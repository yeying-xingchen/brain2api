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

const adminHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>brain2api</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; }
    main { width: min(960px, calc(100vw - 32px)); margin: 40px auto; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    p { color: #94a3b8; }
    button, textarea, input { font: inherit; }
    button { border: 0; border-radius: 10px; padding: 10px 14px; background: #38bdf8; color: #082f49; cursor: pointer; font-weight: 700; }
    button:hover { background: #7dd3fc; }
    .toolbar { display: flex; gap: 12px; align-items: center; margin: 24px 0; }
    .task { border: 1px solid #334155; border-radius: 16px; padding: 18px; margin-bottom: 16px; background: #111827; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 8px; }
    .question { white-space: pre-wrap; margin-bottom: 14px; line-height: 1.6; }
    textarea { box-sizing: border-box; width: 100%; min-height: 120px; border: 1px solid #334155; border-radius: 12px; padding: 12px; background: #020617; color: #e2e8f0; resize: vertical; }
    input { border: 1px solid #334155; border-radius: 10px; padding: 10px; background: #020617; color: #e2e8f0; }
    .answer-row { display: flex; gap: 10px; margin-top: 10px; align-items: center; }
    .answer-row input { width: 180px; }
    .empty { border: 1px dashed #334155; border-radius: 16px; padding: 32px; text-align: center; color: #94a3b8; }
    .status { color: #94a3b8; }
  </style>
</head>
<body>
  <main>
    <h1>brain2api</h1>
    <p>像调用 OpenAI 一样调用真人回答。这里是回答者后台，有问题出现后直接提交答案。</p>
    <div class="toolbar">
      <button id="refresh">刷新任务</button>
      <span class="status" id="status">等待加载</span>
    </div>
    <section id="tasks"></section>
  </main>
  <script>
    const tasksEl = document.querySelector('#tasks');
    const statusEl = document.querySelector('#status');
    const refreshEl = document.querySelector('#refresh');

    async function loadTasks() {
      statusEl.textContent = '加载中';
      const response = await fetch('/tasks');
      const payload = await response.json();
      renderTasks(payload.data ?? []);
      statusEl.textContent = '已更新 ' + new Date().toLocaleTimeString();
    }

    function renderTasks(tasks) {
      if (tasks.length === 0) {
        tasksEl.innerHTML = '<div class="empty">暂无待回答问题</div>';
        return;
      }
      tasksEl.innerHTML = tasks.map((task) => '<article class="task" data-id="' + task.id + '"><div class="meta">' + task.id + ' · ' + task.model + '</div><div class="question"></div><textarea placeholder="输入你的回答"></textarea><div class="answer-row"><input placeholder="回答者 ID" value="human"><button>提交回答</button></div></article>').join('');
      tasks.forEach((task) => {
        const node = tasksEl.querySelector('[data-id="' + task.id + '"]');
        node.querySelector('.question').textContent = task.question;
        node.querySelector('button').addEventListener('click', async () => {
          const content = node.querySelector('textarea').value.trim();
          const respondentId = node.querySelector('input').value.trim() || 'human';
          if (!content) {
            statusEl.textContent = '回答不能为空';
            return;
          }
          const response = await fetch('/tasks/submit', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: task.id, content, respondent_id: respondentId })
          });
          if (response.ok) {
            statusEl.textContent = '已提交 ' + task.id;
            await loadTasks();
          } else {
            const payload = await response.json();
            statusEl.textContent = payload.error?.message ?? '提交失败';
          }
        });
      });
    }

    refreshEl.addEventListener('click', loadTasks);
    loadTasks();
    setInterval(loadTasks, 3000);
  </script>
</body>
</html>`;

function handleAdmin(req, res) {
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8'
  });
  res.end(adminHtml);
}

async function main() {
  const { createServer } = await import('node:http');
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/') {
      handleAdmin(req, res);
      return;
    }
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

