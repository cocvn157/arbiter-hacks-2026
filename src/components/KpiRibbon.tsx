import { DollarSign, Leaf, Recycle, Utensils } from 'lucide-react';
import type { OptimizationSummary } from '../engine/types';

interface KpiRibbonProps {
  summary: OptimizationSummary;
}

export function KpiRibbon({ summary }: KpiRibbonProps) {
  return (
    <section className="kpi-grid" aria-label="Impact Summary KPIs">
      <div className="kpi-card">
        <div className="kpi-header">
          <span>Landfill Diversion</span>
          <Recycle size={15} color="#059669" />
        </div>
        <div className="kpi-value tabular-nums" data-testid="kpi-diversion">
          {summary.diversionRatePct.toFixed(1)}%
        </div>
        <div className="kpi-sub tabular-nums">
          <span>
            {summary.divertedWeightKg.toLocaleString()} / {summary.totalWeightKg.toLocaleString()} kg diverted
          </span>
          <span
            className="pill"
            style={{
              background: summary.landfillWeightKg === 0 ? '#ECFDF5' : '#FEF2F2',
              color: summary.landfillWeightKg === 0 ? '#059669' : '#DC2626',
            }}
          >
            {summary.landfillWeightKg} kg landfill
          </span>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-header">
          <span>Edible Meals Rescued</span>
          <Utensils size={15} color="#0284C7" />
        </div>
        <div className="kpi-value tabular-nums" data-testid="kpi-meals">
          {summary.totalMealsRescued.toLocaleString()}
        </div>
        <div className="kpi-sub tabular-nums">
          <span>USDA 0.45 kg/meal equivalent</span>
          <span className="pill" style={{ background: '#F0F9FF', color: '#0284C7' }}>
            {summary.criticalLotsCount} {summary.criticalLotsCount === 1 ? 'urgent lot' : 'urgent lots'}
          </span>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-header">
          <span>Net CO2e Abatement</span>
          <Leaf size={15} color="#059669" />
        </div>
        <div className="kpi-value tabular-nums" data-testid="kpi-co2e">
          +{Math.round(summary.netCo2eSavedKg).toLocaleString()} kg
        </div>
        <div className="kpi-sub tabular-nums">
          <span>vs {Math.round(summary.baselineLandfillCo2eKg).toLocaleString()} kg landfill baseline</span>
          <span className="pill" style={{ background: '#ECFDF5', color: '#047857' }}>
            EPA WARM net
          </span>
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-header">
          <span>Net Circular Value</span>
          <DollarSign size={15} color="#0D9488" />
        </div>
        <div className="kpi-value tabular-nums" data-testid="kpi-economics">
          ${Math.round(summary.netEconomicValueUsd).toLocaleString()}
        </div>
        <div className="kpi-sub tabular-nums">
          <span>Avoids ${Math.round(summary.baselineLandfillCostUsd).toLocaleString()} tipping fee</span>
          <span className="pill" style={{ background: '#F0FDFA', color: '#0F766E' }}>
            -{summary.routeDistanceSavedKm.toFixed(1)} km haul
          </span>
        </div>
      </div>
    </section>
  );
}
