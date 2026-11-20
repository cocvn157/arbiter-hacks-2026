import { useState, type FormEvent } from 'react';
import { Download, FileSpreadsheet, Plus, X } from 'lucide-react';
import { MATERIAL_SPECS } from '../engine/constants';
import { generateSampleCsv, parseWasteLotsCsv } from '../engine/io';
import type { GeneratorNode, MaterialClass, WasteLot } from '../engine/types';

interface IntakeModalProps {
  generators: GeneratorNode[];
  onAddLots: (lots: WasteLot[]) => void;
  onClose: () => void;
}

export function IntakeModal({ generators, onAddLots, onClose }: IntakeModalProps) {
  const [tab, setTab] = useState<'single' | 'csv'>('single');

  const [label, setLabel] = useState('Chilled Milk & Yogurt Surplus');
  const [generatorId, setGeneratorId] = useState(generators[0]?.id ?? '');
  const [material, setMaterial] = useState<MaterialClass>('dairy');
  const [weightKg, setWeightKg] = useState(280);
  const [currentTempC, setCurrentTempC] = useState(6.2);
  const [ageHours, setAgeHours] = useState(12);
  const [excursionHours, setExcursionHours] = useState(2.0);
  const [moisturePct, setMoisturePct] = useState(60);
  const [contaminationPct, setContaminationPct] = useState(2);
  const [sealedPackaging, setSealedPackaging] = useState(true);

  const [csvText, setCsvText] = useState(() =>
    generateSampleCsv(generators[0]?.id ?? ''),
  );
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const handleMaterialChange = (mat: MaterialClass) => {
    setMaterial(mat);
    setCurrentTempC(MATERIAL_SPECS[mat].refTempC);
    setMoisturePct(mat === 'clean_cardboard' || mat === 'hdpe_pet_plastic' ? 8 : 65);
  };

  const handleSingleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const spec = MATERIAL_SPECS[material];
    const newLot: WasteLot = {
      id: `LOT-${Math.floor(400 + Math.random() * 500)}`,
      label: label.trim() || `${spec.label} Batch`,
      generatorId: generatorId || generators[0].id,
      material,
      weightKg: Math.max(10, Math.round(weightKg)),
      currentTempC,
      targetTempC: spec.refTempC,
      ageHours: Math.max(0, ageHours),
      excursionHours: Math.max(0, excursionHours),
      moisturePct: Math.min(100, Math.max(0, moisturePct)),
      contaminationPct: Math.min(100, Math.max(0, contaminationPct)),
      sealedPackaging,
      createdAtIso: new Date().toISOString(),
    };
    onAddLots([newLot]);
    onClose();
  };

  const handleCsvImport = () => {
    const res = parseWasteLotsCsv(
      csvText,
      generators[0]?.id ?? '',
      generators.map((g) => g.id),
    );
    if (res.errors.length > 0 && res.lots.length === 0) {
      setCsvErrors(res.errors);
      return;
    }
    setCsvErrors(res.errors);
    if (res.lots.length > 0) {
      onAddLots(res.lots);
      onClose();
    }
  };

  const downloadSample = () => {
    const content = generateSampleCsv(generators[0]?.id ?? 'gen-1');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cycle-arbiter-sample-lots.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Log Waste or Surplus Lots">
      <div className="modal-card">
        <div className="card-header">
          <div className="card-title">
            <Plus size={16} color="#059669" />
            <span>Log Commercial Surplus / Waste Stream</span>
          </div>
          <button type="button" className="btn" onClick={onClose} aria-label="Close modal">
            <X size={14} />
          </button>
        </div>

        <div className="card-body">
          <div className="scenario-tabs" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={`scenario-tab ${tab === 'single' ? 'active' : ''}`}
              onClick={() => setTab('single')}
            >
              Single Lot Entry
            </button>
            <button
              type="button"
              className={`scenario-tab ${tab === 'csv' ? 'active' : ''}`}
              onClick={() => setTab('csv')}
            >
              Batch CSV Import
            </button>
          </div>

          {tab === 'single' ? (
            <form onSubmit={handleSingleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-grid">
                <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Lot Description</span>
                  <input
                    className="form-input"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Origin Generator</span>
                  <select
                    className="form-input"
                    value={generatorId}
                    onChange={(e) => setGeneratorId(e.target.value)}
                  >
                    {generators.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Material Class</span>
                  <select
                    className="form-input"
                    value={material}
                    onChange={(e) => handleMaterialChange(e.target.value as MaterialClass)}
                  >
                    {(Object.keys(MATERIAL_SPECS) as MaterialClass[]).map((m) => (
                      <option key={m} value={m}>
                        {MATERIAL_SPECS[m].label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Mass (kg)</span>
                  <input
                    type="number"
                    className="form-input"
                    min={10}
                    max={10000}
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                  />
                </label>

                <label className="form-field">
                  <span>Measured Temp (°C)</span>
                  <input
                    type="number"
                    step={0.5}
                    className="form-input"
                    value={currentTempC}
                    onChange={(e) => setCurrentTempC(Number(e.target.value))}
                  />
                </label>

                <label className="form-field">
                  <span>Age Since Pack (h)</span>
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    className="form-input"
                    value={ageHours}
                    onChange={(e) => setAgeHours(Number(e.target.value))}
                  />
                </label>

                <label className="form-field">
                  <span>Cold Excursion Hours</span>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    max={48}
                    className="form-input"
                    value={excursionHours}
                    onChange={(e) => setExcursionHours(Number(e.target.value))}
                  />
                </label>

                <label className="form-field">
                  <span>Moisture (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="form-input"
                    value={moisturePct}
                    onChange={(e) => setMoisturePct(Number(e.target.value))}
                  />
                </label>

                <label className="form-field">
                  <span>Contamination (%)</span>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    max={100}
                    className="form-input"
                    value={contaminationPct}
                    onChange={(e) => setContaminationPct(Number(e.target.value))}
                  />
                </label>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={sealedPackaging}
                  onChange={(e) => setSealedPackaging(e.target.checked)}
                />
                Sealed insulated container / intact retail packaging
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={14} />
                  Route Lot via Arbiter
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#475569' }}>
                  Paste CSV rows or load a local `.csv` waste manifest:
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn" onClick={downloadSample}>
                    <Download size={13} />
                    Sample CSV
                  </button>
                  <label className="btn" style={{ cursor: 'pointer' }}>
                    <FileSpreadsheet size={13} />
                    Upload File
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        file.text().then((txt) => setCsvText(txt));
                      }}
                    />
                  </label>
                </div>
              </div>

              <textarea
                rows={7}
                className="form-input"
                style={{ fontFamily: 'monospace', fontSize: 11.5 }}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />

              {csvErrors.length > 0 && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#991B1B',
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: 11.5,
                  }}
                >
                  {csvErrors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleCsvImport}>
                  Import & Optimize Batch
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
