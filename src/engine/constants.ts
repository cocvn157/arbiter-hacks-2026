import type { MaterialClass, PolicyMode, RecoveryTier } from './types';

export interface MaterialPhysicsSpec {
  label: string;
  edible: boolean;
  requiresColdChain: boolean;
  refTempC: number;
  maxSafeTempC: number;
  baseShelfLifeHours: number;
  q10Factor: number;
  /** Baseline kg CO2e emitted if sent to landfill (EPA WARM aligned proxy) */
  landfillCo2ePerKg: number;
  /** Net CO2e emitted by each target tier (negative = net sequestration/avoided virgin extraction) */
  tierNetCo2ePerKg: Record<RecoveryTier, number>;
}

/**
 * Physical thermal-decay constants and EPA WARM-aligned lifecycle CO2e factors.
 * Values are deterministic constants (kg CO2e per kg wet mass).
 */
export const MATERIAL_SPECS: Record<MaterialClass, MaterialPhysicsSpec> = {
  produce: {
    label: 'Fresh Produce',
    edible: true,
    requiresColdChain: true,
    refTempC: 4,
    maxSafeTempC: 8,
    baseShelfLifeHours: 72,
    q10Factor: 2.3,
    landfillCo2ePerKg: 0.72,
    tierNetCo2ePerKg: {
      human_donation: -1.15,
      upcycle_discount: -0.92,
      animal_feed: -0.42,
      anaerobic_compost: -0.18,
      mrf_recycling: 0.5,
      ewaste_refurbish: 0.5,
      landfill: 0.72,
    },
  },
  dairy: {
    label: 'Chilled Dairy & Eggs',
    edible: true,
    requiresColdChain: true,
    refTempC: 3,
    maxSafeTempC: 5,
    baseShelfLifeHours: 48,
    q10Factor: 2.8,
    landfillCo2ePerKg: 1.45,
    tierNetCo2ePerKg: {
      human_donation: -2.6,
      upcycle_discount: -2.1,
      animal_feed: -0.65,
      anaerobic_compost: -0.22,
      mrf_recycling: 1.0,
      ewaste_refurbish: 1.0,
      landfill: 1.45,
    },
  },
  bakery: {
    label: 'Artisanal Bakery',
    edible: true,
    requiresColdChain: false,
    refTempC: 18,
    maxSafeTempC: 26,
    baseShelfLifeHours: 36,
    q10Factor: 1.8,
    landfillCo2ePerKg: 0.85,
    tierNetCo2ePerKg: {
      human_donation: -1.35,
      upcycle_discount: -1.1,
      animal_feed: -0.58,
      anaerobic_compost: -0.2,
      mrf_recycling: 0.6,
      ewaste_refurbish: 0.6,
      landfill: 0.85,
    },
  },
  prepared_meals: {
    label: 'Prepared Meals',
    edible: true,
    requiresColdChain: true,
    refTempC: 3,
    maxSafeTempC: 5,
    baseShelfLifeHours: 24,
    q10Factor: 3.1,
    landfillCo2ePerKg: 1.65,
    tierNetCo2ePerKg: {
      human_donation: -2.95,
      upcycle_discount: -2.4,
      animal_feed: -0.35,
      anaerobic_compost: -0.25,
      mrf_recycling: 1.2,
      ewaste_refurbish: 1.2,
      landfill: 1.65,
    },
  },
  seafood_meat: {
    label: 'Cold-Chain Protein',
    edible: true,
    requiresColdChain: true,
    refTempC: 1,
    maxSafeTempC: 4,
    baseShelfLifeHours: 28,
    q10Factor: 3.4,
    landfillCo2ePerKg: 2.35,
    tierNetCo2ePerKg: {
      human_donation: -4.8,
      upcycle_discount: -3.9,
      animal_feed: 0.4, // Restricted in most jurisdictions for meat/seafood without rendering
      anaerobic_compost: -0.3,
      mrf_recycling: 1.8,
      ewaste_refurbish: 1.8,
      landfill: 2.35,
    },
  },
  dry_pantry: {
    label: 'Dry Pantry Goods',
    edible: true,
    requiresColdChain: false,
    refTempC: 20,
    maxSafeTempC: 30,
    baseShelfLifeHours: 720,
    q10Factor: 1.3,
    landfillCo2ePerKg: 0.62,
    tierNetCo2ePerKg: {
      human_donation: -1.4,
      upcycle_discount: -1.15,
      animal_feed: -0.5,
      anaerobic_compost: -0.1,
      mrf_recycling: 0.4,
      ewaste_refurbish: 0.4,
      landfill: 0.62,
    },
  },
  organics_compostable: {
    label: 'Source-Separated Organics',
    edible: false,
    requiresColdChain: false,
    refTempC: 16,
    maxSafeTempC: 32,
    baseShelfLifeHours: 60,
    q10Factor: 1.9,
    landfillCo2ePerKg: 0.78,
    tierNetCo2ePerKg: {
      human_donation: 0.78,
      upcycle_discount: 0.78,
      animal_feed: -0.32,
      anaerobic_compost: -0.26,
      mrf_recycling: 0.78,
      ewaste_refurbish: 0.78,
      landfill: 0.78,
    },
  },
  clean_cardboard: {
    label: 'Corrugated Cardboard (OCC)',
    edible: false,
    requiresColdChain: false,
    refTempC: 22,
    maxSafeTempC: 45,
    baseShelfLifeHours: 2400,
    q10Factor: 1.05,
    landfillCo2ePerKg: 0.94,
    tierNetCo2ePerKg: {
      human_donation: 0.94,
      upcycle_discount: 0.94,
      animal_feed: 0.94,
      anaerobic_compost: -0.15,
      mrf_recycling: -2.45,
      ewaste_refurbish: 0.94,
      landfill: 0.94,
    },
  },
  hdpe_pet_plastic: {
    label: 'Rigid HDPE / PET Packaging',
    edible: false,
    requiresColdChain: false,
    refTempC: 22,
    maxSafeTempC: 45,
    baseShelfLifeHours: 4800,
    q10Factor: 1.02,
    landfillCo2ePerKg: 0.12,
    tierNetCo2ePerKg: {
      human_donation: 0.12,
      upcycle_discount: 0.12,
      animal_feed: 0.12,
      anaerobic_compost: 0.12,
      mrf_recycling: -1.68,
      ewaste_refurbish: 0.12,
      landfill: 0.12,
    },
  },
  ewaste: {
    label: 'Commercial E-Waste',
    edible: false,
    requiresColdChain: false,
    refTempC: 22,
    maxSafeTempC: 45,
    baseShelfLifeHours: 4800,
    q10Factor: 1.01,
    landfillCo2ePerKg: 0.85,
    tierNetCo2ePerKg: {
      human_donation: 0.85,
      upcycle_discount: 0.85,
      animal_feed: 0.85,
      anaerobic_compost: 0.85,
      mrf_recycling: -0.9,
      ewaste_refurbish: -3.4,
      landfill: 0.85,
    },
  },
};

