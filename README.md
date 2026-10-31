# Remix of Remix of Remix of Chess Game Review Studio

Act as a Principal Full-Stack Engineer and Lead UI/UX Designer specializing in web-based chess platforms. Build a production-grade, highly optimized, fully responsive Chess Game Review & Engine Analysis Web Application named "NafChessLog" inspired by Chess.com's Game Review and Lichess analysis.

---

### 1. CORE TECH STACK & ARCHITECTURE
- **Framework**: Next.js 14+ (App Router) or TanStack Start (React 19, TypeScript, Vite, Tailwind CSS v4)
- **UI & Components**: Tailwind CSS, Shadcn UI / Radix UI, Lucide Icons
- **Chess Engine & Logic**: `chess.js` (rule validation, FEN/PGN state) and `react-chessboard`
- **Charts**: Recharts (interactive evaluation advantage chart)
- **State Management**: Zustand or React Context with local storage / session storage persistence
- **Audio**: Web Audio API / HTML5 Audio playing move, capture, check, castle, promotion, and game-end sound effects.
- **Backend / Database**: Serverless API routes (or Server Functions) and a database (Supabase / PostgreSQL) for site settings and caching.

---

### 2. INPUT MODALITIES & GAME RETRIEVAL
Build an intuitive, tabbed game loader on the home page:
1. **Chess.com Import**:
   - Input: Username with placeholder: `Username (ex. MdNafimMuttaki)`
   - Backend Proxy (`/api/public/chesscom`): Fetches archives via `https://api.chess.com/pub/player/{username}/games/{yyyy}/{mm}` with a custom `User-Agent` header to prevent CORS and 403 blocks.
   - List recent 15–20 matches showing opponent name, ratings, time control, result, and date.
   - Session retention: Retain the entered username and fetched games list when navigating back from review ("New Game" or browser back).
2. **Lichess Import**:
   - Input: Username with placeholder: `Username (ex. MdNafimMuttaki)`
   - Backend Proxy (`/api/public/lichess`): Streams recent games from `https://lichess.org/api/games/user/{username}?max=15&pgnInJson=true`.
3. **PGN Paste & Upload**:
   - Direct text area supporting standard PGN format with headers (`[White "..."]`, `[Black "..."]`, `[WhiteElo "..."]`).
   - File drag-and-drop / upload (`.pgn`).
4. **FEN Input**:
   - Single position FEN input for custom starting-board analysis.

---

### 3. THREE-TIER HYBRID CHESS ENGINE ANALYSIS CASCADE
Engine analysis must run client-side to keep server costs near zero while achieving fast (10–20s) multi-move analysis:
- **Tier 1 (Instant Cache)**: Query Lichess Cloud Evaluation API (`https://lichess.org/api/cloud-eval?fen={encodedFen}`). Instant response for opening and popular positions.
- **Tier 2 (Parallel Cloud Engine)**: For cache misses, batch positions to `https://chess-api.com/v1` (Stockfish 16+) with depth configurable (default depth 16 or 18, range 10–18). Implement concurrency batching (4 concurrent requests), a 4-second timeout, and retries.
- **Tier 3 (Local Stockfish Worker Fallback)**: If network requests fail or time out, fallback to an in-browser `stockfish.js` Web Worker running at depth 10-30 (which can be changed through admin panel) so analysis never hangs.
- **Resilience**: Never hang on a single failed position. If all tiers fail on a move, mark evaluation as neutral (0.00 CP) and continue.

---

### 4. CHESS.COM-STYLE METRICS & CLASSIFICATIONS

#### A. Centipawn Loss (CPL) & Win Probability:
- Clamp evaluations between -1000 and +1000 centipawns.
- `CPL = clamp(Eval_best) - clamp(Eval_played)` from the active mover’s perspective.

#### B. Accuracy Formula:
- Calculate Average Centipawn Loss (ACPL) for White and Black.
- Compute Accuracy: `Accuracy = 100 * exp(-0.004 * ACPL)` rounded to 1 decimal place.

