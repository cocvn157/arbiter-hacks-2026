import { useState } from 'react';
import { AlertTriangle, Clock, ListFilter } from 'lucide-react';
import { MATERIAL_SPECS, TIER_META } from '../engine/constants';
import type { LotDecision, RiskBand } from '../engine/types';

interface TriageQueueProps {
  decisions: LotDecision[];
  selectedLotId: string;
  onSelectLot: (lotId: string) => void;
}

const RISK_STYLE: Record<RiskBand, { label: string; color: string; bg: string }> = {
  nominal: { label: 'Nominal', color: '#059669', bg: '#ECFDF5' },
  elevated: { label: 'Elevated', color: '#D97706', bg: '#FFFBEB' },
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
  spoiled: { label: 'TCS Blocked', color: '#991B1B', bg: '#FEE2E2' },
};

type QueueFilter = 'all' | 'urgent' | 'food_rescue' | 'material_compost';

export function TriageQueue({
  decisions,
  selectedLotId,
  onSelectLot,
}: TriageQueueProps) {
  const [filter, setFilter] = useState<QueueFilter>('all');

  const filtered = decisions.filter((d) => {
    if (filter === 'urgent') {
      return (
        d.spoilage.riskBand === 'critical' ||
        d.spoilage.riskBand === 'spoiled' ||
        d.spoilage.thermalExcursionFlag
      );
    }
    if (filter === 'food_rescue') {
      return (
        d.assignedTier === 'human_donation' ||
        d.assignedTier === 'upcycle_discount'
      );
    }
    if (filter === 'material_compost') {
      return (
        d.assignedTier !== 'human_donation' &&
        d.assignedTier !== 'upcycle_discount'
      );
    }
    return true;
  });

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">
            <ListFilter size={15} color="#059669" />
            <span>Priority Triage Queue</span>
          </div>
          <div className="card-subtitle">
            Ordered by Q10 spoilage urgency & cold-chain exposure
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(
            [
              ['all', `All (${decisions.length})`],
              ['urgent', 'Urgent'],
              ['food_rescue', 'Food Rescue'],
              ['material_compost', 'Circular / MRF'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="scenario-tab"
              style={{
                background: filter === key ? '#ECFDF5' : '#F8FAFC',
                color: filter === key ? '#059669' : '#475569',
                border: '1px solid',
                borderColor: filter === key ? '#A7F3D0' : '#E2E8F0',
              }}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="queue-list" role="listbox" aria-label="Waste and Surplus Lots">
        {filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontSize: 12.5 }}>
            No lots match this filter.
          </div>
        ) : (
          filtered.map((d) => {
            const selected = d.lot.id === selectedLotId;
            const tierMeta = TIER_META[d.assignedTier];
            const riskMeta = RISK_STYLE[d.spoilage.riskBand];
            const spec = MATERIAL_SPECS[d.lot.material];
            return (
              <button
                key={d.lot.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`queue-item ${selected ? 'selected' : ''}`}
                onClick={() => onSelectLot(d.lot.id)}
              >
                <div className="queue-row-top">
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F172A' }}>
                    <span style={{ color: '#64748B', marginRight: 6 }} className="tabular-nums">
                      {d.lot.id}
                    </span>
                    {d.lot.label}
                  </div>
                  <span
                    className="pill"
                    style={{ background: riskMeta.bg, color: riskMeta.color }}
                  >
                    {d.spoilage.riskBand === 'critical' || d.spoilage.riskBand === 'spoiled' ? (
                      <AlertTriangle size={11} />
                    ) : (
                      <Clock size={11} />
                    )}
                    {spec.edible
                      ? d.spoilage.remainingDonationHours > 0
                        ? `${d.spoilage.remainingDonationHours}h left`
                        : 'TCS Blocked'
                      : `${d.lot.moisturePct}% moist`}
                  </span>
                </div>

                <div className="queue-row-meta tabular-nums">
                  <span>
                    {spec.label} · <strong>{d.lot.weightKg} kg</strong> · {d.spoilage.effectiveTempC}°C
                  </span>
                  <span
                    className="pill"
                    style={{ background: tierMeta.bg, color: tierMeta.color }}
                  >
                    → {d.assignedHubName.split(' ').slice(0, 2).join(' ')} ({tierMeta.shortLabel})
                  </span>
                </div>

                <div className="queue-row-meta tabular-nums" style={{ fontSize: 11, color: '#64748B' }}>
                  <span>
                    {d.co2eSavedKg >= 0 ? `+${d.co2eSavedKg}` : d.co2eSavedKg} kg CO2e ·{' '}
                    {d.economicNetUsd >= 0 ? `+$${d.economicNetUsd}` : `-$${Math.abs(d.economicNetUsd)}`}
                  </span>
                  <span>
                    {d.mealsRescued > 0
                      ? `${d.mealsRescued.toLocaleString()} meals`
                      : `${d.distanceKm} km (${d.transitMinutes}m)`}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
