import { describe, expect, it } from 'vitest';
import { buildVehicleRoutes, urbanDistanceKm } from '../dispatch';
import {
  exportAuditCsv,
  exportDispatchJson,
  generateSampleCsv,
  parseWasteLotsCsv,
} from '../io';
import { runCycleArbitration } from '../router';
import { DEFAULT_PARAMS, URBAN_SCENARIOS } from '../scenarios';
import { assessLotSpoilage } from '../spoilage';
import type { WasteLot } from '../types';

describe('Spoilage Kinetics Engine (Q10 + FDA TCS)', () => {
  it('accelerates thermal decay monotonically under heatwave stress', () => {
    const scenario = URBAN_SCENARIOS[0];
    const produceLot = scenario.lots.find((l) => l.id === 'LOT-102')!;
    const cool = assessLotSpoilage(produceLot, 0);
    const warm = assessLotSpoilage(produceLot, 6);
    const extreme = assessLotSpoilage(produceLot, 12);

    expect(warm.effectiveTempC).toBeGreaterThan(cool.effectiveTempC);
    expect(warm.remainingDonationHours).toBeLessThan(cool.remainingDonationHours);
    expect(extreme.remainingDonationHours).toBeLessThanOrEqual(warm.remainingDonationHours);
    expect(cool.hourlyCurve).toHaveLength(8);
    expect(cool.hourlyCurve[0].viabilityPct).toBeGreaterThanOrEqual(
      cool.hourlyCurve[cool.hourlyCurve.length - 1].viabilityPct,
    );
  });

  it('enforces FDA TCS 4-hour cold-chain excursion block on high-risk protein', () => {
    const seafoodBreach: WasteLot = {
      id: 'LOT-TCS',
      label: 'Docked Salmon Excursion',
      generatorId: 'gen-harbor',
      material: 'seafood_meat',
      weightKg: 200,
      currentTempC: 9.5,
      targetTempC: 1.0,
      ageHours: 10,
      excursionHours: 4.5,
      moisturePct: 72,
      contaminationPct: 1,
      sealedPackaging: true,
      createdAtIso: '2026-11-20T07:00:00Z',
    };
    const assessment = assessLotSpoilage(seafoodBreach, 0);
    expect(assessment.remainingDonationHours).toBe(0);
    expect(assessment.riskBand).toBe('spoiled');
    expect(assessment.thermalExcursionFlag).toBe(true);
    expect(assessment.remainingFeedCompostHours).toBeGreaterThan(0);
  });
});

describe('CycleArbiter Router & Capacity Allocator', () => {
  it('routes Metro Cold-Chain Surge with high diversion, net CO2e abatement, and valid hub capacity bounds', () => {
    const scenario = URBAN_SCENARIOS[0];
    const result = runCycleArbitration(scenario, DEFAULT_PARAMS);

    expect(result.decisions).toHaveLength(scenario.lots.length);
    expect(result.summary.diversionRatePct).toBeGreaterThan(95);
    expect(result.summary.netCo2eSavedKg).toBeGreaterThan(3000);
    expect(result.summary.totalMealsRescued).toBeGreaterThan(2000);
    expect(result.summary.netEconomicValueUsd).toBeGreaterThan(1500);

    for (const util of result.hubUtilization) {
      expect(util.usedKg).toBeLessThanOrEqual(util.capacityKg);
      expect(util.utilizationPct).toBeLessThanOrEqual(100);
    }
  });

  it('blocks wet contaminated cardboard from MRF Recycling and diverts to Anaerobic Biogas', () => {
    const scenario = URBAN_SCENARIOS[0];
    const result = runCycleArbitration(scenario, DEFAULT_PARAMS);

    const wetCardboard = result.decisions.find((d) => d.lot.id === 'LOT-107')!;
    const dryCardboard = result.decisions.find((d) => d.lot.id === 'LOT-108')!;

    expect(wetCardboard.assignedTier).toBe('anaerobic_compost');
    expect(dryCardboard.assignedTier).toBe('mrf_recycling');

    const mrfCandidate = wetCardboard.candidates.find((c) => c.tier === 'mrf_recycling')!;
    expect(mrfCandidate.feasible).toBe(false);
    expect(mrfCandidate.rejectionReasons.some((r) => r.includes('Moisture'))).toBe(true);
  });

  it('blocks TCS-breached protein from Human Food Rescue while diverting to Biogas', () => {
    const scenario = URBAN_SCENARIOS[0];
    const result = runCycleArbitration(scenario, DEFAULT_PARAMS);

    const salmon = result.decisions.find((d) => d.lot.id === 'LOT-103')!;
    expect(salmon.assignedTier).toBe('anaerobic_compost');

    const foodBankCandidate = salmon.candidates.find((c) => c.tier === 'human_donation')!;
    expect(foodBankCandidate.feasible).toBe(false);
    expect(foodBankCandidate.rejectionReasons.some((r) => r.includes('FDA TCS'))).toBe(true);
  });

  it('runs all 3 scenarios and all 4 policies cleanly with positive diversion', () => {
    const policies = ['balanced', 'max_meals', 'max_carbon', 'min_cost'] as const;
    for (const scenario of URBAN_SCENARIOS) {
      for (const policy of policies) {
        const res = runCycleArbitration(scenario, { ...scenario.defaultParams, policy });
        expect(res.summary.totalWeightKg).toBeGreaterThan(0);
        expect(res.summary.diversionRatePct).toBeGreaterThan(80);
        expect(res.routes.length).toBeGreaterThan(0);
      }
    }
  });

  it('reduces rescued meals under severe ambient heatwave stress (+12C) and tightens MRF gates when tolerance drops', () => {
    const scenario = URBAN_SCENARIOS[0];
    const baseline = runCycleArbitration(scenario, DEFAULT_PARAMS);
    const heatwave = runCycleArbitration(scenario, {
      ...DEFAULT_PARAMS,
      ambientTempDeltaC: 12,
    });
    expect(heatwave.summary.totalMealsRescued).toBeLessThanOrEqual(
      baseline.summary.totalMealsRescued,
    );
    expect(heatwave.summary.criticalLotsCount).toBeGreaterThanOrEqual(
      baseline.summary.criticalLotsCount,
    );

    const strictContam = runCycleArbitration(scenario, {
      ...DEFAULT_PARAMS,
      contaminationToleranceDeltaPct: -6,
    });
    expect(strictContam.summary.contaminatedDowngradesCount).toBeGreaterThanOrEqual(
      baseline.summary.contaminatedDowngradesCount,
    );
  });
});

