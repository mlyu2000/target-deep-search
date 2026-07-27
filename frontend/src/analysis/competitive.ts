import type { GraphData, CompetitiveReport } from '../types'
import { sanitizeId } from './id'

const COMPETITOR_REL_TYPES = new Set(['competes', 'rival', 'competitor'])
const ACQUISITION_REL_TYPES = new Set(['acquired', 'subsidiary_of', 'owns'])
const EXECUTIVE_TYPES = new Set(['person'])
const PARTNER_REL_TYPES = new Set(['partnered', 'supplies', 'collaborates_with', 'invested_in'])
const PRODUCT_TYPES = new Set(['product'])

// Pure port of backend app/analyzers/competitive.py — operates on an already-built graph.
export function buildCompetitiveReport(graph: GraphData): CompetitiveReport {
  const competitors: CompetitiveReport['competitors'] = []
  const acquisitions: CompetitiveReport['acquisitions'] = []
  const executives: CompetitiveReport['executives'] = []
  const partners: CompetitiveReport['partners'] = []
  const products: CompetitiveReport['products'] = []

  const targetId = sanitizeId(graph.target)
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))

  for (const edge of graph.edges) {
    if (edge.source === targetId) {
      const targetNode = nodeMap.get(edge.target)
      if (!targetNode) continue
      if (ACQUISITION_REL_TYPES.has(edge.type)) {
        acquisitions.push({ name: targetNode.name, type: edge.type, description: edge.description || '' })
      } else if (PARTNER_REL_TYPES.has(edge.type)) {
        partners.push({ name: targetNode.name, type: edge.type, strength: edge.strength, description: edge.description || '' })
      } else if (COMPETITOR_REL_TYPES.has(edge.type)) {
        competitors.push({ name: targetNode.name, type: edge.type, strength: edge.strength, description: edge.description || '' })
      }
    }
    if (edge.target === targetId) {
      const sourceNode = nodeMap.get(edge.source)
      if (!sourceNode) continue
      if (EXECUTIVE_TYPES.has(sourceNode.type)) {
        executives.push({ name: sourceNode.name, role: edge.type, description: edge.description || '' })
      } else if (PARTNER_REL_TYPES.has(edge.type)) {
        partners.push({ name: sourceNode.name, type: edge.type, strength: edge.strength, description: edge.description || '' })
      } else if (COMPETITOR_REL_TYPES.has(edge.type)) {
        competitors.push({ name: sourceNode.name, type: edge.type, strength: edge.strength, description: edge.description || '' })
      }
    }
  }

  for (const node of graph.nodes) {
    if (PRODUCT_TYPES.has(node.type)) {
      products.push({ name: node.name, description: node.description || '' })
    }
    if (node.type === 'person' && node.id !== targetId) {
      if (!executives.some((e) => e.name === node.name)) {
        executives.push({ name: node.name, role: 'unknown', description: node.description || '' })
      }
    }
  }

  const uniqueCompetitors = dedupe(competitors, (c) => c.name)
  const uniquePartners = dedupe(partners, (p) => p.name)
  const uniqueAcquisitions = dedupe(acquisitions, (a) => a.name)
  const uniqueExecutives = dedupe(executives, (e) => e.name)
  const uniqueProducts = dedupe(products, (p) => p.name)

  const summary =
    `Analysis of **${graph.target}**: ` +
    `${uniqueCompetitors.length} competitors, ` +
    `${uniqueAcquisitions.length} acquisitions, ` +
    `${uniqueExecutives.length} executives/people, ` +
    `${uniquePartners.length} partners, ` +
    `${uniqueProducts.length} products identified from ` +
    `${graph.nodes.length} entities and ${graph.edges.length} relationships.`

  return {
    type: 'competitive',
    target: graph.target,
    summary,
    competitors: uniqueCompetitors.slice(0, 20),
    acquisitions: uniqueAcquisitions.slice(0, 20),
    executives: uniqueExecutives.slice(0, 20),
    partners: uniquePartners.slice(0, 20),
    products: uniqueProducts.slice(0, 20),
  }
}

function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const k = key(item)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(item)
    }
  }
  return out
}
