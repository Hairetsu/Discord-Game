import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbedField
} from "discord.js";
import type { LeaderboardEntry, PlayerRecord } from "../db/repository.js";
import {
  DROP_LIFETIME_MS,
  NOIR,
  SECURITY_ITEMS,
  SECURITY_SLOTS,
  type SecurityItem,
  type SecuritySlot
} from "../game/constants.js";
import { formatDollars, remainingSeconds } from "../game/time.js";
import type { AttackResult } from "../services/robbery.js";

export function dropButton(dropId: string, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`drop:${dropId}`)
      .setLabel(disabled ? "Bag Taken" : "Grab the Bag")
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(disabled)
  );
}

export function balanceEmbed(player: PlayerRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(NOIR.brass)
    .setTitle("Private Ledger")
    .addFields(
      { name: "Wallet", value: formatDollars(player.wallet), inline: true },
      { name: "Bank", value: formatDollars(player.bank), inline: true },
      { name: "Net Worth", value: formatDollars(player.wallet + player.bank), inline: true },
      { name: "Lifetime Earned", value: formatDollars(player.lifetimeEarned), inline: true },
      { name: "Lifetime Stolen", value: formatDollars(player.lifetimeStolen), inline: true },
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
        return `**${index + 1}.** <@${entry.userId}> - ${formatDollars(entry.netWorth)} (${formatDollars(
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

export function dropEmbed(amount: number): EmbedBuilder {
  const lifetimeSeconds = Math.floor(DROP_LIFETIME_MS / 1000);
  return new EmbedBuilder()
    .setColor(NOIR.green)
    .setTitle("Unmarked Bag On The Floor")
    .setDescription(
      `First hand on the clasp pockets **${formatDollars(amount)}**. The bag vanishes in ${lifetimeSeconds} seconds.`
    );
}

export function claimedDropEmbed(amount: number, userId: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(NOIR.brass)
    .setTitle("Bag Secured")
    .setDescription(`<@${userId}> grabbed **${formatDollars(amount)}** before the room blinked.`);
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
    return new EmbedBuilder()
      .setColor(NOIR.green)
      .setTitle(result.kind === "rob" ? "Wallet Lifted" : "Vault Breached")
      .setDescription(
        `<@${result.robber.userId}> took **${formatDollars(result.stolen)}** from <@${result.target.userId}>.${extra}`
      )
      .addFields({ name: "Odds", value: `${Math.round(result.chance * 100)}%`, inline: true });
  }

  const counter = result.counterSteal > 0 ? ` The guard countered for ${formatDollars(result.counterSteal)}.` : "";
  return new EmbedBuilder()
    .setColor(NOIR.red)
    .setTitle(result.kind === "rob" ? "Robbery Botched" : "Heist Burned")
    .setDescription(
      `<@${result.robber.userId}> got caught and paid **${formatDollars(result.fine)}** in fines.${counter}`
    )
    .addFields({ name: "Odds", value: `${Math.round(result.chance * 100)}%`, inline: true });
}

function attackRefusalText(result: Extract<AttackResult, { ok: false }>): string {
  switch (result.reason) {
    case "self_target":
      return "You cannot run a job on yourself.";
    case "target_not_enrolled":
      return "That player has not entered the current season.";
    case "target_shielded":
      return `That player is under new-account protection for ${remainingSeconds(result.availableAt ?? 0, Date.now())} more seconds.`;
    case "cooldown":
      return `Your crew is cooling off for ${remainingSeconds(result.availableAt ?? 0, Date.now())} more seconds.`;
    case "lockout":
      return `Your heist kit is locked down for ${remainingSeconds(result.availableAt ?? 0, Date.now())} more seconds.`;
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
