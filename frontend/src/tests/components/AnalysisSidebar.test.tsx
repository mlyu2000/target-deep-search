import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AnalysisSidebar from '../../components/AnalysisSidebar'
import type { GraphData } from '../../types'

const graph: GraphData = {
  target: 'Acme',
  depth: 1,
  nodes: [{ id: 'a', name: 'Acme', type: 'organization', description: '', images: [], mention_count: 1 }],
  edges: [],
}

describe('AnalysisSidebar', () => {
  it('renders the two analysis buttons and reports entity count', () => {
    render(<AnalysisSidebar graphData={graph} activeView="graph" onSelect={() => {}} />)
    expect(screen.getByText('Competitive Analysis')).toBeInTheDocument()
    expect(screen.getByText('Supply Chain Analysis')).toBeInTheDocument()
    expect(screen.getByText(/1 entities already mapped/)).toBeInTheDocument()
  })

  it('calls onSelect with the chosen view when clicked', () => {
    const onSelect = vi.fn()
    render(<AnalysisSidebar graphData={graph} activeView="graph" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Competitive Analysis'))
    expect(onSelect).toHaveBeenCalledWith('competitive')
    fireEvent.click(screen.getByText('Supply Chain Analysis'))
    expect(onSelect).toHaveBeenCalledWith('supplychain')
  })
})
