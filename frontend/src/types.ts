export interface ImageData {
  url: string
  alt_text: string | null
  context: string | null
  source_page: string
}

export interface Node {
  id: string
  name: string
  type: 'person' | 'organization' | 'product' | 'location' | 'technology'
  description: string
  images: ImageData[]
  mention_count: number
}

export interface Edge {
  source: string
  target: string
  type: string
  strength: number
  description: string
  source_urls: string[]
}

export interface GraphData {
  target: string
  depth: number
  nodes: Node[]
  edges: Edge[]
  error?: string | null
  report?: CompetitiveReport | SupplyChainReport | null
  report_type?: string | null
}

export interface Session {
  id: string
  target: string
  depth: number
  status: string
  error_msg: string | null
  report_type?: string | null
  created_at: string
  updated_at: string
}

export interface BuildResponse {
  task_id: string
}

export interface StatusUpdate {
  status: string
  message: string
  depth: number
  progress?: number | null
  entities_found?: number | null
  relationships_found?: number | null
  stage?: string | null
  stages?: StageInfo[] | null
  round?: number | null
}

export interface StageInfo {
  name: string
  status: 'pending' | 'active' | 'done' | 'error'
  started_at?: string | null
  elapsed?: number | null
}

export type EntityType = 'person' | 'organization' | 'product' | 'location' | 'technology'
export type AnalyzerMode = 'graph' | 'competitive' | 'supplychain'
export interface KolReport {
  type: 'kol'
  target: string
  summary: string
  ranked: Array<{
    rank: number
    id: string
    name: string
    type: EntityType
    influence: number
    weightedDegree: number
    pagerank: number
    betweenness: number
    mentions: number
    reason: string
  }>
}

export type AnalysisView = 'graph' | 'competitive' | 'supplychain' | 'kol'

export const ENTITY_COLORS: Record<EntityType, string> = {
  person: '#0070f8',
  organization: '#01a982',
  product: '#7764fc',
  location: '#62e5f6',
  technology: '#05cc93',
}

export const ENTITY_TYPES: EntityType[] = ['person', 'organization', 'product', 'location', 'technology']

export interface CompetitiveReport {
  type: 'competitive'
  target: string
  summary: string
  competitors: Array<{ name: string; type: string; strength: number; description: string }>
  acquisitions: Array<{ name: string; type: string; description: string }>
  executives: Array<{ name: string; role: string; description: string }>
  partners: Array<{ name: string; type: string; strength: number; description: string }>
  products: Array<{ name: string; description: string }>
}

export interface SupplyChainReport {
  type: 'supplychain'
  target: string
  summary: string
  tier_1: Array<{ name: string; relationship: string; strength: number; description: string }>
  tier_2: Array<{ name: string; via: string; relationship: string }>
  locations: Array<{ name: string; description: string; risk: boolean }>
  geo_risks: Array<{ region: string; location: string; count: number }>
  single_source_deps: Array<{ name: string; connections: number }>
}

export interface AgentPersonaView {
  id: string
  name: string
  type: string
  bio: string
  persona: string
  stance: string
  influence_weight: number
  traits_sourced: string[]
  inferred: string[]
  enriched: boolean
  rank?: number
}

export interface AgentStatementView {
  round: number
  agent_id: string
  agent_name: string
  reaction: string
  statement: string
  stance: string
}

export interface SimulationRoundView {
  round: number
  statements: AgentStatementView[]
}

export interface SimulationReportView {
  implications_for_target?: string
  how_market_reshapes?: string
  strategic_postures?: Array<{ agent: string; stance: string; move: string }>
  risks?: Array<{ risk: string; severity: string }>
  opportunities?: string[]
  recommended_actions?: string[]
  confidence?: { implications?: string; risks?: string; overall?: string }
  evidence_tier?: string
  evidence_score?: number
  enrichment_summary?: string
  guardrail_flags?: Array<{ action: string; reason: string }>
  summary?: string
  positions?: Array<{ agent: string; final_stance: string; key_point: string }>
  agreement?: string[]
  conflict?: string[]
  overall_outcome?: string
}

export interface WhatIfReport {
  scenario: string
  agents: AgentPersonaView[]
  rounds: SimulationRoundView[]
  report: SimulationReportView
}

export interface WhatIfState {
  scenario: string
  rounds: number
  autoStable: boolean
  fastMode: boolean
  running: boolean
  progress: string
  roundLabel: string
  result: WhatIfReport | null
  error: string
}

export interface SavedSimRunSummary {
  run_id: string
  target: string
  scenario: string
  rounds: number
  graph_depth?: number
  agents_count?: number
  enriched_count?: number
  created_at?: string
}

export interface SavedSimRunFull extends SavedSimRunSummary {
  result: WhatIfReport
}

