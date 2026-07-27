import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const graph = {
  target: 'HPE',
  depth: 1,
  nodes: [
    { id: 'a', name: 'HPE', type: 'organization', description: 'Enterprise tech.', images: [], mention_count: 10 },
    { id: 'b', name: 'Dell', type: 'organization', description: 'Competitor.', images: [], mention_count: 4 },
    { id: 'c', name: 'Antonio Neri', type: 'person', description: 'CEO.', images: [], mention_count: 6 },
    { id: 'd', name: 'GreenLake', type: 'product', description: 'Cloud.', images: [], mention_count: 3 },
  ],
  edges: [
    { source: 'c', target: 'a', type: 'ceo_of', strength: 5, description: '', source_urls: [] },
    { source: 'a', target: 'b', type: 'competes', strength: 4, description: '', source_urls: [] },
    { source: 'a', target: 'd', type: 'owns', strength: 3, description: '', source_urls: [] },
  ],
}

const sampleResult = {
  scenario: 'What if HPE is acquired?',
  agents: [
    { id: 'a', name: 'HPE', type: 'organization', bio: 'b', persona: 'p', stance: 'neutral', influence_weight: 1, traits_sourced: [], inferred: [], enriched: true },
    { id: 'b', name: 'Dell', type: 'organization', bio: 'b', persona: 'p', stance: 'neutral', influence_weight: 1, traits_sourced: [], inferred: [], enriched: true },
  ],
  rounds: [
    { round: 1, statements: [
      { round: 1, agent_id: 'a', agent_name: 'HPE', reaction: 'oppose', statement: 'We resist.', stance: 'oppose' },
      { round: 1, agent_id: 'b', agent_name: 'Dell', reaction: 'support', statement: 'We welcome.', stance: 'support' },
    ] },
  ],
  report: {
    summary: 'Contested outcome.',
    positions: [{ agent: 'HPE', final_stance: 'oppose', key_point: 'defends independence' }],
    agreement: [],
    conflict: ['control of roadmap'],
    risks: ['regulatory'],
    overall_outcome: 'contested',
  },
}

const startSimulate = vi.fn().mockResolvedValue({ task_id: 't1' })
const getSimulateResult = vi.fn().mockResolvedValue(sampleResult)
const connectSimulateStream = vi.fn((_id: string, _onStatus: any, _onErr: any, onComplete: any) => {
  onComplete()
  return () => {}
})

vi.mock('../../api/client', () => ({
  startSimulate,
  connectSimulateStream,
  getSimulateResult,
}))

import WhatIfPanel from '../../components/WhatIfPanel'

describe('WhatIfPanel', () => {
  it('renders top-K agent preview cards with rank (no bar/reason) before run', () => {
    const setState = vi.fn()
    render(<WhatIfPanel graph={graph as any} state={{ scenario: '', rounds: 3, autoStable: false, running: false, progress: '', roundLabel: '', result: null, error: '' }} setState={setState} />)
    const cards = document.querySelectorAll('.whatif-agent-card')
    expect(cards.length).toBeGreaterThan(0)
    expect(screen.getByText('#1')).toBeInTheDocument()
    // bars/reason removed in what-if tab
    expect(document.querySelectorAll('.whatif-influence-bar').length).toBe(0)
    expect(document.querySelectorAll('.whatif-agent-reason').length).toBe(0)
    expect(screen.getByText('Run Simulation')).toBeInTheDocument()
  })

  it('runs simulation, shows transcript + report, and agent detail is expandable', async () => {
    const setState = vi.fn()
    render(<WhatIfPanel graph={graph as any} state={{ scenario: '', rounds: 3, autoStable: false, running: false, progress: '', roundLabel: '', result: null, error: '' }} setState={setState} />)
    fireEvent.click(screen.getByText(/HPE is acquired by a larger competitor/))
    fireEvent.click(screen.getByText('Run Simulation'))
    await waitFor(() => expect(startSimulate).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Contested outcome.')).toBeInTheDocument())
    // result agent rows expandable
    const toggle = document.querySelector('.whatif-agent-toggle') as HTMLButtonElement
    expect(toggle).toBeTruthy()
    fireEvent.click(toggle)
    await waitFor(() => expect(screen.getByText(/Bio:/)).toBeInTheDocument())
    expect(screen.getByText('We resist.')).toBeInTheDocument()
  })
})
