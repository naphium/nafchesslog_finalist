import { useEffect, useRef } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CLASSIFICATION_META,
  CLASSIFICATION_ORDER,
  formatScore,
  scoreToCp,
  type Classification,
  type Score,
} from "@/lib/chess/metrics";
import type { GameReview, SideStats } from "@/lib/chess/analyze";
import type { LoadedGame } from "@/lib/chess/game";
import { Button } from "@/components/ui/button";

export function QBadge({ cls, size = "sm" }: { cls: Classification; size?: "sm" | "md" }) {
  const m = CLASSIFICATION_META[cls];
  return (
    <span
      title={m.label}
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold leading-none text-background bg-${m.token} ${
        size === "sm" ? "h-4 w-4 text-[9px]" : "h-6 w-6 text-xs"
      }`}
    >
      {m.symbol}
    </span>
  );
}

export function EvalBar({ score, flipped, height }: { score: Score; flipped: boolean; height?: number }) {
  const cp = scoreToCp(score);
  const pct = score.mate != null ? (score.mate > 0 ? 100 : score.mate < 0 ? 0 : 50) : 50 + 50 * (2 / (1 + Math.exp(-cp / 400)) - 1);
  const whiteAhead = cp >= 0;
  return (
    <div
      className={`relative w-7 shrink-0 overflow-hidden rounded-md bg-eval-black ${flipped ? "rotate-180" : ""}`}
      style={{ height }}
    >
      <div className="absolute bottom-0 left-0 w-full bg-eval-white transition-all duration-500" style={{ height: `${pct}%` }} />
      <span
        className={`tabular absolute left-0 w-full text-center text-[10px] font-bold ${flipped ? "rotate-180" : ""} ${
          whiteAhead ? "bottom-1 text-eval-black" : "top-1 text-eval-white"
        } ${flipped ? (whiteAhead ? "!top-1 !bottom-auto" : "!bottom-1 !top-auto") : ""}`}
      >
        {formatScore(score).replace("+", "")}
      </span>
    </div>
  );
}

export function PlayerCard({
  name,
  elo,
  stats,
  color,
  active,
}: {
  name: string;
  elo: number | null;
  stats: SideStats | null;
  color: "w" | "b";
  active: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-lg ${color === "w" ? "bg-eval-white text-eval-black" : "bg-eval-black text-eval-white"}`}>
          {color === "w" ? "♔" : "♚"}
        </span>
        <div className="min-w-0">
          <div className={`truncate font-semibold ${active ? "text-foreground" : "text-foreground/80"}`}>{name}</div>
          <div className="tabular text-xs text-muted-foreground">{elo ?? "Unrated"}</div>
        </div>
      </div>
      {stats && (
        <div className="flex items-center gap-2">
          <span className="tabular rounded-md bg-surface px-2 py-1 text-xs font-bold">{stats.accuracy.toFixed(1)}%</span>
          <span className="tabular rounded-md bg-primary/15 px-2 py-1 text-xs font-bold text-primary" title="Estimated performance">
            {stats.perfElo}
          </span>
        </div>
      )}
    </div>
  );
}

