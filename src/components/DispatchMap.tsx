import { Navigation, Truck } from 'lucide-react';
import { TIER_META } from '../engine/constants';
import type {
  HubUtilization,
  LotDecision,
  RecoveryHub,
  UrbanScenario,
  VehicleRoute,
} from '../engine/types';

interface DispatchMapProps {
  scenario: UrbanScenario;
  decisions: LotDecision[];
  routes: VehicleRoute[];
  hubUtilization: HubUtilization[];
  selectedLotId: string;
  onSelectLot: (lotId: string) => void;
}

const SVG_W = 720;
const SVG_H = 305;
const PAD_X = 40;
const PAD_Y = 26;
const MAX_X_KM = 18.5;
const MAX_Y_KM = 12.2;

function toSvgX(xKm: number): number {
  return PAD_X + (xKm / MAX_X_KM) * (SVG_W - PAD_X * 2);
}

function toSvgY(yKm: number): number {
  return PAD_Y + (yKm / MAX_Y_KM) * (SVG_H - PAD_Y * 2);
}

export function DispatchMap({
  scenario,
  decisions,
  routes,
  hubUtilization,
  selectedLotId,
  onSelectLot,
}: DispatchMapProps) {
  const selectedDecision =
    decisions.find((d) => d.lot.id === selectedLotId) ?? decisions[0];

  const utilByHub = new Map<string, HubUtilization>(
    hubUtilization.map((u) => [u.hubId, u]),
  );

  const lotsByGen = new Map<string, LotDecision[]>();
  for (const d of decisions) {
    const arr = lotsByGen.get(d.lot.generatorId) ?? [];
    arr.push(d);
    lotsByGen.set(d.lot.generatorId, arr);
  }

  const selectedGen = selectedDecision
    ? scenario.generators.find((g) => g.id === selectedDecision.lot.generatorId)
    : undefined;
  const selectedHub = selectedDecision
    ? scenario.hubs.find((h) => h.id === selectedDecision.assignedHubId)
    : undefined;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <Navigation size={15} color="#0284C7" />
            <span>Spatial Dispatch & Cold-Chain Route Map</span>
          </div>
          <div className="card-subtitle">
            {scenario.cityLabel} · Click any generator or hub marker to inspect routed stream
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#475569', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: '#0F172A', display: 'inline-block' }} />
            Generator
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: '#059669', display: 'inline-block' }} />
            Recovery Hub
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 2.5, background: '#0284C7', display: 'inline-block' }} />
            Cold Van
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 2.5, background: '#6366F1', display: 'inline-block' }} />
            Dry Truck
          </span>
        </div>
      </div>

      <div className="card-body" style={{ padding: '12px 14px' }}>
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            role="img"
            aria-label="Urban Waste Routing Map"
          >
            {/* Coordinate grid */}
            {[0, 3, 6, 9, 12, 15, 18].map((km) => (
              <g key={`gx-${km}`}>
                <line
                  x1={toSvgX(km)}
                  y1={PAD_Y - 8}
                  x2={toSvgX(km)}
                  y2={SVG_H - PAD_Y + 8}
                  stroke="#E2E8F0"
                  strokeWidth={1}
                />
                <text
                  x={toSvgX(km)}
                  y={SVG_H - 8}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#94A3B8"
                >
                  {km}km
                </text>
              </g>
            ))}
            {[0, 3, 6, 9, 12].map((km) => (
              <line
                key={`gy-${km}`}
                x1={PAD_X - 10}
                y1={toSvgY(km)}
                x2={SVG_W - PAD_X + 10}
                y2={toSvgY(km)}
                stroke="#E2E8F0"
                strokeWidth={1}
              />
            ))}

            {/* Vehicle routes */}
            {routes.map((route, idx) => {
              const points = route.stops
                .map((s) => `${toSvgX(s.xKm)},${toSvgY(s.yKm)}`)
                .join(' ');
              const stroke = route.vehicleType === 'cold_van' ? '#0284C7' : '#6366F1';
              const dash = idx % 2 === 1 ? '5 4' : undefined;
              return (
                <polyline
                  key={route.vehicleId}
                  points={points}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={2.1}
                  strokeOpacity={0.58}
                  strokeDasharray={dash}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Highlighted active lot direct path */}
            {selectedGen && selectedHub && (
              <line
                x1={toSvgX(selectedGen.xKm)}
                y1={toSvgY(selectedGen.yKm)}
                x2={toSvgX(selectedHub.xKm)}
                y2={toSvgY(selectedHub.yKm)}
                stroke="#059669"
                strokeWidth={3.2}
                strokeDasharray="6 3"
              />
            )}

            {/* Recovery Hubs */}
            {scenario.hubs.map((hub: RecoveryHub) => {
              const cx = toSvgX(hub.xKm);
              const cy = toSvgY(hub.yKm);
              const meta = TIER_META[hub.tier];
              const util = utilByHub.get(hub.id);
              const isSelectedHub = selectedDecision?.assignedHubId === hub.id;
              const radius = hub.tier === 'landfill' ? 9 : 11;
              return (
                <g
                  key={hub.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    const match = decisions.find((d) => d.assignedHubId === hub.id);
                    if (match) onSelectLot(match.lot.id);
                  }}
                >
                  {isSelectedHub && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius + 6}
                      fill="none"
                      stroke={meta.color}
                      strokeWidth={2}
                      strokeOpacity={0.55}
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill={meta.bg}
                    stroke={meta.color}
                    strokeWidth={2.3}
                  />
                  <text
                    x={cx}
                    y={cy + 3.5}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill={meta.color}
                  >
                    {hub.tier === 'landfill' ? 'LF' : `T${meta.rank}`}
                  </text>
                  <text
                    x={cx}
                    y={cy - radius - 5}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight={600}
                    fill="#1E293B"
                    style={{ paintOrder: 'stroke', stroke: '#F8FAFC', strokeWidth: 3.5, strokeLinejoin: 'round' }}
                  >
                    {hub.name.split(' ').slice(0, 2).join(' ')}
                  </text>
                  {util && util.usedKg > 0 && (
                    <text
                      x={cx}
                      y={cy + radius + 11}
                      textAnchor="middle"
                      fontSize={8.5}
                      fill="#475569"
                      style={{ paintOrder: 'stroke', stroke: '#F8FAFC', strokeWidth: 3, strokeLinejoin: 'round' }}
                    >
                      {util.usedKg}kg ({util.utilizationPct.toFixed(0)}%)
                    </text>
                  )}
                </g>
              );
            })}

            {/* Generator Nodes */}
            {scenario.generators.map((gen) => {
              const gx = toSvgX(gen.xKm);
              const gy = toSvgY(gen.yKm);
              const gLots = lotsByGen.get(gen.id) ?? [];
              const hasCritical = gLots.some(
                (d) =>
                  d.spoilage.riskBand === 'critical' ||
                  d.spoilage.riskBand === 'spoiled',
              );
              const isSelectedGen = selectedDecision?.lot.generatorId === gen.id;
              return (
                <g
                  key={gen.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (gLots[0]) onSelectLot(gLots[0].lot.id);
                  }}
                >
                  {hasCritical && (
                    <circle
                      cx={gx}
                      cy={gy}
                      r={16}
                      fill="none"
                      stroke="#DC2626"
                      strokeWidth={1.6}
                      strokeDasharray="3 2"
                    />
                  )}
                  {isSelectedGen && (
                    <rect
                      x={gx - 14}
                      y={gy - 14}
                      width={28}
                      height={28}
                      rx={7}
                      fill="none"
                      stroke="#059669"
                      strokeWidth={2}
                    />
                  )}
                  <rect
                    x={gx - 10}
                    y={gy - 10}
                    width={20}
                    height={20}
                    rx={5}
                    fill="#0F172A"
                    stroke="#FFFFFF"
                    strokeWidth={1.8}
                  />
                  <text
                    x={gx}
                    y={gy + 3.5}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight={700}
                    fill="#FFFFFF"
                  >
                    {gLots.length}
                  </text>
                  <text
                    x={gx}
                    y={gy - 15}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight={700}
                    fill="#0F172A"
                    style={{ paintOrder: 'stroke', stroke: '#F8FAFC', strokeWidth: 3.5, strokeLinejoin: 'round' }}
                  >
                    {gen.name.split(' ').slice(0, 2).join(' ')}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Dispatched Fleet Summary */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 8,
            marginTop: 10,
          }}
        >
          {routes.map((r) => (
            <div
              key={r.vehicleId}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                fontSize: 11.5,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  marginBottom: 3,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Truck
                    size={13}
                    color={r.vehicleType === 'cold_van' ? '#0284C7' : '#6366F1'}
                  />
                  {r.vehicleId} ({r.vehicleType === 'cold_van' ? 'Chilled' : 'Ambient'})
                </span>
                <span className="tabular-nums" style={{ color: '#059669' }}>
                  {r.totalDistanceKm.toFixed(1)} km{' '}
                  {r.distanceSavedKm > 0.1 ? `(-${r.distanceSavedKm.toFixed(1)} km)` : '· Milk-run'}
                </span>
              </div>
              <div style={{ color: '#475569', fontSize: 11 }} className="tabular-nums">
                Load: {r.loadKg}/{r.capacityKg} kg · {r.stops.length} stops · {r.haulCo2eKg} kg CO2e
              </div>
              <div
                style={{
                  color: '#64748B',
                  fontSize: 10.5,
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={r.stops.map((s) => s.nodeName).join(' → ')}
              >
                {r.stops.map((s) => s.nodeName.split(' ')[0]).join(' → ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
