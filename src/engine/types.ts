export type MaterialClass =
  | 'produce'
  | 'dairy'
  | 'bakery'
  | 'prepared_meals'
  | 'seafood_meat'
  | 'dry_pantry'
  | 'organics_compostable'
  | 'clean_cardboard'
  | 'hdpe_pet_plastic'
  | 'ewaste';

export type RecoveryTier =
  | 'human_donation'
  | 'upcycle_discount'
  | 'animal_feed'
  | 'anaerobic_compost'
  | 'mrf_recycling'
  | 'ewaste_refurbish'
  | 'landfill';

export type PolicyMode = 'balanced' | 'max_meals' | 'max_carbon' | 'min_cost';

export type RiskBand = 'nominal' | 'elevated' | 'critical' | 'spoiled';

export interface WasteLot {
  id: string;
  label: string;
  generatorId: string;
  material: MaterialClass;
  weightKg: number;
  currentTempC: number;
  targetTempC: number;
  ageHours: number;
  excursionHours: number;
  moisturePct: number;
  contaminationPct: number;
  sealedPackaging: boolean;
  createdAtIso: string;
}

export interface GeoNode {
  id: string;
  name: string;
  kind: 'generator' | 'recovery';
  xKm: number;
  yKm: number;
  district: string;
}

export interface GeneratorNode extends GeoNode {
  kind: 'generator';
  sector: string;
}

export interface RecoveryHub extends GeoNode {
  kind: 'recovery';
  tier: RecoveryTier;
  acceptedMaterials: MaterialClass[];
  dailyCapacityKg: number;
  coldStorageAvailable: boolean;
  maxContaminationPct: number;
  maxMoisturePct: number;
  tippingOrHandlingFeePerTon: number;
  valuePerKgRecoveredUsd: number;
}

export interface SimulationParams {
  policy: PolicyMode;
  ambientTempDeltaC: number;
  contaminationToleranceDeltaPct: number;
  coldVansCount: number;
  dryTrucksCount: number;
  vanCapacityKg: number;
  avgUrbanSpeedKmh: number;
}

export interface SpoilagePoint {
  hour: number;
  viabilityPct: number;
}

export interface SpoilageAssessment {
  lotId: string;
  effectiveTempC: number;
  baseShelfLifeHours: number;
  remainingDonationHours: number;
  remainingFeedCompostHours: number;
  viabilityPct: number;
  urgencyScore: number;
  riskBand: RiskBand;
  thermalExcursionFlag: boolean;
  hourlyCurve: SpoilagePoint[];
}

export interface CandidateEvaluation {
  hubId: string;
  hubName: string;
  tier: RecoveryTier;
  feasible: boolean;
  rejectionReasons: string[];
  distanceKm: number;
  transitMinutes: number;
  co2eSavedKg: number;
  economicNetUsd: number;
  mealsRescued: number;
  objectiveScore: number;
}

export interface LotDecision {
  lot: WasteLot;
  spoilage: SpoilageAssessment;
  assignedHubId: string;
  assignedHubName: string;
  assignedTier: RecoveryTier;
  feasible: boolean;
  diverted: boolean;
  distanceKm: number;
  transitMinutes: number;
  co2eSavedKg: number;
  economicNetUsd: number;
  mealsRescued: number;
  rationale: string[];
  candidates: CandidateEvaluation[];
}

export interface RouteStop {
  nodeId: string;
  nodeName: string;
  kind: 'generator' | 'recovery';
  xKm: number;
  yKm: number;
  action: 'pickup' | 'dropoff';
  weightKg: number;
  lotIds: string[];
}

export interface VehicleRoute {
  vehicleId: string;
  vehicleType: 'cold_van' | 'dry_truck';
  stops: RouteStop[];
  totalDistanceKm: number;
  unbatchedDistanceKm: number;
  distanceSavedKm: number;
  loadKg: number;
  capacityKg: number;
  haulCo2eKg: number;
}

export interface HubUtilization {
  hubId: string;
  name: string;
  tier: RecoveryTier;
  usedKg: number;
  capacityKg: number;
  utilizationPct: number;
}

export interface OptimizationSummary {
  totalWeightKg: number;
  divertedWeightKg: number;
  landfillWeightKg: number;
  diversionRatePct: number;
  totalMealsRescued: number;
  netCo2eSavedKg: number;
  baselineLandfillCo2eKg: number;
  netEconomicValueUsd: number;
  baselineLandfillCostUsd: number;
  totalRouteDistanceKm: number;
  routeDistanceSavedKm: number;
  criticalLotsCount: number;
  contaminatedDowngradesCount: number;
  computeTimeMs: number;
}

export interface OptimizationResult {
  scenarioId: string;
  decisions: LotDecision[];
  routes: VehicleRoute[];
  hubUtilization: HubUtilization[];
  tierBreakdownKg: Record<RecoveryTier, number>;
  summary: OptimizationSummary;
}

export interface UrbanScenario {
  id: string;
  name: string;
  subtitle: string;
  cityLabel: string;
  generators: GeneratorNode[];
  hubs: RecoveryHub[];
  lots: WasteLot[];
  defaultParams: SimulationParams;
}
