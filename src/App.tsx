import { useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  FileJson,
  Plus,
  Recycle,
  Trash2,
} from 'lucide-react';
import { DecisionInspector } from './components/DecisionInspector';
import { DispatchMap } from './components/DispatchMap';
import { IntakeModal } from './components/IntakeModal';
import { KpiRibbon } from './components/KpiRibbon';
import { MethodologyModal } from './components/MethodologyModal';
import { SimulatorPanel } from './components/SimulatorPanel';
import { TriageQueue } from './components/TriageQueue';
import { exportAuditCsv, exportDispatchJson } from './engine/io';
import { runCycleArbitration } from './engine/router';
import { URBAN_SCENARIOS } from './engine/scenarios';
import type { SimulationParams, WasteLot } from './engine/types';

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const [scenarioId, setScenarioId] = useState(URBAN_SCENARIOS[0].id);
  const activeScenario = useMemo(
    () => URBAN_SCENARIOS.find((s) => s.id === scenarioId) ?? URBAN_SCENARIOS[0],
    [scenarioId],
  );

  const [params, setParams] = useState<SimulationParams>(
    URBAN_SCENARIOS[0].defaultParams,
  );
  const [extraLotsByScenario, setExtraLotsByScenario] = useState<
    Record<string, WasteLot[]>
  >({});
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [showIntake, setShowIntake] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  const extraLots = extraLotsByScenario[activeScenario.id] ?? [];

  const result = useMemo(
    () => runCycleArbitration(activeScenario, params, extraLots),
    [activeScenario, params, extraLots],
  );

  const effectiveSelectedId = useMemo(() => {
    if (result.decisions.some((d) => d.lot.id === selectedLotId)) {
      return selectedLotId;
    }
    return result.decisions[0]?.lot.id ?? '';
  }, [result.decisions, selectedLotId]);

  const selectedDecision = useMemo(
    () => result.decisions.find((d) => d.lot.id === effectiveSelectedId),
    [result.decisions, effectiveSelectedId],
  );

  const handleSelectScenario = (nextId: string) => {
    const nextScenario =
      URBAN_SCENARIOS.find((s) => s.id === nextId) ?? URBAN_SCENARIOS[0];
    setScenarioId(nextId);
    setParams(nextScenario.defaultParams);
    setSelectedLotId('');
  };

  const handleAddLots = (newLots: WasteLot[]) => {
    setExtraLotsByScenario((prev) => ({
      ...prev,
      [activeScenario.id]: [...(prev[activeScenario.id] ?? []), ...newLots],
    }));
    if (newLots[0]) {
      setSelectedLotId(newLots[0].id);
    }
  };

  const handleClearExtraLots = () => {
    setExtraLotsByScenario((prev) => ({ ...prev, [activeScenario.id]: [] }));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">
              <Recycle size={19} strokeWidth={2.3} />
            </div>
            <div>
              <div className="brand-title">CycleArbiter</div>
              <div className="brand-sub">
                Cold-Chain Spoilage Kinetics & Circular Waste Routing Engine
              </div>
            </div>
          </div>

          <div className="topbar-controls">
            <div className="scenario-tabs" role="tablist" aria-label="Urban Waste Scenarios">
              {URBAN_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  role="tab"
                  aria-selected={sc.id === activeScenario.id}
                  className={`scenario-tab ${sc.id === activeScenario.id ? 'active' : ''}`}
                  onClick={() => handleSelectScenario(sc.id)}
                >
                  {sc.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowIntake(true)}
            >
              <Plus size={14} />
              Log Lot / CSV
            </button>

            {extraLots.length > 0 && (
              <button
                type="button"
                className="btn"
                onClick={handleClearExtraLots}
                title="Remove custom added lots"
              >
                <Trash2 size={13} color="#DC2626" />
                Clear ({extraLots.length})
              </button>
            )}

            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadTextFile(
                  `${activeScenario.id}-audit-ledger.csv`,
                  exportAuditCsv(result),
                  'text/csv;charset=utf-8',
                )
              }
            >
              <Download size={13} />
              Audit CSV
            </button>

            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadTextFile(
                  `${activeScenario.id}-dispatch.json`,
                  exportDispatchJson(result),
                  'application/json',
                )
              }
            >
              <FileJson size={13} />
              Manifest JSON
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => setShowMethodology(true)}
            >
              <BookOpen size={13} />
              Model Spec
            </button>
          </div>
        </div>
      </header>

      <main className="main-container">
        <KpiRibbon summary={result.summary} />

        <div className="workbench">
          <div className="col-stack">
            <DispatchMap
              scenario={activeScenario}
              decisions={result.decisions}
              routes={result.routes}
              hubUtilization={result.hubUtilization}
              selectedLotId={effectiveSelectedId}
              onSelectLot={setSelectedLotId}
            />
            <SimulatorPanel
              params={params}
              tierBreakdownKg={result.tierBreakdownKg}
              totalWeightKg={result.summary.totalWeightKg}
              hubUtilization={result.hubUtilization}
              computeTimeMs={result.summary.computeTimeMs}
              onChangeParams={setParams}
              onResetParams={() => setParams(activeScenario.defaultParams)}
            />
          </div>

          <div className="col-stack">
            <TriageQueue
              decisions={result.decisions}
              selectedLotId={effectiveSelectedId}
              onSelectLot={setSelectedLotId}
            />
            <DecisionInspector decision={selectedDecision} />
          </div>
        </div>
      </main>

      {showIntake && (
        <IntakeModal
          generators={activeScenario.generators}
          onAddLots={handleAddLots}
          onClose={() => setShowIntake(false)}
        />
      )}

      {showMethodology && (
        <MethodologyModal onClose={() => setShowMethodology(false)} />
      )}
    </div>
  );
}

export default App;
