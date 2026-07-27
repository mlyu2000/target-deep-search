import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const graph = {
  target: 'HPE',
  depth: 1,
  nodes: [
    { id: 'a', name: 'HPE', type: 'organization', description: 'Enterprise tech.', images: [], mention_count: 10 },
    { id: 'b', name: 'Dell', type: 'organization', description: 'Competitor.', images: [], mention_count: 4 },
  ],
  edges: [{ source: 'a', target: 'b', type: 'competes', strength: 4, description: '', source_urls: [] }],
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

const mocks = vi.hoisted(() => ({
  startSimulate: vi.fn().mockResolvedValue({ task_id: 't1' }),
  getSimulateResult: vi.fn().mockResolvedValue(undefined),
  connectSimulateStream: vi.fn((_id: string, _onStatus: any, _onErr: any, onComplete: any) => {
    onComplete()
    return () => {}
  }),
}))

vi.mock('../../api/client', () => ({
  startSimulate: mocks.startSimulate,
  connectSimulateStream: mocks.connectSimulateStream,
  getSimulateResult: mocks.getSimulateResult,
}))

import WhatIfPanel from '../../components/WhatIfPanel'

describe('WhatIfPanel', () => {
  it('renders scenario input, template chips, round selector and Run', () => {
    render(<WhatIfPanel graph={graph as any} />)
    expect(screen.getByText('What-if Simulation')).toBeInTheDocument()
    expect(screen.getByText(/HPE is acquired by a larger competitor/)).toBeInTheDocument()
    expect(screen.getByText('auto')).toBeInTheDocument()
    expect(screen.getByText('Run Simulation')).toBeInTheDocument()
  })

  it('runs simulation and renders transcript + report', async () => {
    mocks.getSimulateResult.mockResolvedValue(sampleResult)
    render(<WhatIfPanel graph={graph as any} />)
    fireEvent.click(screen.getByText(/HPE is acquired by a larger competitor/))
    fireEvent.click(screen.getByText('Run Simulation'))
    await waitFor(() => expect(mocks.startSimulate).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Contested outcome.')).toBeInTheDocument())
    expect(screen.getByText('We resist.')).toBeInTheDocument()
    expect(screen.getByText('control of roadmap')).toBeInTheDocument()
    expect(screen.getByText('regulatory')).toBeInTheDocument()
  })
})
