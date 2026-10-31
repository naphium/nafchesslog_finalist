import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const UA = "NafChessLog/1.0 (game review app; contact: admin@nafchesslog.app)";

interface CcGame {
  url: string;
  pgn?: string;
  time_control: string;
  end_time: number;
  rules: string;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
}

const resultOf = (g: CcGame) =>
  g.white.result === "win" ? "1-0" : g.black.result === "win" ? "0-1" : "½-½";

export const Route = createFileRoute("/api/public/chesscom")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const parsed = z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_-]{2,40}$/)
          .safeParse(new URL(request.url).searchParams.get("username"));
        if (!parsed.success) return Response.json({ error: "Invalid username" }, { status: 400 });
        const user = parsed.data.toLowerCase();
        const now = new Date();
        const games: CcGame[] = [];
        for (let back = 0; back < 3 && games.length < 20; back++) {
          const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
          const url = `https://api.chess.com/pub/player/${user}/games/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
          if (res.status === 404) {
            if (back === 0) return Response.json({ error: "Player not found" }, { status: 404 });
            break;
          }
          if (!res.ok) return Response.json({ error: `Chess.com error ${res.status}` }, { status: 502 });
          const j = (await res.json()) as { games?: CcGame[] };
          games.push(...(j.games ?? []).filter((g) => g.rules === "chess" && g.pgn).reverse());
        }
        const out = games.slice(0, 20).map((g) => ({
          id: g.url,
          white: g.white.username,
          black: g.black.username,
          whiteElo: g.white.rating,
          blackElo: g.black.rating,
          result: resultOf(g),
          timeControl: g.time_control,
          date: new Date(g.end_time * 1000).toISOString().slice(0, 10),
          pgn: g.pgn!,
        }));
        return Response.json({ games: out }, { headers: { "Cache-Control": "public, max-age=60" } });
      },
    },
  },
});
