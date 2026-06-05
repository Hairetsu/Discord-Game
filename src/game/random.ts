export interface RandomSource {
  next(): number;
  int(min: number, max: number): number;
  chance(probability: number): boolean;
}

export class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

export class SequenceRandomSource implements RandomSource {
  private index = 0;

  constructor(private readonly values: number[]) {}

  next(): number {
    if (this.values.length === 0) {
      return 0;
    }
    const value = this.values[this.index % this.values.length] ?? 0;
    this.index += 1;
    return value;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}
