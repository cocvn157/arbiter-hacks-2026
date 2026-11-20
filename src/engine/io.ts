import { MATERIAL_SPECS, TIER_META } from './constants';
import type { MaterialClass, OptimizationResult, WasteLot } from './types';

const VALID_MATERIALS = new Set<MaterialClass>(
  Object.keys(MATERIAL_SPECS) as MaterialClass[],
);

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportAuditCsv(result: OptimizationResult): string {
  const header = [
    'lot_id',
    'label',
    'material',
    'weight_kg',
    'effective_temp_c',
    'remaining_donation_hours',
    'risk_band',
    'assigned_hub',
    'assigned_tier',
    'diverted',
    'distance_km',
    'transit_min',
    'meals_rescued',
    'co2e_saved_kg',
    'economic_net_usd',
    'primary_rationale',
  ].join(',');

  const rows = result.decisions.map((d) =>
    [
      d.lot.id,
      d.lot.label,
      MATERIAL_SPECS[d.lot.material].label,
      d.lot.weightKg,
      d.spoilage.effectiveTempC,
      d.spoilage.remainingDonationHours,
      d.spoilage.riskBand,
      d.assignedHubName,
      TIER_META[d.assignedTier].label,
      d.diverted ? 'YES' : 'NO',
      d.distanceKm,
      d.transitMinutes,
      d.mealsRescued,
      d.co2eSavedKg,
      d.economicNetUsd,
      d.rationale.join(' | '),
    ]
      .map(escapeCsvCell)
      .join(','),
  );

  return [header, ...rows].join('\n');
}

export function exportDispatchJson(result: OptimizationResult): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      engine: 'CycleArbiter v1.0 (Q10 Thermal Decay + EPA Circular Router + 2-Opt Dispatch)',
      scenarioId: result.scenarioId,
      summary: result.summary,
      tierBreakdownKg: result.tierBreakdownKg,
      vehicleRoutes: result.routes,
      lotDecisions: result.decisions.map((d) => ({
        lotId: d.lot.id,
        label: d.lot.label,
        material: d.lot.material,
        weightKg: d.lot.weightKg,
        assignedHub: d.assignedHubName,
        assignedTier: d.assignedTier,
        remainingDonationHours: d.spoilage.remainingDonationHours,
        riskBand: d.spoilage.riskBand,
        co2eSavedKg: d.co2eSavedKg,
        economicNetUsd: d.economicNetUsd,
        mealsRescued: d.mealsRescued,
        rationale: d.rationale,
      })),
    },
    null,
    2,
  );
}

export function generateSampleCsv(defaultGeneratorId: string): string {
  return [
    'label,material,weight_kg,current_temp_c,age_hours,excursion_hours,moisture_pct,contamination_pct,sealed_packaging,generator_id',
    `Organic Spinach & Strawberries,produce,310,6.5,14,1.5,72,2,true,${defaultGeneratorId}`,
    `Chilled Whole Milk Crates,dairy,240,8.2,18,3.1,64,1,true,${defaultGeneratorId}`,
    `Dry Corrugated Pallet Wraps,clean_cardboard,520,21.0,20,0,6,2,false,${defaultGeneratorId}`,
    `Office Laptop & UPS Batch,ewaste,185,22.0,30,0,2,1,true,${defaultGeneratorId}`,
  ].join('\n');
}

function splitCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

export interface CsvImportResult {
  lots: WasteLot[];
  errors: string[];
}

export function parseWasteLotsCsv(
  csvText: string,
  fallbackGeneratorId: string,
  validGeneratorIds: string[],
): CsvImportResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { lots: [], errors: ['CSV must contain a header row and at least one data row.'] };
  }

  const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => headers.indexOf(name);

  if (col('label') === -1 || col('material') === -1 || col('weight_kg') === -1) {
    return {
      lots: [],
      errors: ['Missing required columns: label, material, weight_kg'],
    };
  }

  const genSet = new Set(validGeneratorIds);
  const lots: WasteLot[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = splitCsvRow(lines[i]);
    const label = row[col('label')] || `Imported Lot #${i}`;
    const matRaw = (row[col('material')] ?? '').toLowerCase() as MaterialClass;
    if (!VALID_MATERIALS.has(matRaw)) {
      errors.push(`Row ${i + 1}: unknown material "${row[col('material')] ?? ''}"`);
      continue;
    }
    const weightKg = Number(row[col('weight_kg')]);
    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 25000) {
      errors.push(`Row ${i + 1}: invalid weight_kg "${row[col('weight_kg')] ?? ''}"`);
      continue;
    }

    const spec = MATERIAL_SPECS[matRaw];
    const numOr = (key: string, fallback: number) => {
      const idx = col(key);
      if (idx === -1 || row[idx] === undefined || row[idx] === '') return fallback;
      const v = Number(row[idx]);
      return Number.isFinite(v) ? v : fallback;
    };

    const rawGen = col('generator_id') !== -1 ? row[col('generator_id')] : '';
    const generatorId = genSet.has(rawGen) ? rawGen : fallbackGeneratorId;
    const sealedRaw = col('sealed_packaging') !== -1 ? row[col('sealed_packaging')].toLowerCase() : 'true';

    lots.push({
      id: `CSV-${100 + i}`,
      label,
      generatorId,
      material: matRaw,
      weightKg: Math.round(weightKg),
      currentTempC: numOr('current_temp_c', spec.refTempC),
      targetTempC: spec.refTempC,
      ageHours: Math.max(0, numOr('age_hours', 8)),
      excursionHours: Math.max(0, numOr('excursion_hours', 0)),
      moisturePct: Math.min(100, Math.max(0, numOr('moisture_pct', 20))),
      contaminationPct: Math.min(100, Math.max(0, numOr('contamination_pct', 2))),
      sealedPackaging: sealedRaw !== 'false' && sealedRaw !== '0' && sealedRaw !== 'no',
      createdAtIso: new Date().toISOString(),
    });
  }

  return { lots, errors };
}
