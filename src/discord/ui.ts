import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbedField
} from "discord.js";
import type {
  BountyRecord,
  CrewHeistMemberRecord,
  CrewHeistRecord,
  DropRecord,
  LeaderboardEntry,
  PlayerRecord,
  SeasonRecord
} from "../db/repository.js";
import {
  DROP_LIFETIME_MS,
  NOIR,
  SECURITY_ITEMS,
  SECURITY_SLOTS,
  type SecurityItem,
  type SecuritySlot
} from "../game/constants.js";
import { CASE_FILES, CREW_ROLES, DROP_VARIANTS, heatBand, seasonModifier, type CrewRole } from "../game/engagement.js";
import { formatCents, formatDollars, formatDuration } from "../game/time.js";
import type { MarketQuote, MarketSymbolMatch } from "../services/market-data.js";
import type { MarketBuyResult, MarketLeaderboardEntry, MarketSellResult, PortfolioView } from "../services/market.js";
import type { AttackResult } from "../services/robbery.js";
import type { CaseResult } from "../services/cases.js";
import type { ResolveCrewHeistResult } from "../services/crew-heists.js";
import { roleLabel } from "../services/crew-heists.js";
import type { GazetteView } from "../services/gazette.js";

export function dropButton(drop: DropRecord | string, disabled = false): ActionRowBuilder<ButtonBuilder> {
  const dropId = typeof drop === "string" ? drop : drop.id;
  const label =
    disabled || typeof drop === "string"
      ? disabled
        ? "Closed"
        : "Grab the Bag"
      : (DROP_VARIANTS.find((variant) => variant.kind === drop.kind)?.buttonLabel ?? "Grab the Bag");
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`drop:${dropId}`)
      .setLabel(label)
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(disabled)
  );
}

export function caseButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let index = 0; index < CASE_FILES.length; index += 3) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...CASE_FILES.slice(index, index + 3).map((caseFile) =>
          new ButtonBuilder()
            .setCustomId(`case:${caseFile.id}`)
            .setLabel(caseFile.buttonLabel)
            .setStyle(ButtonStyle.Secondary)
        )
      )
    );
  }
  return rows;
}

export function crewHeistButtons(heistId: string, disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...CREW_ROLES.map((role) =>
        new ButtonBuilder()
          .setCustomId(`crew:${heistId}:join:${role.id}`)
          .setLabel(role.label)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      )
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`crew:${heistId}:launch`)
        .setLabel(disabled ? "Closed" : "Launch Job")
        .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

export function caseMenuEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(NOIR.smoke)
    .setTitle("Daily Case File")
    .setDescription("Pick one quiet job for today's ledger.")
    .addFields(
      CASE_FILES.map((caseFile) => ({
        name: caseFile.name,
        value: `${caseFile.description}\nReward: ${formatDollars(caseFile.minReward)}-${formatDollars(caseFile.maxReward)}`,
        inline: false
      }))
    );
}

export function caseResultEmbed(result: Extract<CaseResult, { ok: true }>): EmbedBuilder {
  const heatText =
    result.heatDelta === 0 ? "No heat change." : `${result.heatDelta > 0 ? "+" : ""}${result.heatDelta} heat.`;
  const laundered = result.laundered > 0 ? ` Laundered ${formatDollars(result.laundered)} into the bank.` : "";
  return new EmbedBuilder()
    .setColor(result.heatDelta > 0 ? NOIR.red : NOIR.green)
    .setTitle(`${result.caseFile.name} Closed`)
    .setDescription(`You cleared **${formatDollars(result.reward)}**. ${heatText}${laundered}`)
    .addFields(
      { name: "Wallet", value: formatDollars(result.player.wallet), inline: true },
      { name: "Bank", value: formatDollars(result.player.bank), inline: true },
      { name: "Heat", value: `${heatBand(result.player.heat).label} (${result.player.heat}/100)`, inline: true }
    );
}

