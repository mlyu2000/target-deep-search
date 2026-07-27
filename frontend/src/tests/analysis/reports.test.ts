import { describe, it, expect } from 'vitest'
import { buildCompetitiveReport } from '../../analysis/competitive'
import { buildSupplyChainReport } from '../../analysis/supplychain'
import type { GraphData } from '../../types'

// A small graph: target "Acme Corp" with a competitor, an acquisition, an exec, a partner, a product, a location.
const graph: GraphData = {
  target: 'Acme Corp',
  depth: 1,
  nodes: [
    { id: 'acme_corp', name: 'Acme Corp', type: 'organization', description: '', images: [], mention_count: 1 },
    { id: 'globex', name: 'Globex', type: 'organization', description: '', images: [], mention_count: 1 },
    { id: 'subco', name: 'SubCo', type: 'organization', description: '', images: [], mention_count: 1 },
    { id: 'jane_doe', name: 'Jane Doe', type: 'person', description: '', images: [], mention_count: 1 },
    { id: 'widget', name: 'Widget', type: 'product', description: '', images: [], mention_count: 1 },
    { id: 'china', name: 'China', type: 'location', description: '', images: [], mention_count: 1 },
  ],
  edges: [
    { source: 'acme_corp', target: 'globex', type: 'competes', strength: 5, description: '', source_urls: [] },
    { source: 'acme_corp', target: 'subco', type: 'owns', strength: 4, description: '', source_urls: [] },
    { source: 'jane_doe', target: 'acme_corp', type: 'ceo', strength: 3, description: '', source_urls: [] },
    { source: 'acme_corp', target: 'china', type: 'located_in', strength: 2, description: '', source_urls: [] },
  ],
}

describe('buildCompetitiveReport', () => {
  it('classifies competitors, acquisitions, executives, products from edges', () => {
    const r = buildCompetitiveReport(graph)
    expect(r.type).toBe('competitive')
    expect(r.target).toBe('Acme Corp')
    expect(r.competitors.map((c) => c.name)).toContain('Globex')
    expect(r.acquisitions.map((a) => a.name)).toContain('SubCo')
    expect(r.executives.map((e) => e.name)).toContain('Jane Doe')
    expect(r.products.map((p) => p.name)).toContain('Widget')
    expect(r.summary).toMatch(/competitors/)
  })

  it('dedupes by name', () => {
    const dup: GraphData = {
      ...graph,
      edges: [
        ...graph.edges,
        { source: 'acme_corp', target: 'globex', type: 'rival', strength: 1, description: '', source_urls: [] },
      ],
    }
    const r = buildCompetitiveReport(dup)
    expect(r.competitors.filter((c) => c.name === 'Globex')).toHaveLength(1)
  })
})

describe('buildSupplyChainReport', () => {
  it('builds tier-1, locations, geo_risks from edges', () => {
    const r = buildSupplyChainReport(graph)
    expect(r.type).toBe('supplychain')
    expect(r.tier_1.map((t) => t.name)).toEqual(expect.arrayContaining(['Globex', 'SubCo', 'China', 'Jane Doe']))
    expect(r.locations.map((l) => l.name)).toContain('China')
    expect(r.locations.find((l) => l.name === 'China')?.risk).toBe(true)
    expect(r.geo_risks.some((g) => g.region === 'China')).toBe(true)
  })
})
