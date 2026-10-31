import type { Score } from "./metrics";

export type EngineSource = "cloud" | "api" | "local" | "none";

export interface PositionEval {
  score: Score; // white POV
  bestMove: string | null; // UCI
  secondScore: Score | null; // white POV, if multipv available
  source: EngineSource;
}

const sideToMove = (fen: string) => (fen.split(" ")[1] === "b" ? "b" : "w");

function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return p(ctrl.signal).finally(() => clearTimeout(t));
}

/* ---------- Tier 1: Lichess cloud eval ---------- */
async function lichessCloud(fen: string): Promise<PositionEval | null> {
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=2`, { signal }),
      2500,
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { pvs?: { cp?: number; mate?: number; moves: string }[] };
    const [p1, p2] = j.pvs ?? [];
    if (!p1) return null;
    const toScore = (p: { cp?: number; mate?: number }): Score => ({ cp: p.cp ?? null, mate: p.mate ?? null });
    return {
      score: toScore(p1),
      bestMove: p1.moves.split(" ")[0] ?? null,
      secondScore: p2 ? toScore(p2) : null,
      source: "cloud",
    };
  } catch {
    return null;
  }
}

/* ---------- Tier 2: chess-api.com ---------- */
async function chessApi(fen: string, depth: number): Promise<PositionEval | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await withTimeout(
        (signal) =>
          fetch("https://chess-api.com/v1", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fen, depth: Math.min(18, Math.max(10, depth)) }),
            signal,
          }),
        4000,
      );
      if (!res.ok) continue;
      const j = (await res.json()) as {
        centipawns?: number | string;
        eval?: number;
        mate?: number | null;
        move?: string;
        lan?: string;
        type?: string;
      };
      if (j.type === "error") continue;
      const mate = j.mate != null ? Number(j.mate) : null;
      const cp =
        j.centipawns != null ? Number(j.centipawns) : j.eval != null ? Math.round(Number(j.eval) * 100) : null;
      if (mate == null && (cp == null || Number.isNaN(cp))) continue;
      return {
        score: { cp: mate != null ? null : cp, mate },
        bestMove: j.lan ?? j.move ?? null,
        secondScore: null,
        source: "api",
      };
    } catch {
      /* retry */
    }
  }
  return null;
}

/* ---------- Tier 3: local Stockfish web worker ---------- */
const STOCKFISH_URL = "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js";
let worker: Worker | null = null;
let workerFailed = false;
let queue: Promise<unknown> = Promise.resolve();

function getWorker(): Worker | null {
  if (workerFailed || typeof window === "undefined") return null;
  if (worker) return worker;
  try {
    const blob = new Blob([`importScripts("${STOCKFISH_URL}");`], { type: "application/javascript" });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onerror = () => {
      workerFailed = true;
      worker = null;
    };
    worker.postMessage("uci");
    worker.postMessage("setoption name MultiPV value 2");
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

function localStockfish(fen: string, depth: number): Promise<PositionEval | null> {
  const run = () =>
    new Promise<PositionEval | null>((resolve) => {
      const w = getWorker();
      if (!w) return resolve(null);
      const flip = sideToMove(fen) === "b" ? -1 : 1;
      const pv: Record<number, Score> = {};
      let best: string | null = null;
      const timer = setTimeout(() => {
        w.removeEventListener("message", onMsg);
        w.postMessage("stop");
        resolve(pv[1] ? { score: pv[1], bestMove: best, secondScore: pv[2] ?? null, source: "local" } : null);
      }, 15000);
      const onMsg = (e: MessageEvent) => {
        const line = String(e.data);
        if (line.startsWith("info") && line.includes(" score ")) {
          const mpv = Number(/ multipv (\d+)/.exec(line)?.[1] ?? 1);
          const cp = / score cp (-?\d+)/.exec(line);
          const mate = / score mate (-?\d+)/.exec(line);
          const s: Score = cp
            ? { cp: Number(cp[1]) * flip, mate: null }
            : mate
              ? { cp: null, mate: Number(mate[1]) * flip }
              : { cp: 0, mate: null };
          pv[mpv] = s;
          if (mpv === 1) best = / pv (\S+)/.exec(line)?.[1] ?? best;
        } else if (line.startsWith("bestmove")) {
          clearTimeout(timer);
          w.removeEventListener("message", onMsg);
          const bm = line.split(" ")[1];
          if (bm && bm !== "(none)") best = bm;
          resolve(pv[1] ? { score: pv[1], bestMove: best, secondScore: pv[2] ?? null, source: "local" } : null);
        }
      };
      w.addEventListener("message", onMsg);
      w.postMessage("ucinewgame");
      w.postMessage(`position fen ${fen}`);
      w.postMessage(`go depth ${Math.min(30, Math.max(10, depth))}`);
    });
  const p = queue.then(run, run);
  queue = p.catch(() => null);
  return p;
}

export interface EngineOptions {
  apiDepth: number;
  localDepth: number;
}

export async function evaluatePosition(fen: string, opts: EngineOptions): Promise<PositionEval> {
  return (
    (await lichessCloud(fen)) ??
    (await chessApi(fen, opts.apiDepth)) ??
    (await localStockfish(fen, opts.localDepth)) ?? {
      score: { cp: 0, mate: null },
      bestMove: null,
      secondScore: null,
      source: "none",
    }
  );
}

/** Evaluates many positions with a concurrency pool of 4. */
export async function evaluateAll(
  fens: string[],
  opts: EngineOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<PositionEval[]> {
  const out: PositionEval[] = new Array(fens.length);
  let next = 0;
  let done = 0;
  const workerFn = async () => {
    while (next < fens.length) {
      const i = next++;
      out[i] = await evaluatePosition(fens[i]!, opts);
      onProgress?.(++done, fens.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, fens.length) }, workerFn));
  return out;
}
