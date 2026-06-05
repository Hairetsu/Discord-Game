import {
  Client,
  Events,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction
} from "discord.js";
import type { HeistRepository } from "../db/repository.js";
import { formatDollars, nowMs } from "../game/time.js";
import type { ActivityService } from "../services/activity.js";
import { containsEmojiOrCustomEmote } from "../services/activity.js";
import type { EconomyService } from "../services/economy.js";
import type { RobberyService } from "../services/robbery.js";
import type { SecurityService } from "../services/security.js";
import type { DropDispatcher } from "./drop-dispatcher.js";
import {
  attackEmbed,
  balanceEmbed,
  buyEmbed,
  leaderboardEmbed,
  loadoutEmbed,
  moneyMoveEmbed,
  shopEmbed
} from "./ui.js";

export interface BotServices {
  repo: HeistRepository;
  activity: ActivityService;
  economy: EconomyService;
  security: SecurityService;
  robbery: RobberyService;
  dropDispatcher: DropDispatcher;
}

export function registerDiscordHandlers(client: Client, services: BotServices): void {
  client.once(Events.ClientReady, () => {
    console.log(`Signed in as ${client.user?.tag ?? "unknown bot"}`);
    void schedulerTick(services);
    setInterval(() => void schedulerTick(services), 60 * 1000);
  });

  client.on(Events.MessageCreate, (message) => {
    if (!message.guildId || message.author.bot) {
      return;
    }
    const now = nowMs();
    services.dropDispatcher.markActive(message.guildId, message.channelId, now);
    services.activity.awardChat(message.guildId, message.author.id, now);
    if (message.content && containsEmojiOrCustomEmote(message.content)) {
      services.activity.awardEmote(message.guildId, message.author.id, now);
    }
  });

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) {
      return;
    }
    const resolvedReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
    const guildId = resolvedReaction?.message.guildId;
    if (!guildId) {
      return;
    }
    services.activity.awardEmote(guildId, user.id, nowMs());
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      const now = nowMs();
      if (interaction.isButton()) {
        await services.dropDispatcher.handleButton(interaction, now);
        return;
      }

      if (!interaction.isChatInputCommand()) {
        return;
      }
      if (!interaction.guildId) {
        await interaction.reply({ content: "This ledger only opens inside a server.", flags: MessageFlags.Ephemeral });
        return;
      }

      await handleCommand(interaction, services, now);
    } catch (error) {
      console.error(error);
      const payload = {
        content: "The ledger jammed. Try again in a moment.",
        flags: MessageFlags.Ephemeral
      } as const;
      if (interaction.isRepliable() && (interaction.deferred || interaction.replied)) {
        await interaction.followUp(payload).catch(() => undefined);
      } else if (interaction.isRepliable()) {
        await interaction.reply(payload).catch(() => undefined);
      }
    }
  });
}

async function schedulerTick(services: BotServices): Promise<void> {
  const now = nowMs();
  for (const config of services.repo.listGuildConfigs()) {
    services.economy.applyDailyInterest(config.guildId, now);
  }
  await services.dropDispatcher.runScheduledDrops(now);
}

