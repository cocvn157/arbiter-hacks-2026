import {
  COLD_VAN_CO2E_PER_KM,
  DRY_TRUCK_CO2E_PER_KM,
  FUEL_COST_PER_KM_USD,
  KG_PER_MEAL,
  LANDFILL_TIPPING_FEE_PER_TON_USD,
  MATERIAL_SPECS,
  MIN_TRANSIT_SAFETY_BUFFER_HOURS,
  POLICY_WEIGHTS,
  TIER_META,
} from './constants';
import { buildVehicleRoutes, urbanDistanceKm } from './dispatch';
import { assessLotSpoilage } from './spoilage';
import type {
  CandidateEvaluation,
  GeneratorNode,
  HubUtilization,
  LotDecision,
  OptimizationResult,
  RecoveryHub,
  RecoveryTier,
  SimulationParams,
  UrbanScenario,
  WasteLot,
} from './types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function evaluateCandidate(
  lot: WasteLot,
  generator: GeneratorNode,
  hub: RecoveryHub,
  remainingCapacityKg: number,
  remainingDonationHours: number,
  remainingFeedCompostHours: number,
  params: SimulationParams,
): CandidateEvaluation {
  const spec = MATERIAL_SPECS[lot.material];
  const policy = POLICY_WEIGHTS[params.policy];
  const distanceKm = urbanDistanceKm(generator, hub);
  const transitHours = distanceKm / Math.max(8, params.avgUrbanSpeedKmh);
  const transitMinutes = Math.round(transitHours * 60);
  const rejectionReasons: string[] = [];

  if (!hub.acceptedMaterials.includes(lot.material)) {
    rejectionReasons.push(`Does not accept ${spec.label}`);
  }

  if (remainingCapacityKg < lot.weightKg) {
    rejectionReasons.push(
      `Insufficient daily capacity (${Math.round(remainingCapacityKg)} kg left vs ${lot.weightKg} kg lot)`,
    );
  }

  const maxContam = Math.max(0, hub.maxContaminationPct + params.contaminationToleranceDeltaPct);
  if (lot.contaminationPct > maxContam) {
    rejectionReasons.push(
      `Contamination ${lot.contaminationPct}% exceeds hub limit (${maxContam.toFixed(1)}%)`,
    );
  }

  const maxMoist = Math.max(0, hub.maxMoisturePct + params.contaminationToleranceDeltaPct);
  if (lot.moisturePct > maxMoist) {
    rejectionReasons.push(
      `Moisture ${lot.moisturePct}% exceeds hub limit (${maxMoist.toFixed(1)}%)`,
    );
  }

  if (hub.tier === 'human_donation' || hub.tier === 'upcycle_discount') {
    if (!spec.edible) {
      rejectionReasons.push('Non-edible stream cannot enter human food tier');
    } else {
      if (remainingDonationHours <= 0) {
        rejectionReasons.push('Expired / failed FDA TCS cold-chain safety window');
      } else if (remainingDonationHours < transitHours + MIN_TRANSIT_SAFETY_BUFFER_HOURS) {
        rejectionReasons.push(
          `Transit (${transitMinutes}m) + 1.25h buffer exceeds ${remainingDonationHours.toFixed(1)}h shelf life`,
        );
      }
      if (spec.requiresColdChain && !hub.coldStorageAvailable) {
        rejectionReasons.push('Hub lacks chilled storage required for cold-chain stream');
      }
    }
  } else if (hub.tier === 'animal_feed' || hub.tier === 'anaerobic_compost') {
    if (
      lot.material !== 'clean_cardboard' &&
      remainingFeedCompostHours < transitHours
    ) {
      rejectionReasons.push('Biological window exhausted prior to transit');
    }
  }

  const transportFactor = spec.requiresColdChain ? COLD_VAN_CO2E_PER_KM : DRY_TRUCK_CO2E_PER_KM;
  const haulCo2eKg = distanceKm * transportFactor;
  const materialCo2eAvoided =
    (spec.landfillCo2ePerKg - spec.tierNetCo2ePerKg[hub.tier]) * lot.weightKg;
  const co2eSavedKg = round2(materialCo2eAvoided - haulCo2eKg);

  const avoidedTippingUsd = (lot.weightKg / 1000) * LANDFILL_TIPPING_FEE_PER_TON_USD;
  const recoveredValueUsd = lot.weightKg * hub.valuePerKgRecoveredUsd;
  const hubFeeUsd = (lot.weightKg / 1000) * hub.tippingOrHandlingFeePerTon;
  const fuelUsd = distanceKm * FUEL_COST_PER_KM_USD;
  const economicNetUsd =
    hub.tier === 'landfill'
      ? round2(-hubFeeUsd - fuelUsd)
      : round2(avoidedTippingUsd + recoveredValueUsd - hubFeeUsd - fuelUsd);

  const mealsRescued =
    hub.tier === 'human_donation' || hub.tier === 'upcycle_discount'
      ? Math.round(lot.weightKg / KG_PER_MEAL)
      : 0;

  const tierRank = TIER_META[hub.tier].rank;
  const tierScore = hub.tier === 'landfill' ? -250 : (8 - tierRank) * 24 * policy.tierWeight;
  const objectiveScore = round2(
    tierScore +
      co2eSavedKg * 0.45 * policy.carbonWeight +
      mealsRescued * 0.14 * policy.mealWeight +
      economicNetUsd * 0.35 * policy.costWeight -
      distanceKm * 0.9,
  );

  return {
    hubId: hub.id,
    hubName: hub.name,
    tier: hub.tier,
    feasible: rejectionReasons.length === 0,
    rejectionReasons,
    distanceKm,
    transitMinutes,
    co2eSavedKg,
    economicNetUsd,
    mealsRescued,
    objectiveScore,
  };
}

