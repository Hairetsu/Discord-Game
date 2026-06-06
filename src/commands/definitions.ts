import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { SECURITY_ITEMS } from "../game/constants.js";

export const commandBuilders = [
  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Open your ledger and check wallet, bank, and season standing."),

  new SlashCommandBuilder()
    .setName("deposit")
    .setDescription("Move wallet cash into the bank.")
    .addIntegerOption((option) =>
      option.setName("amount").setDescription("Dollars to deposit.").setMinValue(1).setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("withdraw")
    .setDescription("Pull cash out of the bank.")
    .addIntegerOption((option) =>
      option.setName("amount").setDescription("Dollars to withdraw.").setMinValue(1).setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the season's richest operators."),

  new SlashCommandBuilder().setName("case").setDescription("Open today's private case file."),

  new SlashCommandBuilder().setName("shop").setDescription("Browse security items for your loadout."),

  new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Buy and auto-equip a security item.")
    .addStringOption((option) =>
      option
        .setName("item")
        .setDescription("Security item.")
        .setRequired(true)
        .addChoices(...SECURITY_ITEMS.map((item) => ({ name: `${item.name} - $${item.cost}`, value: item.id })))
    ),

  new SlashCommandBuilder().setName("loadout").setDescription("Inspect your active security loadout."),

  new SlashCommandBuilder()
    .setName("rob")
    .setDescription("Try to steal wallet cash from another player.")
    .addUserOption((option) => option.setName("target").setDescription("Player to rob.").setRequired(true)),

  new SlashCommandBuilder()
    .setName("heist")
    .setDescription("Try a capped breach against another player's bank.")
    .addUserOption((option) => option.setName("target").setDescription("Player to heist.").setRequired(true)),

  new SlashCommandBuilder()
    .setName("crewheist")
    .setDescription("Recruit a small crew for a rare public bank job.")
    .addUserOption((option) => option.setName("target").setDescription("Player to target.").setRequired(true)),

  new SlashCommandBuilder()
    .setName("bounty")
    .setDescription("Place or inspect player-funded bounties.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("place")
        .setDescription("Put wallet cash on a target.")
        .addUserOption((option) => option.setName("target").setDescription("Bounty target.").setRequired(true))
        .addIntegerOption((option) =>
          option.setName("amount").setDescription("Wallet dollars to post.").setMinValue(1).setRequired(true)
        )
    )
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("Show open bounties.")),

  new SlashCommandBuilder()
    .setName("season")
    .setDescription("Inspect season status, history, and awards.")
    .addSubcommand((subcommand) => subcommand.setName("status").setDescription("Show the current season."))
    .addSubcommand((subcommand) => subcommand.setName("history").setDescription("Show recent seasons."))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("awards")
        .setDescription("Show awards for a closed season.")
        .addIntegerOption((option) => option.setName("id").setDescription("Season number. Defaults to previous season."))
    ),

  new SlashCommandBuilder()
    .setName("market")
    .setDescription("Trade real-market stocks with heist cash.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("quote")
        .setDescription("Get a real-market quote.")
        .addStringOption((option) =>
          option.setName("symbol").setDescription("Ticker symbol, like AAPL, MSFT, SPY.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("search")
        .setDescription("Search real-market ticker symbols.")
        .addStringOption((option) =>
          option.setName("keywords").setDescription("Company, ETF, or ticker keywords.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("buy")
        .setDescription("Buy fractional shares with wallet cash.")
        .addStringOption((option) =>
          option.setName("symbol").setDescription("Ticker symbol, like AAPL, MSFT, SPY.").setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName("amount").setDescription("Wallet dollars to invest.").setMinValue(1).setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sell")
        .setDescription("Sell fractional shares back to wallet cash.")
        .addStringOption((option) =>
          option.setName("symbol").setDescription("Ticker symbol, like AAPL, MSFT, SPY.").setRequired(true)
        )
        .addNumberOption((option) =>
          option.setName("shares").setDescription("Shares to sell. Leave blank if using all:true.").setMinValue(0.000001)
        )
        .addBooleanOption((option) => option.setName("all").setDescription("Sell your full position."))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("portfolio")
        .setDescription("View your real-market stock portfolio.")
        .addUserOption((option) => option.setName("player").setDescription("Player portfolio to view. Defaults to you."))
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("leaderboard").setDescription("Rank players by stock portfolio value.")
    ),

  new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Manage the heist economy.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) => subcommand.setName("setup").setDescription("Initialize this server."))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("channels")
        .setDescription("Manage money-drop channels.")
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("Channel action.")
            .setRequired(true)
            .addChoices(
              { name: "add", value: "add" },
              { name: "remove", value: "remove" },
              { name: "list", value: "list" }
            )
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Drop channel.")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("drop")
        .setDescription("Send a manual money drop.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Drop channel. Defaults to the current or first configured channel.")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("season")
        .setDescription("View or rotate the current season.")
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("Season action.")
            .setRequired(true)
            .addChoices({ name: "status", value: "status" }, { name: "close", value: "close" })
        )
    )
];

export const commandData = commandBuilders.map((command) => command.toJSON());
