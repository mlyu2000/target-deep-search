import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CompareMemo from '../../components/CompareMemo'
import type { SavedSimRunFull } from '../../types'

function run(id: string, implications: string, postures: any[]): SavedSimRunFull {
  return {
    run_id: id, target: 'A', scenario: 's', rounds: 1, agents_count: 1, enriched_count: 0,
    result: { agents: [], rounds: [], report: {
      implications_for_target: implications,
      strategic_postures: postures,
      risks: [{ risk: 'r', severity: 'low' }],
      recommended_actions: ['act'],
    } } as any,
  }
}

describe('CompareMemo', () => {
  it('shows Δ differs when implications differ between runs', () => {
    const a = run('1', 'Alpha loses share', [{ agent: 'X', stance: 'oppose', move: 'm1' }])
    const b = run('2', 'Alpha gains share', [{ agent: 'X', stance: 'oppose', move: 'm1' }])
    render(<CompareMemo a={a} b={b} />)
    expect(screen.getAllByText(/Δ differs/).length).toBeGreaterThan(0)
  })

  it('shows no Δ differs when runs are identical', () => {
    const a = run('1', 'Same', [{ agent: 'X', stance: 'oppose', move: 'm1' }])
    const b = run('2', 'Same', [{ agent: 'X', stance: 'oppose', move: 'm1' }])
    render(<CompareMemo a={a} b={b} />)
    expect(screen.queryByText(/Δ differs/)).toBeNull()
  })

  it('flags a changed agent posture across runs', () => {
    const a = run('1', 'Same', [{ agent: 'X', stance: 'oppose', move: 'm1' }])
    const b = run('2', 'Same', [{ agent: 'X', stance: 'support', move: 'm2' }])
    render(<CompareMemo a={a} b={b} />)
    expect(screen.getAllByText(/Δ/).length).toBeGreaterThan(0)
  })
})