export function bountyPlacedEmbed(bounty: BountyRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(NOIR.red)
    .setTitle("Bounty Posted")
    .setDescription(
      `<@${bounty.issuerUserId}> put **${formatDollars(bounty.amount)}** on <@${bounty.targetUserId}>. It pays on a successful rob or heist.`
    );
}

export function bountyListEmbed(bounties: BountyRecord[]): EmbedBuilder {
  const lines = bounties.length
    ? bounties.map(
        (bounty) =>
          `**#${bounty.id}** ${formatDollars(bounty.amount)} on <@${bounty.targetUserId}> by <@${bounty.issuerUserId}>`
      )
    : ["No open bounties on the board."];

  return new EmbedBuilder().setColor(NOIR.brass).setTitle("Bounty Board").setDescription(lines.join("\n"));
}

export function crewHeistEmbed(heist: CrewHeistRecord, members: CrewHeistMemberRecord[]): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(NOIR.red)
    .setTitle("Crew Heist Recruiting")
    .setDescription(
      `<@${heist.leaderUserId}> is putting a crew together against <@${heist.targetUserId}>. Pick one role, then the leader launches.`
    )
    .addFields(crewRoleFields(members));
}

export function crewHeistResultEmbed(result: Extract<ResolveCrewHeistResult, { ok: true }>): EmbedBuilder {
  const crew = result.members.map((member) => `<@${member.userId}> (${roleLabel(member.role)})`).join(", ");
  if (result.success) {
    const bounty = result.bountyPaid > 0 ? ` Bounty desk paid another **${formatDollars(result.bountyPaid)}**.` : "";
    return new EmbedBuilder()
      .setColor(NOIR.green)
      .setTitle("Crew Heist Paid Out")
      .setDescription(
        `${crew}\n\nThe crew took **${formatDollars(result.stolen)}** from <@${result.target.userId}>. Each member pockets **${formatDollars(
          result.payout
        )}**.${bounty}`
      )
      .addFields({ name: "Odds", value: `${Math.round(result.chance * 100)}%`, inline: true });
  }

  return new EmbedBuilder()
    .setColor(NOIR.red)
    .setTitle("Crew Heist Burned")
    .setDescription(`${crew}\n\nThe job collapsed. The crew paid **${formatDollars(result.fine)}** in total fines.`)
    .addFields({ name: "Odds", value: `${Math.round(result.chance * 100)}%`, inline: true });
}

export function seasonStatusEmbed(season: SeasonRecord, top?: LeaderboardEntry): EmbedBuilder {
  const modifier = seasonModifier(season.modifierId);
  return new EmbedBuilder()
    .setColor(NOIR.brass)
    .setTitle(`Season #${season.seasonId}`)
    .setDescription(top ? `Current leader: <@${top.userId}> at **${formatDollars(top.netWorth)}**.` : "No one has entered yet.")
    .addFields({ name: modifier.name, value: modifier.description, inline: false });
}

export function seasonHistoryEmbed(seasons: SeasonRecord[]): EmbedBuilder {
  const lines = seasons.length
    ? seasons.map((season) => {
        const modifier = seasonModifier(season.modifierId);
        const winner = season.winnerUserId ? `<@${season.winnerUserId}>` : "No winner";
        return `**#${season.seasonId}** ${modifier.name} - ${winner}`;
      })
    : ["No season history yet."];
  return new EmbedBuilder().setColor(NOIR.brass).setTitle("Season History").setDescription(lines.join("\n"));
}

export function seasonAwardsEmbed(season: SeasonRecord): EmbedBuilder {
  const awards = season.awards;
  const fields: APIEmbedField[] = [
    { name: "Richest", value: mentionOrNone(awards.richestUserId), inline: true },
    { name: "Best Thief", value: mentionOrNone(awards.bestThiefUserId), inline: true },
    {
      name: "Biggest Heist",
      value: awards.biggestHeistUserId
        ? `${mentionOrNone(awards.biggestHeistUserId)} - ${formatDollars(awards.biggestHeistAmount ?? 0)}`
        : "None",
      inline: true
    },
    { name: "Worst Luck", value: mentionOrNone(awards.worstLuckUserId), inline: true },
    { name: "Most Wanted", value: mentionOrNone(awards.mostWantedUserId), inline: true }
  ];
  return new EmbedBuilder().setColor(NOIR.brass).setTitle(`Season #${season.seasonId} Awards`).addFields(fields);
}

