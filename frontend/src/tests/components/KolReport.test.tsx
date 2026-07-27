import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import KolReport from '../../components/KolReport'
import { buildKolReport } from '../../analysis/kol'
import type { GraphData } from '../../types'

const graph: GraphData = {
  target: 'Center',
  depth: 1,
  nodes: [
    { id: 'center', name: 'Center', type: 'organization', description: '', images: [], mention_count: 10 },
    { id: 'a', name: 'Alpha', type: 'person', description: '', images: [], mention_count: 2 },
  ],
  edges: [
    { source: 'center', target: 'a', type: 'employs', strength: 5, description: '', source_urls: [] },
  ],
}

describe('KolReport', () => {
  it('renders the ranked list with #1 entity and metrics', () => {
    render(<KolReport report={buildKolReport(graph)} />)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('Center')).toBeInTheDocument()
    expect(screen.getByText(/most impactful/i)).toBeInTheDocument()
    // metric chips present (may appear for multiple entities)
    expect(screen.getAllByText(/deg/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/pr/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/btw/).length).toBeGreaterThan(0)
  })
})
