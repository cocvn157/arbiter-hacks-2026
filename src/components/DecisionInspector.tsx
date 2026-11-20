import { CheckCircle2, Info, ShieldAlert, XCircle } from 'lucide-react';
import { MATERIAL_SPECS, TIER_META } from '../engine/constants';
import type { LotDecision } from '../engine/types';

interface DecisionInspectorProps {
  decision?: LotDecision;
}

export function DecisionInspector({ decision }: DecisionInspectorProps) {
  if (!decision) {
    return (
      <div className="card">
        <div className="card-body" style={{ color: '#64748B', fontSize: 13 }}>
          Select a waste or surplus lot from the queue to inspect its thermal decay curve and arbitration trace.
        </div>
      </div>
    );
  }

  const { lot, spoilage, candidates, rationale } = decision;
  const spec = MATERIAL_SPECS[lot.material];
  const tierMeta = TIER_META[decision.assignedTier];

  // Build SVG path for 0..48h viability curve
  const W = 380;
  const H = 96;
  const padL = 26;
  const padR = 12;
  const padT = 10;
  const padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const coords = spoilage.hourlyCurve.map((pt) => {
    const x = padL + (pt.hour / 48) * plotW;
    const y = padT + (1 - pt.viabilityPct / 100) * plotH;
    return { ...pt, x, y };
  });

  const linePath = coords
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${padT + plotH} L${coords[0].x.toFixed(1)},${padT + plotH} Z`;
  const curveColor =
    spoilage.riskBand === 'spoiled' || spoilage.riskBand === 'critical'
      ? '#DC2626'
      : spoilage.riskBand === 'elevated'
        ? '#D97706'
        : '#059669';

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Info size={15} color="#0284C7" />
            <span>Arbiter Decision Trace · {lot.id}</span>
          </div>
          <div className="card-subtitle">
            {lot.label} ({lot.weightKg} kg · {spec.label})
          </div>
        </div>
        <span className="pill" style={{ background: tierMeta.bg, color: tierMeta.color }}>
          {tierMeta.label}
        </span>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Spoilage Forecast Sparkline */}
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 9,
            padding: '8px 10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11.5,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            <span>Q10 Thermal Viability Forecast (0h → 48h)</span>
            <span className="tabular-nums" style={{ color: curveColor }}>
              {spoilage.viabilityPct.toFixed(0)}% now · {spoilage.effectiveTempC}°C eff.
            </span>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            aria-label="Thermal Viability Curve"
          >
            {[0, 50, 100].map((pct) => {
              const y = padT + (1 - pct / 100) * plotH;
              return (
                <g key={pct}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E2E8F0" strokeWidth={1} />
                  <text x={padL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="#94A3B8">
                    {pct}%
                  </text>
                </g>
              );
            })}
            <path d={areaPath} fill={curveColor} fillOpacity={0.14} />
            <path d={linePath} fill="none" stroke={curveColor} strokeWidth={2.2} />
            {coords.map((pt) => (
              <g key={pt.hour}>
                <circle cx={pt.x} cy={pt.y} r={2.4} fill={curveColor} />
                <text
                  x={pt.x}
                  y={H - 5}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#64748B"
                >
                  {pt.hour}h
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Plain-English Arbitration Rationale */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {rationale.map((line, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                fontSize: 12,
                color: '#1E293B',
              }}
            >
              {line.includes('Bypassed') || line.includes('failed') ? (
                <ShieldAlert size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
              ) : (
                <CheckCircle2 size={14} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
              )}
              <span>{line}</span>
            </div>
          ))}
        </div>

        {/* Ranked Candidate Hub Matrix */}
        <div style={{ overflowX: 'auto' }}>
          <table className="cand-table">
            <thead>
              <tr>
                <th>Candidate Hub</th>
                <th>Status</th>
                <th>Dist</th>
                <th>CO2e</th>
                <th>Net $</th>
              </tr>
            </thead>
            <tbody>
              {candidates.slice(0, 5).map((c) => {
                const isWinner = c.hubId === decision.assignedHubId;
                return (
                  <tr
                    key={c.hubId}
                    style={{
                      background: isWinner ? '#F0FDF4' : undefined,
                      fontWeight: isWinner ? 600 : 400,
                    }}
                  >
                    <td>
                      <div>{c.hubName}</div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>
                        {TIER_META[c.tier].shortLabel}
                      </div>
                    </td>
                    <td>
                      {c.feasible ? (
                        <span
                          style={{
                            color: isWinner ? '#059669' : '#0284C7',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <CheckCircle2 size={11} />
                          {isWinner ? 'Selected' : 'Feasible'}
                        </span>
                      ) : (
                        <span
                          style={{
                            color: '#DC2626',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                          title={c.rejectionReasons.join('; ')}
                        >
                          <XCircle size={11} />
                          {c.rejectionReasons[0]}
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums">{c.distanceKm}km</td>
                    <td className="tabular-nums">
                      {c.co2eSavedKg >= 0 ? `+${c.co2eSavedKg}` : c.co2eSavedKg}
                    </td>
                    <td className="tabular-nums">
                      {c.economicNetUsd >= 0 ? `+$${c.economicNetUsd}` : `-$${Math.abs(c.economicNetUsd)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
