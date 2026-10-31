export type Classification =
  | "book"
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export const CLASSIFICATION_ORDER: Classification[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "blunder",
];

export const CLASSIFICATION_META: Record<
  Classification,
  { label: string; symbol: string; token: string }
> = {
  brilliant: { label: "Brilliant", symbol: "!!", token: "q-brilliant" },
  great: { label: "Great", symbol: "!", token: "q-great" },
  best: { label: "Best", symbol: "★", token: "q-best" },
  excellent: { label: "Excellent", symbol: "👍", token: "q-excellent" },
  good: { label: "Good", symbol: "✓", token: "q-good" },
  book: { label: "Book", symbol: "📖", token: "q-book" },
  inaccuracy: { label: "Inaccuracy", symbol: "?!", token: "q-inaccuracy" },
  mistake: { label: "Mistake", symbol: "?", token: "q-mistake" },
  blunder: { label: "Blunder", symbol: "??", token: "q-blunder" },
};

export const EVAL_CLAMP = 1000;

export function clampEval(cp: number): number {
  if (!Number.isFinite(cp)) return 0;
  return Math.max(-EVAL_CLAMP, Math.min(EVAL_CLAMP, cp));
}

/** Both evals from the mover's perspective. Never negative. */
export function centipawnLoss(bestCp: number, playedCp: number): number {
  return Math.max(0, clampEval(bestCp) - clampEval(playedCp));
}

export function averageCpl(losses: number[]): number {
  if (losses.length === 0) return 0;
  return losses.reduce((a, b) => a + b, 0) / losses.length;
}

export function accuracyFromAcpl(acpl: number): number {
  return Math.round(100 * Math.exp(-0.004 * acpl) * 10) / 10;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function performanceElo(acpl: number, movesPlayed: number, rating?: number | null): number {
  const raw = 3100 * Math.exp(-0.01 * acpl);
  if (rating == null || !Number.isFinite(rating) || rating <= 0) {
    return Math.round(clamp(raw, 400, 3000));
  }
  const weight = clamp(movesPlayed / 40, 0.25, 0.6);
  let blended = rating + (raw - rating) * weight;
  blended = clamp(blended, rating - 400, rating + 400);
  return Math.round(clamp(blended, 400, 3000));
}

/** Threshold classification by CPL only (no book/brilliant/great context). */
export function classifyByCpl(cpl: number, isEngineBest = false): Classification {
  if (isEngineBest || cpl === 0) return "best";
  if (cpl <= 15) return "excellent";
  if (cpl <= 35) return "good";
  if (cpl <= 80) return "inaccuracy";
  if (cpl <= 200) return "mistake";
  return "blunder";
}

export interface ClassifyInput {
  cpl: number;
  isBook: boolean;
  isEngineBest: boolean;
  isSacrifice: boolean;
  moverEvalAfter: number; // mover POV, cp
  onlyMoveGap?: number | null; // best minus second-best, mover POV
}

export function classifyMove(i: ClassifyInput): Classification {
  if (i.isBook) return "book";
  if (i.isSacrifice && i.cpl <= 35 && i.moverEvalAfter >= -50) return "brilliant";
  if (i.isEngineBest && i.onlyMoveGap != null && i.onlyMoveGap >= 150) return "great";
  return classifyByCpl(i.cpl, i.isEngineBest);
}

export type Score = { cp: number | null; mate: number | null };

/** Convert to a single centipawn number (white POV), mates mapped beyond clamp. */
export function scoreToCp(s: Score): number {
  if (s.mate != null) {
    if (s.mate === 0) return 0;
    return s.mate > 0 ? 10000 - s.mate : -10000 - s.mate;
  }
  return s.cp ?? 0;
}

export function formatScore(s: Score): string {
  if (s.mate != null) return s.mate === 0 ? "#" : `${s.mate < 0 ? "-" : ""}M${Math.abs(s.mate)}`;
  const v = (s.cp ?? 0) / 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}
