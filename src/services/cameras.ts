import type { CameraRecordingRecord, CameraSystemRecord, HeistRepository, PlayerRecord } from "../db/repository.js";
import {
  CAMERA_BATTERY_RECORDINGS_PER_PACK,
  CAMERA_BATTERY_STANDBY_MS,
  type CameraAttackType,
  type CameraPowerSource,
  type CameraTier
} from "../game/constants.js";

export interface CameraStatusView {
  enabled: boolean;
  player: PlayerRecord;
  system?: CameraSystemRecord;
  tierName?: string;
  powerOnline: boolean;
  powerSummary: string;
  footageWindowMs: number;
  batteryPackCost: number;
  gridDailyCost: number;
}

export interface CameraFootageView {
  enabled: boolean;
  player: PlayerRecord;
  system?: CameraSystemRecord;
  recordings: CameraRecordingRecord[];
  footageWindowMs: number;
}

export type CameraPowerResult =
  | { ok: true; system: CameraSystemRecord }
  | { ok: false; reason: "disabled" | "not_installed" | "invalid_source"; player?: PlayerRecord };

export type CameraRechargeResult =
  | { ok: true; system: CameraSystemRecord; player: PlayerRecord; packs: number; cost: number }
  | { ok: false; reason: "disabled" | "not_installed" | "invalid_amount" | "insufficient_wallet"; player?: PlayerRecord };

export type CameraBillResult =
  | { ok: true; system: CameraSystemRecord; player: PlayerRecord; days: number; cost: number }
  | { ok: false; reason: "disabled" | "not_installed" | "invalid_amount" | "insufficient_wallet"; player?: PlayerRecord };

export interface CameraRecordInput {
  guildId: string;
  seasonId: number;
  targetUserId: string;
  attackerUserId: string;
  attackType: CameraAttackType;
  success: boolean;
  stolenAmount: number;
  insuranceRestore?: number;
  now: number;
}

export class CameraService {
  constructor(private readonly repo: HeistRepository) {}

  status(guildId: string, userId: string, now: number): CameraStatusView {
    const config = this.repo.ensureGuild(guildId, now);
    const player = this.repo.ensurePlayer(guildId, userId, now);
    const system = this.installedSystem(guildId, userId, player.seasonId, now);
    const gridDailyCost = system ? gridCostForTier(config, system.tier) : config.cameraGridRobberyCost;
    return {
      enabled: config.camerasEnabled,
      player,
      system,
      tierName: system ? cameraTierName(system.tier) : undefined,
      powerOnline: system ? isPowered(system, now) : false,
      powerSummary: system ? powerSummary(system, now) : "No camera installed.",
      footageWindowMs: config.cameraFootageWindowMs,
      batteryPackCost: config.cameraBatteryCost,
      gridDailyCost
    };
  }

  footage(guildId: string, userId: string, now: number): CameraFootageView {
    const config = this.repo.ensureGuild(guildId, now);
    const player = this.repo.ensurePlayer(guildId, userId, now);
    const system = this.installedSystem(guildId, userId, player.seasonId, now);
    return {
      enabled: config.camerasEnabled,
      player,
      system,
      recordings: system ? this.repo.listCameraRecordings(guildId, userId, player.seasonId, now) : [],
      footageWindowMs: config.cameraFootageWindowMs
    };
  }

  setPower(guildId: string, userId: string, source: string, now: number): CameraPowerResult {
    if (source !== "battery" && source !== "grid") {
      return { ok: false, reason: "invalid_source" };
    }
    return this.repo.transaction(() => {
      const config = this.repo.ensureGuild(guildId, now);
      const player = this.repo.ensurePlayer(guildId, userId, now);
      if (!config.camerasEnabled) {
        return { ok: false, reason: "disabled", player };
      }
      const system = this.installedSystem(guildId, userId, player.seasonId, now);
      if (!system) {
        return { ok: false, reason: "not_installed", player };
      }
      system.powerSource = source;
      this.repo.saveCameraSystem(system, now);
      return { ok: true, system };
    });
  }