export function gazetteEmbed(view: GazetteView): EmbedBuilder {
  const fields: APIEmbedField[] = [
    { name: "Season Modifier", value: `**${view.modifierName}**\n${view.modifierDescription}`, inline: false }
  ];
  if (view.top) {
    fields.push({ name: "Richest Operator", value: `<@${view.top.userId}> - ${formatDollars(view.top.netWorth)}`, inline: true });
  }
  if (view.mostWanted) {
    fields.push({ name: "Most Wanted", value: `<@${view.mostWanted.userId}> - ${view.mostWanted.heat}/100 heat`, inline: true });
  }
  if (view.biggestHeist) {
    fields.push({
      name: "Biggest Heist",
      value: `<@${view.biggestHeist.userId}> - ${formatDollars(view.biggestHeist.amount)}`,
      inline: true
    });
  }
  if (view.worstFailure) {
    fields.push({
      name: "Worst Burn",
      value: `<@${view.worstFailure.userId}> - ${formatDollars(Math.abs(view.worstFailure.amount))}`,
      inline: true
    });
  }
  if (view.biggestDrop) {
    fields.push({
      name: "Biggest Drop",
      value: `<@${view.biggestDrop.userId}> - ${formatDollars(view.biggestDrop.amount)}`,
      inline: true
    });
  }
  if (view.bountyClaim) {
    fields.push({
      name: "Bounty Paid",
      value: `<@${view.bountyClaim.userId}> - ${formatDollars(view.bountyClaim.amount)}`,
      inline: true
    });
  }

  return new EmbedBuilder()
    .setColor(NOIR.brass)
    .setTitle("The Vault Gazette")
    .setDescription(`A quiet digest of **${view.eventCount}** ledger events.`)
    .addFields(fields);
}

export function balanceEmbed(player: PlayerRecord): EmbedBuilder {
  const band = heatBand(player.heat);
  return new EmbedBuilder()
    .setColor(NOIR.brass)
    .setTitle("Private Ledger")
    .addFields(
      { name: "Wallet", value: formatDollars(player.wallet), inline: true },
      { name: "Bank", value: formatDollars(player.bank), inline: true },
      { name: "Net Worth", value: formatDollars(player.wallet + player.bank), inline: true },
      { name: "Lifetime Earned", value: formatDollars(player.lifetimeEarned), inline: true },
      { name: "Lifetime Stolen", value: formatDollars(player.lifetimeStolen), inline: true },
      { name: "Title", value: playerTitle(player), inline: true },
      { name: "Heat", value: `${band.label} (${player.heat}/100)`, inline: true },
      { name: "Season", value: `#${player.seasonId}`, inline: true }
    );
}

export function moneyMoveEmbed(title: string, amount: number, player: PlayerRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(NOIR.green)
    .setTitle(title)
    .setDescription(`${formatDollars(amount)} moved through the ledger.`)
    .addFields(
      { name: "Wallet", value: formatDollars(player.wallet), inline: true },
      { name: "Bank", value: formatDollars(player.bank), inline: true }
    );
}

export function leaderboardEmbed(entries: LeaderboardEntry[]): EmbedBuilder {
  const lines = entries.length
    ? entries.map((entry, index) => {
        const title = entry.heat >= 55 ? " · Most Wanted" : entry.lifetimeStolen >= 3000 ? " · The Locksmith" : "";
        return `**${index + 1}.** <@${entry.userId}>${title} - ${formatDollars(entry.netWorth)} (${formatDollars(
          entry.lifetimeStolen
        )} stolen lifetime)`;
      })
    : ["No operators are on the board yet."];

  return new EmbedBuilder()
    .setColor(NOIR.brass)
    .setTitle("Season Vault Board")
    .setDescription(lines.join("\n"));
}

