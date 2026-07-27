import type { GraphData, SupplyChainReport } from '../types'
import { sanitizeId } from './id'

const SUPPLIER_REL_TYPES = new Set(['supplies', 'partnered', 'collaborates_with', 'outsources_to', 'provider'])
const LOCATION_TYPES = new Set(['location'])
const RISK_LOCATIONS = ['china', 'russia', 'taiwan', 'ukraine', 'venezuela', 'iran', 'north_korea']

// Pure port of backend app/analyzers/supplychain.py — operates on an already-built graph.
export function buildSupplyChainReport(graph: GraphData): SupplyChainReport {
  const targetId = sanitizeId(graph.target)
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))

  const tier_1: SupplyChainReport['tier_1'] = []
  const tier_2: SupplyChainReport['tier_2'] = []
  const locations: SupplyChainReport['locations'] = []
  const single_source: SupplyChainReport['single_source_deps'] = []

  for (const edge of graph.edges) {
    if (edge.source === targetId) {
      const n = nodeMap.get(edge.target)
      tier_1.push({
        name: n ? n.name : edge.target,
        relationship: edge.type,
        strength: edge.strength,
        description: edge.description || '',
      })
    }
    if (edge.target === targetId) {
      const n = nodeMap.get(edge.source)
      tier_1.push({
        name: n ? n.name : edge.source,
        relationship: edge.type,
        strength: edge.strength,
        description: edge.description || '',
      })
    }
  }

  const tier_1_ids = new Set<string>()
  for (const t of tier_1) {
    for (const [nid, n] of nodeMap) {
      if (n.name === t.name) tier_1_ids.add(nid)
    }
  }

  const seen_tier_2 = new Set<string>()
  for (const edge of graph.edges) {
    const srcName = nodeMap.get(edge.source)?.name ?? edge.source
    const tgtName = nodeMap.get(edge.target)?.name ?? edge.target
    const srcIsT1 = tier_1_ids.has(edge.source)
    const tgtIsT1 = tier_1_ids.has(edge.target)
    const srcIsTarget = edge.source === targetId
    const tgtIsTarget = edge.target === targetId

    if (!srcIsTarget && !tgtIsTarget && (srcIsT1 || tgtIsT1)) {
      const subName = srcIsT1 ? tgtName : srcName
      const via = srcIsT1 ? srcName : tgtName
      if (!seen_tier_2.has(subName) && subName !== graph.target) {
        seen_tier_2.add(subName)
        tier_2.push({ name: subName, via, relationship: edge.type })
      }
    }
  }

  for (const node of graph.nodes) {
    if (LOCATION_TYPES.has(node.type)) {
      locations.push({
        name: node.name,
        description: node.description || '',
        risk: RISK_LOCATIONS.some((r) => node.name.toLowerCase().includes(r)),
      })
    }
  }

  const connectionCounts = new Map<string, number>()
  for (const edge of graph.edges) {
    if (edge.source !== targetId && edge.target !== targetId) {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) ?? 0) + 1)
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) ?? 0) + 1)
    }
  }

  const singleSourceList = [...connectionCounts.entries()]
    .filter(([nid, count]) => {
      const n = nodeMap.get(nid)
      return count === 1 && n && n.name !== graph.target
    })
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10)
    .map(([nid]) => ({
      name: nodeMap.get(nid)?.name ?? nid,
      connections: connectionCounts.get(nid) ?? 1,
    }))
  single_source.push(...singleSourceList)

  const geo_risks: SupplyChainReport['geo_risks'] = []
  const regionCounts = new Map<string, number>()
  for (const loc of locations) {
    for (const riskRegion of RISK_LOCATIONS) {
      if (loc.name.toLowerCase().includes(riskRegion)) {
        regionCounts.set(riskRegion, (regionCounts.get(riskRegion) ?? 0) + 1)
        geo_risks.push({
          region: riskRegion.charAt(0).toUpperCase() + riskRegion.slice(1),
          location: loc.name,
          count: regionCounts.get(riskRegion) ?? 1,
        })
      }
    }
  }

  const tier_1_names = new Set(tier_1.map((t) => t.name))
  const filtered_tier_2 = tier_2.filter((t) => !tier_1_names.has(t.name)).slice(0, 20)

  const summary =
    `Supply chain analysis of **${graph.target}**: ` +
    `${tier_1.length} direct suppliers/partners, ` +
    `${filtered_tier_2.length} sub-suppliers, ` +
    `${locations.length} geographic locations` +
    (geo_risks.length ? `, ${geo_risks.length} geographic risk(s)` : '') +
    (single_source.length ? `, ${single_source.length} single-source dependencies` : '') +
    '.'

  return {
    type: 'supplychain',
    target: graph.target,
    summary,
    tier_1: tier_1.slice(0, 20),
    tier_2: filtered_tier_2,
    locations: locations.slice(0, 20),
    geo_risks: geo_risks.slice(0, 10),
    single_source_deps: single_source.slice(0, 10),
  }
}
