import {
  type ButtonInteraction,
  Client,
  Events,
  type Message,
  type MessageCreateOptions,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
  type TextBasedChannel
} from "discord.js";
import type { GuildConfig, HeistRepository } from "../db/repository.js";
import { nextSeasonModifier, type CrewRole } from "../game/engagement.js";
import { formatDollars, formatDuration, nowMs } from "../game/time.js";
import type { ActivityService } from "../services/activity.js";
import type { BountyService } from "../services/bounties.js";
import type { CaseService } from "../services/cases.js";
import type { CrewHeistService } from "../services/crew-heists.js";
import { containsEmojiOrCustomEmote } from "../services/activity.js";
import type { CameraService } from "../services/cameras.js";
import type { DrugService } from "../services/drugs.js";
import type { EconomyService } from "../services/economy.js";
import type { GazetteService } from "../services/gazette.js";
import type { MarketService } from "../services/market.js";
import { MarketDataError } from "../services/market-data.js";
import type { RobberyService } from "../services/robbery.js";
import type { SecurityService } from "../services/security.js";
import { scheduleMessageDeletion, scheduleReplyDeletion } from "./cleanup.js";
import type { DropDispatcher } from "./drop-dispatcher.js";
import {
  attackEmbed,
  balanceEmbed,
  bountyListEmbed,
  bountyPlacedEmbed,
  buyEmbed,
  cameraBillEmbed,
  cameraFootageEmbed,
  cameraPowerEmbed,
  cameraRechargeEmbed,
  cameraStatusEmbed,
  caseButtons,
  caseMenuEmbed,
  caseResultEmbed,
  crewHeistButtons,
  crewHeistEmbed,
  crewHeistResultEmbed,
  drugBuyEmbed,
  drugPricesEmbed,
  drugSellEmbed,
  drugStashEmbed,
  gazetteEmbed,
  leaderboardEmbed,
  loadoutEmbed,
  marketLeaderboardEmbed,
  marketQuoteEmbed,
  marketSearchEmbed,
  moneyMoveEmbed,
  portfolioEmbed,
  seasonAwardsEmbed,
  seasonHistoryEmbed,
  seasonStatusEmbed,
  shopEmbed,
  stockBuyEmbed,
  stockSellEmbed
} from "./ui.js";

export interface BotServices {
  repo: HeistRepository;
  activity: ActivityService;
  bounties: BountyService;
  cameras: CameraService;
  cases: CaseService;
  crewHeists: CrewHeistService;
  drugs: DrugService;
  economy: EconomyService;
  gazette: GazetteService;
  market: MarketService;
  security: SecurityService;
  robbery: RobberyService;
  dropDispatcher: DropDispatcher;
}

