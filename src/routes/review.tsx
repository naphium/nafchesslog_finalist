import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat2,
  Plus,
  Loader2,
  Volume2,
  VolumeX,
  Target,
  ArrowLeft,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useApp, useStoreReady } from "@/lib/store";
import { useSettings } from "@/lib/use-settings";
import { evaluateAll } from "@/lib/chess/engine";
import { buildReview } from "@/lib/chess/analyze";
import { playSound } from "@/lib/sound";
import { EvalBar, EvalChart, MoveList, PlayerCard, Summary, QBadge } from "@/components/review/parts";
import { CLASSIFICATION_META } from "@/lib/chess/metrics";
import { Coach } from "@/components/review/Coach";
import { Analyze } from "@/components/review/Analyze";
import { useAnalysis } from "@/lib/chess/use-analysis";

const Board = lazy(() => import("@/components/review/Board"));

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Game Review — NafChessLog" },
      { name: "description", content: "Move-by-move engine review with accuracy, evaluation chart and move classifications." },
      { property: "og:title", content: "Game Review — NafChessLog" },
      { property: "og:description", content: "See your accuracy, performance Elo, brilliant moves and blunders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewPage,
});

function uciToSan(fen: string, uci: string) {
  try {
    const c = new Chess(fen);
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" }).san;
  } catch {
    return null;
  }
}

