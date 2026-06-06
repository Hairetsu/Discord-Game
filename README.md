# Discord Heist Bank Bot

A seasonal Discord economy game where players grab random money drops, bank cash for daily interest, buy security loadouts, and rob or heist each other with capped risk.

Players also earn a little scratch for keeping the room alive:

- Normal chat can pay `$1-$4` to wallet cash once every 2 minutes per player.
- Emoji/emote activity can pay `$2-$6` once every 5 minutes per player.
- Reactions count as emote activity. Emoji inside message text also counts when Discord provides message content to the bot.

The engagement layer keeps the game active without increasing bot spam:

- `/case` gives each player one private daily job with small rewards and heat changes.
- Money drops now have variants like locked cases, marked bills, decoys, and jackpot briefcases.
- Robberies and heists build heat, which can lower odds and increase fines at higher bands.
- Repeated attacker/target pairs become rivalries with public callouts once the history matters.
- Player-funded `/bounty` posts create opt-in public conflict.
- `/crewheist` creates one public recruiting message for a role-based group heist.
- Seasons can carry modifiers, awards, and history.
- The Vault Gazette posts a periodic digest instead of lots of individual announcements.

## Setup

```bash
npm install
cp .env.example .env
npm run register
npm run start
```

Use `DISCORD_GUILD_ID` while testing to register slash commands instantly in one server. Without it, commands are registered globally and can take time to appear.

Market commands use Alpha Vantage real-market quote and symbol-search endpoints. Set `ALPHA_VANTAGE_API_KEY` in `.env` before using `/market`.

## Deploy to Fly.io

Install and log in to Fly:

```bash
brew install flyctl
fly auth login
```

Create a Fly app and a 1GB persistent volume for SQLite:

```bash
export APP_NAME=your-unique-bot-name
export REGION=iad

cp fly.toml.example fly.toml
perl -0pi -e "s/your-fly-app-name/$ENV{APP_NAME}/; s/primary_region = \"iad\"/primary_region = \"$ENV{REGION}\"/" fly.toml

fly apps create "$APP_NAME"
fly volumes create data --app "$APP_NAME" --region "$REGION" --size 1
```

Set secrets before deploying so the bot can start successfully:

```bash
fly secrets set --app "$APP_NAME" DISCORD_TOKEN="your-discord-token"
fly secrets set --app "$APP_NAME" DISCORD_CLIENT_ID="your-discord-client-id"
fly secrets set --app "$APP_NAME" DISCORD_GUILD_ID="your-test-guild-id"
fly secrets set --app "$APP_NAME" ALPHA_VANTAGE_API_KEY="your-alpha-vantage-key"
```

`DISCORD_GUILD_ID` is optional, but useful while testing. `ALPHA_VANTAGE_API_KEY` is only needed for `/market` commands.

Deploy and register slash commands:

```bash
fly deploy --app "$APP_NAME" --remote-only
fly ssh console --app "$APP_NAME" -C "npm run register:prod"
fly logs --app "$APP_NAME"
```

This bot is a background worker, not an HTTP service. If Fly's dashboard asks for a start command, use `npm run start:prod`. Do not configure an HTTP service or health check on port `8080`.

## Deploy to Railway

Railway will use the root `Dockerfile` automatically. Create a new Railway project from this GitHub repo, then add a volume mounted at `/data`.

Set these service variables:

```bash
DISCORD_TOKEN=your-discord-token
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_GUILD_ID=your-test-guild-id
ALPHA_VANTAGE_API_KEY=your-alpha-vantage-key
DATABASE_PATH=/data/heist-bank.sqlite
```

`DISCORD_GUILD_ID` is optional after testing. `ALPHA_VANTAGE_API_KEY` is only needed for `/market` commands. Do not generate a public domain or configure a healthcheck; this is a long-running Discord bot, not an HTTP service.

## GitHub CI and Fly Deploys

The `.github/workflows/ci-cd.yml` workflow runs typecheck, tests, and a production build for pull requests and pushes to `master`.

If you linked this repo in the Fly web UI, keep runtime secrets in Fly and let Fly deploy from the connected repository:

```bash
fly secrets set --app "$APP_NAME" DISCORD_TOKEN="your-discord-token"
fly secrets set --app "$APP_NAME" DISCORD_CLIENT_ID="your-discord-client-id"
fly secrets set --app "$APP_NAME" DISCORD_GUILD_ID="your-test-guild-id"
fly secrets set --app "$APP_NAME" ALPHA_VANTAGE_API_KEY="your-alpha-vantage-key"
```

## Admin Flow

1. Invite the bot with slash-command permissions.
2. Run `/admin setup` to initialize the guild.
3. Run `/admin channels add:#channel` for every channel where drops may appear.
4. Use `/admin drop` to send a manual test drop.

## Core Commands

- `/balance`
- `/deposit amount`
- `/withdraw amount`
- `/leaderboard`
- `/case`
- `/shop`
- `/buy item`
- `/loadout`
- `/rob target`
- `/heist target`
- `/crewheist target`
- `/bounty place target amount`
- `/bounty list`
- `/season status`
- `/season history`
- `/season awards id`
- `/market quote symbol`
- `/market search keywords`
- `/market buy symbol amount`
- `/market sell symbol shares all`
- `/market portfolio`
- `/market leaderboard`
- `/admin setup`
- `/admin channels action channel`
- `/admin drop`
- `/admin season action`
