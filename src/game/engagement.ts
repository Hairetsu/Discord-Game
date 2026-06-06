import type { SecurityItem } from "./constants.js";
import type { RandomSource } from "./random.js";

export const HEAT_MAX = 100;
export const HEAT_DECAY_PER_HOUR = 8;
export const ROB_HEAT_GAIN = 8;
export const HEIST_HEAT_GAIN = 18;
export const CREW_HEIST_HEAT_GAIN = 22;
export const BOUNTY_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
export const CASE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const CREW_HEIST_RECRUIT_MS = 2 * 60 * 1000;
export const GAZETTE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const GAZETTE_MIN_EVENTS = 3;

export type HeatBandId = "clean" | "watched" | "wanted" | "burned";

export interface HeatBand {
  id: HeatBandId;
  label: string;
  minHeat: number;
  chancePenalty: number;
  fineMultiplier: number;
}

export const HEAT_BANDS: HeatBand[] = [
  { id: "clean", label: "Clean", minHeat: 0, chancePenalty: 0, fineMultiplier: 1 },
  { id: "watched", label: "Watched", minHeat: 25, chancePenalty: 0.03, fineMultiplier: 1.1 },
  { id: "wanted", label: "Wanted", minHeat: 55, chancePenalty: 0.08, fineMultiplier: 1.25 },
  { id: "burned", label: "Burned", minHeat: 80, chancePenalty: 0.14, fineMultiplier: 1.45 }
];

export type CaseFileId = "stakeout" | "quiet_pickup" | "quick_launder" | "market_tip" | "inside_whisper";

export interface CaseFile {
  id: CaseFileId;
  name: string;
  buttonLabel: string;
  description: string;
  minReward: number;
  maxReward: number;
  heatDelta: number;
  depositPercent?: number;
}

export const CASE_FILES: CaseFile[] = [
  {
    id: "stakeout",
    name: "Stakeout",
    buttonLabel: "Stakeout",
    description: "Low cash, reliable heat reduction.",
    minReward: 25,
    maxReward: 65,
    heatDelta: -18
  },
  {
    id: "quiet_pickup",
    name: "Quiet Pickup",
    buttonLabel: "Quiet Pickup",
    description: "Simple wallet cash with no heat.",
    minReward: 50,
    maxReward: 130,
    heatDelta: 0
  },
  {
    id: "quick_launder",
    name: "Quick Launder",
    buttonLabel: "Launder",
    description: "Moves a slice of wallet cash into the bank and trims heat.",
    minReward: 15,
    maxReward: 45,
    heatDelta: -8,
    depositPercent: 0.25
  },
  {
    id: "market_tip",
    name: "Market Tip",
    buttonLabel: "Market Tip",
    description: "A small speculative payout with a little heat.",
    minReward: 75,
    maxReward: 180,
    heatDelta: 5
  },
  {
    id: "inside_whisper",
    name: "Inside Whisper",
    buttonLabel: "Whisper",
    description: "Moderate cash and a little extra attention.",
    minReward: 90,
    maxReward: 210,
    heatDelta: 8
  }
];

export type DropKind = "cash_bag" | "locked_case" | "marked_bills" | "decoy_bag" | "jackpot_briefcase";

export interface DropVariant {
  kind: DropKind;
  name: string;
  buttonLabel: string;
  minAmount: number;
  maxAmount: number;
  requiredClaims: number;
  weight: number;
  heatDelta: number;
}

export const DROP_VARIANTS: DropVariant[] = [
  {
    kind: "cash_bag",
    name: "Unmarked Bag",
    buttonLabel: "Grab the Bag",
    minAmount: 25,
    maxAmount: 250,
    requiredClaims: 1,
    weight: 66,
    heatDelta: 0
  },
  {
    kind: "locked_case",
    name: "Locked Case",
    buttonLabel: "Work the Lock",
    minAmount: 160,
    maxAmount: 420,
    requiredClaims: 2,
    weight: 14,
    heatDelta: 0
  },
  {
    kind: "marked_bills",
    name: "Marked Bills",
    buttonLabel: "Take the Risk",
    minAmount: 180,
    maxAmount: 520,
    requiredClaims: 1,
    weight: 11,
    heatDelta: 12
  },
  {
    kind: "decoy_bag",
    name: "Decoy Bag",
    buttonLabel: "Check the Bag",
    minAmount: 5,
    maxAmount: 35,
    requiredClaims: 1,
    weight: 8,
    heatDelta: 4
  },
  {
    kind: "jackpot_briefcase",
    name: "Jackpot Briefcase",
    buttonLabel: "Snatch Briefcase",
    minAmount: 1000,
    maxAmount: 1000,
    requiredClaims: 1,
    weight: 1,
    heatDelta: 20
  }
];

