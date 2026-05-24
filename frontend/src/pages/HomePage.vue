<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Bot, ClipboardList, FileJson2, Radar, Send, Sparkles } from 'lucide-vue-next'
import { useConsoleStore } from '@/stores/console'

const router = useRouter()
const store = useConsoleStore()

const model = ref('human-brain-001')
const userQuestion = ref('请用一句话解释 brain2api 的价值。')
const streamMode = ref(false)
const timeoutMs = ref(3000)
const respondentId = ref('human')
const answerText = ref('')
const activeTab = ref<'json' | 'stream'>('json')

const responsePreview = computed(() => {
  if (store.recentResponse) {
    return JSON.stringify(store.recentResponse, null, 2)
  }
  return store.responseText || '等待请求返回。'
})

async function refresh() {
  await Promise.all([store.loadHealth(), store.loadTasks()])
}

async function submitRequest() {
  await store.sendCompletion({
    model: model.value,
    messages: [
      { role: 'system', content: '你是 brain2api 的控制台示例。' },
      { role: 'user', content: userQuestion.value },
    ],
    stream: streamMode.value,
    timeout_ms: timeoutMs.value,
  })
}

async function submitAnswer(taskId: string) {
  await store.submitTaskAnswer(taskId, answerText.value, respondentId.value)
  answerText.value = ''
}

onMounted(refresh)
</script>

