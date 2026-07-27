import { useRef, useEffect, useState, useCallback } from 'react'
import * as d3 from 'd3'
import type { GraphData, Node, Edge } from '../types'
import { ENTITY_COLORS, type EntityType } from '../types'
import './GraphViewer.css'

interface GraphViewerProps {
  data: GraphData
  onNodeClick: (node: Node) => void
  selectedNodeId: string | null
  activeTypes?: Set<string>
  onToggleType?: (type: string) => void
  onResetFilters?: () => void
  totalCount?: number
  visibleCount?: number
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  type: EntityType
  mention_count: number
  images?: { url: string }[]
  description: string
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  type: string
  strength: number
  description: string
}

export default function GraphViewer({ data, onNodeClick, selectedNodeId, activeTypes, onToggleType, onResetFilters, totalCount, visibleCount }: GraphViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const drawGraph = useCallback(() => {
    if (!svgRef.current || !data) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = dimensions
    if (width === 0 || height === 0) return

    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]))

    // The searched target entity must always remain visible, even when its
    // type is filtered out, so it stays on the chart. Edges are only drawn
    // between nodes that are actually rendered (target's relationships to
    // still-visible entities remain; those to hidden entities drop cleanly).
    const targetKey = data.target.trim().toLowerCase()
    const targetId = data.nodes.find((n) => n.name.trim().toLowerCase() === targetKey)?.id

    const visibleTypes = activeTypes ?? new Set(data.nodes.map((n) => n.type))
    const isVisible = (type: string) => visibleTypes.has(type)
    const isPinned = (id: string) => targetId !== undefined && id === targetId

    const isNodeShown = (n: { id: string; type: string }) => isVisible(n.type) || isPinned(n.id)

    const nodes: SimNode[] = data.nodes
      .filter(isNodeShown)
      .map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type as EntityType,
        mention_count: n.mention_count,
        images: n.images,
        description: n.description,
      }))

    const links: SimLink[] = data.edges
      .filter((e) => {
        const s = nodeMap.get(e.source)
        const t = nodeMap.get(e.target)
        return s && t && isNodeShown(s) && isNodeShown(t)
      })
      .map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        strength: e.strength,
        description: e.description,
      }))

    const g = svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30))
      .alphaDecay(0.02)

    const link = g.append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => {
        if (selectedNodeId) {
          const sourceId = typeof d.source === 'object' ? (d.source as SimNode).id : d.source
          const targetId = typeof d.target === 'object' ? (d.target as SimNode).id : d.target
          return sourceId === selectedNodeId || targetId === selectedNodeId
            ? 'var(--hpe-brand)'
            : 'var(--edge-default)'
        }
        return 'var(--edge-default)'
      })
      .attr('stroke-width', (d) => Math.max(1, d.strength))
      .attr('stroke-opacity', (d) => {
        if (selectedNodeId) {
          const sourceId = typeof d.source === 'object' ? (d.source as SimNode).id : d.source
          const targetId = typeof d.target === 'object' ? (d.target as SimNode).id : d.target
          return sourceId === selectedNodeId || targetId === selectedNodeId ? 0.8 : 0.1
        }
        return 0.6
      })

    const linkLabel = g.append('g')
      .selectAll<SVGTextElement, SimLink>('text')
      .data(links)
      .join('text')
      .text((d) => d.type)
      .attr('font-size', '9px')
      .attr('fill', 'var(--hpe-text-weak)')
      .attr('text-anchor', 'middle')
      .attr('dy', '-4')

    const nodeGroup = g.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')

    nodeGroup.append('circle')
      .attr('r', (d) => Math.max(12, Math.min(30, 10 + d.mention_count * 2)))
      .attr('fill', (d) => ENTITY_COLORS[d.type] || 'var(--hpe-text-weak)')
      .attr('stroke', (d) => d.id === selectedNodeId ? 'var(--hpe-white)' : 'none')
      .attr('stroke-width', 3)
      .attr('opacity', (d) => (selectedNodeId && d.id !== selectedNodeId) ? 0.3 : 1)

    nodeGroup.filter((d) => (d.images?.length ?? 0) > 0)
      .append('image')
      .attr('xlink:href', (d) => d.images![0].url)
      .attr('x', -8)
      .attr('y', -8)
      .attr('width', 16)
      .attr('height', 16)
      .attr('clip-path', 'circle(8px)')

    nodeGroup.append('text')
      .text((d) => d.name)
      .attr('dx', (d) => Math.max(12, Math.min(30, 10 + d.mention_count * 2)) + 6)
      .attr('dy', 4)
      .attr('font-size', '11px')
      .attr('fill', (d) => selectedNodeId && d.id !== selectedNodeId ? 'var(--hpe-text-weak)' : 'var(--hpe-text-primary)')
      .attr('font-weight', (d) => d.id === selectedNodeId ? '700' : '400')

    nodeGroup.on('click', (_event, d) => {
      const originalNode = nodeMap.get(d.id)
      if (originalNode) onNodeClick(originalNode)
    })

    const drag = d3.drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    nodeGroup.call(drag)

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x!)
        .attr('y1', (d) => (d.source as SimNode).y!)
        .attr('x2', (d) => (d.target as SimNode).x!)
        .attr('y2', (d) => (d.target as SimNode).y!)

      linkLabel
        .attr('x', (d) => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
        .attr('y', (d) => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2)

      nodeGroup.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

  }, [data, dimensions, onNodeClick, selectedNodeId, activeTypes])

  useEffect(() => {
    drawGraph()
  }, [data, dimensions, onNodeClick, selectedNodeId, activeTypes])

  return (
    <div ref={containerRef} className="graph-container">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />
      <div className="graph-legend">
        <div className="graph-legend-header">
          <span className="graph-legend-count">
            {typeof visibleCount === 'number' && typeof totalCount === 'number'
              ? `Showing ${visibleCount} / ${totalCount} entities`
              : ''}
          </span>
          {activeTypes && activeTypes.size < 5 && onResetFilters && (
            <button type="button" className="graph-legend-reset" onClick={onResetFilters}>
              Reset filters
            </button>
          )}
        </div>
        {(Object.entries(ENTITY_COLORS) as [EntityType, string][]).map(([type, color]) => {
          const active = !activeTypes || activeTypes.has(type)
          return (
            <button
              key={type}
              type="button"
              className={`graph-legend-item${active ? '' : ' inactive'}`}
              onClick={() => onToggleType?.(type)}
              title={active ? `Hide ${type}` : `Show ${type}`}
            >
              <span className="graph-legend-dot" style={{ backgroundColor: color }} />
              {type}
            </button>
          )
        })}
      </div>
    </div>
  )
}
