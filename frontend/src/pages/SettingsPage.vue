<script setup lang="ts">
import { ref } from 'vue'
import { Settings2, SlidersHorizontal } from 'lucide-vue-next'

const defaultModel = ref('human-brain-001')
const defaultTimeout = ref(3000)
const enableStream = ref(true)
const theme = ref('nocturne')
</script>

<template>
  <div class="min-h-screen bg-[#050816] px-6 py-8 text-slate-100 lg:px-8">
    <div class="mx-auto max-w-4xl space-y-6">
      <header class="rounded-[28px] border border-white/10 bg-slate-950/75 p-6 backdrop-blur-xl">
        <div class="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400"><Settings2 class="h-4 w-4" /> 系统设置</div>
        <h1 class="mt-3 font-[ui-serif] text-4xl text-white">默认参数与外观偏好</h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-300">这里预留给未来的账号配置、主题切换和默认请求参数管理。当前版本先提供可视化占位与设置草案。</p>
      </header>

      <section class="grid gap-6 md:grid-cols-2">
        <div class="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div class="text-xs uppercase tracking-[0.25em] text-slate-400">默认请求参数</div>
          <div class="mt-4 space-y-4">
            <label class="block text-sm text-slate-300">
              <span class="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-500">默认模型</span>
              <input v-model="defaultModel" class="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none" />
            </label>
            <label class="block text-sm text-slate-300">
              <span class="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-500">默认超时（ms）</span>
              <input v-model.number="defaultTimeout" type="number" class="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none" />
            </label>
            <label class="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
              <input v-model="enableStream" type="checkbox" class="h-4 w-4 rounded border-white/20 bg-white/5 text-cyan-400" />
              默认启用流式模式
            </label>
          </div>
        </div>

        <div class="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div class="text-xs uppercase tracking-[0.25em] text-slate-400">主题偏好</div>
          <div class="mt-4 rounded-3xl border border-white/10 bg-slate-950/70 p-5">
            <div class="flex items-center gap-2 text-sm text-slate-300"><SlidersHorizontal class="h-4 w-4" /> 当前主题</div>
            <div class="mt-2 text-2xl font-semibold text-white">{{ theme }}</div>
            <p class="mt-2 text-sm leading-6 text-slate-400">默认采用夜间编辑器风格，后续可扩展为浅色、对比增强或品牌主题。</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
