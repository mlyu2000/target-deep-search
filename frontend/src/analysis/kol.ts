import type { GraphData, KolReport, EntityType } from '../types'

interface Metrics {
  id: string
  name: string
  type: EntityType
  mentions: number
  weightedDegree: number
  pagerank: number
  betweenness: number
  influence: number
}

function normalize(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 1)
  return values.map((v) => (v - min) / (max - min))
}

// PageRank power iteration (undirected, weighted edges treated as weight on adjacency).
function pagerank(adj: Map<string, Map<string, number>>, ids: string[], damping = 0.85, iterations = 50): Map<string, number> {
  const n = ids.length
  const pr = new Map<string, number>(ids.map((id) => [id, 1 / n]))
  if (n === 0) return pr
  for (let it = 0; it < iterations; it++) {
    const next = new Map<string, number>(ids.map((id) => [id, (1 - damping) / n]))
    for (const id of ids) {
      const out = adj.get(id)
      if (!out || out.size === 0) {
        // dangling: distribute evenly
        for (const j of ids) next.set(j, next.get(j)! + (damping * pr.get(id)!) / n)
      } else {
        const outSum = [...out.values()].reduce((a, b) => a + b, 0)
        for (const [nb, w] of out) {
          next.set(nb, next.get(nb)! + (damping * pr.get(id)! * w) / outSum)
        }
      }
    }
    for (const id of ids) pr.set(id, next.get(id)!)
  }
  return pr
}

// Brandes betweenness centrality on an unweighted undirected graph.
function betweenness(adj: Map<string, Set<string>>, ids: string[]): Map<string, number> {
  const cb = new Map<string, number>(ids.map((id) => [id, 0]))
  for (const s of ids) {
    const stack: string[] = []
    const pred = new Map<string, string[]>()
    const sigma = new Map<string, number>(ids.map((id) => [id, 0]))
    const dist = new Map<string, number>(ids.map((id) => [id, -1]))
    sigma.set(s, 1)
    dist.set(s, 0)
    const queue: string[] = [s]
    while (queue.length) {
      const v = queue.shift()!
      stack.push(v)
      for (const w of adj.get(v) ?? []) {
        if (dist.get(w)! < 0) {
          dist.set(w, dist.get(v)! + 1)
          queue.push(w)
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(s)!)
          if (!pred.has(w)) pred.set(w, [])
          pred.get(w)!.push(v)
        }
      }
    }
    const delta = new Map<string, number>(ids.map((id) => [id, 0]))
    while (stack.length) {
      const w = stack.pop()!
      for (const v of pred.get(w) ?? []) {
        const c = (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!)
        delta.set(v, delta.get(v)! + c)
      }
      if (w !== s) cb.set(w, cb.get(w)! + delta.get(w)!)
    }
  }
  // Undirected: divide by 2
  for (const id of ids) cb.set(id, cb.get(id)! / 2)
  return cb
}

// Builds a KOL / influence ranking from an already-built graph (no extra crawl).
export function buildKolReport(graph: GraphData, topN = 10): KolReport {
  // KOL = key opinion LEADER: only people and organizations can be KOLs.
  // Products/technologies/locations are not opinion leaders, so exclude them
  // (mirrors backend centrality.py fix for "product shown as KOL").
  const kolTypes = new Set<EntityType>(['person', 'organization'])
  const nodes = graph.nodes.filter((n) => kolTypes.has(n.type as EntityType))
  const ids = nodes.map((n) => n.id)
  const nameById = new Map(nodes.map((n) => [n.id, n.name]))
  const typeById = new Map(nodes.map((n) => [n.id, n.type as EntityType]))
  const mentionsById = new Map(nodes.map((n) => [n.id, n.mention_count]))

  // Adjacency (undirected, weighted by edge strength)
  const wadj = new Map<string, Map<string, number>>()
  const uadj = new Map<string, Set<string>>()
  const weightedDegree = new Map<string, number>(ids.map((id) => [id, 0]))
  for (const id of ids) {
    wadj.set(id, new Map())
    uadj.set(id, new Set())
  }
  for (const e of graph.edges) {
    if (!wadj.has(e.source) || !wadj.has(e.target)) continue
    const w = Math.max(1, e.strength)
    const a = wadj.get(e.source)!
    const b = wadj.get(e.target)!
    a.set(e.target, (a.get(e.target) ?? 0) + w)
    b.set(e.source, (b.get(e.source) ?? 0) + w)
    weightedDegree.set(e.source, (weightedDegree.get(e.source) ?? 0) + w)
    weightedDegree.set(e.target, (weightedDegree.get(e.target) ?? 0) + w)
    uadj.get(e.source)!.add(e.target)
    uadj.get(e.target)!.add(e.source)
  }

  const pr = pagerank(wadj, ids)
  const bc = betweenness(uadj, ids)

  const metrics: Metrics[] = ids.map((id) => ({
    id,
    name: nameById.get(id) ?? id,
    type: typeById.get(id)!,
    mentions: mentionsById.get(id) ?? 0,
    weightedDegree: weightedDegree.get(id) ?? 0,
    pagerank: pr.get(id) ?? 0,
    betweenness: bc.get(id) ?? 0,
    influence: 0,
  }))

  // Normalize each axis to [0,1]
  const nd = normalize(metrics.map((m) => m.weightedDegree))
  const np = normalize(metrics.map((m) => m.pagerank))
  const nb = normalize(metrics.map((m) => m.betweenness))
  const nm = normalize(metrics.map((m) => m.mentions))
  metrics.forEach((m, i) => {
    // Composite influence: blend (equal weights) of the four normalized axes.
    m.influence = (nd[i] + np[i] + nb[i] + nm[i]) / 4
  })

  const ranked = [...metrics]
    .sort((a, b) => b.influence - a.influence)
    .slice(0, topN)
    .map((m, i) => {
      const reasons: string[] = []
      if (nm[metrics.indexOf(m)] >= 0.8) reasons.push('high external prominence')
      if (nd[metrics.indexOf(m)] >= 0.8) reasons.push('most connected (weighted degree)')
      if (np[metrics.indexOf(m)] >= 0.8) reasons.push('linked to other influential entities (PageRank)')
      if (nb[metrics.indexOf(m)] >= 0.8) reasons.push('bridges clusters (betweenness)')
      if (reasons.length === 0) reasons.push('balanced centrality across connections, prominence, and bridge roles')
      return {
        rank: i + 1,
        id: m.id,
        name: m.name,
        type: m.type,
        influence: Number(m.influence.toFixed(3)),
        weightedDegree: m.weightedDegree,
        pagerank: Number(m.pagerank.toFixed(4)),
        betweenness: Number(m.betweenness.toFixed(3)),
        mentions: m.mentions,
        reason: reasons.join('; '),
      }
    })

  const top = ranked[0]
  const summary =
    `KOL / influence analysis of **${graph.target}**: ` +
    `top ${ranked.length} most impactful entities identified from ` +
    `${graph.nodes.length} nodes and ${graph.edges.length} relationships. ` +
    (top ? `Most impactful: **${top.name}** (${top.reason}).` : '')

  return { type: 'kol', target: graph.target, summary, ranked }
}