/**
 * Deterministic multi-objective circular waste stream arbitration & dispatch optimizer.
 */
export function runCycleArbitration(
  scenario: UrbanScenario,
  params: SimulationParams,
  extraLots: WasteLot[] = [],
): OptimizationResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const allLots = [...scenario.lots, ...extraLots];
  const generatorMap = new Map(scenario.generators.map((g) => [g.id, g]));
  const hubMap = new Map(scenario.hubs.map((h) => [h.id, h]));
  const remainingCapacity = new Map<string, number>(
    scenario.hubs.map((h) => [h.id, h.dailyCapacityKg]),
  );

  // Assess thermal decay & urgency for every lot first
  const assessed = allLots.map((lot) => ({
    lot,
    spoilage: assessLotSpoilage(lot, params.ambientTempDeltaC),
  }));

  // Allocate scarce higher-tier capacity to most urgent lots first (EDF + value tie-break)
  const prioritized = [...assessed].sort((a, b) => {
    if (b.spoilage.urgencyScore !== a.spoilage.urgencyScore) {
      return b.spoilage.urgencyScore - a.spoilage.urgencyScore;
    }
    return b.lot.weightKg - a.lot.weightKg;
  });

  const decisions: LotDecision[] = [];
  let contaminatedDowngradesCount = 0;

  for (const { lot, spoilage } of prioritized) {
    const generator = generatorMap.get(lot.generatorId) ?? scenario.generators[0];
    const candidates = scenario.hubs
      .map((hub) =>
        evaluateCandidate(
          lot,
          generator,
          hub,
          remainingCapacity.get(hub.id) ?? 0,
          spoilage.remainingDonationHours,
          spoilage.remainingFeedCompostHours,
          params,
        ),
      )
      .sort((a, b) => {
        if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
        return b.objectiveScore - a.objectiveScore;
      });

    const winner = candidates.find((c) => c.feasible) ?? candidates[candidates.length - 1];
    if (winner && winner.feasible) {
      remainingCapacity.set(
        winner.hubId,
        Math.max(0, (remainingCapacity.get(winner.hubId) ?? 0) - lot.weightKg),
      );
    }

    const rationale: string[] = [];
    const spec = MATERIAL_SPECS[lot.material];
    const rejectedHigherTiers = candidates.filter(
      (c) => !c.feasible && TIER_META[c.tier].rank < TIER_META[winner.tier].rank,
    );

    const hadContamRejection = rejectedHigherTiers.some((c) =>
      c.rejectionReasons.some(
        (r) => r.includes('Contamination') || r.includes('Moisture') || r.includes('TCS'),
      ),
    );
    if (hadContamRejection) {
      contaminatedDowngradesCount += 1;
    }

    if (winner.tier === 'landfill') {
      rationale.push('All higher-tier circular hubs failed safety, moisture, or capacity gates.');
    } else {
      rationale.push(
        `Matched to ${winner.hubName} (${TIER_META[winner.tier].label}) at ${winner.distanceKm} km (${winner.transitMinutes} min transit).`,
      );
      if (spec.edible && winner.mealsRescued > 0) {
        rationale.push(
          `Rescues ~${winner.mealsRescued.toLocaleString()} meal equivalents with ${spoilage.remainingDonationHours}h safe window left.`,
        );
      }
      if (rejectedHigherTiers.length > 0) {
        const topBlocked = rejectedHigherTiers[0];
        rationale.push(
          `Bypassed ${topBlocked.hubName}: ${topBlocked.rejectionReasons[0]}.`,
        );
      }
    }

    decisions.push({
      lot,
      spoilage,
      assignedHubId: winner.hubId,
      assignedHubName: winner.hubName,
      assignedTier: winner.tier,
      feasible: winner.feasible,
      diverted: winner.tier !== 'landfill',
      distanceKm: winner.distanceKm,
      transitMinutes: winner.transitMinutes,
      co2eSavedKg: winner.co2eSavedKg,
      economicNetUsd: winner.economicNetUsd,
      mealsRescued: winner.mealsRescued,
      rationale,
      candidates,
    });
  }

  // Sort display order by urgency descending
  decisions.sort((a, b) => b.spoilage.urgencyScore - a.spoilage.urgencyScore);

  const routes = buildVehicleRoutes(decisions, generatorMap, hubMap, params);

  const tierBreakdownKg: Record<RecoveryTier, number> = {
    human_donation: 0,
    upcycle_discount: 0,
    animal_feed: 0,
    anaerobic_compost: 0,
    mrf_recycling: 0,
    ewaste_refurbish: 0,
    landfill: 0,
  };

  let totalWeightKg = 0;
  let divertedWeightKg = 0;
  let totalMealsRescued = 0;
  let totalLotMaterialCo2eSaved = 0;
  let baselineLandfillCo2eKg = 0;
  let netEconomicValueUsd = 0;
  let baselineLandfillCostUsd = 0;
  let criticalLotsCount = 0;

  for (const d of decisions) {
    const spec = MATERIAL_SPECS[d.lot.material];
    totalWeightKg += d.lot.weightKg;
    tierBreakdownKg[d.assignedTier] += d.lot.weightKg;
    if (d.diverted) divertedWeightKg += d.lot.weightKg;
    totalMealsRescued += d.mealsRescued;
    baselineLandfillCo2eKg += d.lot.weightKg * spec.landfillCo2ePerKg;
    totalLotMaterialCo2eSaved +=
      (spec.landfillCo2ePerKg - spec.tierNetCo2ePerKg[d.assignedTier]) * d.lot.weightKg;
    baselineLandfillCostUsd += (d.lot.weightKg / 1000) * LANDFILL_TIPPING_FEE_PER_TON_USD;
    netEconomicValueUsd += d.economicNetUsd;
    if (d.spoilage.riskBand === 'critical' || d.spoilage.riskBand === 'spoiled') {
      criticalLotsCount += 1;
    }
  }

  const totalRouteDistanceKm = round2(routes.reduce((s, r) => s + r.totalDistanceKm, 0));
  const routeDistanceSavedKm = round2(routes.reduce((s, r) => s + r.distanceSavedKm, 0));
  const batchedHaulCo2e = routes.reduce((s, r) => s + r.haulCo2eKg, 0);
  const netCo2eSavedKg = round2(totalLotMaterialCo2eSaved - batchedHaulCo2e);

  const hubUtilization: HubUtilization[] = scenario.hubs.map((hub) => {
    const rem = remainingCapacity.get(hub.id) ?? hub.dailyCapacityKg;
    const usedKg = Math.round(hub.dailyCapacityKg - rem);
    return {
      hubId: hub.id,
      name: hub.name,
      tier: hub.tier,
      usedKg,
      capacityKg: hub.dailyCapacityKg,
      utilizationPct: hub.dailyCapacityKg > 0 ? Math.round((usedKg / hub.dailyCapacityKg) * 1000) / 10 : 0,
    };
  });

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    scenarioId: scenario.id,
    decisions,
    routes,
    hubUtilization,
    tierBreakdownKg,
    summary: {
      totalWeightKg: Math.round(totalWeightKg),
      divertedWeightKg: Math.round(divertedWeightKg),
      landfillWeightKg: Math.round(totalWeightKg - divertedWeightKg),
      diversionRatePct:
        totalWeightKg > 0 ? Math.round((divertedWeightKg / totalWeightKg) * 1000) / 10 : 0,
      totalMealsRescued,
      netCo2eSavedKg,
      baselineLandfillCo2eKg: round2(baselineLandfillCo2eKg),
      netEconomicValueUsd: round2(netEconomicValueUsd),
      baselineLandfillCostUsd: round2(baselineLandfillCostUsd),
      totalRouteDistanceKm,
      routeDistanceSavedKm,
      criticalLotsCount,
      contaminatedDowngradesCount,
      computeTimeMs: round2(Math.max(0.1, t1 - t0)),
    },
  };
}
