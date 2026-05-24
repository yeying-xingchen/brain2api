import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';

function startServer() {
  return new Promise((resolve) => {
    const state = {
      pendingRequests: new Map(),
      waitingResolvers: new Map()
    };

    function nowSeconds() {
      return Math.floor(Date.now() / 1000);
    }

    function readJson(req) {
      return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          if (!body) {
            resolve({});
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error('Invalid JSON'));
          }
        });
        req.on('error', reject);
      });
    }

    function writeJson(res, statusCode, payload) {
      res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(payload));
    }

    function writeSse(res, payload) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    function endSse(res) {
      res.write('data: [DONE]\n\n');
      res.end();
    }

    function createChunk(id, model, content, finishReason = null) {
      return {
        id,
        object: 'chat.completion.chunk',
        created: nowSeconds(),
        model,
        choices: [
          {
            index: 0,
            delta: content ? { role: 'assistant', content } : { role: 'assistant' },
            finish_reason: finishReason
          }
        ]
      };
    }

    function extractQuestion(messages) {
      if (!Array.isArray(messages) || messages.length === 0) {
        return '';
      }
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message && typeof message.content === 'string' && message.content.trim()) {
          return message.content.trim();
        }
      }
      return '';
    }

    function toOpenAIResponse(id, model, content, metadata = {}) {
      return {
        id,
        object: 'chat.completion',
        created: nowSeconds(),
        model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        brain2api: metadata
      };
    }

    function createTask(question, model) {
      const id = `chatcmpl_${Math.random().toString(36).slice(2, 10)}`;
      const task = { id, model, question, status: 'pending', createdAt: Date.now() };
      state.pendingRequests.set(id, task);
      return task;
    }

    function settleTask(id, content, respondentId = 'human') {
      const task = state.pendingRequests.get(id);
      const resolver = state.waitingResolvers.get(id);
      if (!task || !resolver) {
        return null;
      }
      const answer = { id, content, respondentId, answeredAt: Date.now() };
      state.pendingRequests.delete(id);
      state.waitingResolvers.delete(id);
      resolver.resolve({ task, answer });
      return { task, answer };
    }

    function waitForAnswer(id, timeoutMs) {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          state.waitingResolvers.delete(id);
          state.pendingRequests.delete(id);
          resolve(null);
        }, timeoutMs);
        state.waitingResolvers.set(id, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          }
        });
      });
    }

    async function handleCompletion(req, res) {
      const body = await readJson(req);
      const model = typeof body.model === 'string' && body.model ? body.model : 'human-brain-001';
      const question = extractQuestion(body.messages);
      const timeoutMs = Number.isFinite(body.timeout_ms) && body.timeout_ms > 0 ? body.timeout_ms : 30000;
      const stream = body.stream === true;
      if (!question) {
        writeJson(res, 400, {
          error: {
            message: 'messages must include at least one non-empty content field',
            type: 'invalid_request_error',
            code: 'invalid_messages'
          }
        });
        return;
      }
      const task = createTask(question, model);
      const answer = await waitForAnswer(task.id, timeoutMs);
      if (!answer) {
        writeJson(res, 504, {
          error: {
            message: 'No human answered before timeout',
            type: 'human_timeout',
            code: 'human_timeout'
          }
        });
        return;
      }
      if (stream) {
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          connection: 'keep-alive',
          'cache-control': 'no-cache, no-transform'
        });
        writeSse(res, createChunk(task.id, model, answer.answer.content));
        writeSse(res, createChunk(task.id, model, '', 'stop'));
        endSse(res);
        return;
      }
      writeJson(res, 200, toOpenAIResponse(task.id, model, answer.answer.content, {
        answered_by: answer.answer.respondentId,
        latency_ms: answer.answer.answeredAt - task.createdAt,
        question
      }));
    }

    async function handleTaskSubmit(req, res) {
      const body = await readJson(req);
      const id = typeof body.id === 'string' ? body.id : '';
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      if (!id || !content) {
        writeJson(res, 400, {
          error: {
            message: 'id and content are required',
            type: 'invalid_request_error',
            code: 'invalid_payload'
          }
        });
        return;
      }
      const task = state.pendingRequests.get(id);
      const resolver = state.waitingResolvers.get(id);
      if (!task || !resolver) {
        writeJson(res, 404, {
          error: {
            message: 'task not found',
            type: 'invalid_request_error',
            code: 'task_not_found'
          }
        });
        return;
      }
      const answer = {
        id,
        content,
        respondentId: typeof body.respondent_id === 'string' && body.respondent_id ? body.respondent_id : 'human',
        answeredAt: Date.now()
      };
      state.pendingRequests.delete(id);
      state.waitingResolvers.delete(id);
      resolver.resolve({ task, answer });
      writeJson(res, 200, { ok: true, task_id: task.id });
    }

    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') {
        writeJson(res, 200, { ok: true, service: 'brain2api' });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
        await handleCompletion(req, res);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/tasks/submit') {
        await handleTaskSubmit(req, res);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/tasks') {
        writeJson(res, 200, {
          data: Array.from(state.pendingRequests.values()).map((task) => ({
            id: task.id,
            model: task.model,
            question: task.question,
            status: task.status,
            created_at: task.createdAt
          }))
        });
        return;
      }
      writeJson(res, 404, {
        error: { message: 'not found', type: 'invalid_request_error', code: 'not_found' }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

async function requestJson(port, path, method, body) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  return { response, data };
}

test('health endpoint works', async () => {
  const { server, port } = await startServer();
  try {
    const { response, data } = await requestJson(port, '/health', 'GET');
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.service, 'brain2api');
  } finally {
    server.close();
  }
});

