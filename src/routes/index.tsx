import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type DragEvent } from "react";
import { Loader2, Search, Upload, FileText, Grid3x3 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApp, useStoreReady, type ListedGame, type LoaderTab } from "@/lib/store";
import { fenOnly, parsePgn, type LoadedGame } from "@/lib/chess/game";
import { OwnerPresence } from "@/components/OwnerPresence";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NafChessLog — Review your chess games with Stockfish" },
      {
        name: "description",
        content: "Import games from Chess.com, Lichess, PGN or FEN and get accuracy, performance Elo and brilliant-move detection.",
      },
      { property: "og:title", content: "NafChessLog — Chess Game Review" },
      { property: "og:description", content: "Free Chess.com-style game review with engine analysis, accuracy and move classifications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function fmtTc(tc: string) {
  const [base, inc] = tc.split("+");
  const n = Number(base);
  if (!Number.isFinite(n)) return tc;
  const m = n >= 60 ? `${Math.round(n / 60)}m` : `${n}s`;
  return inc ? `${m} +${inc}` : m;
}

function GameList({ games, user, onPick }: { games: ListedGame[]; user: string; onPick: (g: ListedGame) => void }) {
  if (!games.length) return null;
  const me = user.toLowerCase();
  return (
    <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
      {games.map((g) => {
        const iAmWhite = g.white.toLowerCase() === me;
        const opp = iAmWhite ? g.black : g.white;
        const oppElo = iAmWhite ? g.blackElo : g.whiteElo;
        const myElo = iAmWhite ? g.whiteElo : g.blackElo;
        const won = (g.result === "1-0" && iAmWhite) || (g.result === "0-1" && !iAmWhite);
        const lost = (g.result === "1-0" && !iAmWhite) || (g.result === "0-1" && iAmWhite);
        return (
          <li key={g.id}>
            <Button variant="ghost"
              onClick={() => onPick(g)}
              className="grid h-auto w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-none bg-surface/40 px-3 py-4 text-left transition-colors hover:bg-surface sm:px-4"
            >
              <span className={`h-3 w-3 rounded-sm border border-border ${iAmWhite ? "bg-eval-white" : "bg-eval-black"}`} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  vs {opp} <span className="tabular text-xs text-muted-foreground">({oppElo ?? "?"})</span>
                </span>
                <span className="block text-xs text-muted-foreground">
                  {g.date} · {fmtTc(g.timeControl)} · you {myElo ?? "?"}
                </span>
              </span>
              <span
                className={`tabular rounded-md px-2 py-1 text-xs font-bold ${
                  won ? "bg-success/15 text-success" : lost ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                }`}
              >
                {g.result}
              </span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function Home() {
  const ready = useStoreReady();
  const st = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<null | "chesscom" | "lichess">(null);
  const [drag, setDrag] = useState(false);

  const openGame = (g: LoadedGame) => {
    st.set({ game: g, review: st.review?.gameId === g.id ? st.review : null });
    void navigate({ to: "/review" });
  };

  const pickPgn = (pgn: string) => {
    try {
      const g = parsePgn(pgn);
      if (!g.plies.length) throw new Error("No moves found");
      openGame(g);
    } catch (e) {
      toast.error(`Couldn't read PGN: ${(e as Error).message}`);
    }
  };

  const fetchGames = async (src: "chesscom" | "lichess") => {
    const user = (src === "chesscom" ? st.chesscomUser : st.lichessUser).trim();
    if (!user) {
      toast.error("Enter a username");
      return;
    }
    setLoading(src);
    try {
      const res = await fetch(`/api/public/${src}?username=${encodeURIComponent(user)}`);
      const j = (await res.json()) as { games?: ListedGame[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      if (!j.games?.length) toast.info("No recent games found");
      st.set(src === "chesscom" ? { chesscomGames: j.games ?? [] } : { lichessGames: j.games ?? [] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) st.set({ pgnText: await f.text() });
  };

  return (
    <div className="mx-auto max-w-4xl px-3 pb-12 pt-4 sm:px-6 lg:pt-8">
      <div className="space-y-6">
        <section className="grid gap-5 border-b border-border pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold sm:text-4xl">NafChessLog</h1>
            <p className="mt-2 text-sm text-muted-foreground">Your next game review</p>
          </div>
          <OwnerPresence />
        </section>

        <section className="min-w-0">
          <Tabs value={st.tab} onValueChange={(v) => st.set({ tab: v as LoaderTab })}>
            <TabsList className="grid h-12 w-full grid-cols-4 bg-surface">
              <TabsTrigger value="chesscom" className="min-w-0 px-1 text-xs sm:text-sm">Chess.com</TabsTrigger>
              <TabsTrigger value="lichess" className="min-w-0 px-1 text-xs sm:text-sm">Lichess</TabsTrigger>
              <TabsTrigger value="pgn" className="min-w-0 px-1 text-xs sm:text-sm">PGN</TabsTrigger>
              <TabsTrigger value="fen" className="min-w-0 px-1 text-xs sm:text-sm">FEN</TabsTrigger>
            </TabsList>

            {(["chesscom", "lichess"] as const).map((src) => (
              <TabsContent key={src} value={src} className="mt-5">
                <form
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void fetchGames(src);
                  }}
                >
                  <Input
                    disabled={!ready}
                    value={src === "chesscom" ? st.chesscomUser : st.lichessUser}
                    onChange={(e) => st.set(src === "chesscom" ? { chesscomUser: e.target.value } : { lichessUser: e.target.value })}
                    placeholder="Username (ex. MdNafimMuttaki)"
                    className="h-11 min-w-0 bg-surface"
                  />
                  <Button type="submit" className="h-11 px-3 sm:px-5" disabled={loading === src}>
                    {loading === src ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Fetch
                  </Button>
                </form>
                <GameList
                  games={src === "chesscom" ? st.chesscomGames : st.lichessGames}
                  user={src === "chesscom" ? st.chesscomUser : st.lichessUser}
                  onPick={(g) => pickPgn(g.pgn)}
                />
              </TabsContent>
            ))}

            <TabsContent value="pgn" className="mt-5 space-y-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                className={`rounded-lg border-2 border-dashed transition-colors ${drag ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <Textarea
                  value={st.pgnText}
                  onChange={(e) => st.set({ pgnText: e.target.value })}
                  placeholder={'[White "Magnus"]\n[Black "Hikaru"]\n[WhiteElo "2850"]\n\n1. e4 e5 2. Nf3 Nc6 …'}
                  className="tabular min-h-56 resize-y border-0 bg-transparent text-xs focus-visible:ring-0"
                />
              </div>
              <div className="grid gap-2 min-[400px]:grid-cols-2">
                <Button variant="secondary" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" /> Upload .pgn
                    <input
                      type="file"
                      accept=".pgn,text/plain"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) st.set({ pgnText: await f.text() });
                      }}
                    />
                  </label>
                </Button>
                <Button className="flex-1" onClick={() => pickPgn(st.pgnText)} disabled={!st.pgnText.trim()}>
                  <FileText className="h-4 w-4" /> Review game
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="fen" className="mt-5 space-y-3">
              <Input
                value={st.fenText}
                onChange={(e) => st.set({ fenText: e.target.value })}
                placeholder="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
                className="tabular h-11 bg-surface text-xs"
              />
              <Button
                className="w-full"
                disabled={!st.fenText.trim()}
                onClick={() => {
                  try {
                    openGame(fenOnly(st.fenText));
                  } catch {
                    toast.error("That FEN isn't valid");
                  }
                }}
              >
                <Grid3x3 className="h-4 w-4" /> Analyze position
              </Button>
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}