export function shopEmbed(): EmbedBuilder {
  const fields = SECURITY_SLOTS.map((slot) => ({
    name: slotLabel(slot),
    value: SECURITY_ITEMS.filter((item) => item.slot === slot)
      .map((item) => `**${item.name}** - ${formatDollars(item.cost)}\n${item.description}\n\`${item.id}\``)
      .join("\n\n"),
    inline: false
  }));

  return new EmbedBuilder().setColor(NOIR.brass).setTitle("Backroom Security Catalog").addFields(fields);
}

export function loadoutEmbed(equipped: Partial<Record<SecuritySlot, SecurityItem>>): EmbedBuilder {
  const fields: APIEmbedField[] = SECURITY_SLOTS.map((slot) => {
    const item = equipped[slot];
    return {
      name: slotLabel(slot),
      value: item ? `**${item.name}**\n${item.description}` : "Empty",
      inline: true
    };
  });

  return new EmbedBuilder().setColor(NOIR.smoke).setTitle("Active Security Loadout").addFields(fields);
}

export function buyEmbed(item: SecurityItem, player: PlayerRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(NOIR.green)
    .setTitle("Security Installed")
    .setDescription(`**${item.name}** is now watching the ${slotLabel(item.slot).toLowerCase()}.`)
    .addFields({ name: "Wallet", value: formatDollars(player.wallet), inline: true });
}

export function dropEmbed(drop: DropRecord): EmbedBuilder {
  const lifetimeSeconds = Math.floor(DROP_LIFETIME_MS / 1000);
  const variant = DROP_VARIANTS.find((candidate) => candidate.kind === drop.kind);
  const title = variant?.name ?? "Unmarked Bag";
  const heat = drop.heatDelta > 0 ? ` It carries **${drop.heatDelta} heat**.` : "";
  const locked =
    drop.requiredClaims > 1
      ? ` It needs **${drop.requiredClaims} different hands** on the lock before it opens.`
      : "";
  const opener = pick([
    "The room clocks",
    "A loose floorboard gives up",
    "Somebody left behind",
    "A courier's mistake spills"
  ]);
  return new EmbedBuilder()
    .setColor(NOIR.green)
    .setTitle(`${title} On The Floor`)
    .setDescription(
      `${opener} **${formatDollars(drop.amount)}**.${locked}${heat} It vanishes in ${lifetimeSeconds} seconds.`
    );
}

export function pendingDropEmbed(drop: DropRecord, claimants: string[], claimsNeeded: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(NOIR.brass)
    .setTitle("Lock Half-Turned")
    .setDescription(
      `${claimants.map((userId) => `<@${userId}>`).join(", ")} started the work. **${claimsNeeded}** more hand${
        claimsNeeded === 1 ? "" : "s"
      } needed before **${formatDollars(drop.amount)}** opens.`
    );
}

export function claimedDropEmbed(drop: DropRecord, claimants: string[], perPlayerAmount: number): EmbedBuilder {
  const names = claimants.map((userId) => `<@${userId}>`).join(", ");
  const split =
    claimants.length > 1
      ? `${names} ${pick(["cracked it", "worked the clasp", "split the quiet money"])} and each pocketed **${formatDollars(
          perPlayerAmount
        )}**.`
      : `${names} ${pick(["grabbed", "palmed", "swept up"])} **${formatDollars(
          perPlayerAmount
        )}** before the room blinked.`;
  return new EmbedBuilder()
    .setColor(NOIR.brass)
    .setTitle("Drop Secured")
    .setDescription(split);
}

