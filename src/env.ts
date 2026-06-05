export interface AppEnv {
  token: string;
  clientId: string;
  guildId?: string;
  databasePath: string;
  alphaVantageApiKey?: string;
}

export function loadEnv(): AppEnv {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token) {
    throw new Error("DISCORD_TOKEN is required.");
  }
  if (!clientId) {
    throw new Error("DISCORD_CLIENT_ID is required.");
  }

  return {
    token,
    clientId,
    guildId: process.env.DISCORD_GUILD_ID || undefined,
    databasePath: process.env.DATABASE_PATH || "./data/heist-bank.sqlite",
    alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || undefined
  };
}
