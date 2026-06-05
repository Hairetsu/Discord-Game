export const STARTING_WALLET = 250;
export const NEW_PLAYER_SHIELD_MS = 24 * 60 * 60 * 1000;

export const DROP_MIN = 25;
export const DROP_MAX = 250;
export const DROP_JACKPOT = 1000;
export const DROP_JACKPOT_CHANCE = 0.01;
export const DROP_LIFETIME_MS = 90 * 1000;
export const DROP_INTERVAL_MIN_MS = 20 * 60 * 1000;
export const DROP_INTERVAL_MAX_MS = 45 * 60 * 1000;
export const ACTIVE_CHANNEL_WINDOW_MS = 15 * 60 * 1000;

export const DAILY_INTEREST_RATE = 0.01;
export const DAILY_INTEREST_CAP = 500;

export const CHAT_REWARD_MIN = 1;
export const CHAT_REWARD_MAX = 4;
export const CHAT_REWARD_COOLDOWN_MS = 2 * 60 * 1000;
export const EMOTE_REWARD_MIN = 2;
export const EMOTE_REWARD_MAX = 6;
export const EMOTE_REWARD_COOLDOWN_MS = 5 * 60 * 1000;

export const ROB_BASE_SUCCESS = 0.45;
export const ROB_MIN_PERCENT = 0.1;
export const ROB_MAX_PERCENT = 0.25;
export const ROB_MAX_STEAL = 750;
export const ROB_COOLDOWN_MS = 2 * 60 * 60 * 1000;
export const ROB_FAIL_FINE_RATE = 0.15;
export const ROB_FAIL_FINE_MIN = 50;

export const HEIST_BASE_SUCCESS = 0.25;
export const HEIST_MIN_PERCENT = 0.03;
export const HEIST_MAX_PERCENT = 0.08;
export const HEIST_MAX_STEAL = 1500;
export const HEIST_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export const HEIST_LOCKOUT_MS = 6 * 60 * 60 * 1000;
export const HEIST_FAIL_FINE_RATE = 0.25;

export const MIN_SUCCESS_CHANCE = 0.05;
export const MAX_SUCCESS_CHANCE = 0.9;

export const NOIR = {
  ink: 0x14120f,
  brass: 0xc99a3a,
  red: 0xc73a30,
  green: 0x2f8f62,
  smoke: 0x4a4a46
} as const;

export type SecuritySlot = "vault" | "alarm" | "guard" | "insurance";

export interface SecurityItem {
  id: string;
  name: string;
  slot: SecuritySlot;
  tier: number;
  cost: number;
  description: string;
  vaultPenalty?: number;
  alarmFineBonus?: number;
  guardCounterPercent?: number;
  guardCounterMax?: number;
  insuranceRestorePercent?: number;
  insuranceRestoreMax?: number;
}

export const SECURITY_ITEMS: SecurityItem[] = [
  {
    id: "vault_i",
    name: "Brass Vault I",
    slot: "vault",
    tier: 1,
    cost: 400,
    description: "Cuts incoming rob and heist success odds by 5%.",
    vaultPenalty: 0.05
  },
  {
    id: "vault_ii",
    name: "Brass Vault II",
    slot: "vault",
    tier: 2,
    cost: 1200,
    description: "Cuts incoming rob and heist success odds by 10%.",
    vaultPenalty: 0.1
  },
  {
    id: "vault_iii",
    name: "Brass Vault III",
    slot: "vault",
    tier: 3,
    cost: 3000,
    description: "Cuts incoming rob and heist success odds by 18%.",
    vaultPenalty: 0.18
  },
  {
    id: "alarm_i",
    name: "Tripwire Alarm I",
    slot: "alarm",
    tier: 1,
    cost: 350,
    description: "Failed attackers pay 10% more in fines.",
    alarmFineBonus: 0.1
  },
  {
    id: "alarm_ii",
    name: "Tripwire Alarm II",
    slot: "alarm",
    tier: 2,
    cost: 1000,
    description: "Failed attackers pay 20% more in fines.",
    alarmFineBonus: 0.2
  },
  {
    id: "guard_i",
    name: "Backroom Guard I",
    slot: "guard",
    tier: 1,
    cost: 500,
    description: "On failed attacks, counter-steals up to 5% of the attacker wallet, max $150.",
    guardCounterPercent: 0.05,
    guardCounterMax: 150
  },
  {
    id: "guard_ii",
    name: "Backroom Guard II",
    slot: "guard",
    tier: 2,
    cost: 1500,
    description: "On failed attacks, counter-steals up to 10% of the attacker wallet, max $400.",
    guardCounterPercent: 0.1,
    guardCounterMax: 400
  },
  {
    id: "insurance_i",
    name: "Ledger Insurance I",
    slot: "insurance",
    tier: 1,
    cost: 600,
    description: "Restores 10% of bank losses after a successful heist, max $250.",
    insuranceRestorePercent: 0.1,
    insuranceRestoreMax: 250
  },
  {
    id: "insurance_ii",
    name: "Ledger Insurance II",
    slot: "insurance",
    tier: 2,
    cost: 1800,
    description: "Restores 20% of bank losses after a successful heist, max $750.",
    insuranceRestorePercent: 0.2,
    insuranceRestoreMax: 750
  }
];

export const SECURITY_BY_ID = new Map(SECURITY_ITEMS.map((item) => [item.id, item]));
export const SECURITY_SLOTS: SecuritySlot[] = ["vault", "alarm", "guard", "insurance"];