async function handleCommand(
  interaction: ChatInputCommandInteraction,
  services: BotServices,
  now: number
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: "This command only works in a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  switch (interaction.commandName) {
    case "balance": {
      const player = services.economy.getBalance(guildId, interaction.user.id, now);
      await interaction.reply({ embeds: [balanceEmbed(player)], flags: MessageFlags.Ephemeral });
      return;
    }

    case "deposit": {
      const amount = interaction.options.getInteger("amount", true);
      const result = services.economy.deposit(guildId, interaction.user.id, amount, now);
      if (!result.ok) {
        await interaction.reply({
          content:
            result.reason === "insufficient_wallet"
              ? "Your wallet does not carry that much cash."
              : "Use a positive dollar amount.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      await interaction.reply({ embeds: [moneyMoveEmbed("Cash Deposited", result.amount, result.player)] });
      return;
    }

    case "withdraw": {
      const amount = interaction.options.getInteger("amount", true);
      const result = services.economy.withdraw(guildId, interaction.user.id, amount, now);
      if (!result.ok) {
        await interaction.reply({
          content:
            result.reason === "insufficient_bank" ? "Your bank balance is too low." : "Use a positive dollar amount.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      await interaction.reply({ embeds: [moneyMoveEmbed("Cash Withdrawn", result.amount, result.player)] });
      return;
    }

    case "leaderboard": {
      await interaction.reply({ embeds: [leaderboardEmbed(services.economy.leaderboard(guildId, now))] });
      return;
    }

    case "shop": {
      await interaction.reply({ embeds: [shopEmbed()], flags: MessageFlags.Ephemeral });
      return;
    }

    case "buy": {
      const itemId = interaction.options.getString("item", true);
      const result = services.security.buy(guildId, interaction.user.id, itemId, now);
      if (!result.ok) {
        await interaction.reply({ content: buyFailureText(result.reason), flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ embeds: [buyEmbed(result.item, result.player)], flags: MessageFlags.Ephemeral });
      return;
    }

    case "loadout": {
      const view = services.security.getLoadout(guildId, interaction.user.id, now);
      await interaction.reply({ embeds: [loadoutEmbed(view.equipped)], flags: MessageFlags.Ephemeral });
      return;
    }

    case "rob": {
      await handleAttack(interaction, services, "rob", now);
      return;
    }

    case "heist": {
      await handleAttack(interaction, services, "heist", now);
      return;
    }

    case "admin": {
      await handleAdmin(interaction, services, now);
      return;
    }

    default:
      await interaction.reply({ content: "Unknown ledger entry.", flags: MessageFlags.Ephemeral });
  }
}

async function handleAttack(
  interaction: ChatInputCommandInteraction,
  services: BotServices,
  kind: "rob" | "heist",
  now: number
): Promise<void> {
  const target = interaction.options.getUser("target", true);
  if (target.bot) {
    await interaction.reply({ content: "Bot accounts do not keep vaults here.", flags: MessageFlags.Ephemeral });
    return;
  }

  const result =
    kind === "rob"
      ? services.robbery.rob(interaction.guildId!, interaction.user.id, target.id, now)
      : services.robbery.heist(interaction.guildId!, interaction.user.id, target.id, now);
  await interaction.reply({ embeds: [attackEmbed(result)] });
}

async function handleAdmin(
  interaction: ChatInputCommandInteraction,
  services: BotServices,
  now: number
): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "Manage Server is required for this ledger.", flags: MessageFlags.Ephemeral });
    return;
  }

  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand(true);
  switch (subcommand) {
    case "setup": {
      const config = services.repo.ensureGuild(guildId, now);
      await interaction.reply({
        content: `Season #${config.currentSeasonId} is open. Add drop channels with \`/admin channels\`.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    case "channels": {
      await handleAdminChannels(interaction, services, now);
      return;
    }

    case "drop": {
      const config = services.repo.ensureGuild(guildId, now);
      const channel = interaction.options.getChannel("channel");
      const channelId = channel?.id ?? (config.dropChannelIds.includes(interaction.channelId) ? interaction.channelId : null);
      const fallbackChannelId = channelId ?? config.dropChannelIds[0];
      if (!fallbackChannelId) {
        await interaction.reply({ content: "No drop channel is configured yet.", flags: MessageFlags.Ephemeral });
        return;
      }

      const sent = await services.dropDispatcher.sendDrop(guildId, fallbackChannelId, now);
      await interaction.reply({
        content: sent ? `Manual bag sent to <#${fallbackChannelId}>.` : `I could not send a bag to <#${fallbackChannelId}>.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    case "season": {
      const action = interaction.options.getString("action", true);
      if (action === "status") {
        const config = services.repo.ensureGuild(guildId, now);
        const top = services.economy.leaderboard(guildId, now, 1)[0];
        await interaction.reply({
          content: top
            ? `Season #${config.currentSeasonId} is open. Current leader: <@${top.userId}> at ${formatDollars(top.netWorth)}.`
            : `Season #${config.currentSeasonId} is open. No one has entered yet.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const result = services.repo.startNextSeason(guildId, now);
      await interaction.reply({
        content: result.winnerUserId
          ? `Season closed. <@${result.winnerUserId}> takes the brass plaque. Season #${result.seasonId} is now open.`
          : `Season closed with no winner. Season #${result.seasonId} is now open.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }
  }
}

async function handleAdminChannels(
  interaction: ChatInputCommandInteraction,
  services: BotServices,
  now: number
): Promise<void> {
  const guildId = interaction.guildId!;
  const action = interaction.options.getString("action", true);
  const config = services.repo.ensureGuild(guildId, now);
  const channel = interaction.options.getChannel("channel");

  if (action === "list") {
    const content = config.dropChannelIds.length
      ? `Drop channels: ${config.dropChannelIds.map((id) => `<#${id}>`).join(", ")}`
      : "No drop channels are configured.";
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    return;
  }

  if (!channel) {
    await interaction.reply({ content: "Choose a channel to add or remove.", flags: MessageFlags.Ephemeral });
    return;
  }

  const next =
    action === "add"
      ? [...new Set([...config.dropChannelIds, channel.id])]
      : config.dropChannelIds.filter((channelId) => channelId !== channel.id);
  services.repo.setDropChannels(guildId, next, now);
  await interaction.reply({
    content:
      action === "add"
        ? `<#${channel.id}> is wired for money drops.`
        : `<#${channel.id}> is no longer wired for money drops.`,
    flags: MessageFlags.Ephemeral
  });
}

function buyFailureText(reason: "unknown_item" | "already_owned" | "insufficient_wallet"): string {
  switch (reason) {
    case "unknown_item":
      return "That item is not in the catalog.";
    case "already_owned":
      return "You already own that item this season.";
    case "insufficient_wallet":
      return "Your wallet is short for that security buy.";
  }
}
