# Discord Heist Bank Bot

A seasonal Discord economy game where players grab random money drops, bank cash for daily interest, buy security loadouts, and rob or heist each other with capped risk.

Players also earn a little scratch for keeping the room alive:

- Normal chat can pay `$1-$4` to wallet cash once every 2 minutes per player.
- Emoji/emote activity can pay `$2-$6` once every 5 minutes per player.
- Reactions count as emote activity. Emoji inside message text also counts when Discord provides message content to the bot.

## Setup

```bash
npm install
cp .env.example .env
npm run register
npm run start
```

Use `DISCORD_GUILD_ID` while testing to register slash commands instantly in one server. Without it, commands are registered globally and can take time to appear.

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
- `/shop`
- `/buy item`
- `/loadout`
- `/rob target`
- `/heist target`
- `/admin setup`
- `/admin channels action channel`
- `/admin drop`
- `/admin season action`
