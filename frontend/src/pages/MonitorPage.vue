<template>
  <div class="min-h-screen bg-[#050816] px-6 py-8 text-slate-100 lg:px-8">
    <div class="mx-auto max-w-6xl space-y-6">
      <header class="rounded-[28px] border border-white/10 bg-slate-950/75 p-6 backdrop-blur-xl">
        <div class="text-xs uppercase tracking-[0.25em] text-slate-400">任务监控面板</div>
        <h1 class="mt-3 font-[ui-serif] text-4xl text-white">请求链路实时可视化</h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-300">这个页面用于查看请求是否进入等待、是否被回答、是否超时，以及当前后端是否可用。</p>
      </header>

      <section class="grid gap-6 lg:grid-cols-3">
        <div class="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div class="text-xs uppercase tracking-[0.25em] text-slate-400">健康状态</div>
          <div class="mt-3 text-3xl font-semibold text-white">{{ store.healthStatus }}</div>
          <div class="mt-2 text-sm text-slate-400">{{ store.apiBaseReady ? '后端可连接' : '后端离线或未启动' }}</div>
        </div>
        <div class="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div class="text-xs uppercase tracking-[0.25em] text-slate-400">待处理任务</div>
          <div class="mt-3 text-3xl font-semibold text-white">{{ store.tasks.length }}</div>
          <div class="mt-2 text-sm text-slate-400">任务以内存队列方式实时刷新</div>
        </div>
        <div class="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div class="text-xs uppercase tracking-[0.25em] text-slate-400">最近错误</div>
          <div class="mt-3 text-sm leading-6 text-slate-200">{{ store.error || '暂无错误' }}</div>
        </div>
      </section>

      <section class="rounded-[28px] border border-white/10 bg-slate-950/75 p-6 backdrop-blur-xl">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs uppercase tracking-[0.25em] text-slate-400">请求时间线</div>
            <h2 class="mt-2 text-xl font-semibold text-white">API 生命周期</h2>
          </div>
          <button class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10" @click="refresh">刷新</button>
        </div>
        <div class="mt-6 space-y-4">
          <div v-for="step in steps" :key="step.title" class="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div class="mt-1 h-3 w-3 rounded-full bg-cyan-400"></div>
            <div>
              <div class="font-medium text-white">{{ step.title }}</div>
              <p class="mt-1 text-sm leading-6 text-slate-300">{{ step.description }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useConsoleStore } from '@/stores/console'

const store = useConsoleStore()
const steps = [
  {
    title: '请求进入',
    description: '用户在控制台首页提交 OpenAI 风格请求，后端创建一个待回答任务。',
  },
  {
    title: '任务排队',
    description: '回答者工作台拉取任务列表，等待真人填写答案。',
  },
  {
    title: '答案提交',
    description: '回答者提交答案后，API 立即解析并返回 JSON 或 SSE 结果。',
  },
  {
    title: '状态回收',
    description: '响应完成后，任务从待处理列表中清除，监控面板展示最新状态。',
  },
]

async function refresh() {
  await Promise.all([store.loadHealth(), store.loadTasks()])
}

onMounted(refresh)
</script>