<template>
  <div class="min-h-screen bg-[#050816] text-slate-100">
    <div class="pointer-events-none fixed inset-0 overflow-hidden">
      <div class="absolute left-[-10%] top-[-10%] h-[34rem] w-[34rem] rounded-full bg-cyan-500/20 blur-3xl" />
      <div class="absolute right-[-8%] top-[18%] h-[28rem] w-[28rem] rounded-full bg-amber-400/10 blur-3xl" />
      <div class="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20" />
    </div>

    <div class="relative mx-auto flex min-h-screen max-w-[1600px] flex-col px-6 py-6 lg:px-8">
      <header class="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div class="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
            <Sparkles class="h-3.5 w-3.5" />
            OpenAI 风格的人类问答控制台
          </div>
          <h1 class="font-[ui-serif] text-4xl tracking-tight text-white lg:text-6xl">brain2api</h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-300 lg:text-base">
            把问题发给真人，把结果以 OpenAI 兼容格式返回。这个前端把请求、回答和监控放在同一个工作台里。
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm lg:min-w-[360px]">
          <div class="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div class="text-slate-400">后端状态</div>
            <div class="mt-1 flex items-center gap-2 font-medium">
              <span class="h-2.5 w-2.5 rounded-full" :class="store.apiBaseReady ? 'bg-emerald-400' : 'bg-rose-400'" />
              {{ store.healthStatus }}
            </div>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div class="text-slate-400">待处理任务</div>
            <div class="mt-1 text-lg font-semibold text-white">{{ store.tasks.length }}</div>
          </div>
        </div>
      </header>

      <main class="mt-8 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <section class="space-y-6">
          <div class="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div class="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-cyan-200/80">
                  <Bot class="h-4 w-4" /> 控制台首页
                </div>
                <h2 class="mt-2 text-2xl font-semibold text-white">构造 OpenAI 风格请求</h2>
              </div>
              <div class="flex flex-wrap gap-2">
                <button class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10" @click="router.push('/answerer')">回答者工作台</button>
                <button class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10" @click="router.push('/monitor')">任务监控</button>
                <button class="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300" @click="submitRequest">
                  发起请求
                </button>
              </div>
            </div>

            <div class="mt-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <div class="space-y-4">
                <label class="block">
                  <span class="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">问题内容</span>
                  <textarea v-model="userQuestion" class="h-40 w-full rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50" placeholder="输入你的问题"></textarea>
                </label>
                <div class="grid gap-4 md:grid-cols-3">
                  <label class="block">
                    <span class="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">模型</span>
                    <input v-model="model" class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-400/50" />
                  </label>
                  <label class="block">
                    <span class="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">超时（ms）</span>
                    <input v-model.number="timeoutMs" type="number" class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-400/50" />
                  </label>
                  <label class="flex h-full items-end gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    <input v-model="streamMode" type="checkbox" class="h-4 w-4 rounded border-white/20 bg-white/5 text-cyan-400" />
                    <span>启用流式返回</span>
                  </label>
                </div>
              </div>

              <div class="rounded-[24px] border border-white/10 bg-black/30 p-4">
                <div class="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-slate-400">
                  <span>请求预览</span>
                  <span class="rounded-full border border-white/10 px-2 py-1 text-[10px]">POST /v1/chat/completions</span>
                </div>
                <pre class="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-300">{{ JSON.stringify({ model, messages: [{ role: 'system', content: '你是 brain2api 的控制台示例。' }, { role: 'user', content: userQuestion }], stream: streamMode, timeout_ms: timeoutMs }, null, 2) }}</pre>
              </div>
            </div>
          </div>

          <div class="grid gap-6 lg:grid-cols-2">
            <div class="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs uppercase tracking-[0.25em] text-slate-400">响应预览</div>
                  <h3 class="mt-2 text-xl font-semibold text-white">{{ streamMode ? 'SSE 片段' : 'JSON completion' }}</h3>
                </div>
                <div class="flex rounded-full border border-white/10 bg-white/5 p-1 text-xs">
                  <button class="rounded-full px-3 py-1 transition" :class="activeTab === 'json' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'" @click="activeTab = 'json'">JSON</button>
                  <button class="rounded-full px-3 py-1 transition" :class="activeTab === 'stream' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'" @click="activeTab = 'stream'">Stream</button>
                </div>
              </div>
              <pre v-if="activeTab === 'json'" class="mt-4 max-h-[420px] overflow-auto rounded-3xl bg-slate-950 p-4 text-xs leading-6 text-slate-300">{{ responsePreview }}</pre>
              <div v-else class="mt-4 max-h-[420px] space-y-2 overflow-auto rounded-3xl bg-slate-950 p-4 text-xs leading-6 text-slate-300">
                <div v-for="(line, index) in store.streamLog" :key="index" class="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">{{ line }}</div>
                <div v-if="store.streamLog.length === 0" class="text-slate-500">等待流式响应。</div>
              </div>
              <div class="mt-4 flex items-center gap-3 text-sm text-slate-400">
                <span class="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1"><FileJson2 class="h-4 w-4" /> {{ store.loadingResponse ? '请求中' : '已就绪' }}</span>
                <span class="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1"><Send class="h-4 w-4" /> {{ store.error || '无错误' }}</span>
              </div>
            </div>

            <div class="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs uppercase tracking-[0.25em] text-slate-400">最近任务</div>
                  <h3 class="mt-2 text-xl font-semibold text-white">回答者队列</h3>
                </div>
                <button class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10" @click="store.loadTasks()">刷新</button>
              </div>
              <div class="mt-4 space-y-3">
                <div v-for="task in store.tasks" :key="task.id" class="rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/30 hover:bg-white/7">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="text-xs text-slate-500">{{ task.id }}</div>
                      <p class="mt-2 text-sm leading-6 text-slate-200">{{ task.question }}</p>
                    </div>
                    <span class="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200">pending</span>
                  </div>
                  <div class="mt-4 flex flex-wrap items-center gap-3">
                    <input v-model="respondentId" class="w-36 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none" placeholder="回答者 ID" />
                    <input v-model="answerText" class="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none" placeholder="填写回答内容" />
                    <button class="rounded-2xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300" @click="submitAnswer(task.id)">提交</button>
                  </div>
                </div>
                <div v-if="!store.tasks.length" class="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">当前没有待回答任务。</div>
              </div>
            </div>
          </div>
        </section>

        <aside class="space-y-6">
          <div class="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl">
            <div class="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400"><Radar class="h-4 w-4" /> 任务监控</div>
            <div class="mt-4 space-y-3 text-sm text-slate-300">
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div class="text-slate-500">健康状态</div>
                <div class="mt-1 font-semibold text-white">{{ store.healthStatus }}</div>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div class="text-slate-500">响应方式</div>
                <div class="mt-1 font-semibold text-white">{{ streamMode ? '流式 SSE' : '单次 completion' }}</div>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div class="text-slate-500">路由导航</div>
                <div class="mt-3 flex flex-col gap-2">
                  <button class="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left transition hover:border-cyan-400/30 hover:bg-white/5" @click="router.push('/answerer')">前往回答者工作台 <ArrowRight class="ml-2 inline h-4 w-4" /></button>
                  <button class="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left transition hover:border-cyan-400/30 hover:bg-white/5" @click="router.push('/monitor')">查看监控面板 <ArrowRight class="ml-2 inline h-4 w-4" /></button>
                  <button class="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left transition hover:border-cyan-400/30 hover:bg-white/5" @click="router.push('/settings')">打开设置页 <ArrowRight class="ml-2 inline h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  </div>
</template>
