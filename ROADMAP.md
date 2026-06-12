# Roadmap: Street Supply and Surveillance

## North Star

Make the bot feel like a living Discord crime economy without increasing noise. Public posts should be rare, dramatic, and player-driven. Everything else should be ephemeral, summarized, or folded into existing embeds.

Guiding rule: ephemeral by default, public only when another player can react to it.

## Not Done Yet

The first engagement pass is already implemented. This roadmap only tracks the next unfinished expansion:

- Drug selling and contraband inventory.
- Powered cameras and private footage.
- Surveillance shop items.
- Admin tuning for drugs, cameras, and public bust thresholds.

Keep the same product rule as the engagement pass: private by default, public only when another player can react.

## Phase 1: Drug Selling

Add a contraband side hustle for players who want higher cash generation with higher risk.

### Core Commands

- `/drug buy type amount`: buy product from a supplier using wallet cash.
- `/drug sell type amount`: sell product for variable profit.
- `/drug stash`: privately inspect inventory, street value, and risk.
- `/drug prices`: show current street prices and demand bands.

### Buy Options

Every buy option should have a memorable name, a visible price range, and a short "what it does" description in `/drug prices` and `/drug buy`.

- `Corner Candy`: cheap starter stash. Low profit, low heat, and the safest sell option for new players.
- `Blue Static`: mid-tier party supply. Better profit than Corner Candy, but each sale adds more heat.
- `Neon Ghost Vials`: expensive, volatile stash. Can spike hard during high demand, but busts confiscate more inventory.
- `Velvet Brick`: bulk dealer package. Best profit per command, but large sales raise raid chance and can trigger public busts.
- `Midnight Samples`: rare rotating special. Small inventory cap, high resale multiplier, and extra heat on every sale.

### Selling Rules

- Buying product removes wallet cash and creates inventory.
- Selling product pays wallet cash and adds heat.
- Each product should explain its profit profile, heat gain, and bust risk before purchase.
- Prices rotate on a timer so players have a reason to check in.
- Larger sales have better profit but higher raid chance.
- Failed sales can confiscate part of the stash, fine wallet cash, or add heat.
- Selling should be private unless a dramatic bust, bounty tie-in, or server-configured broadcast threshold is met.

### Balance Targets

- Drug selling should beat chat rewards and normal drops when managed well.
- It should be less safe than banking, markets, or quiet case files.
- Heat from drug sales should make robberies, heists, and fines more dangerous.
- Inventory should reset at season close unless the season modifier says otherwise.

### Data Model

- `contraband_inventory`: guild, user, season, product id, quantity, average cost, updated time.
- `contraband_market`: guild, season, product id, demand band, buy price, sell price, expires time.
- New transaction types: `drug_buy`, `drug_sale`, `drug_bust`, `drug_confiscated`.

### Implementation Notes

- Reuse the existing transaction ledger for all cash movement.
- Reuse heat bands so drug risk affects the rest of the game instead of becoming an isolated minigame.
- Add focused tests for price rotation, wallet validation, stash changes, bust penalties, and season reset behavior.

## Phase 2: Powered Cameras

Add camera equipment as a new defensive utility. Cameras do not stop robberies by themselves; they reveal who hit you if the system had power at the time.

### Core Commands

- `/camera status`: show installed cameras, power source, battery life, grid billing, and footage window.
- `/camera footage`: privately list who robbed or heisted you in the last 24 hours.
- `/camera power source`: switch between `battery` and `grid`.
- `/camera recharge amount`: buy battery charge using wallet cash.
- `/camera bill`: pay or inspect current grid power charges.

### Camera Rules

- Cameras must be purchased from `/shop` or a future `/camera buy` command.
- Cameras only record successful incoming robberies and heists while powered.
- `/camera footage` shows the last 24 hours of powered recordings.
- Footage includes attacker, attack type, stolen amount, time, and whether insurance restored anything.
- Footage is ephemeral so revenge intel does not become automatic public drama.
- If cameras are unpowered, the robbery still happens but no footage is recorded.

### Power Sources

- `Battery`: prepaid, predictable, drains per recorded event or per hour online.
- `Power Grid`: always-on if bills are paid, but charges a daily upkeep fee.
- Grid bills should be paid from wallet first, then optionally bank if the user enables autopay later.
- If grid billing fails, cameras shut off until the player pays or switches to battery.

### Buy Options

- `Keyhole Polaroid`: $650 install. Records the last 24 hours of successful wallet robberies while powered.
- `Lobby Mirror Lens`: $1,200 install. Records wallet robberies and failed robbery attempts while powered.
- `Vault Hall Camera`: $1,800 install. Records successful wallet robberies and bank heists while powered.
- `Dead Drop Battery`: $150 recharge. Powers cameras for 24 hours of standby time or 5 recordings, whichever runs out first.
- `Borrowed Grid Line`: $75 daily bill for robbery footage only. Stays online while bills are paid.
- `Private Substation Tap`: $125 daily bill for robbery and heist footage. Stays online while bills are paid.

### Data Model

- `camera_systems`: guild, user, season, tier, power source, battery units, grid paid until, enabled, updated time.
- `camera_recordings`: guild, user, season, attacker id, attack type, stolen amount, insurance restore, recorded at, expires at.
- New transaction types: `camera_purchase`, `camera_battery`, `camera_grid_bill`.

### Robbery Integration

- On successful `rob` or `heist`, after transaction records are written, check the target's active camera system.
- If powered and eligible, write one `camera_recordings` row with a 24-hour expiration.
- If on battery, decrement battery charge.
- If on grid, verify `grid_paid_until > now`.
- Keep existing `robbed_wallet` and `bank_breached` transactions as the source of truth for money movement; camera recordings are the reveal layer.

## Phase 3: Security Shop Expansion

Fold cameras into the existing loadout fantasy without crowding the current slots.

### New Slot

- Add `surveillance` as a security slot separate from `vault`, `alarm`, `guard`, and `insurance`.

### Shop Items

- `Keyhole Polaroid`: starter surveillance that records successful wallet robberies when battery-powered.
- `Lobby Mirror Lens`: mid-tier surveillance that records successful robberies and failed robbery attempts.
- `Vault Hall Camera`: premium surveillance that records successful wallet robberies and bank heists.
- `Dead Drop Battery`: consumable camera power for players who want fixed costs.
- `Borrowed Grid Line`: daily robbery-only camera power for players who want always-on coverage.
- `Private Substation Tap`: daily robbery and heist camera power for high-value targets.
- `Signal Scrambler`: optional attacker item later, gives a small chance to avoid camera recording.

### Purchase UX

- `/shop` should group buy options by slot and show price, effect, upkeep, and buy code.
- `/buy item` choices should include a compact effect in the option label when Discord limits prevent separate descriptions.
- Purchase confirmations should repeat what the item does so players understand the impact immediately.

### Design Goals

- Cameras should create revenge decisions, not passive punishment.
- Defenders pay ongoing upkeep for better information.
- Attackers can still play aggressively, but repeat attacks become easier to identify.
- Camera footage should tie naturally into bounties and rivalries.

## Phase 4: Admin Tuning

Give server owners control over how sharp these systems are.

### Admin Settings

- Enable or disable drug selling.
- Set drug price volatility.
- Set public bust threshold.
- Enable or disable cameras.
- Set camera footage window, defaulting to 24 hours.
- Set battery and grid costs.

### Testing and Rollout

- Ship drug selling first behind admin enablement.
- Ship camera purchase and battery power next.
- Add grid power and daily billing after battery behavior is stable.
- Add admin tuning last, once default balance values have real server feedback.
