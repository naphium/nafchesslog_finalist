import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";

export interface GameHeaders {
  white: string;
  black: string;
  whiteElo: number | null;
  blackElo: number | null;
  result: string;
  date: string;
  event: string;
  eco: string | null;
  opening: string | null;
  timeControl: string | null;
}

export interface Ply {
  san: string;
  uci: string;
  from: Square;
  to: Square;
  color: Color;
  fenBefore: string;
  fenAfter: string;
  flags: string;
  captured?: PieceSymbol | undefined;
  piece: PieceSymbol;
}

export interface LoadedGame {
  id: string;
  headers: GameHeaders;
  startFen: string;
  plies: Ply[];
}

const num = (v?: string) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : null;
};

export function parsePgn(pgn: string): LoadedGame {
  const chess = new Chess();
  chess.loadPgn(pgn.trim());
  const h = chess.getHeaders() as Partial<
    Record<"FEN" | "White" | "Black" | "WhiteElo" | "BlackElo" | "Result" | "Date" | "UTCDate" | "Event" | "ECO" | "Opening" | "TimeControl", string>
  >;
  const history = chess.history({ verbose: true });
  const startFen = h.FEN ?? history[0]?.before ?? new Chess().fen();
  return {
    id: `${h.White ?? "w"}-${h.Black ?? "b"}-${h.Date ?? ""}-${history.length}-${hash(pgn)}`,
    headers: {
      white: h.White ?? "White",
      black: h.Black ?? "Black",
      whiteElo: num(h.WhiteElo),
      blackElo: num(h.BlackElo),
      result: h.Result ?? "*",
      date: h.Date ?? h.UTCDate ?? "",
      event: h.Event ?? "",
      eco: h.ECO ?? null,
      opening: h.Opening ?? null,
      timeControl: h.TimeControl ?? null,
    },
    startFen,
    plies: history.map((m) => ({
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ""),
      from: m.from,
      to: m.to,
      color: m.color,
      fenBefore: m.before,
      fenAfter: m.after,
      flags: m.flags,
      captured: m.captured,
      piece: m.piece,
    })),
  };
}

export function fenOnly(fen: string): LoadedGame {
  const c = new Chess(fen.trim()); // throws on invalid
  return {
    id: `fen-${hash(fen)}`,
    headers: {
      white: "White",
      black: "Black",
      whiteElo: null,
      blackElo: null,
      result: "*",
      date: "",
      event: "Custom position",
      eco: null,
      opening: null,
      timeControl: null,
    },
    startFen: c.fen(),
    plies: [],
  };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** Did the mover leave the moved piece en prise (attacked by cheaper piece, or attacked & undefended)? */
export function isSacrifice(ply: Ply): boolean {
  if (ply.piece === "p" || ply.piece === "k") return false;
  const v = VALUE[ply.piece];
  if (ply.captured && VALUE[ply.captured] >= v) return false;
  const c = new Chess(ply.fenAfter);
  if (c.isCheckmate()) return false;
  const opp: Color = ply.color === "w" ? "b" : "w";
  const attackers = c.attackers(ply.to, opp);
  if (attackers.length === 0) return false;
  const gained = ply.captured ? VALUE[ply.captured] : 0;
  const cheapest = Math.min(...attackers.map((sq) => VALUE[c.get(sq)!.type]));
  if (cheapest < v - gained) return true;
  const defended = c.attackers(ply.to, ply.color).length > 0;
  return !defended && v - gained >= 2;
}