export function attackEmbed(result: AttackResult): EmbedBuilder {
  if (!result.ok) {
    return new EmbedBuilder().setColor(NOIR.red).setTitle("Job Refused").setDescription(attackRefusalText(result));
  }

  if (result.success) {
    const extra =
      result.kind === "heist" && result.insuranceRestore
        ? `\nInsurance restored ${formatDollars(result.insuranceRestore)} to <@${result.target.userId}>.`
        : "";
    const bounty = result.bountyPaid > 0 ? `\nBounty paid **${formatDollars(result.bountyPaid)}**.` : "";
    const rivalry = rivalryText(result.rivalry);
    return new EmbedBuilder()
      .setColor(NOIR.green)
      .setTitle(result.kind === "rob" ? "Wallet Lifted" : "Vault Breached")
      .setDescription(
        `<@${result.robber.userId}> ${pick(["took", "lifted", "skimmed"])} **${formatDollars(
          result.stolen
        )}** from <@${result.target.userId}>.${extra}${bounty}${rivalry}`
      )
      .addFields(
        { name: "Odds", value: `${Math.round(result.chance * 100)}%`, inline: true },
        { name: "Heat", value: `${heatBand(result.robber.heat).label} (${result.robber.heat}/100)`, inline: true }
      );
  }

  const counter = result.counterSteal > 0 ? ` The guard countered for ${formatDollars(result.counterSteal)}.` : "";
  const rivalry = rivalryText(result.rivalry);
  return new EmbedBuilder()
    .setColor(NOIR.red)
    .setTitle(result.kind === "rob" ? "Robbery Botched" : "Heist Burned")
    .setDescription(
      `<@${result.robber.userId}> ${pick(["got caught", "tripped the wire", "left fingerprints"])} and paid **${formatDollars(
        result.fine
      )}** in fines.${counter}${rivalry}`
    )
    .addFields(
      { name: "Odds", value: `${Math.round(result.chance * 100)}%`, inline: true },
      { name: "Heat", value: `${heatBand(result.robber.heat).label} (${result.robber.heat}/100)`, inline: true }
    );
}

export function marketQuoteEmbed(quote: MarketQuote): EmbedBuilder {
  const changeSign = quote.changeCents >= 0 ? "+" : "";
  return new EmbedBuilder()
    .setColor(quote.changeCents >= 0 ? NOIR.green : NOIR.red)
    .setTitle(`${quote.symbol} Market Quote`)
    .addFields(
      { name: "Price", value: formatCents(quote.priceCents), inline: true },
      {
        name: "Move",
        value: `${changeSign}${formatCents(quote.changeCents)} (${quote.changePercent.toFixed(2)}%)`,
        inline: true
      },
      { name: "Volume", value: quote.volume.toLocaleString("en-US"), inline: true },
      { name: "As Of", value: quote.asOf, inline: true },
      { name: "Source", value: quote.provider, inline: true }
    );
}

export function marketSearchEmbed(matches: MarketSymbolMatch[]): EmbedBuilder {
  const description = matches.length
    ? matches
        .map((match) => `**${match.symbol}** - ${match.name}\n${match.region} · ${match.currency}`)
        .join("\n\n")
    : "No matching market symbols found.";

  return new EmbedBuilder().setColor(NOIR.brass).setTitle("Ticker Wire Search").setDescription(description);
}

export function stockBuyEmbed(result: Extract<MarketBuyResult, { ok: true }>): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(NOIR.green)
    .setTitle("Stock Position Opened")
    .setDescription(
      `<@${result.player.userId}> bought **${formatShares(result.sharesBoughtMicro)} ${result.quote.symbol}** for **${formatDollars(
        result.spentDollars
      )}**.`
    )
    .addFields(
      { name: "Fill Price", value: formatCents(result.quote.priceCents), inline: true },
      { name: "Wallet", value: formatDollars(result.player.wallet), inline: true }
    );
}

export function stockSellEmbed(result: Extract<MarketSellResult, { ok: true }>): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(result.realizedGainLossCents >= 0 ? NOIR.green : NOIR.red)
    .setTitle("Stock Position Sold")
    .setDescription(
      `<@${result.player.userId}> sold **${formatShares(result.sharesSoldMicro)} ${result.quote.symbol}** for **${formatDollars(
        result.receivedDollars
      )}**.`
    )
    .addFields(
      { name: "Fill Price", value: formatCents(result.quote.priceCents), inline: true },
      { name: "Realized", value: formatCents(result.realizedGainLossCents), inline: true },
      { name: "Wallet", value: formatDollars(result.player.wallet), inline: true }
    );
}

