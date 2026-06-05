import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commandData } from "./commands/definitions.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const rest = new REST({ version: "10" }).setToken(env.token);
const route = env.guildId
  ? Routes.applicationGuildCommands(env.clientId, env.guildId)
  : Routes.applicationCommands(env.clientId);

await rest.put(route, { body: commandData });

console.log(
  `Registered ${commandData.length} slash commands ${env.guildId ? `for guild ${env.guildId}` : "globally"}.`
);
