import { describe, it, expect } from "vitest";
import {
  accuracyFromAcpl,
  centipawnLoss,
  clampEval,
  classifyByCpl,
  classifyMove,
  performanceElo,
} from "./metrics";

describe("clamping & CPL", () => {
  it("clamps evals to ±1000", () => {
    expect(clampEval(2500)).toBe(1000);
    expect(clampEval(-9999)).toBe(-1000);
    expect(clampEval(120)).toBe(120);
  });
  it("CPL uses clamped values", () => {
    expect(centipawnLoss(5000, 900)).toBe(100);
    expect(centipawnLoss(100, -2000)).toBe(1100);
  });
  it("CPL never negative", () => {
    expect(centipawnLoss(50, 80)).toBe(0);
  });
});

describe("accuracy", () => {
  it("ACPL 0 → 100", () => expect(accuracyFromAcpl(0)).toBe(100));
  it("ACPL 50 → 81.9", () => expect(accuracyFromAcpl(50)).toBe(81.9));
  it("ACPL 100 → 67", () => expect(accuracyFromAcpl(100)).toBe(67));
});

describe("performance elo", () => {
  it("raw without rating, clamped to 3000", () => {
    expect(performanceElo(0, 30)).toBe(3000);
    expect(performanceElo(50, 30)).toBe(Math.round(3100 * Math.exp(-0.5)));
  });
  it("blends with rating and stays within ±400", () => {
    // raw ≈ 3100 at acpl 0, weight 0.6 at 40 moves → would be 1500+960; capped at 1900
    expect(performanceElo(0, 40, 1500)).toBe(1900);
  });
  it("weight floor 0.25 for short games", () => {
    const raw = 3100 * Math.exp(-0.01 * 100);
    expect(performanceElo(100, 4, 1000)).toBe(Math.round(1000 + (raw - 1000) * 0.25));
  });
  it("global floor 400", () => {
    expect(performanceElo(1000, 40, 450)).toBe(400);
  });
});

describe("classification thresholds", () => {
  it.each([
    [0, "best"],
    [15, "excellent"],
    [16, "good"],
    [35, "good"],
    [36, "inaccuracy"],
    [80, "inaccuracy"],
    [81, "mistake"],
    [200, "mistake"],
    [201, "blunder"],
  ])("cpl %i → %s", (cpl, expected) => {
    expect(classifyByCpl(cpl as number)).toBe(expected);
  });
  it("book wins over everything", () => {
    expect(
      classifyMove({ cpl: 300, isBook: true, isEngineBest: false, isSacrifice: false, moverEvalAfter: 0 }),
    ).toBe("book");
  });
  it("sound sacrifice is brilliant", () => {
    expect(
      classifyMove({ cpl: 0, isBook: false, isEngineBest: true, isSacrifice: true, moverEvalAfter: 120 }),
    ).toBe("brilliant");
  });
  it("only-move is great", () => {
    expect(
      classifyMove({ cpl: 0, isBook: false, isEngineBest: true, isSacrifice: false, moverEvalAfter: 0, onlyMoveGap: 300 }),
    ).toBe("great");
  });
});