export function registerDiscordHandlers(client: Client, services: BotServices): void {
  client.once(Events.ClientReady, () => {
    console.log(`Signed in as ${client.user?.tag ?? "unknown bot"}`);
    void schedulerTick(client, services);
    setInterval(() => void schedulerTick(client, services), 60 * 1000);
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
        if (await services.dropDispatcher.handleButton(interaction, now)) {
          return;
        }
        if (interaction.customId.startsWith("case:")) {
          await handleCaseButton(interaction, services, now);
          return;
        }
        if (interaction.customId.startsWith("crew:")) {
          await handleCrewButton(interaction, services, now);
          return;
        }
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

async function schedulerTick(client: Client, services: BotServices): Promise<void> {
  const now = nowMs();
  for (const config of services.repo.listGuildConfigs()) {
    services.economy.applyDailyInterest(config.guildId, now);
    const view = services.gazette.build(config.guildId, now);
    if (view && config.dropChannelIds[0]) {
      const channel = await client.channels.fetch(config.dropChannelIds[0]).catch(() => null);
      if (isSendableTextChannel(channel)) {
        const message = await channel.send({ embeds: [gazetteEmbed(view)] });
        scheduleMessageDeletion(message);
        services.gazette.markPosted(config.guildId, now);
      }
    }
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
      await replyPublic(interaction, { embeds: [moneyMoveEmbed("Cash Deposited", result.amount, result.player)] });
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
      await replyPublic(interaction, { embeds: [moneyMoveEmbed("Cash Withdrawn", result.amount, result.player)] });
      return;
    }

    case "leaderboard": {
      await replyPublic(interaction, { embeds: [leaderboardEmbed(services.economy.leaderboard(guildId, now))] });
      return;
    }

    case "case": {
      await interaction.reply({ embeds: [caseMenuEmbed()], components: caseButtons(), flags: MessageFlags.Ephemeral });
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

    case "drug": {
      await handleDrug(interaction, services, now);
      return;
    }

    case "camera": {
      await handleCamera(interaction, services, now);
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

    case "crewheist": {
      await handleCrewHeistCommand(interaction, services, now);
      return;
    }

    case "bounty": {
      await handleBounty(interaction, services, now);
      return;
    }

    case "season": {
      await handleSeason(interaction, services, now);
      return;
    }

    case "market": {
      await handleMarket(interaction, services, now);
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

async function handleMarket(
  interaction: ChatInputCommandInteraction,
  services: BotServices,
  now: number
): Promise<void> {
  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand(true);

  try {
    switch (subcommand) {
      case "quote": {
        const quote = await services.market.quote(interaction.options.getString("symbol", true), now);
        await replyPublic(interaction, { embeds: [marketQuoteEmbed(quote)] });
        return;
      }

      case "search": {
        const matches = await services.market.search(interaction.options.getString("keywords", true));
        await interaction.reply({ embeds: [marketSearchEmbed(matches)], flags: MessageFlags.Ephemeral });
        return;
      }

      case "buy": {
        const result = await services.market.buy(
          guildId,
          interaction.user.id,
          interaction.options.getString("symbol", true),
          interaction.options.getInteger("amount", true),
          now
        );
        if (!result.ok) {
          await interaction.reply({ content: marketBuyFailureText(result.reason), flags: MessageFlags.Ephemeral });
          return;
        }
        await replyPublic(interaction, { embeds: [stockBuyEmbed(result)] });
        return;
      }

      case "sell": {
        const sellAll = interaction.options.getBoolean("all") ?? false;
        const shares = interaction.options.getNumber("shares") ?? undefined;
        const result = await services.market.sell(
          guildId,
          interaction.user.id,
          interaction.options.getString("symbol", true),
          shares,
          sellAll,
          now
        );
        if (!result.ok) {
          await interaction.reply({ content: marketSellFailureText(result.reason), flags: MessageFlags.Ephemeral });
          return;
        }
        await replyPublic(interaction, { embeds: [stockSellEmbed(result)] });
        return;
      }

      case "portfolio": {
        const target = interaction.options.getUser("player") ?? interaction.user;
        if (target.bot) {
          await interaction.reply({ content: "Bot accounts do not keep portfolios here.", flags: MessageFlags.Ephemeral });
          return;
        }
        const view = await services.market.portfolio(guildId, target.id, now);
        await interaction.reply({ embeds: [portfolioEmbed(view, target.id)], flags: MessageFlags.Ephemeral });
        return;
      }

      case "leaderboard": {
        const entries = await services.market.leaderboard(guildId, now);
        await replyPublic(interaction, { embeds: [marketLeaderboardEmbed(entries)] });
        return;
      }
    }
  } catch (error) {
    if (error instanceof MarketDataError) {
      await interaction.reply({ content: marketDataErrorText(error), flags: MessageFlags.Ephemeral });
      return;
    }
    throw error;
  }
}

async function handleDrug(
  interaction: ChatInputCommandInteraction,
  services: BotServices,
  now: number
): Promise<void> {
  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand(true);

  switch (subcommand) {
    case "prices": {
      await interaction.reply({ embeds: [drugPricesEmbed(services.drugs.prices(guildId, now))], flags: MessageFlags.Ephemeral });
      return;
    }

    case "stash": {
      await interaction.reply({
        embeds: [drugStashEmbed(services.drugs.stash(guildId, interaction.user.id, now))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    case "buy": {
      const result = services.drugs.buy(
        guildId,
        interaction.user.id,
        interaction.options.getString("type", true),
        interaction.options.getInteger("amount", true),
        now
      );
      if (!result.ok) {
        await interaction.reply({ content: drugBuyFailureText(result.reason), flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ embeds: [drugBuyEmbed(result)], flags: MessageFlags.Ephemeral });
      return;
    }

    case "sell": {
      const result = services.drugs.sell(
        guildId,
        interaction.user.id,
        interaction.options.getString("type", true),
        interaction.options.getInteger("amount", true),
        now
      );
      if (!result.ok) {
        await interaction.reply({ content: drugSellFailureText(result.reason), flags: MessageFlags.Ephemeral });
        return;
      }
      if (result.busted && result.publicBust) {
        await replyPublic(interaction, { embeds: [drugSellEmbed(result)] });
        return;
      }
      await interaction.reply({ embeds: [drugSellEmbed(result)], flags: MessageFlags.Ephemeral });
      return;
    }
  }
}

async function handleCamera(
  interaction: ChatInputCommandInteraction,
  services: BotServices,
  now: number
): Promise<void> {
  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand(true);

  switch (subcommand) {
    case "status": {
      await interaction.reply({
        embeds: [cameraStatusEmbed(services.cameras.status(guildId, interaction.user.id, now))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    case "footage": {
      await interaction.reply({
        embeds: [cameraFootageEmbed(services.cameras.footage(guildId, interaction.user.id, now))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    case "power": {
      const result = services.cameras.setPower(guildId, interaction.user.id, interaction.options.getString("source", true), now);
      if (!result.ok) {
        await interaction.reply({ content: cameraFailureText(result.reason), flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ embeds: [cameraPowerEmbed(result)], flags: MessageFlags.Ephemeral });
      return;
    }

    case "recharge": {
      const result = services.cameras.recharge(guildId, interaction.user.id, interaction.options.getInteger("packs", true), now);
      if (!result.ok) {
        await interaction.reply({ content: cameraFailureText(result.reason), flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ embeds: [cameraRechargeEmbed(result)], flags: MessageFlags.Ephemeral });
      return;
    }

    case "bill": {
      const result = services.cameras.payGridBill(guildId, interaction.user.id, interaction.options.getInteger("days") ?? 1, now);
      if (!result.ok) {
        await interaction.reply({ content: cameraFailureText(result.reason), flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ embeds: [cameraBillEmbed(result)], flags: MessageFlags.Ephemeral });
      return;
    }
  }
}

async function handleBounty(
  interaction: ChatInputCommandInteraction,
  services: BotServices,
  now: number
): Promise<void> {
  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand(true);
  if (subcommand === "list") {
    await replyPublic(interaction, { embeds: [bountyListEmbed(services.bounties.list(guildId, now))] });
    return;
  }

  const target = interaction.options.getUser("target", true);
  if (target.bot) {
    await interaction.reply({ content: "Bot accounts do not carry bounties here.", flags: MessageFlags.Ephemeral });
    return;
  }
  const result = services.bounties.place(
    guildId,
    interaction.user.id,
    target.id,
    interaction.options.getInteger("amount", true),
    now
  );
  if (!result.ok) {
    await interaction.reply({ content: bountyFailureText(result.reason), flags: MessageFlags.Ephemeral });
    return;
  }
  await replyPublic(interaction, { embeds: [bountyPlacedEmbed(result.bounty)] });
}

async function handleSeason(
  interaction: ChatInputCommandInteraction,
  services: BotServices,
  now: number
): Promise<void> {
  const guildId = interaction.guildId!;
  const subcommand = interaction.options.getSubcommand(true);
  if (subcommand === "status") {
    const season = services.repo.getCurrentSeason(guildId, now);
    const top = services.economy.leaderboard(guildId, now, 1)[0];
    await replyPublic(interaction, { embeds: [seasonStatusEmbed(season, top)] });
    return;
  }
  if (subcommand === "history") {
    await replyPublic(interaction, { embeds: [seasonHistoryEmbed(services.repo.listSeasons(guildId, 6))] });
    return;
  }

  const config = services.repo.ensureGuild(guildId, now);
  const requested = interaction.options.getInteger("id") ?? Math.max(1, config.currentSeasonId - 1);
  const season = services.repo.getSeason(guildId, requested);
  if (!season) {
    await interaction.reply({ content: "That season is not on the ledger.", flags: MessageFlags.Ephemeral });
    return;
  }
  await replyPublic(interaction, { embeds: [seasonAwardsEmbed(season)] });
}

async function handleCrewHeistCommand(
  interaction: ChatInputCommandInteraction,
  services: BotServices,
  now: number
): Promise<void> {
  const target = interaction.options.getUser("target", true);
  if (target.bot) {
    await interaction.reply({ content: "Bot accounts do not keep vaults here.", flags: MessageFlags.Ephemeral });
    return;
  }

  const result = services.crewHeists.create(interaction.guildId!, interaction.channelId, interaction.user.id, target.id, now);
  if (!result.ok) {
    await interaction.reply({ content: crewCreateFailureText(result.reason), flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({
    embeds: [crewHeistEmbed(result.heist, result.members)],
    components: crewHeistButtons(result.heist.id)
  });
  const message = await interaction.fetchReply();
  services.crewHeists.attachMessage(result.heist.id, message.id);
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
  await replyPublic(interaction, { embeds: [attackEmbed(result)] });
}

async function handleCaseButton(interaction: ButtonInteraction, services: BotServices, now: number): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "This case file only opens inside a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  const caseId = interaction.customId.slice("case:".length);
  const result = services.cases.run(interaction.guildId, interaction.user.id, caseId, now);
  if (!result.ok) {
    const content =
      result.reason === "cooldown"
        ? `Your case file is cooling down for ${formatDuration(result.availableAt ?? now, now)}.`
        : "That case file is no longer available.";
    await interaction.update({ content, embeds: [], components: [] });
    return;
  }

  await interaction.update({ embeds: [caseResultEmbed(result)], components: [] });
}

async function handleCrewButton(interaction: ButtonInteraction, services: BotServices, now: number): Promise<void> {
  const parts = interaction.customId.split(":");
  const heistId = parts[1];
  const action = parts[2];
  if (!heistId || !action) {
    await interaction.reply({ content: "That crew board is no longer readable.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === "join") {
    const role = parts[3] as CrewRole | undefined;
    if (!role) {
      await interaction.reply({ content: "Pick a crew role.", flags: MessageFlags.Ephemeral });
      return;
    }
    const result = services.crewHeists.join(heistId, interaction.user.id, role, now);
    if (!result.ok) {
      await interaction.reply({ content: crewJoinFailureText(result.reason), flags: MessageFlags.Ephemeral });
      if (result.reason === "expired" || result.reason === "closed") {
        await interaction.message.edit({ components: crewHeistButtons(heistId, true) }).catch(() => undefined);
        scheduleMessageDeletion(interaction.message);
      }
      return;
    }
    await interaction.update({
      embeds: [crewHeistEmbed(result.heist, result.members)],
      components: crewHeistButtons(result.heist.id)
    });
    return;
  }

  if (action === "launch") {
    const result = services.crewHeists.resolve(heistId, interaction.user.id, now);
    if (!result.ok) {
      await interaction.reply({ content: crewResolveFailureText(result.reason), flags: MessageFlags.Ephemeral });
      if (result.reason === "expired" || result.reason === "closed") {
        await interaction.message.edit({ components: crewHeistButtons(heistId, true) }).catch(() => undefined);
        scheduleMessageDeletion(interaction.message);
      }
      return;
    }
    await interaction.update({
      embeds: [crewHeistResultEmbed(result)],
      components: crewHeistButtons(result.heist.id, true)
    });
    scheduleMessageDeletion(interaction.message, 30 * 1000);
  }
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
        const season = services.repo.getCurrentSeason(guildId, now);
        const top = services.economy.leaderboard(guildId, now, 1)[0];
        await interaction.reply({
          embeds: [seasonStatusEmbed(season, top)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const current = services.repo.ensureGuild(guildId, now);
      const modifier = nextSeasonModifier(current.currentSeasonId + 1);
      const result = services.repo.startNextSeason(guildId, now, modifier.id);
      await interaction.reply({
        content: result.winnerUserId
          ? `Season closed. <@${result.winnerUserId}> takes the brass plaque. Season #${result.seasonId} opens with ${modifier.name}.`
          : `Season closed with no winner. Season #${result.seasonId} opens with ${modifier.name}.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    case "features": {
      const feature = interaction.options.getString("feature", true);
      const enabled = interaction.options.getBoolean("enabled", true);
      const settings =
        feature === "drugs"
          ? { drugsEnabled: enabled }
          : feature === "cameras"
            ? { camerasEnabled: enabled }
            : {};
      const config = services.repo.updateGuildSettings(guildId, settings, now);
      await interaction.reply({
        content: `Features updated. Drug selling is ${config.drugsEnabled ? "enabled" : "disabled"}; cameras are ${
          config.camerasEnabled ? "enabled" : "disabled"
        }.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    case "tuning": {
      const setting = interaction.options.getString("setting", true);
      const value = interaction.options.getNumber("value", true);
      const settings = adminTuningUpdate(setting, value);
      if (!settings) {
        await interaction.reply({ content: "That tuning key is not recognized.", flags: MessageFlags.Ephemeral });
        return;
      }
      const config = services.repo.updateGuildSettings(guildId, settings, now);
      await interaction.reply({
        content: adminTuningSummary(setting, config),
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

function adminTuningUpdate(
  setting: string,
  value: number
): Partial<
  Pick<
    GuildConfig,
    | "drugPriceVolatility"
    | "publicBustThreshold"
    | "cameraFootageWindowMs"
    | "cameraBatteryCost"
    | "cameraGridRobberyCost"
    | "cameraGridFullCost"
  >
> | null {
  switch (setting) {
    case "drug_volatility":
      return { drugPriceVolatility: value };
    case "public_bust_threshold":
      return { publicBustThreshold: Math.floor(value) };
    case "camera_window_hours":
      return { cameraFootageWindowMs: Math.floor(value * 60 * 60 * 1000) };
    case "battery_cost":
      return { cameraBatteryCost: Math.floor(value) };
    case "grid_robbery_cost":
      return { cameraGridRobberyCost: Math.floor(value) };
    case "grid_full_cost":
      return { cameraGridFullCost: Math.floor(value) };
    default:
      return null;
  }
}

function adminTuningSummary(setting: string, config: GuildConfig): string {
  switch (setting) {
    case "drug_volatility":
      return `Drug price volatility set to ${config.drugPriceVolatility}.`;
    case "public_bust_threshold":
      return `Public bust threshold set to ${formatDollars(config.publicBustThreshold)}.`;
    case "camera_window_hours":
      return `Camera footage window set to ${Math.round(config.cameraFootageWindowMs / (60 * 60 * 1000))} hours.`;
    case "battery_cost":
      return `Camera battery pack cost set to ${formatDollars(config.cameraBatteryCost)}.`;
    case "grid_robbery_cost":
      return `Robbery-only grid daily cost set to ${formatDollars(config.cameraGridRobberyCost)}.`;
    case "grid_full_cost":
      return `Full camera grid daily cost set to ${formatDollars(config.cameraGridFullCost)}.`;
    default:
      return "Tuning updated.";
  }
}

function buyFailureText(reason: "unknown_item" | "already_owned" | "insufficient_wallet" | "cameras_disabled"): string {
  switch (reason) {
    case "unknown_item":
      return "That item is not in the catalog.";
    case "already_owned":
      return "You already own that item this season.";
    case "insufficient_wallet":
      return "Your wallet is short for that security buy.";
    case "cameras_disabled":
      return "Cameras are disabled by an admin.";
  }
}

function drugBuyFailureText(reason: "disabled" | "unknown_product" | "invalid_amount" | "insufficient_wallet"): string {
  switch (reason) {
    case "disabled":
      return "Drug selling is disabled by an admin.";
    case "unknown_product":
      return "That product is not on the street sheet.";
    case "invalid_amount":
      return "Use a positive unit amount.";
    case "insufficient_wallet":
      return "Your wallet is short for that supply buy.";
  }
}

function drugSellFailureText(
  reason: "disabled" | "unknown_product" | "invalid_amount" | "missing_stash" | "insufficient_stash"
): string {
  switch (reason) {
    case "disabled":
      return "Drug selling is disabled by an admin.";
    case "unknown_product":
      return "That product is not on the street sheet.";
    case "invalid_amount":
      return "Use a positive unit amount.";
    case "missing_stash":
      return "You do not have that product in your stash.";
    case "insufficient_stash":
      return "Your stash does not have that many units.";
  }
}

function cameraFailureText(
  reason: "disabled" | "not_installed" | "invalid_source" | "invalid_amount" | "insufficient_wallet"
): string {
  switch (reason) {
    case "disabled":
      return "Cameras are disabled by an admin.";
    case "not_installed":
      return "Install a surveillance item with `/buy item` first.";
    case "invalid_source":
      return "Use battery or grid as the camera power source.";
    case "invalid_amount":
      return "Use a positive amount.";
    case "insufficient_wallet":
      return "Your wallet is short for that camera cost.";
  }
}

function marketBuyFailureText(reason: "invalid_amount" | "insufficient_wallet" | "order_too_small"): string {
  switch (reason) {
    case "invalid_amount":
      return "Use a positive wallet-dollar amount.";
    case "insufficient_wallet":
      return "Your wallet is short for that stock buy.";
    case "order_too_small":
      return "That order is too small at the current market price.";
  }
}

function marketSellFailureText(
  reason: "missing_position" | "invalid_shares" | "insufficient_shares" | "order_too_small"
): string {
  switch (reason) {
    case "missing_position":
      return "You do not own that symbol this season.";
    case "invalid_shares":
      return "Choose a share amount or set all:true.";
    case "insufficient_shares":
      return "You do not own that many shares.";
    case "order_too_small":
      return "That sale would return less than $1.";
  }
}

function bountyFailureText(
  reason: "self_target" | "target_not_enrolled" | "invalid_amount" | "insufficient_wallet"
): string {
  switch (reason) {
    case "self_target":
      return "You cannot post a bounty on yourself.";
    case "target_not_enrolled":
      return "That player has not entered the current season.";
    case "invalid_amount":
      return "Use a positive bounty amount.";
    case "insufficient_wallet":
      return "Your wallet is short for that bounty.";
  }
}

function crewCreateFailureText(reason: "self_target" | "target_not_enrolled" | "no_bank_cash"): string {
  switch (reason) {
    case "self_target":
      return "You cannot crew-heist yourself.";
    case "target_not_enrolled":
      return "That player has not entered the current season.";
    case "no_bank_cash":
      return "That bank account has nothing worth breaching.";
  }
}

function crewJoinFailureText(
  reason: "missing" | "closed" | "expired" | "target_joined" | "already_joined" | "role_taken"
): string {
  switch (reason) {
    case "missing":
      return "That crew board is gone.";
    case "closed":
      return "That crew job is already closed.";
    case "expired":
      return "That crew job expired.";
    case "target_joined":
      return "The target cannot join the crew.";
    case "already_joined":
      return "You already joined this crew.";
    case "role_taken":
      return "That role is already taken.";
  }
}

function crewResolveFailureText(
  reason: "missing" | "not_leader" | "closed" | "expired" | "short_crew" | "target_not_enrolled" | "no_bank_cash"
): string {
  switch (reason) {
    case "missing":
      return "That crew board is gone.";
    case "not_leader":
      return "Only the crew leader can launch this job.";
    case "closed":
      return "That crew job is already closed.";
    case "expired":
      return "That crew job expired.";
    case "short_crew":
      return "You need at least two crew members before launching.";
    case "target_not_enrolled":
      return "The target is no longer on this season's ledger.";
    case "no_bank_cash":
      return "That bank account has nothing worth breaching.";
  }
}

function marketDataErrorText(error: MarketDataError): string {
  switch (error.code) {
    case "missing_key":
      return "Real-market trading needs `ALPHA_VANTAGE_API_KEY` in `.env` before the market desk can open.";
    case "invalid_symbol":
      return error.message;
    case "not_found":
      return "No real-market quote was found for that symbol.";
    case "rate_limited":
      return "The market data provider is rate-limiting requests. Try again after the quote cache cools down.";
    case "provider_error":
      return "The market data provider did not return a usable quote.";
  }
}

async function replyPublic(
  interaction: ChatInputCommandInteraction,
  options: InteractionReplyOptions
): Promise<void> {
  await interaction.reply(options);
  scheduleReplyDeletion(interaction);
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
