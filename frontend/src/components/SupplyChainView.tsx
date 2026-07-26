import type { SupplyChainReport } from '../types'
import './SupplyChainView.css'

interface Props {
  report: SupplyChainReport
}

function RiskDot({ level }: { level: 'low' | 'medium' | 'high' }) {
  const colors = { low: '#01a982', medium: '#f0a030', high: '#e74c3c' }
  return <span className="sc-risk-dot" style={{ background: colors[level] }} />
}

function TierBar({ items, label }: { items: { name: string; via?: string; relationship?: string }[]; label: string }) {
  if (items.length === 0) return null
  return (
    <div className="sc-tier">
      <div className="sc-tier-header">
        <span className="sc-tier-badge">{label}</span>
        <span className="sc-tier-count">{items.length}</span>
      </div>
      <div className="sc-tier-items">
        {items.map((item, i) => (
          <div key={i} className="sc-tier-item">
            <span className="sc-tier-name">{item.name}</span>
            {item.via && <span className="sc-tier-via">via {item.via}</span>}
            {item.relationship && <span className="sc-tier-rel">{item.relationship}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SupplyChainView({ report }: Props) {
  return (
    <div className="sc-view">
      <div className="sc-summary">{report.summary}</div>

      <div className="sc-layout">
        <div className="sc-chain">
          <TierBar items={report.tier_1} label="Tier 1 (Direct)" />
          <TierBar items={report.tier_2} label="Tier 2 (Sub-suppliers)" />
        </div>

        <div className="sc-sidebar">
          {report.locations.length > 0 && (
            <div className="sc-section">
              <h3 className="sc-section-title">Locations ({report.locations.length})</h3>
              <div className="sc-location-list">
                {report.locations.map((loc, i) => (
                  <div key={i} className={`sc-location ${loc.risk ? 'sc-location-risk' : ''}`}>
                    <RiskDot level={loc.risk ? 'high' : 'low'} />
                    <div>
                      <div className="sc-location-name">{loc.name}</div>
                      {loc.description && <div className="sc-location-desc">{loc.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.geo_risks.length > 0 && (
            <div className="sc-section sc-risk-section">
              <h3 className="sc-section-title sc-risk-title">Geographic Risks ({report.geo_risks.length})</h3>
              {report.geo_risks.map((risk, i) => (
                <div key={i} className="sc-risk-item">
                  <RiskDot level="high" />
                  <span>{risk.region}</span>
                  <span className="sc-risk-loc">{risk.location}</span>
                </div>
              ))}
            </div>
          )}

          {report.single_source_deps.length > 0 && (
            <div className="sc-section sc-risk-section">
              <h3 className="sc-section-title sc-risk-title">Single-Source Dependencies</h3>
              {report.single_source_deps.map((dep, i) => (
                <div key={i} className="sc-risk-item">
                  <RiskDot level="medium" />
                  <span>{dep.name}</span>
                  <span className="sc-risk-count">{dep.connections} connection</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