test('completion waits for human answer and returns OpenAI style response', async () => {
  const { server, port } = await startServer();
  try {
    const completionPromise = requestJson(port, '/v1/chat/completions', 'POST', {
      model: 'human-brain-001',
      messages: [{ role: 'user', content: '请解释 brain2api 是什么' }],
      timeout_ms: 2000
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const tasksResult = await requestJson(port, '/tasks', 'GET');
    assert.equal(tasksResult.response.status, 200);
    assert.equal(tasksResult.data.data.length, 1);

    const taskId = tasksResult.data.data[0].id;
    await requestJson(port, '/tasks/submit', 'POST', {
      id: taskId,
      content: 'brain2api 是一个把人类回答封装成 OpenAI 风格接口的项目。',
      respondent_id: 'alice'
    });

    const { response, data } = await completionPromise;
    assert.equal(response.status, 200);
    assert.equal(data.object, 'chat.completion');
    assert.equal(data.model, 'human-brain-001');
    assert.equal(data.choices[0].message.role, 'assistant');
    assert.match(data.choices[0].message.content, /brain2api/);
    assert.equal(data.brain2api.answered_by, 'alice');
  } finally {
    server.close();
  }
});

test('completion supports stream mode and returns SSE chunks', async () => {
  const { server, port } = await startServer();
  try {
    const completionPromise = fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'human-brain-001',
        messages: [{ role: 'user', content: '请用一句话解释 brain2api' }],
        stream: true,
        timeout_ms: 2000
      })
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const tasksResult = await requestJson(port, '/tasks', 'GET');
    const taskId = tasksResult.data.data[0].id;
    await requestJson(port, '/tasks/submit', 'POST', {
      id: taskId,
      content: 'brain2api 会把人类回答包装成 OpenAI 风格流式输出。',
      respondent_id: 'bob'
    });

    const response = await completionPromise;
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);

    const text = await response.text();
    assert.match(text, /chat\.completion\.chunk/);
    assert.match(text, /brain2api 会把人类回答包装成 OpenAI 风格流式输出。/);
    assert.match(text, /\[DONE\]/);
  } finally {
    server.close();
  }
});