function ReviewPage() {
  const ready = useStoreReady();
  const { game, review, set } = useApp();
  const settings = useSettings();
  const navigate = useNavigate();
  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [auto, setAuto] = useState(false);
  const [sound, setSound] = useState(true);
  const [arrow, setArrow] = useState(true);
  const [tab, setTab] = useState("summary");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const running = useRef<string | null>(null);
  const boardWrap = useRef<HTMLDivElement>(null);
  const [boardH, setBoardH] = useState(480);
  const defaultsApplied = useRef(false);
  useEffect(() => {
    if (defaultsApplied.current) return;
    setSound(settings.default_sound);
    setArrow(settings.default_arrow);
    defaultsApplied.current = true;
  }, [settings.default_sound, settings.default_arrow]);

  const total = game?.plies.length ?? 0;

  // Run analysis
  useEffect(() => {
    if (!game || (review && review.gameId === game.id) || running.current === game.id) return;
    running.current = game.id;
    const fens = [game.startFen, ...game.plies.map((p) => p.fenAfter)];
    setProgress({ done: 0, total: fens.length });
    void evaluateAll(fens, { apiDepth: settings.engine_depth, localDepth: settings.local_depth }, (done, t) =>
      setProgress({ done, total: t }),
    ).then((evals) => {
      if (running.current !== game.id) return;
      set({ review: buildReview(game, evals, uciToSan) });
      setProgress(null);
      running.current = null;
    });
  }, [game, review, set, settings.engine_depth, settings.local_depth]);

  useEffect(() => {
    if (!game) return;
    setPly(game.plies.length ? 0 : 0);
  }, [game?.id]);

  // Board size
  useEffect(() => {
    const el = boardWrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setBoardH(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready, game]);

  const go = useCallback(
    (p: number) => {
      const next = Math.max(0, Math.min(total, p));
      setPly((prev) => {
        if (next !== prev && sound && game && next > 0 && Math.abs(next - prev) === 1) {
          const m = game.plies[next - 1];
          if (!m) return next;
          const c = new Chess(m.fenAfter);
          playSound(
            c.isGameOver() ? "end" : c.inCheck() ? "check" : m.flags.includes("p") ? "promote" : m.flags.match(/[kq]/) ? "castle" : m.captured ? "capture" : "move",
          );
        } else if (next !== prev && sound) playSound("move");
        return next;
      });
    },
    [total, sound, game],
  );

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (tab === "analyze") return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "ArrowLeft") go(ply - 1);
      else if (e.key === "ArrowRight") go(ply + 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total);
      else if (e.key === "f") setFlipped((f) => !f);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go, ply, total, tab]);

  // Autoplay
  useEffect(() => {
    if (!auto) return;
    if (ply >= total) return setAuto(false);
    const t = setTimeout(() => go(ply + 1), 900);
    return () => clearTimeout(t);
  }, [auto, ply, total, go]);

  const fen = useMemo(() => (!game ? "" : ply === 0 ? game.startFen : game.plies[ply - 1]?.fenAfter ?? game.startFen), [game, ply]);
  const analyzing = tab === "analyze";
  const analysis = useAnalysis(fen, analyzing, { apiDepth: settings.engine_depth, localDepth: settings.local_depth }, sound);
  useEffect(() => { if (game && !game.plies.length) setTab("analyze"); }, [game?.id]);
  const boardFen = analyzing ? analysis.fen : fen;

  if (!ready) {
    return (
      <div className="grid h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!game) {
    return (
      <div className="mx-auto mt-16 max-w-md panel p-8 text-center">
        <h1 className="text-2xl font-bold">No game loaded</h1>
        <p className="mt-2 text-sm text-muted-foreground">Import a game from Chess.com, Lichess or paste a PGN to start reviewing.</p>
        <Button asChild className="mt-6">
          <Link to="/">Load a game</Link>
        </Button>
      </div>
    );
  }

  const r = review?.gameId === game.id ? review : null;
  const h = game.headers;
  const curMove = ply > 0 ? game.plies[ply - 1] : null;
  const curReview = ply > 0 ? r?.moves[ply - 1] : null;
  const evalNow = (analyzing ? analysis.evaluation?.score : r?.evals[ply]?.score) ?? { cp: 0, mate: null };
  const topColor = flipped ? "w" : "b";
  const bottomColor = flipped ? "b" : "w";
  const sideToMove = boardFen.split(" ")[1];

  const card = (c: "w" | "b") => (
    <PlayerCard
      name={c === "w" ? h.white : h.black}
      elo={c === "w" ? h.whiteElo : h.blackElo}
      stats={r ? (c === "w" ? r.white : r.black) : null}
      color={c}
      active={sideToMove === c}
    />
  );

  const tryMove = (from: Square, to: Square) => {
    const next = game.plies[ply];
    if (next && next.from === from && next.to === to) {
      go(ply + 1);
      return true;
    }
    return false;
  };

  return (
    <div className="mx-auto max-w-[1440px] px-3 pb-8 sm:px-6 lg:px-10">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft /> Go back</Link></Button>
        <span className="text-xs font-semibold text-muted-foreground">Game review <span className="tabular ml-2 text-primary">{ply} / {total}</span></span>
      </div>
      {progress && (
        <div className="mb-4 flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Analyzing positions…</span>
              <span className="tabular">
                {progress.done}/{progress.total}
              </span>
            </div>
            <Progress value={(progress.done / Math.max(1, progress.total)) * 100} className="h-1.5" />
          </div>
        </div>
      )}
      <div className="grid min-w-0 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)] xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-10">
        {/* Board column */}
        <div className="mx-auto w-full min-w-0 max-w-[720px] md:sticky md:top-5">
          {card(topColor)}
          <div className="flex gap-2">
            <EvalBar score={evalNow} flipped={flipped} height={boardH} />
            <div ref={boardWrap} className="board-frame min-w-0 flex-1">
              <ClientOnly fallback={<div className="aspect-square w-full animate-pulse rounded-lg bg-surface" />}>
                <Suspense fallback={<div className="aspect-square w-full animate-pulse rounded-lg bg-surface" />}>
                  <Board
                    fen={boardFen}
                    orientation={flipped ? "black" : "white"}
                    lastMove={analyzing ? analysis.lastMove : curMove ? { from: curMove.from, to: curMove.to } : null}
                    badge={analyzing ? null : curReview?.classification ?? null}
                    bestMove={analyzing ? analysis.evaluation?.bestMove ?? null : r?.evals[ply]?.bestMove ?? null}
                    showArrow={arrow}
                    onTryMove={analyzing ? analysis.move : tryMove}
                  />
                </Suspense>
              </ClientOnly>
            </div>
          </div>
          {card(bottomColor)}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-1 rounded-lg border border-border bg-card p-2 sm:gap-1.5">
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
            <Button variant="secondary" size="icon" onClick={() => analyzing ? analysis.jump(0) : go(0)} aria-label="First move">
              <ChevronFirst />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => analyzing ? analysis.jump(analysis.cursor - 1) : go(ply - 1)} aria-label="Previous move">
              <ChevronLeft />
            </Button>
            <Button size="icon" onClick={() => setAuto((a) => !a)} aria-label={auto ? "Pause" : "Auto-play"} disabled={!total || analyzing}>
              {auto ? <Pause /> : <Play />}
            </Button>
            <Button variant="secondary" size="icon" onClick={() => analyzing ? analysis.jump(analysis.cursor + 1) : go(ply + 1)} aria-label="Next move">
              <ChevronRight />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => analyzing ? analysis.jump(analysis.line.length) : go(total)} aria-label="Last move">
              <ChevronLast />
            </Button>
            </div>
            <span className="hidden h-6 w-px bg-border xl:mx-1 xl:block" />
            <div className="flex items-center justify-center gap-1 sm:gap-1.5">
            <Button variant="ghost" size="icon" onClick={() => setFlipped((f) => !f)} aria-label="Flip board">
              <Repeat2 />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setArrow((a) => !a)} aria-label="Toggle best-move arrow" className={arrow ? "text-primary" : ""}>
              <Target />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSound((s) => !s)} aria-label="Toggle sound">
              {sound ? <Volume2 /> : <VolumeX />}
            </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="flex min-w-0 flex-col border-t border-border pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0 xl:pl-8">
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold">
                {h.white} <span className="text-muted-foreground">vs</span> {h.black}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {[h.event, h.date, h.result].filter((x) => x && !x.includes("?")).join(" · ")}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void navigate({ to: "/" })}>
              <Plus className="h-4 w-4" /> New game
            </Button>
          </div>

          <div className="mb-4 flex min-h-12 items-center justify-center rounded-lg border border-border bg-card">
          {curMove && curReview && (
            <div className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-3 text-center text-sm bg-${CLASSIFICATION_META[curReview.classification].token}/15`}>
              <QBadge cls={curReview.classification} size="md" />
              <span>
                <b className="tabular">{curMove.san}</b> is{" "}
                <span className={`font-semibold text-${CLASSIFICATION_META[curReview.classification].token}`}>
                  {CLASSIFICATION_META[curReview.classification].label.toLowerCase()}
                </span>
              </span>
            </div>
          )}
          {!curMove && <span className="text-xs text-muted-foreground">Starting position</span>}
          {curMove && !curReview && <span className="tabular text-sm text-muted-foreground">{curMove.san}</span>}
          </div>

          <Coach game={game} review={r} ply={ply} settings={settings} />
          <Tabs value={tab} onValueChange={(value) => { setTab(value); setAuto(false); }} className="flex-1">
            <TabsList className="grid w-full grid-cols-4 bg-surface">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="moves">Moves</TabsTrigger>
              <TabsTrigger value="analyze">Analyze</TabsTrigger>
              <TabsTrigger value="chart">Chart</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="mt-4">
              {r ? <Summary game={game} review={r} /> : <Pending />}
            </TabsContent>
            <TabsContent value="moves" className="mt-4">
              <MoveList game={game} review={r} ply={ply} onJump={go} />
            </TabsContent>
            <TabsContent value="chart" className="mt-4">
              {r ? <EvalChart review={r} ply={ply} onJump={go} /> : <Pending />}
            </TabsContent>
            <TabsContent value="analyze" className="mt-4"><Analyze analysis={analysis} /></TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}

function Pending() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" />
      ))}
    </div>
  );
}
