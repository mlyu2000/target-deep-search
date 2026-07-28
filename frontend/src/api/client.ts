import type { BuildResponse, GraphData, Session, StatusUpdate, AnalyzerMode, WhatIfReport, SavedSimRunSummary, SavedSimRunFull } from '../types'

const API_BASE = '/api'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, message)
    this.name = 'NotFoundError'
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    if (res.status === 404) throw new NotFoundError(await res.text())
    throw new ApiError(res.status, await res.text())
  }
  return res.json()
}

export async function buildGraph(target: string, depth: number, maxPages = 10, categories?: string[]): Promise<BuildResponse> {
  return request<BuildResponse>('/graph/build', {
    method: 'POST',
    body: JSON.stringify({ target, depth, max_pages: maxPages, categories: categories?.length ? categories : undefined }),
  })
}

export async function analyzeGraph(target: string, depth: number, mode: AnalyzerMode, maxPages = 10, categories?: string[]): Promise<BuildResponse> {
  return request<BuildResponse>('/graph/analyze', {
    method: 'POST',
    body: JSON.stringify({ target, depth, mode, max_pages: maxPages, categories: categories?.length ? categories : undefined }),
  })
}

export async function getResult(taskId: string): Promise<GraphData> {
  return request<GraphData>(`/graph/result/${taskId}`)
}

export function connectStatusStream(
  taskId: string,
  onStatus: (update: StatusUpdate) => void,
  onError: (error: Error) => void,
  onComplete: () => void,
): () => void {
  const eventSource = new EventSource(`${API_BASE}/graph/status/${taskId}`)

  eventSource.addEventListener('status', (event) => {
    try {
      const data: StatusUpdate = JSON.parse(event.data)
      onStatus(data)
      if (data.status === 'complete' || data.status === 'error') {
        eventSource.close()
        onComplete()
      }
    } catch (e) {
      console.error('Failed to parse SSE event:', e)
    }
  })

  eventSource.onerror = () => {
    const error = new Error('SSE connection failed')
    onError(error)
    eventSource.close()
  }

  return () => {
    eventSource.close()
  }
}

export async function listSessions(): Promise<{ sessions: Session[] }> {
  return request<{ sessions: Session[] }>('/sessions')
}

export async function clearSessions(): Promise<{ ok: boolean; deleted: number }> {
  return request<{ ok: boolean; deleted: number }>('/sessions', { method: 'DELETE' })
}

export async function deleteSession(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/sessions/${id}`, { method: 'DELETE' })
}

export function exportSession(id: string): void {
  window.open(`${API_BASE}/sessions/${id}/export`, '_blank')
}

export interface SimulateRequest {
  graph: GraphData
  scenario: string
  top_k?: number
  rounds?: number
  until_stable?: boolean
  enrich?: boolean
}

export interface SimulateResponse {
  task_id: string
}

export async function startSimulate(req: SimulateRequest): Promise<SimulateResponse> {
  return request<SimulateResponse>('/simulate', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export function connectSimulateStream(
  taskId: string,
  onStatus: (update: StatusUpdate) => void,
  onError: (error: Error) => void,
  onComplete: () => void,
): () => void {
  const eventSource = new EventSource(`${API_BASE}/simulate/status/${taskId}`)

  eventSource.addEventListener('status', (event) => {
    try {
      const data: StatusUpdate = JSON.parse(event.data)
      onStatus(data)
      if (data.status === 'complete' || data.status === 'error') {
        eventSource.close()
        onComplete()
      }
    } catch (e) {
      console.error('Failed to parse SSE event:', e)
    }
  })

  eventSource.onerror = () => {
    const error = new Error('SSE connection failed')
    onError(error)
    eventSource.close()
  }

  return () => {
    eventSource.close()
  }
}

export async function getSimulateResult(taskId: string): Promise<WhatIfReport> {
  return request<WhatIfReport>(`/simulate/result/${taskId}`)
}

export async function listSavedRuns(): Promise<{ runs: SavedSimRunSummary[] }> {
  return request<{ runs: SavedSimRunSummary[] }>('/simulate/runs')
}

export async function getSavedRun(runId: string): Promise<SavedSimRunFull> {
  return request<SavedSimRunFull>(`/simulate/runs/${runId}`)
}

export async function deleteSavedRun(runId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/simulate/runs/${runId}`, { method: 'DELETE' })
}

export function exportSavedRun(runId: string): void {
  window.open(`${API_BASE}/simulate/runs/${runId}/export`, '_blank')
}
