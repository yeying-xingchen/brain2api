import type { ChatCompletionRequest, ChatCompletionResponse, TaskItem } from '@/types/api'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error?.message ?? `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function fetchHealth() {
  return requestJson<{ ok: boolean; service: string }>('/health')
}

export async function fetchTasks() {
  const payload = await requestJson<{ data: TaskItem[] }>('/tasks')
  return payload.data
}

export async function submitAnswer(id: string, content: string, respondentId: string) {
  return requestJson<{ ok: boolean; task_id: string }>('/tasks/submit', {
    method: 'POST',
    body: JSON.stringify({ id, content, respondent_id: respondentId }),
  })
}

export async function createCompletion(payload: ChatCompletionRequest) {
  return requestJson<ChatCompletionResponse>('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createCompletionStream(payload: ChatCompletionRequest) {
  return fetch(`${API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      stream: true,
    }),
  })
}