export function portfolioEmbed(view: PortfolioView, userId: string): EmbedBuilder {
  const lines = view.positions.length
    ? view.positions.map((position) => {
        return `**${position.holding.symbol}** ${formatShares(position.holding.sharesMicro)} shares · ${formatCents(
          position.marketValueCents
        )} (${formatCents(position.gainLossCents)})`;
      })
    : ["No stock positions this season."];

  return new EmbedBuilder()
    .setColor(view.gainLossCents >= 0 ? NOIR.green : NOIR.red)
    .setTitle("Market Portfolio")
    .setDescription(`<@${userId}>\n\n${lines.join("\n")}`)
    .addFields(
      { name: "Stock Value", value: formatCents(view.stockValueCents), inline: true },
      { name: "Cost Basis", value: formatCents(view.costBasisCents), inline: true },
      { name: "Open P/L", value: formatCents(view.gainLossCents), inline: true },
      { name: "Wallet", value: formatDollars(view.player.wallet), inline: true },
      { name: "Bank", value: formatDollars(view.player.bank), inline: true }
    );
}

export function marketLeaderboardEmbed(entries: MarketLeaderboardEntry[]): EmbedBuilder {
  const lines = entries.length
    ? entries.map((entry, index) => `**${index + 1}.** <@${entry.userId}> - ${formatCents(entry.stockValueCents)}`)
    : ["No stock portfolios are on the board yet."];

  return new EmbedBuilder().setColor(NOIR.brass).setTitle("Market Desk Board").setDescription(lines.join("\n"));
}

function attackRefusalText(result: Extract<AttackResult, { ok: false }>): string {
  switch (result.reason) {
    case "self_target":
      return "You cannot run a job on yourself.";
    case "target_not_enrolled":
      return "That player has not entered the current season.";
    case "target_shielded":
      return `That player is under new-account protection for ${formatDuration(result.availableAt ?? 0, Date.now())}.`;
    case "cooldown":
      return `Your crew is cooling off for ${formatDuration(result.availableAt ?? 0, Date.now())}.`;
    case "lockout":
      return `Your heist kit is locked down for ${formatDuration(result.availableAt ?? 0, Date.now())}.`;
    case "no_wallet_cash":
      return "That wallet is empty.";
    case "no_bank_cash":
      return "That bank account has nothing worth breaching.";
  }
}

function slotLabel(slot: SecuritySlot): string {
  switch (slot) {
    case "vault":
      return "Vault";
    case "alarm":
      return "Alarm";
    case "guard":
      return "Guard";
    case "insurance":
      return "Insurance";
  }
}

function playerTitle(player: PlayerRecord): string {
  if (player.heat >= 80) {
    return "Burned Operator";
  }
  if (player.heat >= 55) {
    return "Most Wanted";
  }
  if (player.lifetimeStolen >= 5000) {
    return "The Locksmith";
  }
  if (player.bank >= 5000) {
    return "Cold Ledger";
  }
  if (player.wallet + player.bank >= 3000) {
    return "Brass Banker";
  }
  if (player.lifetimeStolen >= 1000) {
    return "Brass Knuckles";
  }
  return "New Blood";
}

function crewRoleFields(members: CrewHeistMemberRecord[]): APIEmbedField[] {
  return CREW_ROLES.map((role) => {
    const member = members.find((candidate) => candidate.role === role.id);
    return {
      name: role.label,
      value: member ? `<@${member.userId}>` : role.description,
      inline: true
    };
  });
}

function mentionOrNone(userId: string | undefined): string {
  return userId ? `<@${userId}>` : "None";
}

function rivalryText(rivalry: { attacks: number; successes: number } | undefined): string {
  if (!rivalry || rivalry.attacks < 3) {
    return "";
  }
  if (rivalry.successes >= 2) {
    return "\nA familiar account keeps getting cracked.";
  }
  return "\nA familiar grudge returns to the ledger.";
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

function formatShares(sharesMicro: number): string {
  return (sharesMicro / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
  });
}
