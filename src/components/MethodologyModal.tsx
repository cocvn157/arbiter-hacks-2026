import { BookOpen, X } from 'lucide-react';

interface MethodologyModalProps {
  onClose: () => void;
}

export function MethodologyModal({ onClose }: MethodologyModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Engine Methodology">
      <div className="modal-card">
        <div className="card-header">
          <div className="card-title">
            <BookOpen size={16} color="#059669" />
            <span>Scientific & Algorithmic Architecture</span>
          </div>
          <button type="button" className="btn" onClick={onClose} aria-label="Close methodology">
            <X size={14} />
          </button>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12.5, color: '#334155' }}>
          <div>
            <strong style={{ color: '#0F172A' }}>1. Q10 Thermal Spoilage Kinetics & FDA TCS Safety Gate</strong>
            <p style={{ margin: '4px 0 0' }}>
              Each perishable stream tracks cumulative biological aging using{' '}
              <code>rate(T) = Q10^((T_eff - T_ref)/10)</code>, weighted by dock temperature excursion
              history and insulated vs open packaging heat penetration. High-risk cold-chain items
              (dairy, seafood/meat, prepared meals) exceeding 4 hours in the danger zone are hard-blocked
              from human donation per FDA Time/Temperature Control for Safety (TCS) rules and redirected
              to anaerobic biogas or feed recovery.
            </p>
          </div>

          <div>
            <strong style={{ color: '#0F172A' }}>2. Moisture & Contamination MRF Protection</strong>
            <p style={{ margin: '4px 0 0' }}>
              Single-stream recyclables (corrugated cardboard, HDPE/PET) are gated by moisture and
              residue thresholds. Wet or grease-soaked fiber (&gt;14% moisture) is automatically diverted
              away from Optical MRFs into Anaerobic Fiber Pulping/Compost, preventing entire clean
              recycling bales from landfill rejection.
            </p>
          </div>

          <div>
            <strong style={{ color: '#0F172A' }}>3. EPA Circular Hierarchy & WARM Emissions Model</strong>
            <p style={{ margin: '4px 0 0' }}>
              Candidate hubs are scored via a priority-constrained multi-objective solver enforcing
              daily hub capacities, transit-time safety margins (transit + 1.25h buffer), avoided
              methane &amp; virgin production offsets (EPA WARM-aligned proxies), USDA 0.45 kg/meal
              food rescue equivalents, and municipal tipping fees ($82/ton baseline).
            </p>
          </div>

          <div>
            <strong style={{ color: '#0F172A' }}>4. Precedence-Constrained 2-Opt Fleet Dispatch</strong>
            <p style={{ margin: '4px 0 0' }}>
              Allocated lots are segregated into refrigerated vans vs dry trucks, packed by urgency
              and hub affinity under payload limits, and sequenced with nearest-neighbor + 2-opt
              local search guaranteeing every pickup strictly precedes its dropoff while minimizing
              urban tortuosity-adjusted route km (1.28× Euclidean) and fleet diesel CO2e.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
