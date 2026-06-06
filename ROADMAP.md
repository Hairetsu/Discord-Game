# Engagement Roadmap

## North Star

Make the bot feel like a living Discord crime economy without increasing noise. Public posts should be rare, dramatic, and player-driven. Everything else should be ephemeral, summarized, or folded into existing embeds.

Guiding rule: ephemeral by default, public only when another player can react to it.

## Implementation Status

The first full engagement pass is implemented:

- Private case files on a short cooldown
- Player titles and heat display
- Drop variants, including locked two-player cases
- Heat bands that affect attack odds and fines
- Rivalry tracking and callouts
- Player-funded bounties
- Role-based crew heists
- Season modifiers, awards, and history
- Scheduled Vault Gazette digest

Future tuning should focus on live balance values, copy variety, and server-specific cadence.

## Phase 1: Engagement Spine

Ship these first because they add daily reasons to play without spamming the server.

### Daily Case Files

Add `/case`, a private choice between small jobs on a short cooldown.

Example case options:

- `Stakeout`: low payout, reduces heat.
- `Quick Launder`: converts wallet cash into slightly safer bank cash.
- `Market Tip`: small chance at a stock-related bonus.
- `Quiet Pickup`: simple modest cash reward.
- `Inside Whisper`: improves the next robbery or heist odds slightly.

Design goals:

- Reply ephemerally.
- Give players meaningful but quick choices.
- Avoid creating extra public messages.
- Let case outcomes reinforce the noir/heist fantasy.

### Player Titles

Add cosmetic titles based on behavior and season stats.

Example titles:

- `The Locksmith`: successful heists.
- `Cold Ledger`: high bank balance.
- `Dividend Shark`: strong market gains.
- `Brass Knuckles`: repeated successful robberies.
- `The Ghost`: strong success rate with few failures.
- `Vault Rat`: frequent drop claims.

Display titles in:

- `/balance`
- `/leaderboard`
- Robbery and heist embeds
- Season recap embeds

### Flavor Rotation

Rotate copy for repeated events so the bot feels less mechanical.

Targets:

- Drop spawn text
- Drop claimed text
- Robbery success
- Robbery failure
- Heist success
- Heist failure
- Market buys and sells
- Security purchases

Keep messages short. Flavor should add character without slowing down readability.

## Phase 2: Smarter Drops

Keep drop frequency the same, but add drop variants so each one feels less predictable.

### Drop Types

- `Cash Bag`: current standard first-click payout.
- `Locked Case`: requires two different players to click before it opens.
- `Marked Bills`: bigger payout, but adds heat to the claimant.
- `Decoy Bag`: small payout, or a tiny fine with strong flavor.
- `Jackpot Briefcase`: rare high-value public moment.

Design goals:

- Same message volume as the current drop system.
- Clear button labels.
- Short expiration window.
- Public only because the drop itself is already a public event.

## Phase 3: Heat System

Use heat as the main balancing layer for aggression.

### Core Rules

- Robberies increase heat slightly.
- Heists increase heat heavily.
- Failed jobs may increase heat more than clean jobs.
- Heat cools down over time.
- Higher heat raises fines, lowers success chance, or both.
- Some `/case` options reduce heat.

### Suggested Heat Bands

- `Clean`: no modifier.
- `Watched`: small fine increase.
- `Wanted`: lower attack odds and higher fines.
- `Burned`: heavy fines and reduced heist odds.

Design goals:

- Discourage repetitive attacks without hard-blocking play.
- Make risky players visibly interesting.
- Keep most heat details private unless relevant to a public action.

## Phase 4: Social Drama

Add player-driven public moments that create stories without automated chatter.

### Rivalries

Track repeated attacker and target pairs during a season.

Use rivalry data to add flavor:

- "A familiar grudge returns."
- "This account has been cracked before."
- "The payback job finally hits the ledger."

Optional mechanics:

- Small revenge odds bump after being robbed or heisted.
- Small bonus when striking back within a time window.
- Rivalry callouts in attack embeds only after meaningful history exists.

### Bounties

Add `/bounty target amount`.

Rules:

- The bounty comes from the issuer's wallet.
- The bounty pays out when another player successfully robs or heists the target.
- Bounties expire after a set time.
- Bounty placement is public because the player intentionally creates the drama.

Design goals:

- Make conflict opt-in.
- Prevent griefing with caps and expirations.
- Avoid ping storms or repeated reminder posts.

## Phase 5: Crew Heists

Build this after heat, rivalries, and bounties are stable.

### Flow

1. A player runs `/crewheist target`.
2. The bot posts one public opt-in embed with buttons.
3. Players join roles such as `Driver`, `Lookout`, `Lockpick`, and `Inside Person`.
4. The heist resolves after enough players join or a short timer expires.
5. Rewards and fines split across the crew.

### Role Ideas

- `Driver`: reduces failure fine.
- `Lookout`: improves odds.
- `Lockpick`: increases max steal.
- `Inside Person`: reduces target security effect.

Design goals:

- Make crew heists rare and memorable.
- Use long cooldowns.
- Keep the flow to one public setup message and one public result message.

## Phase 6: Season Identity

Make each season feel different.

### Season Modifiers

Examples:

- `Blackout Season`: heists are slightly easier.
- `Banker's Moon`: interest cap is higher.
- `Street Heat`: failed attacks cost more.
- `Bull Run`: market leaderboard matters more.
- `Loose Floorboards`: drops are slightly more valuable.

### Season Awards

At season close, record awards such as:

- Richest player
- Best thief
- Biggest heist
- Worst luck
- Most fortified vault
- Market winner
- Most wanted

### History

Keep lightweight season history available through an admin or public command.

Potential command:

- `/season history`
- `/season awards`

## Phase 7: Vault Gazette

Add one scheduled digest post that summarizes recent activity.

### Digest Cadence

Use weekly by default. Daily can work for very active servers.

### Gazette Sections

- Richest operator
- Biggest heist
- Biggest failed job
- Top market move
- Most wanted player
- Biggest drop claim
- Current season modifier
- New rivalry to watch

Design goals:

- One message with high signal.
- No individual event spam.
- Make the game feel alive even when players miss events.

## Recommended Build Order

1. `/case`
2. Player titles
3. Flavor rotation
4. Drop variants
5. Heat system
6. Rivalries
7. Bounties
8. Vault Gazette
9. Crew heists
10. Season modifiers
11. Season awards and history

## First Milestone

The first implementation milestone should include:

- `/case`
- Player titles
- Flavor rotation
- Drop variants

This gives the largest engagement lift with the least complexity. It also keeps the anti-spam posture intact because most of the new interaction is private or reuses existing public moments.
