import type { ButtonInteraction, Client, Message, MessageCreateOptions, TextBasedChannel } from "discord.js";
import { MessageFlags } from "discord.js";
import type { HeistRepository } from "../db/repository.js";
import { ACTIVE_CHANNEL_WINDOW_MS } from "../game/constants.js";
import type { DropService } from "../services/drops.js";
import { scheduleMessageDeletion } from "./cleanup.js";
import { claimedDropEmbed, dropButton, dropEmbed } from "./ui.js";

export class DropDispatcher {
  private readonly activeChannels = new Map<string, number>();

  constructor(
    private readonly client: Client,
    private readonly repo: HeistRepository,
    private readonly drops: DropService
  ) {}

  markActive(guildId: string, channelId: string, now: number): void {
    this.activeChannels.set(`${guildId}:${channelId}`, now);
  }

  activeConfiguredChannels(guildId: string, channelIds: string[], now: number): string[] {
    return channelIds.filter((channelId) => {
      const lastActive = this.activeChannels.get(`${guildId}:${channelId}`) ?? 0;
      return now - lastActive <= ACTIVE_CHANNEL_WINDOW_MS;
    });
  }

  async sendDrop(guildId: string, channelId: string, now: number): Promise<boolean> {
    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!isSendableTextChannel(channel)) {
      return false;
    }

    const drop = this.drops.createDrop(guildId, channelId, now);
    const message = await channel.send({
      embeds: [dropEmbed(drop.amount)],
      components: [dropButton(drop.id)]
    });
    this.drops.attachMessage(drop.id, message.id);

    setTimeout(() => {
      message.edit({ components: [dropButton(drop.id, true)] }).catch(() => undefined);
    }, Math.max(0, drop.expiresAt - now));

    return true;
  }

  async handleButton(interaction: ButtonInteraction, now: number): Promise<boolean> {
    if (!interaction.customId.startsWith("drop:")) {
      return false;
    }

    const dropId = interaction.customId.slice("drop:".length);
    const result = this.drops.claim(dropId, interaction.user.id, now);
    if (!result.ok) {
      const message =
        result.reason === "claimed"
          ? "The clasp is already empty."
          : result.reason === "expired"
            ? "The bag is gone."
            : "That bag is no longer on the ledger.";
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
      return true;
    }

    await interaction.update({
      embeds: [claimedDropEmbed(result.drop.amount, interaction.user.id)],
      components: [dropButton(dropId, true)]
    });
    if (interaction.message) {
      scheduleMessageDeletion(interaction.message);
    }
    return true;
  }

  async runScheduledDrops(now: number): Promise<void> {
    for (const config of this.repo.listGuildConfigs()) {
      if (config.dropChannelIds.length === 0) {
        continue;
      }

      if (!config.nextDropAt) {
        this.repo.setNextDropAt(config.guildId, this.drops.nextDropAt(now), now);
        continue;
      }
      if (config.nextDropAt > now) {
        continue;
      }

      const candidates = this.activeConfiguredChannels(config.guildId, config.dropChannelIds, now);
      if (candidates.length === 0) {
        this.repo.setNextDropAt(config.guildId, now + 5 * 60 * 1000, now);
        continue;
      }

      const channelId = candidates[Math.floor(Math.random() * candidates.length)] ?? candidates[0];
      const sent = await this.sendDrop(config.guildId, channelId, now);
      this.repo.setNextDropAt(config.guildId, sent ? this.drops.nextDropAt(now) : now + 5 * 60 * 1000, now);
    }
  }
}

function isSendableTextChannel(
  channel: unknown
): channel is TextBasedChannel & { send(options: MessageCreateOptions): Promise<Message> } {
  if (!channel || typeof channel !== "object") {
    return false;
  }
  const candidate = channel as {
    isTextBased?: unknown;
    send?: unknown;
  };
  return (
    typeof candidate.isTextBased === "function" &&
    candidate.isTextBased() === true &&
    typeof candidate.send === "function"
  );
}
