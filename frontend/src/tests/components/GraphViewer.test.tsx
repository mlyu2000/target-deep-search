import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { useState } from 'react'
import GraphViewer from '../../components/GraphViewer'
import type { GraphData } from '../../types'

const mockData: GraphData = {
  target: 'TestCo',
  depth: 1,
  nodes: [
    { id: 'testco', name: 'TestCo', type: 'organization', description: '', images: [], mention_count: 1 },
    { id: 'alice', name: 'Alice', type: 'person', description: '', images: [], mention_count: 2 },
    { id: 'prod', name: 'Widget', type: 'product', description: '', images: [], mention_count: 1 },
    { id: 'nyc', name: 'New York', type: 'location', description: '', images: [], mention_count: 1 },
  ],
  edges: [
    { source: 'alice', target: 'testco', type: 'employs', strength: 5, description: '', source_urls: [] },
    { source: 'testco', target: 'prod', type: 'owns', strength: 4, description: '', source_urls: [] },
    { source: 'testco', target: 'nyc', type: 'located_in', strength: 3, description: '', source_urls: [] },
  ],
}

function countCircles(container: HTMLElement): number {
  return container.querySelectorAll('svg circle').length
}

describe('GraphViewer legend filter', () => {
  const ALL = ['person', 'organization', 'product', 'location', 'technology']

  // Harness mirrors App.tsx: owns activeTypes state and passes it down.
  function Harness({ initial = null }: { initial?: Set<string> | null }) {
    const [activeTypes, setActiveTypes] = useState<Set<string> | null>(initial)
    const toggleType = (t: string) => {
      const all = new Set(ALL)
      const current = activeTypes ?? all
      const next = new Set(current)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      setActiveTypes(next.size === all.size ? null : (next.size === 0 ? new Set<string>() : next))
    }
    return <GraphViewer data={mockData} onNodeClick={() => {}} selectedNodeId={null}
      activeTypes={activeTypes ?? undefined} onToggleType={toggleType} />
  }

  it('hides entities of a deselected type', async () => {
    const { container } = render(<Harness />)
    await waitFor(() => expect(countCircles(container)).toBe(4))
    fireEvent.click(screen.getByTitle('Hide person'))
    await waitFor(() => expect(countCircles(container)).toBe(3))
    expect(screen.getByTitle('Show person')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Hide product'))
    await waitFor(() => expect(countCircles(container)).toBe(2))
  })

  it('restores all entities when re-selected back to full set', async () => {
    const { container } = render(<Harness />)
    await waitFor(() => expect(countCircles(container)).toBe(4))
    fireEvent.click(screen.getByTitle('Hide person'))
    await waitFor(() => expect(countCircles(container)).toBe(3))
    fireEvent.click(screen.getByTitle('Show person'))
    await waitFor(() => expect(countCircles(container)).toBe(4))
  })

  it('calls onToggleType with the type when clicked', () => {
    const toggled: string[] = []
    render(
      <GraphViewer
        data={mockData}
        onNodeClick={() => {}}
        selectedNodeId={null}
        onToggleType={(t) => toggled.push(t)}
      />,
    )
    fireEvent.click(screen.getByTitle('Hide location'))
    expect(toggled).toContain('location')
  })

  it('respects a controlled activeTypes prop', async () => {
    const { container } = render(
      <GraphViewer
        data={mockData}
        onNodeClick={() => {}}
        selectedNodeId={null}
        activeTypes={new Set(['organization', 'person'])}
      />,
    )
    await waitFor(() => expect(countCircles(container)).toBe(2))
  })
})
