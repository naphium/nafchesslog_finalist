import { isSacrifice, type LoadedGame } from "./game";
import { detectOpening } from "./openings";
import type { PositionEval } from "./engine";
import {
  accuracyFromAcpl,
  averageCpl,
  centipawnLoss,
  classifyMove,
  clampEval,
  performanceElo,
  scoreToCp,
  CLASSIFICATION_ORDER,
  type Classification,
  type Score,
} from "./metrics";

export interface MoveReview {
  ply: number; // index into plies
  cpl: number;
  classification: Classification;
  evalAfter: Score; // white POV
  bestMove: string | null; // best move in the position BEFORE this move (UCI)
  bestSan: string | null;
}

export interface SideStats {
  acpl: number;
  accuracy: number;
  perfElo: number;
  counts: Record<Classification, number>;
}

export interface GameReview {
  gameId: string;
  evals: PositionEval[]; // one per position (0 = start)
  moves: MoveReview[];
  white: SideStats;
  black: SideStats;
  opening: { eco: string; name: string } | null;
}

const emptyCounts = () =>
  Object.fromEntries(CLASSIFICATION_ORDER.map((c) => [c, 0])) as Record<Classification, number>;

export function buildReview(
  game: LoadedGame,
  evals: PositionEval[],
  uciToSan: (fen: string, uci: string) => string | null,
): GameReview {
  const { bookPlies, opening } = game.startFen.startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w")
    ? detectOpening(game.plies.map((p) => p.san))
    : { bookPlies: 0, opening: null };

  const losses: Record<"w" | "b", number[]> = { w: [], b: [] };
  const counts = { w: emptyCounts(), b: emptyCounts() };

  const moves: MoveReview[] = game.plies.map((p, i) => {
    const none = { score: { cp: 0, mate: null }, bestMove: null, secondScore: null, source: "none" as const };
    const before = evals[i] ?? none;
    const after = evals[i + 1] ?? none;
    const sign = p.color === "w" ? 1 : -1;
    const bestCp = sign * scoreToCp(before.score);
    const playedCp = sign * scoreToCp(after.score);
    const isEngineBest = before.bestMove != null && before.bestMove === p.uci;
    // If best move was played, CPL is noise from different engine sources; treat as 0.
    const cpl = isEngineBest ? 0 : centipawnLoss(bestCp, playedCp);
    const gap = before.secondScore
      ? clampEval(bestCp) - clampEval(sign * scoreToCp(before.secondScore))
      : null;
    const classification = classifyMove({
      cpl,
      isBook: i < bookPlies,
      isEngineBest,
      isSacrifice: i >= bookPlies && isSacrifice(p),
      moverEvalAfter: playedCp,
      onlyMoveGap: gap,
    });
    losses[p.color].push(cpl);
    counts[p.color][classification]++;
    return {
      ply: i,
      cpl,
      classification,
      evalAfter: after.score,
      bestMove: before.bestMove,
      bestSan: before.bestMove ? uciToSan(p.fenBefore, before.bestMove) : null,
    };
  });

  const side = (c: "w" | "b"): SideStats => {
    const acpl = averageCpl(losses[c]);
    const elo = c === "w" ? game.headers.whiteElo : game.headers.blackElo;
    return {
      acpl,
      accuracy: accuracyFromAcpl(acpl),
      perfElo: performanceElo(acpl, losses[c].length, elo),
      counts: counts[c],
    };
  };

  const hdrOpening =
    game.headers.opening || game.headers.eco
      ? { eco: game.headers.eco ?? opening?.eco ?? "", name: game.headers.opening ?? opening?.name ?? "" }
      : null;

  return {
    gameId: game.id,
    evals,
    moves,
    white: side("w"),
    black: side("b"),
    opening: opening ? { eco: opening.eco, name: opening.name } : hdrOpening,
  };
}
