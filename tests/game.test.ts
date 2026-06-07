import { describe, expect, it, vi } from "vitest";
import { HEIST_COOLDOWN_MS, HEIST_LOCKOUT_MS, ROB_COOLDOWN_MS, SECURITY_BY_ID } from "../src/game/constants.js";
import {
  adjustHeat,
  decayHeat,
  heatBand,
  nextSeasonModifier,
  randomDropVariant,
  seasonModifier,
  securityModifiers
} from "../src/game/engagement.js";
import { MathRandomSource, SequenceRandomSource } from "../src/game/random.js";
import { clamp, formatCents, formatDollars, formatDuration, localDateKey, nowMs, remainingSeconds } from "../src/game/time.js";

describe("game utilities", () => {
  it("formats money, dates, clamps, and remaining time", () => {
    expect(formatDollars(1234.9)).toBe("$1,234");
    expect(formatDollars(-12)).toBe("$0");
    expect(formatCents(12345)).toBe("$123.45");
    expect(formatCents(-12345)).toBe("-$123.45");
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(localDateKey(Date.UTC(2026, 0, 1, 5), "America/New_York")).toBe("2026-01-01");
    expect(remainingSeconds(2500, 1000)).toBe(2);
    expect(remainingSeconds(1000, 2500)).toBe(0);
    expect(formatDuration(1000 + 30 * 1000, 1000)).toBe("30 seconds");
    expect(formatDuration(1000 + 15 * 60 * 1000, 1000)).toBe("15 minutes");
    expect(formatDuration(1000 + 60 * 60 * 1000, 1000)).toBe("1 hour");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(nowMs()).toBe(Date.UTC(2026, 0, 1));
    vi.useRealTimers();
  });

  it("supports deterministic and math random sources", () => {
    const sequence = new SequenceRandomSource([0, 0.5]);
    expect(sequence.next()).toBe(0);
    expect(sequence.int(10, 20)).toBe(15);
    expect(sequence.chance(0.75)).toBe(true);
    expect(new SequenceRandomSource([]).next()).toBe(0);

    const math = new MathRandomSource();
    vi.spyOn(Math, "random").mockReturnValueOnce(0.25).mockReturnValueOnce(0.99).mockReturnValueOnce(0.1);
    expect(math.next()).toBe(0.25);
    expect(math.int(1, 10)).toBe(10);
    expect(math.chance(0.2)).toBe(true);
    vi.restoreAllMocks();
  });

  it("computes heat, seasons, drops, and security modifiers", () => {
    expect(ROB_COOLDOWN_MS).toBe(15 * 60 * 1000);
    expect(HEIST_COOLDOWN_MS).toBe(60 * 60 * 1000);
    expect(HEIST_LOCKOUT_MS).toBe(30 * 60 * 1000);
    expect(heatBand(0).id).toBe("clean");
    expect(heatBand(60).id).toBe("wanted");
    expect(adjustHeat(95, 20)).toBe(100);
    expect(adjustHeat(5, -20)).toBe(0);
    expect(decayHeat(50, 1000, 1000)).toBe(50);
    expect(decayHeat(0, 1000, 10_000_000)).toBe(0);
    expect(decayHeat(50, 1000, 1000 + 30 * 60 * 1000)).toBe(38);
    expect(decayHeat(50, 1000, 1000 + 2 * 60 * 60 * 1000)).toBe(2);

    expect(randomDropVariant(new SequenceRandomSource([0])).kind).toBe("cash_bag");
    expect(randomDropVariant(new SequenceRandomSource([0.999999])).kind).toBe("jackpot_briefcase");
    expect(seasonModifier("blackout").name).toBe("Blackout Season");
    expect(seasonModifier("missing").id).toBe("standard");
    expect(nextSeasonModifier(2).id).toBe("blackout");
    expect(nextSeasonModifier(999).id).toBeTruthy();

    const modifiers = securityModifiers([
      SECURITY_BY_ID.get("vault_i")!,
      SECURITY_BY_ID.get("alarm_i")!,
      SECURITY_BY_ID.get("guard_i")!,
      SECURITY_BY_ID.get("insurance_i")!
    ]);
    expect(modifiers).toMatchObject({
      vaultPenalty: 0.05,
      alarmFineBonus: 0.1,
      guardCounterPercent: 0.05,
      guardCounterMax: 150,
      insuranceRestorePercent: 0.1,
      insuranceRestoreMax: 250
    });
  });
});
