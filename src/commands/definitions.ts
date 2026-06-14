import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { CONTRABAND_PRODUCTS, SECURITY_ITEMS } from "../game/constants.js";

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
        .setDescription("Security item. Each choice shows the cost and what it does.")
        .setRequired(true)
        .addChoices(
          ...SECURITY_ITEMS.map((item) => ({
            name: `${item.name} ($${item.cost}): ${item.buyMenuEffect}`,
            value: item.id
          }))
        )
    ),

  new SlashCommandBuilder().setName("loadout").setDescription("Inspect your active security loadout."),

  new SlashCommandBuilder()
    .setName("drug")
    .setDescription("Buy, sell, and inspect contraband street supply.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("prices")
        .setDescription("Show current contraband prices and what each stash does.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("stash")
        .setDescription("Privately inspect your contraband inventory.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("buy")
        .setDescription("Buy product from a supplier using wallet cash.")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Product type. Each choice explains the risk.")
            .setRequired(true)
            .addChoices(
              ...CONTRABAND_PRODUCTS.map((product) => ({
                name: `${product.name}: ${product.buyMenuEffect}`,
                value: product.id
              }))
            )
        )
        .addIntegerOption((option) =>
          option.setName("amount").setDescription("Units to buy.").setMinValue(1).setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sell")
        .setDescription("Sell product for wallet cash with heat and bust risk.")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Product type.")
            .setRequired(true)
            .addChoices(
              ...CONTRABAND_PRODUCTS.map((product) => ({
                name: `${product.name}: ${product.buyMenuEffect}`,
                value: product.id
              }))
            )
        )
        .addIntegerOption((option) =>
          option.setName("amount").setDescription("Units to sell.").setMinValue(1).setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("camera")
    .setDescription("Manage powered surveillance and private footage.")
    .addSubcommand((subcommand) => subcommand.setName("status").setDescription("Show camera tier, power, and costs."))
    .addSubcommand((subcommand) =>
      subcommand.setName("footage").setDescription("Privately list powered recordings from the last 24 hours.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("power")
        .setDescription("Switch camera power source.")
        .addStringOption((option) =>
          option
            .setName("source")
            .setDescription("Power source.")
            .setRequired(true)
            .addChoices({ name: "Battery: prepaid packs, drains per recording.", value: "battery" }, { name: "Grid: daily bill, online while paid.", value: "grid" })
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("recharge")
        .setDescription("Buy battery packs for camera power.")
        .addIntegerOption((option) =>
          option.setName("packs").setDescription("Battery packs to buy.").setMinValue(1).setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("bill")
        .setDescription("Pay grid power bills for camera coverage.")
        .addIntegerOption((option) =>
          option.setName("days").setDescription("Days of grid power to buy. Defaults to 1.").setMinValue(1)
        )
    ),

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
    .addSubcommand((subcommand) =>
      subcommand
        .setName("features")
        .setDescription("Enable or disable drug selling and cameras.")
        .addStringOption((option) =>
          option
            .setName("feature")
            .setDescription("Feature to change.")
            .setRequired(true)
            .addChoices({ name: "Drug selling", value: "drugs" }, { name: "Cameras", value: "cameras" })
        )
        .addBooleanOption((option) =>
          option.setName("enabled").setDescription("Whether this feature is enabled.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("tuning")
        .setDescription("Tune drug and camera economy values.")
        .addStringOption((option) =>
          option
            .setName("setting")
            .setDescription("Setting to tune.")
            .setRequired(true)
            .addChoices(
              { name: "Drug price volatility", value: "drug_volatility" },
              { name: "Public bust threshold", value: "public_bust_threshold" },
              { name: "Camera footage window hours", value: "camera_window_hours" },
              { name: "Battery pack cost", value: "battery_cost" },
              { name: "Grid robbery daily cost", value: "grid_robbery_cost" },
              { name: "Grid full daily cost", value: "grid_full_cost" }
            )
        )
        .addNumberOption((option) =>
          option.setName("value").setDescription("New numeric value.").setMinValue(0).setRequired(true)
        )
    )
];

export const commandData = commandBuilders.map((command) => command.toJSON());
