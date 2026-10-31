import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LoadedGame } from "./chess/game";
import type { GameReview } from "./chess/analyze";

export interface ListedGame {
  id: string;
  white: string;
  black: string;
  whiteElo: number | null;
  blackElo: number | null;
  result: string;
  timeControl: string;
  date: string;
  pgn: string;
}

export type LoaderTab = "chesscom" | "lichess" | "pgn" | "fen";

interface AppState {
  tab: LoaderTab;
  chesscomUser: string;
  chesscomGames: ListedGame[];
  lichessUser: string;
  lichessGames: ListedGame[];
  pgnText: string;
  fenText: string;
  game: LoadedGame | null;
  review: GameReview | null;
  set: (p: Partial<AppState>) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      tab: "chesscom",
      chesscomUser: "",
      chesscomGames: [],
      lichessUser: "",
      lichessGames: [],
      pgnText: "",
      fenText: "",
      game: null,
      review: null,
      set: (p) => set(p),
    }),
    {
      name: "nafchesslog-session",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: ({ set: _s, ...rest }) => rest,
    },
  ),
);

import { useEffect, useState } from "react";

/** True once the session store has rehydrated on the client. */
export function useStoreReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (useApp.persist.hasHydrated()) setReady(true);
    return useApp.persist.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}
