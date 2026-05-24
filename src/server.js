const pendingRequests = new Map();
const waitingResolvers = new Map();

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
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
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(payload));
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
        message: {
          role: 'assistant',
          content
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    },
    brain2api: metadata
  };
}

function createTask(question, model) {
  const id = `chatcmpl_${Math.random().toString(36).slice(2, 10)}`;
  const task = {
    id,
    model,
    question,
    status: 'pending',
    createdAt: Date.now()
  };
  pendingRequests.set(id, task);
  return task;
}

function settleTask(id, content, respondentId = 'human') {
  const task = pendingRequests.get(id);
  const resolver = waitingResolvers.get(id);
  if (!task || !resolver) {
    return null;
  }
  const answer = {
    id,
    content,
    respondentId,
    answeredAt: Date.now()
  };
  pendingRequests.delete(id);
  waitingResolvers.delete(id);
  resolver.resolve({ task, answer });
  return { task, answer };
}

function waitForAnswer(id, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waitingResolvers.delete(id);
      pendingRequests.delete(id);
      resolve(null);
    }, timeoutMs);
    waitingResolvers.set(id, {
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
  const answerPromise = waitForAnswer(task.id, timeoutMs);
  const answer = await answerPromise;
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
  const result = settleTask(id, content, typeof body.respondent_id === 'string' && body.respondent_id ? body.respondent_id : 'human');
  if (!result) {
    writeJson(res, 404, {
      error: {
        message: 'task not found',
        type: 'invalid_request_error',
        code: 'task_not_found'
      }
    });
    return;
  }
  writeJson(res, 200, {
    ok: true,
    task_id: result.task.id
  });
}

function handleListTasks(req, res) {
  writeJson(res, 200, {
    data: Array.from(pendingRequests.values()).map((task) => ({
      id: task.id,
      model: task.model,
      question: task.question,
      status: task.status,
      created_at: task.createdAt
    }))
  });
}

function handleHealth(req, res) {
  writeJson(res, 200, {
    ok: true,
    service: 'brain2api'
  });
}

async function main() {
  const { createServer } = await import('node:http');
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') {
      handleHealth(req, res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      try {
        await handleCompletion(req, res);
      } catch (error) {
        writeJson(res, 500, {
          error: {
            message: error instanceof Error ? error.message : 'internal error',
            type: 'internal_server_error',
            code: 'internal_error'
          }
        });
      }
      return;
    }
    if (req.method === 'POST' && url.pathname === '/tasks/submit') {
      try {
        await handleTaskSubmit(req, res);
      } catch (error) {
        writeJson(res, 500, {
          error: {
            message: error instanceof Error ? error.message : 'internal error',
            type: 'internal_server_error',
            code: 'internal_error'
          }
        });
      }
      return;
    }
    if (req.method === 'GET' && url.pathname === '/tasks') {
      handleListTasks(req, res);
      return;
    }
    writeJson(res, 404, {
      error: {
        message: 'not found',
        type: 'invalid_request_error',
        code: 'not_found'
      }
    });
  });

  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => {
    console.log(`brain2api listening on http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

