import { defineStore } from 'pinia'
import type { ChatCompletionRequest, ChatCompletionResponse, TaskItem } from '@/types/api'
import { createCompletion, createCompletionStream, fetchHealth, fetchTasks, submitAnswer } from '@/utils/api'

interface ConsoleState {
  apiBaseReady: boolean
  healthStatus: string
  tasks: TaskItem[]
  recentResponse: ChatCompletionResponse | null
  responseText: string
  streamLog: string[]
  loadingTasks: boolean
  loadingResponse: boolean
  error: string
}

const defaultMessages = [
  { role: 'system' as const, content: '你是 brain2api 的控制台示例。' },
  { role: 'user' as const, content: '请用一句话解释 brain2api 是什么。' },
]

export const useConsoleStore = defineStore('console', {
  state: (): ConsoleState => ({
    apiBaseReady: false,
    healthStatus: 'unknown',
    tasks: [],
    recentResponse: null,
    responseText: '',
    streamLog: [],
    loadingTasks: false,
    loadingResponse: false,
    error: '',
  }),
  actions: {
    async loadHealth() {
      try {
        const payload = await fetchHealth()
        this.apiBaseReady = payload.ok
        this.healthStatus = payload.service
      } catch (error) {
        this.apiBaseReady = false
        this.healthStatus = 'offline'
        this.error = error instanceof Error ? error.message : '健康检查失败'
      }
    },
    async loadTasks() {
      this.loadingTasks = true
      try {
        this.tasks = await fetchTasks()
      } catch (error) {
        this.error = error instanceof Error ? error.message : '任务加载失败'
      } finally {
        this.loadingTasks = false
      }
    },
    async sendCompletion(payload: ChatCompletionRequest = { model: 'human-brain-001', messages: defaultMessages, timeout_ms: 2000 }) {
      this.loadingResponse = true
      this.error = ''
      this.responseText = ''
      this.streamLog = []
      try {
        if (payload.stream) {
          const response = await createCompletionStream(payload)
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          if (!reader) {
            throw new Error('无法读取流式响应')
          }
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }
            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split('\n\n')
            buffer = parts.pop() ?? ''
            parts.forEach((chunk) => {
              const line = chunk.trim()
              if (!line) {
                return
              }
              this.streamLog.push(line)
              if (line === 'data: [DONE]') {
                return
              }
              if (line.startsWith('data: ')) {
                this.responseText = line.replace(/^data: /, '')
              }
            })
          }
        } else {
          const response = await createCompletion(payload)
          this.recentResponse = response
          this.responseText = response.choices[0]?.message.content ?? ''
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : '请求失败'
      } finally {
        this.loadingResponse = false
      }
    },
    async submitTaskAnswer(id: string, content: string, respondentId: string) {
      await submitAnswer(id, content, respondentId)
      await this.loadTasks()
    },
  },
})
