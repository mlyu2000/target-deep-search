import { useState } from 'react'
import type { Node, GraphData } from '../types'
import { ENTITY_COLORS, type EntityType } from '../types'
import './ResultsPanel.css'

interface ResultsPanelProps {
  node: Node
  graphData: GraphData
  onClose: () => void
  onNodeSelect: (node: Node) => void
}

export default function ResultsPanel({ node, graphData, onClose, onNodeSelect }: ResultsPanelProps) {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)

  const connections = graphData.edges
    .filter((e) => e.source === node.id || e.target === node.id)
    .map((e) => {
      const connectedId = e.source === node.id ? e.target : e.source
      const connectedNode = graphData.nodes.find((n) => n.id === connectedId)
      const direction = e.source === node.id ? 'outgoing' : 'incoming'
      return { edge: e, connectedNode, direction }
    })

  return (
    <>
      <aside className="results-panel">
        <div className="results-panel-header">
          <h2 className="results-panel-title">{node.name}</h2>
          <button className="results-panel-close" onClick={onClose}>×</button>
        </div>

        <span
          className="results-panel-badge"
          style={{ background: ENTITY_COLORS[node.type as EntityType] || 'var(--hpe-text-weak)' }}
        >
          {node.type}
        </span>

        {node.description && (
          <p className="results-panel-desc">{node.description}</p>
        )}

        <p className="results-panel-meta">
          Mentioned {node.mention_count} time{node.mention_count !== 1 ? 's' : ''}
        </p>

        {node.images.length > 0 && (
          <div className="results-panel-images">
            <h3 className="results-panel-section-title">Images ({node.images.length})</h3>
            <div className="results-panel-image-scroll">
              {node.images.slice(0, 10).map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={img.alt_text || `${node.name} image ${i + 1}`}
                  className="results-panel-thumb"
                  onClick={() => setEnlargedImage(img.url)}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="results-panel-connections">
          <h3 className="results-panel-section-title">
            Connections ({connections.length})
          </h3>
          {connections.length === 0 ? (
            <p className="results-panel-no-data">No connections found</p>
          ) : (
            <ul className="results-panel-connection-list">
              {connections.slice(0, 20).map((c, i) => (
                <li
                  key={i}
                  className="results-panel-connection-item"
                  onClick={() => c.connectedNode && onNodeSelect(c.connectedNode)}
                >
                  <div className="results-panel-connection-info">
                    <span
                      className="results-panel-connection-dot"
                      style={{
                        background: c.connectedNode
                          ? ENTITY_COLORS[c.connectedNode.type as EntityType] || 'var(--hpe-text-weak)'
                          : 'var(--hpe-text-weak)',
                      }}
                    />
                    <span className="results-panel-connection-name">
                      {c.connectedNode?.name || 'Unknown'}
                    </span>
                  </div>
                  <span className="results-panel-connection-type">
                    {c.direction === 'outgoing' ? '→' : '←'} {c.edge.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {enlargedImage && (
        <div className="results-panel-enlarged-overlay" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} alt="Enlarged" className="results-panel-enlarged-img" />
        </div>
      )}
    </>
  )
}