describe('2-Opt Precedence Vehicle Dispatch', () => {
  it('guarantees pickup precedes dropoff for every routed lot and calculates non-negative km savings', () => {
    const scenario = URBAN_SCENARIOS[0];
    const result = runCycleArbitration(scenario, DEFAULT_PARAMS);

    for (const route of result.routes) {
      const pickupIndex = new Map<string, number>();
      const dropoffIndex = new Map<string, number>();
      route.stops.forEach((stop, idx) => {
        for (const id of stop.lotIds) {
          if (stop.action === 'pickup') pickupIndex.set(id, idx);
          else dropoffIndex.set(id, idx);
        }
      });

      for (const [lotId, pIdx] of pickupIndex.entries()) {
        const dIdx = dropoffIndex.get(lotId);
        expect(dIdx).toBeDefined();
        expect(pIdx).toBeLessThan(dIdx!);
      }
      expect(route.distanceSavedKm).toBeGreaterThanOrEqual(0);
      expect(route.totalDistanceKm).toBeGreaterThan(0);
    }

    expect(urbanDistanceKm({ xKm: 0, yKm: 0 }, { xKm: 3, yKm: 4 })).toBeCloseTo(6.4, 1);
  });

  it('handles empty decision lists gracefully', () => {
    const routes = buildVehicleRoutes([], new Map(), new Map(), DEFAULT_PARAMS);
    expect(routes).toEqual([]);
  });
});

describe('CSV Import & Audit Ledger Export', () => {
  it('parses valid sample CSV and exports well-formed CSV and JSON manifests', () => {
    const scenario = URBAN_SCENARIOS[0];
    const sample = generateSampleCsv(scenario.generators[0].id);
    const parsed = parseWasteLotsCsv(
      sample,
      scenario.generators[0].id,
      scenario.generators.map((g) => g.id),
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.lots).toHaveLength(4);

    const combined = runCycleArbitration(scenario, DEFAULT_PARAMS, parsed.lots);
    expect(combined.decisions).toHaveLength(scenario.lots.length + 4);

    const csvOut = exportAuditCsv(combined);
    const csvLines = csvOut.split('\n');
    expect(csvLines).toHaveLength(scenario.lots.length + 5);
    expect(csvLines[0]).toContain('lot_id,label,material,weight_kg');

    const jsonOut = JSON.parse(exportDispatchJson(combined));
    expect(jsonOut.lotDecisions).toHaveLength(scenario.lots.length + 4);
    expect(jsonOut.summary.divertedWeightKg).toBeGreaterThan(0);
  });

  it('reports row-level validation errors on malformed CSV material or missing columns', () => {
    const badHeaders = parseWasteLotsCsv('foo,bar\n1,2', 'g1', ['g1']);
    expect(badHeaders.lots).toHaveLength(0);
    expect(badHeaders.errors[0]).toContain('Missing required columns');

    const badRow = parseWasteLotsCsv(
      'label,material,weight_kg\nTest,plutonium,100\nValid Bread,bakery,50',
      'g1',
      ['g1'],
    );
    expect(badRow.lots).toHaveLength(1);
    expect(badRow.errors).toHaveLength(1);
    expect(badRow.errors[0]).toContain('unknown material');
  });
});
