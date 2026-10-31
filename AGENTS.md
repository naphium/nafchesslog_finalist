<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## NafChessLog architecture
- Engine analysis runs client-side in `src/lib/chess/engine.ts` (Lichess cloud → chess-api.com → Stockfish worker → neutral 0.00); keeps server cost near zero.
- Review math/thresholds live only in `src/lib/chess/metrics.ts` and are covered by `metrics.test.ts`; change both together.
- Site settings are a single row in `site_settings` (public read via RLS); writes only through `updateSettings` server fn after HMAC admin-token check keyed by ADMIN_PASSWORD.
- Loader + current game state persist in sessionStorage via zustand (`src/lib/store.ts`) so "New game"/back keeps fetched lists.
- Coach explanations are deterministic, client-side summaries of analyzed moves; do not claim positional details that are not available from move data.
- Validate public customization fields through the shared settings schema; owner links and avatar links accept HTTPS only to prevent unsafe public links.
- Scroll active moves by updating only the move-list container scrollTop; never use scrollIntoView because it also scrolls ancestor pages.
- Owner footer fields share the site-settings schema and query; keeping a single source ensures admin updates reach every page.
- Review uses a sticky board and adjacent analysis at medium desktop widths, then stacks on phones; this preserves the board as the primary workspace.
- Owner presence is fetched client-side from Lanyard using the validated owner settings ID; polling keeps public activity current without server costs.
- Interactive analysis uses a separate variation history and stale-result guards while sharing the review board; alternate moves never mutate the imported game or its review.