export const TIER_META: Record<
  RecoveryTier,
  { label: string; shortLabel: string; rank: number; color: string; bg: string }
> = {
  human_donation: {
    label: 'Human Food Rescue',
    shortLabel: 'Food Rescue',
    rank: 1,
    color: '#059669',
    bg: '#ECFDF5',
  },
  upcycle_discount: {
    label: 'Flash Upcycle Retail',
    shortLabel: 'Flash Upcycle',
    rank: 2,
    color: '#0284C7',
    bg: '#F0F9FF',
  },
  animal_feed: {
    label: 'Licensed Feed / BSF',
    shortLabel: 'Animal Feed',
    rank: 3,
    color: '#0D9488',
    bg: '#F0FDFA',
  },
  anaerobic_compost: {
    label: 'Anaerobic Biogas & Compost',
    shortLabel: 'Biogas/Compost',
    rank: 4,
    color: '#65A30D',
    bg: '#F7FEE7',
  },
  mrf_recycling: {
    label: 'MRF Material Recovery',
    shortLabel: 'MRF Recycling',
    rank: 5,
    color: '#4F46E5',
    bg: '#EEF2FF',
  },
  ewaste_refurbish: {
    label: 'Certified E-Waste Refurb',
    shortLabel: 'E-Waste Refurb',
    rank: 5,
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  landfill: {
    label: 'Municipal Landfill',
    shortLabel: 'Landfill',
    rank: 99,
    color: '#DC2626',
    bg: '#FEF2F2',
  },
};

export const POLICY_WEIGHTS: Record<
  PolicyMode,
  { label: string; description: string; tierWeight: number; carbonWeight: number; mealWeight: number; costWeight: number }
> = {
  balanced: {
    label: 'Balanced Arbiter',
    description: 'Equal blend of EPA hierarchy, net CO2e reduction, meals rescued, and municipal cost savings.',
    tierWeight: 1.0,
    carbonWeight: 1.0,
    mealWeight: 1.15,
    costWeight: 0.95,
  },
  max_meals: {
    label: 'Max Meals Rescued',
    description: 'Prioritizes human-grade food banks & flash rescue kitchens before cold-chain expiry.',
    tierWeight: 1.4,
    carbonWeight: 0.65,
    mealWeight: 2.3,
    costWeight: 0.6,
  },
  max_carbon: {
    label: 'Max CO2e Abatement',
    description: 'Maximizes lifecycle GHG avoidance (high-protein rescue, clean OCC, and e-waste recovery).',
    tierWeight: 1.1,
    carbonWeight: 2.4,
    mealWeight: 0.8,
    costWeight: 0.65,
  },
  min_cost: {
    label: 'Min Municipal Cost',
    description: 'Minimizes tipping fees, haul km, and spoilage write-offs for lean city/SME budgets.',
    tierWeight: 0.75,
    carbonWeight: 0.65,
    mealWeight: 0.75,
    costWeight: 2.35,
  },
};

export const KG_PER_MEAL = 0.45; // USDA / Feeding America standard 1.2 lb ~ 0.45 kg edible equivalent per meal
export const LANDFILL_TIPPING_FEE_PER_TON_USD = 82;
export const COLD_VAN_CO2E_PER_KM = 0.31;
export const DRY_TRUCK_CO2E_PER_KM = 0.24;
export const FUEL_COST_PER_KM_USD = 0.48;
export const MIN_TRANSIT_SAFETY_BUFFER_HOURS = 1.25;