  recharge(guildId: string, userId: string, packs: number, now: number): CameraRechargeResult {
    const packCount = Math.floor(packs);
    if (packCount <= 0) {
      return { ok: false, reason: "invalid_amount" };
    }

    return this.repo.transaction(() => {
      const config = this.repo.ensureGuild(guildId, now);
      const player = this.repo.ensurePlayer(guildId, userId, now);
      if (!config.camerasEnabled) {
        return { ok: false, reason: "disabled", player };
      }
      const system = this.installedSystem(guildId, userId, player.seasonId, now);
      if (!system) {
        return { ok: false, reason: "not_installed", player };
      }
      const cost = config.cameraBatteryCost * packCount;
      if (player.wallet < cost) {
        return { ok: false, reason: "insufficient_wallet", player };
      }

      player.wallet -= cost;
      system.powerSource = "battery";
      system.batteryUnits += packCount * CAMERA_BATTERY_RECORDINGS_PER_PACK;
      system.batteryExpiresAt = Math.max(now, system.batteryExpiresAt) + packCount * CAMERA_BATTERY_STANDBY_MS;
      this.repo.savePlayer(player, now);
      this.repo.saveCameraSystem(system, now);
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: "camera_battery",
        amount: -cost,
        metadata: { packs: packCount, batteryUnits: system.batteryUnits, batteryExpiresAt: system.batteryExpiresAt },
        createdAt: now
      });
      return { ok: true, system, player, packs: packCount, cost };
    });
  }

  payGridBill(guildId: string, userId: string, days: number, now: number): CameraBillResult {
    const dayCount = Math.floor(days);
    if (dayCount <= 0) {
      return { ok: false, reason: "invalid_amount" };
    }

    return this.repo.transaction(() => {
      const config = this.repo.ensureGuild(guildId, now);
      const player = this.repo.ensurePlayer(guildId, userId, now);
      if (!config.camerasEnabled) {
        return { ok: false, reason: "disabled", player };
      }
      const system = this.installedSystem(guildId, userId, player.seasonId, now);
      if (!system) {
        return { ok: false, reason: "not_installed", player };
      }
      const cost = gridCostForTier(config, system.tier) * dayCount;
      if (player.wallet < cost) {
        return { ok: false, reason: "insufficient_wallet", player };
      }

      player.wallet -= cost;
      system.powerSource = "grid";
      system.gridPaidUntil = Math.max(now, system.gridPaidUntil) + dayCount * 24 * 60 * 60 * 1000;
      this.repo.savePlayer(player, now);
      this.repo.saveCameraSystem(system, now);
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: "camera_grid_bill",
        amount: -cost,
        metadata: { days: dayCount, gridPaidUntil: system.gridPaidUntil },
        createdAt: now
      });
      return { ok: true, system, player, days: dayCount, cost };
    });
  }

  recordAttack(input: CameraRecordInput): CameraRecordingRecord | null {
    const config = this.repo.getGuildConfig(input.guildId);
    if (!config?.camerasEnabled) {
      return null;
    }
    const system = this.installedSystem(input.guildId, input.targetUserId, input.seasonId, input.now);
    if (!system || !canRecord(system.tier, input.attackType, input.success) || !isPowered(system, input.now)) {
      return null;
    }

    const recording = this.repo.insertCameraRecording({
      guildId: input.guildId,
      userId: input.targetUserId,
      seasonId: input.seasonId,
      attackerUserId: input.attackerUserId,
      attackType: input.attackType,
      success: input.success,
      stolenAmount: input.stolenAmount,
      insuranceRestore: input.insuranceRestore ?? 0,
      powerSource: system.powerSource,
      recordedAt: input.now,
      expiresAt: input.now + config.cameraFootageWindowMs
    });

    if (system.powerSource === "battery") {
      system.batteryUnits = Math.max(0, system.batteryUnits - 1);
      this.repo.saveCameraSystem(system, input.now);
    }
    return recording;
  }

  private installedSystem(
    guildId: string,
    userId: string,
    seasonId: number,
    now: number
  ): CameraSystemRecord | undefined {
    const existing = this.repo.getCameraSystem(guildId, userId, seasonId);
    if (existing) {
      return existing;
    }
    const camera = this.repo
      .getLoadoutItems(guildId, userId, seasonId)
      .filter((item) => item.cameraTier)
      .sort((left, right) => right.tier - left.tier)[0];
    return camera?.cameraTier ? this.repo.upsertCameraSystem(guildId, userId, seasonId, camera.cameraTier, now) : undefined;
  }
}

export function cameraTierName(tier: CameraTier): string {
  switch (tier) {
    case "keyhole":
      return "Keyhole Polaroid";
    case "lobby_mirror":
      return "Lobby Mirror Lens";
    case "vault_hall":
      return "Vault Hall Camera";
  }
}

function canRecord(tier: CameraTier, attackType: CameraAttackType, success: boolean): boolean {
  switch (tier) {
    case "keyhole":
      return attackType === "rob" && success;
    case "lobby_mirror":
      return attackType === "rob";
    case "vault_hall":
      return success && (attackType === "rob" || attackType === "heist");
  }
}

function isPowered(system: CameraSystemRecord, now: number): boolean {
  if (!system.enabled) {
    return false;
  }
  if (system.powerSource === "grid") {
    return system.gridPaidUntil > now;
  }
  return system.batteryUnits > 0 && system.batteryExpiresAt > now;
}

function powerSummary(system: CameraSystemRecord, now: number): string {
  if (system.powerSource === "grid") {
    return system.gridPaidUntil > now ? `Grid online until <t:${Math.floor(system.gridPaidUntil / 1000)}:R>.` : "Grid bill unpaid.";
  }
  if (system.batteryUnits <= 0) {
    return "Battery empty.";
  }
  if (system.batteryExpiresAt <= now) {
    return "Battery standby expired.";
  }
  return `${system.batteryUnits} battery recordings left, standby until <t:${Math.floor(system.batteryExpiresAt / 1000)}:R>.`;
}

function gridCostForTier(
  config: { cameraGridRobberyCost: number; cameraGridFullCost: number },
  tier: CameraTier
): number {
  return tier === "vault_hall" ? config.cameraGridFullCost : config.cameraGridRobberyCost;
}
