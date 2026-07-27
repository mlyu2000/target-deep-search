import { describe, it, expect } from 'vitest'
import { buildKolReport } from '../../analysis/kol'
import type { GraphData } from '../../types'

// A small star graph: hub 'Center' connects to 4 leaves. Center should be most influential.
const star: GraphData = {
  target: 'Center',
  depth: 1,
  nodes: [
    { id: 'center', name: 'Center', type: 'organization', description: '', images: [], mention_count: 10 },
    { id: 'a', name: 'Alpha', type: 'person', description: '', images: [], mention_count: 2 },
    { id: 'b', name: 'Beta', type: 'product', description: '', images: [], mention_count: 1 },
    { id: 'c', name: 'Gamma', type: 'location', description: '', images: [], mention_count: 1 },
    { id: 'd', name: 'Delta', type: 'technology', description: '', images: [], mention_count: 1 },
  ],
  edges: [
    { source: 'center', target: 'a', type: 'employs', strength: 5, description: '', source_urls: [] },
    { source: 'center', target: 'b', type: 'owns', strength: 4, description: '', source_urls: [] },
    { source: 'center', target: 'c', type: 'located_in', strength: 3, description: '', source_urls: [] },
    { source: 'center', target: 'd', type: 'uses', strength: 3, description: '', source_urls: [] },
  ],
}

// A line graph: a-b-c. 'b' is the bridge (highest betweenness).
const line: GraphData = {
  target: 'A',
  depth: 1,
  nodes: [
    { id: 'a', name: 'A', type: 'organization', description: '', images: [], mention_count: 5 },
    { id: 'b', name: 'B', type: 'organization', description: '', images: [], mention_count: 5 },
    { id: 'c', name: 'C', type: 'organization', description: '', images: [], mention_count: 5 },
  ],
  edges: [
    { source: 'a', target: 'b', type: 'rival', strength: 3, description: '', source_urls: [] },
    { source: 'b', target: 'c', type: 'rival', strength: 3, description: '', source_urls: [] },
  ],
}

describe('buildKolReport', () => {
  it('ranks the hub of a star graph as #1', () => {
    const r = buildKolReport(star)
    expect(r.type).toBe('kol')
    expect(r.ranked[0].id).toBe('center')
    expect(r.ranked[0].rank).toBe(1)
    expect(r.ranked[0].weightedDegree).toBe(5 + 4 + 3 + 3)
  })

  it('ranks the bridge of a line graph as #1 (betweenness)', () => {
    const r = buildKolReport(line)
    expect(r.ranked[0].id).toBe('b')
    // b should have positive betweenness, leaves zero
    const b = r.ranked.find((k) => k.id === 'b')!
    expect(b.betweenness).toBeGreaterThan(0)
  })

  it('returns at most topN ranked entities with reasons', () => {
    const r = buildKolReport(star, 3)
    expect(r.ranked).toHaveLength(3)
    expect(r.ranked.every((k) => typeof k.reason === 'string' && k.reason.length > 0)).toBe(true)
    expect(r.ranked[0].influence).toBeGreaterThanOrEqual(r.ranked[2].influence)
  })

  it('influence scores are within [0,1]', () => {
    const r = buildKolReport(star)
    expect(r.ranked.every((k) => k.influence >= 0 && k.influence <= 1)).toBe(true)
  })
})
