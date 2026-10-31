import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

interface LiGame {
  id: string;
  createdAt: number;
  winner?: "white" | "black";
  status: string;
  speed: string;
  clock?: { initial: number; increment: number };
  players: {
    white: { user?: { name: string }; rating?: number };
    black: { user?: { name: string }; rating?: number };
  };
  pgn?: string;
}

export const Route = createFileRoute("/api/public/lichess")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const parsed = z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_-]{2,30}$/)
          .safeParse(new URL(request.url).searchParams.get("username"));
        if (!parsed.success) return Response.json({ error: "Invalid username" }, { status: 400 });
        const res = await fetch(
          `https://lichess.org/api/games/user/${parsed.data}?max=15&pgnInJson=true&clocks=false&evals=false`,
          { headers: { Accept: "application/x-ndjson", "User-Agent": "NafChessLog/1.0" } },
        );
        if (res.status === 404) return Response.json({ error: "Player not found" }, { status: 404 });
        if (!res.ok || !res.body) return Response.json({ error: `Lichess error ${res.status}` }, { status: 502 });

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        const games: LiGame[] = [];
        for (;;) {
          const { value, done } = await reader.read();
          if (value) buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) games.push(JSON.parse(line) as LiGame);
          }
          if (done) break;
        }
        if (buf.trim()) games.push(JSON.parse(buf) as LiGame);

        const out = games
          .filter((g) => g.pgn)
          .map((g) => ({
            id: g.id,
            white: g.players.white.user?.name ?? "Anonymous",
            black: g.players.black.user?.name ?? "Anonymous",
            whiteElo: g.players.white.rating ?? null,
            blackElo: g.players.black.rating ?? null,
            result: g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1" : "½-½",
            timeControl: g.clock ? `${g.clock.initial}+${g.clock.increment}` : g.speed,
            date: new Date(g.createdAt).toISOString().slice(0, 10),
            pgn: g.pgn!,
          }));
        return Response.json({ games: out });
      },
    },
  },
});