export type CrewRole = "driver" | "lookout" | "lockpick" | "inside_person";

export interface CrewRoleDefinition {
  id: CrewRole;
  label: string;
  description: string;
}

export const CREW_ROLES: CrewRoleDefinition[] = [
  { id: "driver", label: "Driver", description: "Reduces failure fines." },
  { id: "lookout", label: "Lookout", description: "Improves the crew's odds." },
  { id: "lockpick", label: "Lockpick", description: "Raises the max take." },
  { id: "inside_person", label: "Inside Person", description: "Softens target security." }
];

export type SeasonModifierId = "standard" | "blackout" | "bankers_moon" | "street_heat" | "bull_run" | "loose_floorboards";

export interface SeasonModifier {
  id: SeasonModifierId;
  name: string;
  description: string;
  heistChanceBonus?: number;
  fineMultiplier?: number;
  interestCapBonus?: number;
  dropMultiplier?: number;
}

export const SEASON_MODIFIERS: SeasonModifier[] = [
  { id: "standard", name: "Open Ledger", description: "No special season modifier." },
  { id: "blackout", name: "Blackout Season", description: "Heists are slightly easier.", heistChanceBonus: 0.05 },
  {
    id: "bankers_moon",
    name: "Banker's Moon",
    description: "Daily interest can pay a little higher.",
    interestCapBonus: 250
  },
  {
    id: "street_heat",
    name: "Street Heat",
    description: "Failed jobs hurt more.",
    fineMultiplier: 1.2
  },
  {
    id: "bull_run",
    name: "Bull Run",
    description: "The market desk has the room's attention."
  },
  {
    id: "loose_floorboards",
    name: "Loose Floorboards",
    description: "Money drops carry more cash.",
    dropMultiplier: 1.2
  }
];

export interface SecurityModifiers {
  vaultPenalty: number;
  alarmFineBonus: number;
  guardCounterPercent: number;
  guardCounterMax: number;
  insuranceRestorePercent: number;
  insuranceRestoreMax: number;
}

export function heatBand(heat: number): HeatBand {
  return [...HEAT_BANDS].reverse().find((band) => heat >= band.minHeat) ?? HEAT_BANDS[0];
}

export function adjustHeat(heat: number, delta: number): number {
  return Math.max(0, Math.min(HEAT_MAX, heat + delta));
}

export function decayHeat(heat: number, previousUpdatedAt: number, now: number): number {
  if (heat <= 0 || previousUpdatedAt >= now) {
    return heat;
  }
  const hours = Math.floor((now - previousUpdatedAt) / (60 * 60 * 1000));
  if (hours <= 0) {
    return heat;
  }
  return adjustHeat(heat, -hours * HEAT_DECAY_PER_HOUR);
}

export function randomDropVariant(random: RandomSource): DropVariant {
  const totalWeight = DROP_VARIANTS.reduce((total, variant) => total + variant.weight, 0);
  let roll = random.int(1, totalWeight);
  for (const variant of DROP_VARIANTS) {
    roll -= variant.weight;
    if (roll <= 0) {
      return variant;
    }
  }
  return DROP_VARIANTS[0];
}

export function seasonModifier(id: string | null | undefined): SeasonModifier {
  return SEASON_MODIFIERS.find((modifier) => modifier.id === id) ?? SEASON_MODIFIERS[0];
}

export function nextSeasonModifier(seasonId: number): SeasonModifier {
  const cycle = SEASON_MODIFIERS.filter((modifier) => modifier.id !== "standard");
  return cycle[(seasonId - 2) % cycle.length] ?? SEASON_MODIFIERS[0];
}

export function securityModifiers(items: SecurityItem[]): SecurityModifiers {
  return {
    vaultPenalty: items.reduce((total, item) => total + (item.vaultPenalty ?? 0), 0),
    alarmFineBonus: items.reduce((total, item) => total + (item.alarmFineBonus ?? 0), 0),
    guardCounterPercent: items.reduce((total, item) => total + (item.guardCounterPercent ?? 0), 0),
    guardCounterMax: items.reduce((total, item) => total + (item.guardCounterMax ?? 0), 0),
    insuranceRestorePercent: items.reduce((total, item) => total + (item.insuranceRestorePercent ?? 0), 0),
    insuranceRestoreMax: items.reduce((total, item) => total + (item.insuranceRestoreMax ?? 0), 0)
  };
}
