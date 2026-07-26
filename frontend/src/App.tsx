import { useState, useCallback, useEffect, useRef } from 'react'
import Header from './components/Header'
import SearchInput from './components/SearchInput'
import DepthControl from './components/DepthControl'
import ModeSelector from './components/ModeSelector'
import AdvancedSettings from './components/AdvancedSettings'
import GraphViewer from './components/GraphViewer'
import ResultsPanel from './components/ResultsPanel'
import ProcessPanel from './components/ProcessPanel'
import type { LogEntry } from './components/ProcessPanel'
import ExportButton from './components/ExportButton'
import SessionList from './components/SessionList'
import CompetitiveReport from './components/CompetitiveReport'
import SupplyChainView from './components/SupplyChainView'
import { buildGraph, analyzeGraph, getResult, connectStatusStream, listSessions } from './api/client'
import type { GraphData, Node, Session, StatusUpdate, StageInfo, AnalyzerMode, CompetitiveReport as CompReport, SupplyChainReport } from './types'

export default function App() {
  const [target, setTarget] = useState('')
  const [depth, setDepth] = useState(2)
  const [mode, setMode] = useState<AnalyzerMode>('graph')
  const [maxPages, setMaxPages] = useState(10)
  const [categories, setCategories] = useState<string[]>(['general', 'news'])
  const [taskId, setTaskId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'building' | 'complete' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [stages, setStages] = useState<StageInfo[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [reportTab, setReportTab] = useState<'graph' | 'report'>('graph')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const cancelSse = useRef<(() => void) | null>(null)

  const pushLog = useCallback((text: string, type: 'info' | 'error' = 'info') => {
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    setLogs(prev => [...prev.slice(-99), { time, text, type }])
  }, [])

  useEffect(() => {
    listSessions().then((res) => setSessions(res.sessions)).catch(() => {})
    return () => {
      if (cancelSse.current) cancelSse.current()
    }
  }, [])

  const handleSearch = useCallback(async (searchTarget: string, searchDepth: number, searchMode: AnalyzerMode) => {
    if (cancelSse.current) {
      cancelSse.current()
      cancelSse.current = null
    }
    setStatus('building')
    setStatusMessage('Starting...')
    setGraphData(null)
    setSelectedNode(null)
    setStages([])
    setLogs([])

    const catDesc = categories.length ? ` (categories: ${categories.join(', ')})` : ''
    const pageDesc = maxPages !== 10 ? `, max pages: ${maxPages}` : ''
    pushLog(`Starting ${searchMode} analysis for "${searchTarget}" (depth ${searchDepth}${pageDesc}${catDesc})`)

    try {
      const apiCall = searchMode === 'graph' ? buildGraph : analyzeGraph
      const { task_id } = await apiCall(searchTarget, searchDepth, searchMode, maxPages, categories.length ? categories : undefined)
      setTaskId(task_id)

      cancelSse.current = connectStatusStream(
        task_id,
        (update: StatusUpdate) => {
          setStatusMessage(update.message)
          pushLog(update.message, update.status === 'error' ? 'error' : 'info')
          if (update.stages) setStages(update.stages)
          if (update.status === 'error') setStatus('error')
        },
        (err) => {
          setStatus('error')
          pushLog(`SSE error: ${err.message}`, 'error')
        },
        async () => {
          cancelSse.current = null
          try {
            const result = await getResult(task_id)
            setGraphData(result)
            setStatus(result.error ? 'error' : 'complete')
            if (result.error) {
              setStatusMessage(result.error)
              pushLog(result.error, 'error')
            } else {
              pushLog(`Graph ready: ${result.nodes.length} entities, ${result.edges.length} relationships`)
            }
            const sessionsList = await listSessions()
            setSessions(sessionsList.sessions)
          } catch (e) {
            setStatus('error')
            setStatusMessage('Failed to load result')
            pushLog(`Failed to load result: ${e}`, 'error')
          }
        },
      )
    } catch (e) {
      setStatus('error')
      setStatusMessage('Failed to start build')
      pushLog(`Build failed: ${e}`, 'error')
    }
  }, [pushLog, maxPages, categories])

  const handleLoadSession = useCallback(async (sessionId: string) => {
    if (cancelSse.current) {
      cancelSse.current()
      cancelSse.current = null
    }
    try {
      const result = await getResult(sessionId)
      setGraphData(result)
      setTaskId(sessionId)
      setStatus('complete')
      setStatusMessage('')
      setSelectedNode(null)
      setReportTab('graph')
      setMode((result.report_type as AnalyzerMode) || 'graph')
      setStages([])
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      setLogs([
        { time, text: `Loaded saved session: ${result.target} (depth ${result.depth})`, type: 'info' },
        { time, text: `Entities: ${result.nodes.length}, Relationships: ${result.edges.length}`, type: 'info' },
      ])
      const sessionsList = await listSessions()
      setSessions(sessionsList.sessions)
    } catch {
      setStatus('error')
      setStatusMessage('Failed to load session')
    }
  }, [])

  const handleSessionsChanged = useCallback(async () => {
    const res = await listSessions()
    setSessions(res.sessions)
  }, [])

  const hasReport = graphData?.report && (graphData.report_type === 'competitive' || graphData.report_type === 'supplychain')
  const showGraph = graphData && (reportTab === 'graph' || !hasReport)

  return (
    <>
      <Header />
      <main className="app-main">
        <section className="app-header-section">
          <h1 className="app-subtitle">
            {mode === 'graph' && 'Explore relationships between people, organizations, and more'}
            {mode === 'competitive' && 'Competitive intelligence — map competitors, acquisitions, and partners'}
            {mode === 'supplychain' && 'Supply chain mapping — trace suppliers, tiers, and geographic risks'}
          </h1>
          <div className="app-controls-row">
            <ModeSelector mode={mode} onChange={setMode} disabled={status === 'building'} />
            <SearchInput
              value={target}
              onChange={setTarget}
              onSubmit={(val) => handleSearch(val, depth, mode)}
              disabled={status === 'building'}
            />
          </div>
          <AdvancedSettings
            depth={depth}
            onDepthChange={setDepth}
            maxPages={maxPages}
            onMaxPagesChange={setMaxPages}
            categories={categories}
            onCategoriesChange={setCategories}
          />
        </section>

        <section className="app-content-section">
          <SessionList
            sessions={sessions}
            onSelect={handleLoadSession}
            onDelete={async (id) => {
              const { deleteSession } = await import('./api/client')
              await deleteSession(id)
              handleSessionsChanged()
              if (taskId === id) {
                setGraphData(null)
                setStatus('idle')
                setStages([])
                setLogs([])
              }
            }}
          />

          <div className="app-content-main">
            {status === 'idle' && !graphData && (
              <div className="app-empty-state">
                Enter a target and select depth to begin
              </div>
            )}

            {status === 'building' && !graphData && (
              <div className="app-building-state">
                <div className="loading-spinner" />
                Building&hellip; see progress below
              </div>
            )}

            {graphData && hasReport && (
              <div className="app-report-tabs">
                <button
                  onClick={() => setReportTab('graph')}
                  className={reportTab === 'graph' ? 'active' : ''}
                >Graph</button>
                <button
                  onClick={() => setReportTab('report')}
                  className={reportTab === 'report' ? 'active' : ''}
                >Report</button>
              </div>
            )}

            {showGraph && (
              <div className="app-graph-container">
                <GraphViewer
                  data={graphData}
                  onNodeClick={setSelectedNode}
                  selectedNodeId={selectedNode?.id ?? null}
                />
                {taskId && (
                  <div className="app-export-btn">
                    <ExportButton taskId={taskId} />
                  </div>
                )}
              </div>
            )}

            {graphData && reportTab === 'report' && graphData.report_type === 'competitive' && graphData.report && (
              <div className="app-report-container">
                <CompetitiveReport report={graphData.report as unknown as CompReport} />
              </div>
            )}

            {graphData && reportTab === 'report' && graphData.report_type === 'supplychain' && graphData.report && (
              <div className="app-report-container">
                <SupplyChainView report={graphData.report as unknown as SupplyChainReport} />
              </div>
            )}

            {selectedNode && graphData && (
              <ResultsPanel
                node={selectedNode}
                graphData={graphData}
                onClose={() => setSelectedNode(null)}
                onNodeSelect={(node) => setSelectedNode(node)}
              />
            )}
          </div>
        </section>

        <ProcessPanel
          stages={stages}
          message={statusMessage}
          logs={logs}
          active={status === 'building'}
        />
      </main>
    </>
  )
}