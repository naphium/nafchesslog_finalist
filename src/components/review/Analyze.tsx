import { ChevronLeft, ChevronRight, RotateCcw, Target, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useAnalysis } from "@/lib/chess/use-analysis";

export function Analyze({ analysis }: { analysis: ReturnType<typeof useAnalysis> }) {
  const { evaluation, bestSan, terminal, checkmate } = analysis;
  const score = evaluation?.score;
  const label = score?.mate != null ? `M${score.mate}` : score?.cp != null ? `${score.cp >= 0 ? "+" : ""}${(score.cp / 100).toFixed(2)}` : "—";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div><p className="text-xs text-muted-foreground">{terminal ? "Game over" : "Best move"}</p><p className="tabular mt-1 text-2xl font-semibold text-primary">{terminal ? checkmate ? "Checkmate" : "Draw" : bestSan || "—"}</p></div>
        <div className="text-right"><p className="tabular font-semibold">{terminal ? checkmate ? "Mate" : "0.00" : label}</p><p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">{!terminal && !evaluation ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing…</> : evaluation?.source === "none" ? "Engine unavailable" : terminal ? "Final position" : evaluation?.source === "local" ? "Stockfish" : "Cloud engine"}</p></div>
      </div>
      <Button className="w-full" disabled={!bestSan || terminal} onClick={() => { const move = evaluation?.bestMove; if (move) analysis.move(move.slice(0, 2) as Parameters<typeof analysis.move>[0], move.slice(2, 4) as Parameters<typeof analysis.move>[1], move[4] ?? "q"); }}><Target className="h-4 w-4" /> Play best move</Button>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" aria-label="Undo analysis move" disabled={!analysis.cursor} onClick={() => analysis.jump(analysis.cursor - 1)}><ChevronLeft /></Button>
        <span className="tabular text-xs text-muted-foreground">{analysis.cursor} / {analysis.line.length}</span>
        <Button variant="outline" size="icon" aria-label="Redo analysis move" disabled={analysis.cursor === analysis.line.length} onClick={() => analysis.jump(analysis.cursor + 1)}><ChevronRight /></Button>
        <Button variant="ghost" size="icon" aria-label="Reset analysis" disabled={!analysis.line.length} onClick={analysis.reset}><RotateCcw /></Button>
      </div>
      <div className="flex min-h-16 flex-wrap content-start gap-1 border-y border-border py-3" aria-label="Analysis variation">
        {!analysis.line.length && <span className="text-xs text-muted-foreground">{analysis.fen.split(" ")[1] === "b" ? "Black" : "White"} to move</span>}
        {analysis.line.map((move, i) => <Button key={i} size="sm" variant={analysis.cursor === i + 1 ? "secondary" : "ghost"} className="tabular h-8" onClick={() => analysis.jump(i + 1)}>{move.san}</Button>)}
      </div>
    </div>
  );
}