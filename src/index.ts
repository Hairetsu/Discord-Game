import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { openDatabase } from "./db/database.js";
import { HeistRepository } from "./db/repository.js";
import { DropDispatcher } from "./discord/drop-dispatcher.js";
import { registerDiscordHandlers } from "./discord/handlers.js";
import { loadEnv } from "./env.js";
import { MathRandomSource } from "./game/random.js";
import { ActivityService } from "./services/activity.js";
import { DropService } from "./services/drops.js";
import { EconomyService } from "./services/economy.js";
import { MarketService } from "./services/market.js";
import { AlphaVantageMarketDataProvider } from "./services/market-data.js";
import { RobberyService } from "./services/robbery.js";
import { SecurityService } from "./services/security.js";

const env = loadEnv();
const db = openDatabase(env.databasePath);
const repo = new HeistRepository(db);
const random = new MathRandomSource();
const marketProvider = new AlphaVantageMarketDataProvider(env.alphaVantageApiKey);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const drops = new DropService(repo, random);
const services = {
  repo,
  activity: new ActivityService(repo, random),
  economy: new EconomyService(repo),
  market: new MarketService(repo, marketProvider),
  security: new SecurityService(repo),
  robbery: new RobberyService(repo, random),
  dropDispatcher: new DropDispatcher(client, repo, drops)
};

registerDiscordHandlers(client, services);

client.once("ready", (readyClient) => {
  console.log(`Discord bot logged in as ${readyClient.user.tag}.`);
});

await client.login(env.token);
