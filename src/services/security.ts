import type { HeistRepository, PlayerRecord } from "../db/repository.js";
import { SECURITY_BY_ID, SECURITY_ITEMS, type SecurityItem, type SecuritySlot } from "../game/constants.js";

export type BuyResult =
  | { ok: true; player: PlayerRecord; item: SecurityItem }
  | {
      ok: false;
      reason: "unknown_item" | "already_owned" | "insufficient_wallet" | "cameras_disabled";
      player?: PlayerRecord;
      item?: SecurityItem;
    };

export interface LoadoutView {
  player: PlayerRecord;
  equipped: Partial<Record<SecuritySlot, SecurityItem>>;
}

export class SecurityService {
  constructor(private readonly repo: HeistRepository) {}

  listShop(): SecurityItem[] {
    return SECURITY_ITEMS;
  }

  getLoadout(guildId: string, userId: string, now: number): LoadoutView {
    const player = this.repo.ensurePlayer(guildId, userId, now);
    const equipped: Partial<Record<SecuritySlot, SecurityItem>> = {};
    for (const item of this.repo.getLoadoutItems(guildId, userId, player.seasonId)) {
      equipped[item.slot] = item;
    }
    return { player, equipped };
  }

  buy(guildId: string, userId: string, itemId: string, now: number): BuyResult {
    return this.repo.transaction(() => {
      const item = SECURITY_BY_ID.get(itemId);
      if (!item) {
        return { ok: false, reason: "unknown_item" };
      }

      const config = this.repo.ensureGuild(guildId, now);
      const player = this.repo.ensurePlayer(guildId, userId, now);
      if (item.cameraTier && !config.camerasEnabled) {
        return { ok: false, reason: "cameras_disabled", player, item };
      }
      if (this.repo.getInventoryQuantity(guildId, userId, player.seasonId, item.id) > 0) {
        return { ok: false, reason: "already_owned", player, item };
      }
      if (player.wallet < item.cost) {
        return { ok: false, reason: "insufficient_wallet", player, item };
      }

      player.wallet -= item.cost;
      this.repo.savePlayer(player, now);
      this.repo.addInventoryAndEquip(guildId, userId, player.seasonId, item);
      if (item.cameraTier) {
        this.repo.upsertCameraSystem(guildId, userId, player.seasonId, item.cameraTier, now);
      }
      this.repo.recordTransaction({
        guildId,
        userId,
        seasonId: player.seasonId,
        type: item.cameraTier ? "camera_purchase" : "security_purchase",
        amount: -item.cost,
        metadata: { itemId: item.id, slot: item.slot },
        createdAt: now
      });

      return { ok: true, player, item };
    });
  }
}
