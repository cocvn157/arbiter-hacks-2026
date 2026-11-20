import { COLD_VAN_CO2E_PER_KM, DRY_TRUCK_CO2E_PER_KM, MATERIAL_SPECS } from './constants';
import type { GeneratorNode, LotDecision, RecoveryHub, RouteStop, SimulationParams, VehicleRoute } from './types';

const URBAN_TORTUOSITY_FACTOR = 1.28;

export function urbanDistanceKm(
  a: { xKm: number; yKm: number },
  b: { xKm: number; yKm: number },
): number {
  const dx = a.xKm - b.xKm;
  const dy = a.yKm - b.yKm;
  return Math.round(Math.hypot(dx, dy) * URBAN_TORTUOSITY_FACTOR * 100) / 100;
}

function pathDistanceKm(stops: RouteStop[]): number {
  if (stops.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < stops.length; i++) {
    total += urbanDistanceKm(stops[i - 1], stops[i]);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Improves pickup/dropoff ordering via 2-opt swaps while keeping every lot's
 * pickup strictly before its destination dropoff (precedence-constrained 2-opt).
 */
function twoOptWithPrecedence(
  stops: RouteStop[],
  lotPickupStopIndex: Map<string, string>,
): RouteStop[] {
  if (stops.length <= 3) return stops;
  let best = [...stops];
  let bestDist = pathDistanceKm(best);

  const isValidOrder = (candidate: RouteStop[]): boolean => {
    const pos = new Map<string, number>();
    candidate.forEach((s, idx) => {
      if (s.action === 'pickup') {
        for (const lotId of s.lotIds) {
          pos.set(lotId, idx);
        }
      }
    });
    for (let idx = 0; idx < candidate.length; idx++) {
      const stop = candidate[idx];
      if (stop.action === 'dropoff') {
        for (const lotId of stop.lotIds) {
          const pIdx = pos.get(lotId);
          if (pIdx === undefined || pIdx > idx) return false;
        }
      }
    }
    return Boolean(lotPickupStopIndex);
  };

  let improved = true;
  let passes = 0;
  while (improved && passes < 12) {
    improved = false;
    passes += 1;
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        if (!isValidOrder(candidate)) continue;
        const dist = pathDistanceKm(candidate);
        if (dist + 0.01 < bestDist) {
          best = candidate;
          bestDist = dist;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * Groups routed waste/surplus lots into refrigerated vs dry fleet loops,
 * sequences stops using nearest-neighbor + precedence-preserving 2-opt,
 * and computes haul CO2e and km saved relative to unbatched point-to-point runs.
 */
export function buildVehicleRoutes(
  decisions: LotDecision[],
  generators: Map<string, GeneratorNode>,
  hubs: Map<string, RecoveryHub>,
  params: SimulationParams,
): VehicleRoute[] {
  const coldLots = decisions.filter((d) => MATERIAL_SPECS[d.lot.material].requiresColdChain);
  const dryLots = decisions.filter((d) => !MATERIAL_SPECS[d.lot.material].requiresColdChain);

  const packFleet = (
    groupLots: LotDecision[],
    vehicleType: 'cold_van' | 'dry_truck',
    maxVehicles: number,
  ): VehicleRoute[] => {
    if (groupLots.length === 0) return [];
    // Sort by urgency descending so critical lots get earliest pickup
    const sorted = [...groupLots].sort(
      (a, b) => b.spoilage.urgencyScore - a.spoilage.urgencyScore || b.lot.weightKg - a.lot.weightKg,
    );

    const bins: LotDecision[][] = Array.from({ length: Math.max(1, maxVehicles) }, () => []);
    const binWeights = new Array(bins.length).fill(0);

    for (const dec of sorted) {
      // Choose lightest bin that stays under vanCapacityKg, or least loaded overall if overflow
      let targetIdx = 0;
      let bestScore = Infinity;
      for (let i = 0; i < bins.length; i++) {
        const projected = binWeights[i] + dec.lot.weightKg;
        const fits = projected <= params.vanCapacityKg;
        // Prefer batching near same destination hub if already in bin
        const sameHubBonus = bins[i].some((x) => x.assignedHubId === dec.assignedHubId) ? -120 : 0;
        const score = (fits ? 0 : 10000) + binWeights[i] + sameHubBonus;
        if (score < bestScore) {
          bestScore = score;
          targetIdx = i;
        }
      }
      bins[targetIdx].push(dec);
      binWeights[targetIdx] += dec.lot.weightKg;
    }

    const routes: VehicleRoute[] = [];
    const co2Factor = vehicleType === 'cold_van' ? COLD_VAN_CO2E_PER_KM : DRY_TRUCK_CO2E_PER_KM;

    bins.forEach((assigned, idx) => {
      if (assigned.length === 0) return;

      // Aggregate pickups by generator and dropoffs by hub
      const pickupsByGen = new Map<string, LotDecision[]>();
      const dropoffsByHub = new Map<string, LotDecision[]>();
      const lotToPickupNode = new Map<string, string>();
      let unbatchedDistanceKm = 0;

      for (const d of assigned) {
        unbatchedDistanceKm += d.distanceKm;
        const genList = pickupsByGen.get(d.lot.generatorId) ?? [];
        genList.push(d);
        pickupsByGen.set(d.lot.generatorId, genList);

        const hubList = dropoffsByHub.get(d.assignedHubId) ?? [];
        hubList.push(d);
        dropoffsByHub.set(d.assignedHubId, hubList);

        lotToPickupNode.set(d.lot.id, d.lot.generatorId);
      }

      // Nearest-neighbor constructive sequence across pickups then dropoffs
      const pickupStops: RouteStop[] = [];
      const unvisitedGens = new Set(pickupsByGen.keys());
      // Start from most urgent lot's generator
      let currentGenId = assigned[0].lot.generatorId;

      while (unvisitedGens.size > 0) {
        if (!unvisitedGens.has(currentGenId)) {
          currentGenId = Array.from(unvisitedGens)[0];
        }
        unvisitedGens.delete(currentGenId);
        const gNode = generators.get(currentGenId);
        const gLots = pickupsByGen.get(currentGenId) ?? [];
        if (gNode && gLots.length > 0) {
          pickupStops.push({
            nodeId: gNode.id,
            nodeName: gNode.name,
            kind: 'generator',
            xKm: gNode.xKm,
            yKm: gNode.yKm,
            action: 'pickup',
            weightKg: Math.round(gLots.reduce((acc, l) => acc + l.lot.weightKg, 0)),
            lotIds: gLots.map((l) => l.lot.id),
          });
        }
        if (unvisitedGens.size > 0 && gNode) {
          let nearestId = '';
          let minD = Infinity;
          for (const nextId of unvisitedGens) {
            const candidate = generators.get(nextId);
            if (!candidate) continue;
            const d = urbanDistanceKm(gNode, candidate);
            if (d < minD) {
              minD = d;
              nearestId = nextId;
            }
          }
          currentGenId = nearestId;
        }
      }

      const dropoffStops: RouteStop[] = [];
      const unvisitedHubs = new Set(dropoffsByHub.keys());
      let anchor: { xKm: number; yKm: number } =
        pickupStops[pickupStops.length - 1] ?? { xKm: 0, yKm: 0 };

      while (unvisitedHubs.size > 0) {
        let nearestHubId = '';
        let minD = Infinity;
        for (const hId of unvisitedHubs) {
          const hNode = hubs.get(hId);
          if (!hNode) continue;
          const d = urbanDistanceKm(anchor, hNode);
          if (d < minD) {
            minD = d;
            nearestHubId = hId;
          }
        }
        unvisitedHubs.delete(nearestHubId);
        const hNode = hubs.get(nearestHubId);
        const hLots = dropoffsByHub.get(nearestHubId) ?? [];
        if (hNode && hLots.length > 0) {
          dropoffStops.push({
            nodeId: hNode.id,
            nodeName: hNode.name,
            kind: 'recovery',
            xKm: hNode.xKm,
            yKm: hNode.yKm,
            action: 'dropoff',
            weightKg: Math.round(hLots.reduce((acc, l) => acc + l.lot.weightKg, 0)),
            lotIds: hLots.map((l) => l.lot.id),
          });
          anchor = hNode;
        }
      }

      const combined = twoOptWithPrecedence([...pickupStops, ...dropoffStops], lotToPickupNode);
      const totalDistanceKm = pathDistanceKm(combined);
      const loadKg = Math.round(assigned.reduce((s, d) => s + d.lot.weightKg, 0));
      const haulCo2eKg = Math.round(totalDistanceKm * co2Factor * 100) / 100;
      const roundedUnbatched = Math.round(unbatchedDistanceKm * 100) / 100;

      routes.push({
        vehicleId: `${vehicleType === 'cold_van' ? 'COLD' : 'DRY'}-${idx + 1}`,
        vehicleType,
        stops: combined,
        totalDistanceKm,
        unbatchedDistanceKm: roundedUnbatched,
        distanceSavedKm: Math.round(Math.max(0, roundedUnbatched - totalDistanceKm) * 100) / 100,
        loadKg,
        capacityKg: params.vanCapacityKg,
        haulCo2eKg,
      });
    });

    return routes;
  };

  return [
    ...packFleet(coldLots, 'cold_van', params.coldVansCount),
    ...packFleet(dryLots, 'dry_truck', params.dryTrucksCount),
  ];
}