#### C. Performance Elo Estimation:
- Base formula: `RawElo = 3100 * exp(-0.01 * ACPL)`.
- When the player's actual rating is provided in PGN headers, blend the raw estimate with their real rating:
  `weight = clamp(movesPlayed / 40, 0.25, 0.60)`
  `BlendedElo = rating + (RawElo - rating) * weight`
  Constrain estimate within `[rating - 400, rating + 400]`, clamped globally between 400 and 3000.

#### D. Move Quality Classification:
1. **Book (📖)**: Move matches recognized ECO opening theory (database of 50+ common openings).
2. **Brilliant (!!)**: Sacrificing a piece of higher material value to a lower material value piece (or leaving it hanging undefended) while retaining positive engine advantage / no severe blunder.
3. **Great (!)**: Finding the only winning move or critical defensive move where alternative moves result in significant eval drop.
4. **Best (★)**: Move matches engine top choice or CPL == 0.
5. **Excellent (👍)**: CPL <= 15.
6. **Good (✓)**: CPL <= 35.
7. **Inaccuracy (?!)**: CPL <= 80.
8. **Mistake (?)**: CPL <= 200.
9. **Blunder (??)**: CPL > 200.

---

### 5. UI/UX & INTERACTIVE GAME REVIEW DASHBOARD

#### Layout:
- **Dark Modern Theme**: Chess.com / Lichess dark palette (slate/charcoal backgrounds `#18181b`, `#27272a`, accent green `#22c55e`, amber `#f59e0b`, red `#ef4444`, cyan `#06b6d4`).
- **Board Area**:
  - Evaluation Bar on the left showing visual bar height advantage and numerical score (`+1.4`, `-2.1`, `M3`).
  - Top & Bottom Player Info Cards: Display username, Elo rating, accuracy percentage, and estimated performance Elo badge above and below the board. Dynamic orientation based on active board flip.
  - Interactive board with legal move highlights, last-move indicator, arrow for engine recommended best move, and move classification badge overlay on the moved square (`!!`, `★`, `??`).
  - Controls: First `|<`, Previous `<`, Next `>`, Last `>|`, Auto-play toggle, and Flip Board button. Keyboard arrow navigation (Left/Right) enabled.
  - Audio triggers on move change (move, capture, check, castle).

#### Sidebar Tabs:
1. **Review Summary**:
   - Accuracy cards for White and Black side-by-side with circular or gauge progress.
   - Performance rating badge vs real rating badge.
   - Opening name and ECO code (e.g., "B90 Sicilian Defense: Najdorf Variation").
   - Move Quality Classification Table: Direct comparison grid of White vs Black counts for Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, and Blunder.
2. **Move List**:
   - Numbered move list with standard algebraic notation.
   - Move quality badges next to each move.
   - Engine evaluation tag and best move suggestion on mistakes/blunders.
   - Auto-scrolls to keep active move visible.
3. **Evaluation Chart**:
   - Interactive Recharts area chart showing advantage swing across move numbers.
   - Color-coded zero line; clicking any node on the chart immediately jumps the board to that move ply.

---

### 6. SITE SETTINGS & ADMIN CONTROLS
- Secure admin route (`/admin`) protected by an `ADMIN_PASSWORD` HMAC token.
- Single-row `site_settings` table:
  - Maintenance mode toggle (locks public routes with a maintenance gate banner).
  - Configurable engine depth slider (10 to 18, default 16).
  - Global announcement banner text and toggle.
  - Social / Discord link in footer.

---

### 7. CODE QUALITY & PRODUCTION READINESS
- Strict TypeScript typing across all engine types, PGN parsers, and game review state.
- Automated Vitest unit tests verifying accuracy math, centipawn loss clamping, and move categorization thresholds.
- Fast initial page load with zero server blocking.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c5c12fbb-50fd-42b7-92f6-24f5797d67c4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
