import { GraduationCap } from "lucide-react";
import { useState } from "react";
import type { LoadedGame } from "@/lib/chess/game";
import type { GameReview } from "@/lib/chess/analyze";
import type { SiteSettings } from "@/lib/settings-schema";
import { CLASSIFICATION_META, formatScore } from "@/lib/chess/metrics";
import { QBadge } from "./parts";

export function Coach({ game, review, ply, settings }: { game: LoadedGame; review: GameReview | null; ply: number; settings: SiteSettings }) {
  const [failedUrl, setFailedUrl] = useState("");
  if (!settings.coach_enabled) return null;
  const move = game.plies[ply - 1];
  const rating = review?.moves[ply - 1];
  let message = "The starting position is ready. Let’s look at the game together.";
  if (move && !rating) message = "The engine is still evaluating this move.";
  if (move && rating) {
    if (["inaccuracy", "mistake", "blunder"].includes(rating.classification)) {
      message = rating.bestSan ? `Consider ${rating.bestSan} instead. This move gives up ${(rating.cpl / 100).toFixed(2)} pawns of evaluation.` : "This move loses ground. Look for threats and safer alternatives.";
    } else if (rating.classification === "book") {
      message = review?.opening ? `This follows ${review.opening.name}. Keep developing your pieces and checking your opponent’s threats.` : "This is an established opening move. Continue developing and watch the center.";
    } else if (move.san.includes("#")) message = "Checkmate! The opposing king has no escape.";
    else if (move.san.startsWith("O-O")) message = "Castling brings your king to safety and connects your rooks.";
    else if (move.captured) message = "A capture changes the material balance. Check for recaptures and newly opened lines.";
    else if (move.san.includes("+")) message = "This gives check. Look at the king’s legal replies before planning your next move.";
    else message = rating.bestSan === move.san ? "You found the engine’s first choice. Keep looking for your opponent’s strongest reply." : "This keeps your position on track. Look for active pieces and your opponent’s threats.";
  }
  return (
    <section aria-label="Move coach" className="coach-section mb-5 grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-y border-primary/25 py-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-primary/30 bg-primary/15 text-primary">
        {settings.coach_avatar_url && failedUrl !== settings.coach_avatar_url ? <img src={settings.coach_avatar_url} alt={settings.coach_name} className="h-full w-full object-cover" onError={() => setFailedUrl(settings.coach_avatar_url)} /> : <GraduationCap className="h-7 w-7" />}
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary"><GraduationCap className="h-3.5 w-3.5 shrink-0" /><span className="break-words">{settings.coach_name}</span></div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-sm">
          <div className="flex min-w-0 items-center gap-1.5">{rating && <QBadge cls={rating.classification} />}<span className="break-words"><b>{move?.san ?? "Start"}</b>{rating ? ` is ${CLASSIFICATION_META[rating.classification].label.toLowerCase()}` : ""}</span></div>
          {rating && <span className="tabular shrink-0 rounded border border-border px-1.5 py-0.5 text-xs">{formatScore(rating.evalAfter)}</span>}
        </div>
        <p className="mt-2 min-h-16 break-words text-sm leading-relaxed text-foreground/90">{message}</p>
      </div>
    </section>
  );
}