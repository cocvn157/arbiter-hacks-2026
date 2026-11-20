import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { POLICY_WEIGHTS, TIER_META } from '../engine/constants';
import type {
  HubUtilization,
  PolicyMode,
  RecoveryTier,
  SimulationParams,
} from '../engine/types';

interface SimulatorPanelProps {
  params: SimulationParams;
  tierBreakdownKg: Record<RecoveryTier, number>;
  totalWeightKg: number;
  hubUtilization: HubUtilization[];
  computeTimeMs: number;
  onChangeParams: (next: SimulationParams) => void;
  onResetParams: () => void;
}

const ORDERED_TIERS: RecoveryTier[] = [
  'human_donation',
  'upcycle_discount',
  'animal_feed',
  'anaerobic_compost',
  'mrf_recycling',
  'ewaste_refurbish',
  'landfill',
];

export function SimulatorPanel({
  params,
  tierBreakdownKg,
  totalWeightKg,
  hubUtilization,
  computeTimeMs,
  onChangeParams,
  onResetParams,
}: SimulatorPanelProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <SlidersHorizontal size={15} color="#059669" />
            <span>Policy & Stress Simulator</span>
          </div>
          <div className="card-subtitle tabular-nums">
            Live client-side arbitration ({computeTimeMs.toFixed(1)} ms solve)
          </div>
        </div>
        <button type="button" className="btn" onClick={onResetParams}>
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      <div className="card-body">
        <div className="policy-grid" role="group" aria-label="Optimization Policy">
          {(Object.keys(POLICY_WEIGHTS) as PolicyMode[]).map((key) => {
            const p = POLICY_WEIGHTS[key];
            const active = params.policy === key;
            return (
              <button
                key={key}
                type="button"
                className={`policy-btn ${active ? 'active' : ''}`}
                onClick={() => onChangeParams({ ...params, policy: key })}
                title={p.description}
              >
                <div className="policy-btn-title">{p.label}</div>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>
                  {key === 'balanced'
                    ? 'All-round optimum'
                    : key === 'max_meals'
                      ? 'Food rescue priority'
                      : key === 'max_carbon'
                        ? 'Peak GHG offset'
                        : 'Lowest haul & tip'}
                </div>
              </button>
            );
          })}
        </div>

        <div className="slider-grid">
          <label className="slider-field">
            <span className="slider-label-row">
              <span>Ambient Heatwave Stress</span>
              <span className="tabular-nums" style={{ color: params.ambientTempDeltaC >= 6 ? '#DC2626' : '#059669' }}>
                +{params.ambientTempDeltaC}°C
              </span>
            </span>
            <input
              type="range"
              aria-label="Ambient Heatwave Stress"
              min={0}
              max={12}
              step={1}
              value={params.ambientTempDeltaC}
              onChange={(e) =>
                onChangeParams({
                  ...params,
                  ambientTempDeltaC: Number(e.target.value),
                })
              }
            />
          </label>

          <label className="slider-field">
            <span className="slider-label-row">
              <span>Contamination / Moisture Gate</span>
              <span className="tabular-nums">
                {params.contaminationToleranceDeltaPct >= 0 ? '+' : ''}
                {params.contaminationToleranceDeltaPct}%
              </span>
            </span>
            <input
              type="range"
              aria-label="Contamination Tolerance Delta"
              min={-8}
              max={8}
              step={1}
              value={params.contaminationToleranceDeltaPct}
              onChange={(e) =>
                onChangeParams({
                  ...params,
                  contaminationToleranceDeltaPct: Number(e.target.value),
                })
              }
            />
          </label>

          <label className="slider-field">
            <span className="slider-label-row">
              <span>Refrigerated Vans</span>
              <span className="tabular-nums">{params.coldVansCount} active</span>
            </span>
            <input
              type="range"
              aria-label="Refrigerated Vans"
              min={1}
              max={5}
              step={1}
              value={params.coldVansCount}
              onChange={(e) =>
                onChangeParams({
                  ...params,
                  coldVansCount: Number(e.target.value),
                })
              }
            />
          </label>

          <label className="slider-field">
            <span className="slider-label-row">
              <span>Dry / MRF Haul Trucks</span>
              <span className="tabular-nums">{params.dryTrucksCount} active</span>
            </span>
            <input
              type="range"
              aria-label="Dry Haul Trucks"
              min={1}
              max={4}
              step={1}
              value={params.dryTrucksCount}
              onChange={(e) =>
                onChangeParams({
                  ...params,
                  dryTrucksCount: Number(e.target.value),
                })
              }
            />
          </label>
        </div>

        {/* EPA Hierarchy Distribution */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
            <span>EPA Circular Hierarchy Allocation</span>
            <span className="tabular-nums" style={{ color: '#475569' }}>
              {totalWeightKg.toLocaleString()} kg total
            </span>
          </div>
          <div className="tier-bar-track" aria-label="EPA Hierarchy Allocation Bar">
            {ORDERED_TIERS.map((tier) => {
              const kg = tierBreakdownKg[tier] ?? 0;
              if (kg <= 0 || totalWeightKg <= 0) return null;
              const pct = (kg / totalWeightKg) * 100;
              return (
                <div
                  key={tier}
                  title={`${TIER_META[tier].label}: ${kg} kg (${pct.toFixed(1)}%)`}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: TIER_META[tier].color,
                    transition: 'width 0.2s ease',
                  }}
                />
              );
            })}
          </div>
          <div className="tier-legend">
            {ORDERED_TIERS.map((tier) => {
              const kg = tierBreakdownKg[tier] ?? 0;
              if (kg <= 0) return null;
              return (
                <span key={tier} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} className="tabular-nums">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 99,
                      background: TIER_META[tier].color,
                    }}
                  />
                  {TIER_META[tier].shortLabel}: <strong>{kg} kg</strong>
                </span>
              );
            })}
          </div>
        </div>

        {/* Hub Daily Capacity Utilization */}
        <div className="hub-grid">
          {hubUtilization
            .filter((h) => h.tier !== 'landfill' || h.usedKg > 0)
            .map((h) => {
              const meta = TIER_META[h.tier];
              return (
                <div key={h.hubId} className="hub-gauge">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11.5,
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.name}
                    </span>
                    <span className="tabular-nums" style={{ color: meta.color }}>
                      {h.utilizationPct.toFixed(0)}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 99,
                      background: '#E2E8F0',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, h.utilizationPct)}%`,
                        height: '100%',
                        background: meta.color,
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 3 }} className="tabular-nums">
                    {h.usedKg.toLocaleString()} / {h.capacityKg.toLocaleString()} kg
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
