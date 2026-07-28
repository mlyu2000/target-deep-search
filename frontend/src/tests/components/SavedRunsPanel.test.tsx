import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SavedRunsPanel from '../../components/SavedRunsPanel'

vi.mock('../../api/client', () => {
  const runs = [
    { run_id: 'r1', target: 'A', scenario: 's1', rounds: 1, agents_count: 1, enriched_count: 0 },
    { run_id: 'r2', target: 'B', scenario: 's2', rounds: 1, agents_count: 1, enriched_count: 0 },
  ]
  const full = (id: string, implications: string, stance: string): any => ({
    run_id: id, target: 'A', scenario: 's', rounds: 1, agents_count: 1, enriched_count: 0,
    result: { agents: [], rounds: [], report: {
      implications_for_target: implications,
      strategic_postures: [{ agent: 'X', stance, move: 'm' }],
      risks: [{ risk: 'r', severity: 'low' }],
      recommended_actions: ['act'],
    } },
  })
  return {
    listSavedRuns: vi.fn().mockResolvedValue({ runs }),
    getSavedRun: vi.fn((id: string) => Promise.resolve(id === 'r1' ? full('r1', 'loses', 'oppose') : full('r2', 'gains', 'support'))),
    deleteSavedRun: vi.fn().mockResolvedValue({ ok: true }),
    exportSavedRun: vi.fn(),
  }
})

describe('SavedRunsPanel', () => {
  it('has a Close button that returns to analysis (panel hides)', () => {
    const { container } = render(<SavedRunsPanel onClose={() => {}} />)
    expect(container.querySelector('.saved-close')).toBeTruthy()
  })

  it('opens detail and Back to list returns to hint', async () => {
    render(<SavedRunsPanel onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('s1')).toBeInTheDocument())
    fireEvent.click(screen.getByText('s1'))
    await waitFor(() => expect(screen.getByText(/Back to list/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Back to list/))
    await waitFor(() => expect(screen.getByText(/Select a run to view/)).toBeInTheDocument())
  })

  it('compares two runs and shows 2 columns + diff badges + clear button', async () => {
    render(<SavedRunsPanel onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('s1')).toBeInTheDocument())
    const compares = screen.getAllByText('Compare')
    fireEvent.click(compares[0])
    fireEvent.click(compares[1])
    await waitFor(() => expect(document.querySelectorAll('.compare-col').length).toBe(2))
    expect(document.querySelectorAll('.diff-badge').length).toBeGreaterThan(0)
    expect(screen.getByText('Clear compare')).toBeInTheDocument()
    expect(screen.getByText(/Back to list/)).toBeInTheDocument()
  })
})
