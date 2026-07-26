import { describe, it, expect, vi, afterEach } from 'vitest'

describe('API Client', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('buildGraph sends correct request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ task_id: 'abc-123' }),
    })
    globalThis.fetch = mockFetch

    const { buildGraph } = await import('../../api/client')
    const result = await buildGraph('Tesla', 2)

    expect(mockFetch).toHaveBeenCalledWith('/api/graph/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'Tesla', depth: 2, max_pages: 10 }),
    })
    expect(result.task_id).toBe('abc-123')
  })

  it('buildGraph throws ApiError on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error'),
    })

    const { buildGraph, ApiError } = await import('../../api/client')
    await expect(buildGraph('Tesla', 2)).rejects.toThrow(ApiError)
  })

  it('getResult fetches correct URL', async () => {
    const mockData = { target: 'Tesla', depth: 1, nodes: [], edges: [] }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { getResult } = await import('../../api/client')
    const result = await getResult('abc-123')
    expect(result).toEqual(mockData)
  })

  it('listSessions returns sessions', async () => {
    const mockData = { sessions: [{ id: '1', target: 'Tesla', depth: 2, status: 'complete' }] }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { listSessions } = await import('../../api/client')
    const result = await listSessions()
    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0].target).toBe('Tesla')
  })

  it('deleteSession sends DELETE', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    })

    const { deleteSession } = await import('../../api/client')
    const result = await deleteSession('session-1')
    expect(result.ok).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/sessions/session-1', { method: 'DELETE', headers: { 'Content-Type': 'application/json' } })
  })
})
