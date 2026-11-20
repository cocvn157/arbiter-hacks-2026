import { MATERIAL_SPECS } from './constants';
import type { RiskBand, SpoilageAssessment, SpoilagePoint, WasteLot } from './types';

const CURVE_HORIZONS_HOURS = [0, 4, 8, 12, 18, 24, 36, 48];

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Assesses perishable thermal decay using Q10 Arrhenius-approximated kinetics
 * combined with FDA TCS (Time/Temperature Control for Safety) cold-chain excursion rules.
 */
export function assessLotSpoilage(lot: WasteLot, ambientTempDeltaC = 0): SpoilageAssessment {
  const spec = MATERIAL_SPECS[lot.material];
  const heatPenetration = lot.sealedPackaging ? 0.45 : 0.78;
  const effectiveTempC = round1(lot.currentTempC + ambientTempDeltaC * heatPenetration);

  // Q10 decay multiplier relative to reference storage temperature
  const historicalRate = Math.max(
    0.25,
    Math.pow(spec.q10Factor, (lot.currentTempC - spec.refTempC) / 10),
  );
  const futureRate = Math.max(
    0.25,
    Math.pow(spec.q10Factor, (effectiveTempC - spec.refTempC) / 10),
  );

  // Excursion hours outside safe threshold accelerate cumulative biological decay
  const excursionPenaltyHours = lot.excursionHours * (spec.requiresColdChain ? 1.75 : 1.15);
  const equivalentAgeHours = lot.ageHours * historicalRate + excursionPenaltyHours;
  const remainingBaseHours = Math.max(0, spec.baseShelfLifeHours - equivalentAgeHours);

  // FDA TCS 4-hour danger-zone rule for cold-chain proteins, dairy, and prepared meals
  const thermalExcursionFlag =
    spec.requiresColdChain &&
    (effectiveTempC > spec.maxSafeTempC || lot.excursionHours >= 2.5);

  const tcsSafetyBreach =
    spec.requiresColdChain &&
    lot.material !== 'produce' &&
    lot.excursionHours >= 4 &&
    lot.currentTempC > spec.maxSafeTempC;

  let remainingDonationHours = spec.edible ? remainingBaseHours / futureRate : 0;
  if (tcsSafetyBreach || lot.contaminationPct > 12) {
    remainingDonationHours = 0;
  }

  // Feed / compost window lasts significantly longer than human-edible grade
  const feedCompostTotalBase = spec.baseShelfLifeHours * 1.9 + 24;
  const remainingFeedCompostHours =
    lot.material === 'clean_cardboard' || lot.material === 'hdpe_pet_plastic' || lot.material === 'ewaste'
      ? 2400
      : Math.max(0, (feedCompostTotalBase - equivalentAgeHours) / futureRate);

  const rawViability =
    spec.edible && (tcsSafetyBreach || lot.contaminationPct > 12)
      ? 0
      : clamp(0, 100, (remainingBaseHours / spec.baseShelfLifeHours) * 100);

  const viabilityPct = round1(rawViability);

  const hourlyCurve: SpoilagePoint[] = CURVE_HORIZONS_HOURS.map((hour) => {
    const projectedBase = Math.max(0, remainingBaseHours - hour * futureRate);
    const pct =
      spec.edible && (tcsSafetyBreach || lot.contaminationPct > 12)
        ? 0
        : clamp(0, 100, (projectedBase / spec.baseShelfLifeHours) * 100);
    return { hour, viabilityPct: round1(pct) };
  });

  let riskBand: RiskBand = 'nominal';
  if (spec.edible) {
    if (remainingDonationHours <= 0) {
      riskBand = 'spoiled';
    } else if (remainingDonationHours <= 6) {
      riskBand = 'critical';
    } else if (remainingDonationHours <= 18 || thermalExcursionFlag) {
      riskBand = 'elevated';
    }
  } else if (lot.material === 'organics_compostable') {
    riskBand = lot.excursionHours > 6 ? 'elevated' : 'nominal';
  } else if (lot.moisturePct > 15 || lot.contaminationPct > 10) {
    riskBand = 'elevated';
  }

  // Urgency score prioritizes imminent spoilage & high-mass cold-chain lots
  let urgencyScore = 15;
  if (spec.edible) {
    if (remainingDonationHours <= 0) {
      urgencyScore = 82; // Needs rapid compost/AD rescue before odor/methane spike
    } else {
      const timeUrgency = clamp(0, 85, (1 - Math.min(remainingDonationHours, 48) / 48) * 85);
      const excursionBoost = thermalExcursionFlag ? 12 : 0;
      urgencyScore = round1(clamp(10, 100, timeUrgency + excursionBoost));
    }
  } else {
    urgencyScore = round1(clamp(10, 75, 20 + lot.weightKg / 25 + lot.moisturePct));
  }

  return {
    lotId: lot.id,
    effectiveTempC,
    baseShelfLifeHours: spec.baseShelfLifeHours,
    remainingDonationHours: round1(remainingDonationHours),
    remainingFeedCompostHours: round1(remainingFeedCompostHours),
    viabilityPct,
    urgencyScore,
    riskBand,
    thermalExcursionFlag,
    hourlyCurve,
  };
}
