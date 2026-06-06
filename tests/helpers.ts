import { openDatabase } from "../src/db/database.js";
import { HeistRepository } from "../src/db/repository.js";
import type { RandomSource } from "../src/game/random.js";
import { SequenceRandomSource } from "../src/game/random.js";
import { ActivityService } from "../src/services/activity.js";
import { BountyService } from "../src/services/bounties.js";
import { CaseService } from "../src/services/cases.js";
import { CrewHeistService } from "../src/services/crew-heists.js";
import { DropService } from "../src/services/drops.js";
import { EconomyService } from "../src/services/economy.js";
import { GazetteService } from "../src/services/gazette.js";
import { RobberyService } from "../src/services/robbery.js";
import { SecurityService } from "../src/services/security.js";

export function createTestServices(random: RandomSource = new SequenceRandomSource([0.5])) {
  const repo = new HeistRepository(openDatabase(":memory:"));
  return {
    repo,
    activity: new ActivityService(repo, random),
    bounties: new BountyService(repo),
    cases: new CaseService(repo, random),
    crewHeists: new CrewHeistService(repo, random),
    economy: new EconomyService(repo),
    gazette: new GazetteService(repo),
    security: new SecurityService(repo),
    drops: new DropService(repo, random),
    robbery: new RobberyService(repo, random)
  };
}

export class LcgRandomSource implements RandomSource {
  private state: number;

  constructor(seed = 123456789) {
    this.state = seed;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 2 ** 32;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}
