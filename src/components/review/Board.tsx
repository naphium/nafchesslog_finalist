import { Chessboard } from "react-chessboard";
import type { CustomSquareProps, Square as BoardSquare } from "react-chessboard/dist/chessboard/types";
import { Chess, type Square } from "chess.js";
import { createContext, forwardRef, useContext, useEffect, useMemo, useState } from "react";
import { CLASSIFICATION_META, type Classification } from "@/lib/chess/metrics";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const BadgeCtx = createContext<{ square: string | null; cls: Classification | null }>({ square: null, cls: null });

const SquareWithBadge = forwardRef<HTMLDivElement, CustomSquareProps>(function SquareWithBadge(
  { children, square, style },
  ref,
) {
  const b = useContext(BadgeCtx);
  const meta = b.square === square && b.cls ? CLASSIFICATION_META[b.cls] : null;
  return (
    <div ref={ref} style={{ ...style, position: "relative" }}>
      {children}
      {meta && (
        <span
          className={`pointer-events-none absolute -right-1 -top-1 z-10 grid h-[38%] min-h-5 w-[38%] min-w-5 place-items-center rounded-full border-2 border-background text-xs font-bold leading-none text-background shadow-md bg-${meta.token}`}
        >
          {meta.symbol}
        </span>
      )}
    </div>
  );
});

function cssVar(name: string) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export interface BoardProps {
  fen: string;
  orientation: "white" | "black";
  lastMove: { from: string; to: string } | null;
  badge: Classification | null;
  bestMove: string | null;
  showArrow: boolean;
  onTryMove: (from: Square, to: Square, promotion?: string) => boolean;
}

export default function Board({ fen, orientation, lastMove, badge, bestMove, showArrow, onTryMove }: BoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [colors, setColors] = useState({ arrow: "", last: "", dot: "", light: "", dark: "" });
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    setColors({
      arrow: cssVar("--q-best"),
      last: cssVar("--q-inaccuracy"),
      dot: cssVar("--background"),
      light: cssVar("--board-light"),
      dark: cssVar("--board-dark"),
    });
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => { setSelected(null); setPromotion(null); }, [fen]);
  const attempt = (from: Square, to: Square) => {
    const chess = new Chess(fen);
    const moves = chess.moves({ square: from, verbose: true });
    const move = moves.find((m) => m.to === to);
    if (!move) return false;
    if (move.isPromotion()) { setPromotion({ from, to }); return false; }
    return onTryMove(from, to);
  };

  const targets = useMemo(() => {
    if (!selected) return [] as Square[];
    try {
      return new Chess(fen).moves({ square: selected, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }, [fen, selected]);

  const squareStyles: Record<string, Record<string, string>> = {};
  if (lastMove) {
    const bg = `color-mix(in oklab, var(--q-inaccuracy) 45%, transparent)`;
    squareStyles[lastMove.from] = { background: bg };
    squareStyles[lastMove.to] = { background: bg };
  }
  if (selected) squareStyles[selected] = { background: `color-mix(in oklab, ${colors.arrow} 40%, transparent)` };
  for (const t of targets) {
    squareStyles[t] = {
      ...(squareStyles[t] ?? {}),
      backgroundImage: `radial-gradient(circle, color-mix(in oklab, ${colors.dot} 45%, transparent) 22%, transparent 24%)`,
    };
  }

  const arrows =
    showArrow && bestMove && bestMove.length >= 4 && colors.arrow
      ? ([[bestMove.slice(0, 2), bestMove.slice(2, 4), colors.arrow]] as [BoardSquare, BoardSquare, string][])
      : [];

  return (
    <BadgeCtx.Provider value={{ square: lastMove?.to ?? null, cls: badge }}>
      <Chessboard
        id="review-board"
        position={fen}
        boardOrientation={orientation}
        animationDuration={reducedMotion ? 0 : 280}
        snapToCursor
        isDraggablePiece={({ piece }) => piece[0] === fen.split(" ")[1]}
        onPromotionCheck={() => false}
        customArrows={arrows}
        customSquare={SquareWithBadge}
        customSquareStyles={squareStyles}
        customLightSquareStyle={{ backgroundColor: colors.light }}
        customDarkSquareStyle={{ backgroundColor: colors.dark }}
        customBoardStyle={{ borderRadius: 8, overflow: "hidden" }}
        onSquareClick={(sq) => {
          if (selected && targets.includes(sq as Square)) {
            attempt(selected, sq as Square);
            setSelected(null);
            return;
          }
          const p = new Chess(fen).get(sq as Square);
          setSelected(p && p.color === fen.split(" ")[1] ? (sq as Square) : null);
        }}
        onPieceDrop={(from, to) => to ? attempt(from as Square, to as Square) : false}
      />
      <Dialog open={Boolean(promotion)} onOpenChange={(open) => { if (!open) setPromotion(null); }}>
        <DialogContent className="max-w-xs rounded-lg">
          <DialogTitle>Promote pawn</DialogTitle>
          <DialogDescription>Choose a piece</DialogDescription>
          <div className="grid grid-cols-4 gap-2">
            {[["q", "Queen", "♛"], ["r", "Rook", "♜"], ["b", "Bishop", "♝"], ["n", "Knight", "♞"]].map(([piece, name, symbol]) => <Button key={piece} variant="secondary" className="h-14 text-3xl" aria-label={`Promote to ${name}`} onClick={() => { if (promotion) onTryMove(promotion.from, promotion.to, piece); setPromotion(null); }}>{symbol}</Button>)}
          </div>
        </DialogContent>
      </Dialog>
    </BadgeCtx.Provider>
  );
}
