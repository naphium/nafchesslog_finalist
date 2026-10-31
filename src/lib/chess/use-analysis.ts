import { useEffect, useState } from "react";
import { Chess, type Square } from "chess.js";
import { evaluatePosition, type PositionEval } from "./engine";
import { playSound } from "@/lib/sound";

export function useAnalysis(baseFen: string, active: boolean, options: { apiDepth: number; localDepth: number }, sound: boolean) {
  const [line, setLine] = useState<{ fen: string; san: string; from: string; to: string }[]>([]);
  const [cursor, setCursor] = useState(0);
  const [root, setRoot] = useState(baseFen);
  const [result, setResult] = useState<{ fen: string; value: PositionEval } | null>(null);
  useEffect(() => { setRoot(baseFen); setLine([]); setCursor(0); }, [baseFen]);
  const fen = cursor > 0 ? line[cursor - 1]?.fen ?? root : root;
  const evaluation = result?.fen === fen ? result.value : null;
  const position = fen ? new Chess(fen) : null;
  const terminal = position?.isGameOver() ?? false;
  useEffect(() => {
    if (!active || !fen || terminal) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void evaluatePosition(fen, options).then((value) => {
        if (!cancelled) setResult({ fen, value });
      });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, fen, terminal, options.apiDepth, options.localDepth]);
  const move = (from: Square, to: Square, promotion = "q") => {
    try {
      const chess = new Chess(fen);
      const next = chess.move({ from, to, promotion });
      setLine([...line.slice(0, cursor), { fen: chess.fen(), san: next.san, from, to }]);
      setCursor(cursor + 1);
      if (sound) playSound(chess.isGameOver() ? "end" : chess.inCheck() ? "check" : next.isPromotion() ? "promote" : next.isKingsideCastle() || next.isQueensideCastle() ? "castle" : next.isCapture() || next.isEnPassant() ? "capture" : "move");
      return true;
    } catch { return false; }
  };
  const jump = (next: number) => { setCursor(Math.max(0, Math.min(line.length, next))); };
  const lastMove = cursor > 0 ? line[cursor - 1] ?? null : null;
  let bestSan: string | null = null;
  if (evaluation?.bestMove) {
    const uci = evaluation.bestMove;
    try { bestSan = new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" }).san; } catch { /* unavailable move */ }
  }
  return { fen, line, cursor, evaluation, bestSan, lastMove, move, jump, reset: () => { setLine([]); setCursor(0); }, terminal, inCheck: position?.inCheck(), checkmate: position?.isCheckmate() };
}