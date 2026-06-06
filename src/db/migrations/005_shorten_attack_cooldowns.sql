UPDATE players
SET rob_cooldown_until = MIN(rob_cooldown_until, CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 15 * 60 * 1000)
WHERE rob_cooldown_until > CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 15 * 60 * 1000;

UPDATE players
SET heist_cooldown_until = MIN(heist_cooldown_until, CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 60 * 60 * 1000)
WHERE heist_cooldown_until > CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 60 * 60 * 1000;

UPDATE players
SET heist_lockout_until = MIN(heist_lockout_until, CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 30 * 60 * 1000)
WHERE heist_lockout_until > CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 30 * 60 * 1000;