function Gauge({ value, label }: { value: number; label: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const tone = value >= 85 ? "text-q-best" : value >= 70 ? "text-q-inaccuracy" : value >= 55 ? "text-q-mistake" : "text-q-blunder";
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r={r} className="fill-none stroke-surface-2" strokeWidth="7" />
          <circle
            cx="40"
            cy="40"
            r={r}
            className={`fill-none stroke-current transition-all duration-700 ${tone}`}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - value / 100)}
          />
        </svg>
        <span className="tabular absolute inset-0 grid place-items-center text-xl font-bold">{value.toFixed(1)}</span>
      </div>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function Summary({ game, review }: { game: LoadedGame; review: GameReview }) {
  const h = game.headers;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border pb-5">
        {(["w", "b"] as const).map((c) => {
          const s = c === "w" ? review.white : review.black;
          const elo = c === "w" ? h.whiteElo : h.blackElo;
          return (
            <div key={c} className="min-w-0 px-2 text-center">
              <div className="truncate text-sm font-semibold">{c === "w" ? h.white : h.black}</div>
              <div className="mt-3">
                <Gauge value={s.accuracy} label="Accuracy" />
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
                <span className="tabular rounded bg-primary/15 px-2 py-1 font-bold text-primary">Perf {s.perfElo}</span>
                <span className="tabular rounded bg-surface-2 px-2 py-1 text-muted-foreground">Real {elo ?? "—"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {review.opening && (
        <div className="border-l-2 border-q-book pl-3">
          <div className="text-xs text-muted-foreground">Opening</div>
          <div className="mt-1 font-semibold">
            <span className="tabular mr-2 text-q-book">{review.opening.eco}</span>
            {review.opening.name}
          </div>
        </div>
      )}

      <table className="w-full table-fixed text-center text-sm">
        <colgroup><col className="w-1/4" /><col className="w-1/2" /><col className="w-1/4" /></colgroup>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="truncate pb-3 font-medium" title={h.white}>{h.white}</th>
            <th />
            <th className="truncate pb-3 font-medium" title={h.black}>{h.black}</th>
          </tr>
        </thead>
        <tbody>
          {CLASSIFICATION_ORDER.map((c) => (
            <tr key={c} className="border-t border-border/60">
              <td className={`tabular py-2 font-bold text-${CLASSIFICATION_META[c].token}`}>{review.white.counts[c]}</td>
              <td className="py-2">
                <span className="grid grid-cols-[16px_1fr_16px] items-center gap-1 text-center text-xs sm:text-sm">
                  <QBadge cls={c} /><span>{CLASSIFICATION_META[c].label}</span><span aria-hidden="true" />
                </span>
              </td>
              <td className={`tabular py-2 font-bold text-${CLASSIFICATION_META[c].token}`}>{review.black.counts[c]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MoveList({
  game,
  review,
  ply,
  onJump,
}: {
  game: LoadedGame;
  review: GameReview | null;
  ply: number;
  onJump: (p: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = ref.current;
    const active = list?.querySelector<HTMLElement>("[data-active=true]");
    if (!list || !active) return;
    const box = list.getBoundingClientRect();
    const row = active.getBoundingClientRect();
    if (row.top < box.top) list.scrollTop += row.top - box.top;
    else if (row.bottom > box.bottom) list.scrollTop += row.bottom - box.bottom;
  }, [ply]);
  const blackFirst = game.plies[0]?.color === "b";
  const rows: { n: number; w: number | null; b: number | null }[] = [];
  const startNum = Number(game.startFen.split(" ")[5] ?? 1) || 1;
  let i = 0;
  if (blackFirst) rows.push({ n: startNum, w: null, b: i++ });
  while (i < game.plies.length) {
    rows.push({ n: startNum + rows.length, w: i, b: i + 1 < game.plies.length ? i + 1 : null });
    i += 2;
  }

  const cell = (idx: number | null) => {
    if (idx == null) return <span />;
    const played = game.plies[idx];
    if (!played) return <span />;
    const mv = review?.moves[idx];
    const active = ply === idx + 1;
    return (
      <Button variant="ghost"
        data-active={active}
        onClick={() => onJump(idx + 1)}
        className={`h-8 min-w-0 justify-start gap-1.5 rounded px-2 py-1 text-left text-sm ${active ? "bg-surface-2" : "hover:bg-surface"}`}
      >
        {mv && <QBadge cls={mv.classification} />}
        <span className="tabular truncate font-semibold">{played.san}</span>
        {mv && <span className="tabular ml-auto text-[10px] text-muted-foreground">{formatScore(mv.evalAfter)}</span>}
      </Button>
    );
  };

  const cur = ply > 0 ? review?.moves[ply - 1] : null;
  const showBest = cur && ["inaccuracy", "mistake", "blunder"].includes(cur.classification) && cur.bestSan;

  return (
    <div className="flex h-full flex-col">
      {showBest && (
        <div className={`mb-3 rounded-lg border px-3 py-2 text-sm border-${CLASSIFICATION_META[cur.classification].token} bg-${CLASSIFICATION_META[cur.classification].token}/15`}>
          <b>{game.plies[ply - 1]?.san}</b> is {CLASSIFICATION_META[cur.classification].label.toLowerCase()} — best was{" "}
          <b className="tabular text-q-best">{cur.bestSan}</b>
        </div>
      )}
      <div ref={ref} className="h-[min(360px,55dvh)] overflow-y-auto overscroll-contain pr-1 text-sm [overflow-anchor:none]">
        {rows.map((r) => (
          <div key={r.n} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1 odd:bg-surface/30">
            <span className="tabular pl-2 text-xs text-muted-foreground">{r.n}.</span>
            {cell(r.w)}
            {cell(r.b)}
          </div>
        ))}
        {!rows.length && <p className="p-4 text-center text-muted-foreground">No moves — single-position analysis.</p>}
      </div>
    </div>
  );
}

export function EvalChart({ review, ply, onJump }: { review: GameReview; ply: number; onJump: (p: number) => void }) {
  const data = review.evals.map((e, i) => ({
    ply: i,
    v: Math.max(-10, Math.min(10, scoreToCp(e.score) / 100)),
    label: formatScore(e.score),
  }));
  return (
    <div className="h-72 w-full rounded-lg bg-eval-black/60 p-2">
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 8, left: -24, bottom: 0 }}
          onClick={(s) => {
            const idx = (s as { activeTooltipIndex?: number } | null)?.activeTooltipIndex;
            if (typeof idx === "number") onJump(idx);
          }}
          className="cursor-pointer"
        >
          <XAxis dataKey="ply" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(p: number) => String(Math.ceil(p / 2))} />
          <YAxis domain={[-10, 10]} ticks={[-10, -5, 0, 5, 10]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(p: number) => (p === 0 ? "Start" : `Move ${Math.ceil(p / 2)}${p % 2 ? "" : "…"}`)}
            formatter={(_v, _n, item) => [(item.payload as { label: string }).label, "Eval"]}
          />
          <ReferenceLine y={0} stroke="var(--primary)" strokeDasharray="4 4" />
          <ReferenceLine x={ply} stroke="var(--info)" />
          <Area type="monotone" dataKey="v" baseValue={-10} stroke="var(--muted-foreground)" fill="var(--eval-white)" fillOpacity={0.9} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
