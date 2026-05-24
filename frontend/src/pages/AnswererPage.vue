<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ClipboardList, Send, UserCog } from 'lucide-vue-next'
import { useConsoleStore } from '@/stores/console'

const store = useConsoleStore()
const respondentId = ref('human')
const draft = ref('')

async function submit(taskId: string) {
  await store.submitTaskAnswer(taskId, draft.value, respondentId.value)
  draft.value = ''
}

onMounted(() => {
  store.loadTasks()
})
</script>

<template>
  <div class="min-h-screen bg-[#050816] px-6 py-8 text-slate-100 lg:px-8">
    <div class="mx-auto max-w-6xl space-y-6">
      <header class="rounded-[28px] border border-white/10 bg-slate-950/75 p-6 backdrop-blur-xl">
        <div class="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-cyan-200">
          <UserCog class="h-4 w-4" /> 回答者工作台
        </div>
        <h1 class="mt-3 font-[ui-serif] text-4xl text-white">任务来了，就直接回答</h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-300">这里把待回答问题整理成卡片，回答者只需要填写内容并提交，就能立刻唤醒等待中的 OpenAI 兼容请求。</p>
      </header>

      <section class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div class="space-y-4">
          <article v-for="task in store.tasks" :key="task.id" class="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="text-xs text-slate-500">{{ task.id }}</div>
                <h2 class="mt-2 text-lg font-semibold text-white">{{ task.question }}</h2>
              </div>
              <span class="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200">pending</span>
            </div>
            <div class="mt-5 space-y-3">
              <input v-model="respondentId" class="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none" placeholder="回答者 ID" />
              <textarea v-model="draft" class="min-h-40 w-full rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none" placeholder="写下你的回答"></textarea>
              <button class="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300" @click="submit(task.id)">
                <Send class="h-4 w-4" /> 提交回答
              </button>
            </div>
          </article>
          <div v-if="!store.tasks.length" class="rounded-[28px] border border-dashed border-white/10 bg-white/5 p-10 text-center text-sm text-slate-400">当前没有待处理任务。</div>
        </div>

        <aside class="space-y-4">
          <div class="rounded-[28px] border border-white/10 bg-slate-950/75 p-6 backdrop-blur-xl">
            <div class="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400"><ClipboardList class="h-4 w-4" /> 任务概览</div>
            <div class="mt-4 space-y-3 text-sm text-slate-300">
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">待处理任务：{{ store.tasks.length }}</div>
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">后端健康：{{ store.healthStatus }}</div>
              <button class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10" @click="store.loadTasks()">刷新任务列表</button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  </div>
</template>
