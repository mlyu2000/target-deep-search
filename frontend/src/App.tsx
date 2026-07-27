import { useState, useCallback, useEffect, useRef } from 'react'
import Header from './components/Header'
import SearchInput from './components/SearchInput'
import DepthControl from './components/DepthControl'
import AdvancedSettings from './components/AdvancedSettings'
import GraphViewer from './components/GraphViewer'
import ResultsPanel from './components/ResultsPanel'
import ProcessPanel from './components/ProcessPanel'
import type { LogEntry } from './components/ProcessPanel'
import ExportButton from './components/ExportButton'
import SessionList from './components/SessionList'
import AnalysisSidebar from './components/AnalysisSidebar'
import AnalysisTab from './components/AnalysisTab'
import { buildGraph, getResult, connectStatusStream, listSessions } from './api/client'
import { buildCompetitiveReport } from './analysis/competitive'
import { buildSupplyChainReport } from './analysis/supplychain'
import type { GraphData, Node, Session, StatusUpdate, StageInfo } from './types'

export default function App() {
  const [target, setTarget] = useState('')
  const [depth, setDepth] = useState(2)
  const [maxPages, setMaxPages] = useState(10)
  const [categories, setCategories] = useState<string[]>(['general', 'news'])
  const [taskId, setTaskId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'building' | 'complete' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [stages, setStages] = useState<StageInfo[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeView, setActiveView] = useState<'graph' | 'competitive' | 'supplychain'>('graph')
  const [activeTypes, setActiveTypes] = useState<Set<string> | null>(null)
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

  const toggleType = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const all = new Set<string>(['person', 'organization', 'product', 'location', 'technology'])
      const current = prev ?? all
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      // If all types are active again, treat as "no filter"
      if (next.size === all.size) return null
      return next.size === 0 ? new Set<string>() : next
    })
  }, [])

  const handleSearch = useCallback(async (searchTarget: string, searchDepth: number) => {
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
    setActiveView('graph')

    const catDesc = categories.length ? ` (categories: ${categories.join(', ')})` : ''
    const pageDesc = maxPages !== 10 ? `, max pages: ${maxPages}` : ''
    pushLog(`Starting analysis for "${searchTarget}" (depth ${searchDepth}${pageDesc}${catDesc})`)

    try {
      const { task_id } = await buildGraph(searchTarget, searchDepth, maxPages, categories.length ? categories : undefined)
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
            setActiveTypes(null)
            setActiveView('graph')
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
      setActiveView('graph')
      setActiveTypes(null)
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

  const handleClearSessions = useCallback(async () => {
    const { clearSessions } = await import('./api/client')
    await clearSessions()
    setSessions([])
    setGraphData(null)
    setStatus('idle')
    setActiveView('graph')
    setActiveTypes(null)
  }, [])

  return (
    <>
      <Header />
      <main className="app-main">
        <section className="app-header-section">
          <h1 className="app-subtitle">
            Explore relationships between people, organizations, and more
          </h1>
          <div className="app-controls-row">
            <SearchInput
              value={target}
              onChange={setTarget}
              onSubmit={(val) => handleSearch(val, depth)}
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
            onClear={handleClearSessions}
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

            {graphData && (
              <div className="app-analysis-layout">
                <div className="app-analysis-main">
                  <div className="app-view-tabs">
                    <button
                      onClick={() => setActiveView('graph')}
                      className={activeView === 'graph' ? 'active' : ''}
                    >Graph</button>
                    <button
                      onClick={() => setActiveView('competitive')}
                      className={activeView === 'competitive' ? 'active' : ''}
                    >Competitive</button>
                    <button
                      onClick={() => setActiveView('supplychain')}
                      className={activeView === 'supplychain' ? 'active' : ''}
                    >Supply Chain</button>
                  </div>

                  {activeView === 'graph' && (
                    <div className="app-graph-container">
                      <GraphViewer
                        data={graphData}
                        onNodeClick={setSelectedNode}
                        selectedNodeId={selectedNode?.id ?? null}
                        activeTypes={activeTypes ?? undefined}
                        onToggleType={toggleType}
                        onResetFilters={() => setActiveTypes(null)}
                        totalCount={graphData.nodes.length}
                        visibleCount={
                          activeTypes
                            ? graphData.nodes.filter(
                                (n) =>
                                  activeTypes.has(n.type) ||
                                  n.name.trim().toLowerCase() === graphData.target.trim().toLowerCase(),
                              ).length
                            : graphData.nodes.length
                        }
                      />
                      {taskId && (
                        <div className="app-export-btn">
                          <ExportButton taskId={taskId} />
                        </div>
                      )}
                    </div>
                  )}

                  {activeView === 'competitive' && graphData && (
                    <AnalysisTab
                      mode="competitive"
                      graphData={graphData}
                      onBack={() => setActiveView('graph')}
                    />
                  )}

                  {activeView === 'supplychain' && graphData && (
                    <AnalysisTab
                      mode="supplychain"
                      graphData={graphData}
                      onBack={() => setActiveView('graph')}
                    />
                  )}
                </div>

                <AnalysisSidebar
                  graphData={graphData}
                  activeView={activeView}
                  onSelect={(view) => setActiveView(view)}
                />
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