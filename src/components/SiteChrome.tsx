import { Link, useRouterState } from "@tanstack/react-router";
import { Megaphone, Wrench, MessageCircle, ArrowUpRight, MapPin, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSettings } from "@/lib/use-settings";
import { Button } from "@/components/ui/button";
import { OwnerPresence } from "@/components/OwnerPresence";

function Logo() {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-xl text-primary-foreground glow">♞</span>
      <span className="truncate font-display text-sm font-bold sm:text-lg">
        Naf<span className="text-primary">Chess</span>Log
      </span>
    </Link>
  );
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const s = useSettings();
  const [failedAvatar, setFailedAvatar] = useState("");
  const path = useRouterState({ select: (r) => r.location.pathname });
  const locked = s.maintenance_mode && !path.startsWith("/admin");

  return (
    <div className="flex min-h-screen flex-col">
      {s.announcement_enabled && s.announcement_text && (
        <div className="flex items-center justify-center gap-2 bg-info/15 px-4 py-2 text-center text-sm text-info">
          <Megaphone className="h-4 w-4 shrink-0" /> {s.announcement_text}
        </div>
      )}
      <header className="site-header mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-4 sm:flex sm:justify-between sm:px-6 lg:px-10">
        <Logo />
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Button asChild variant={path === "/" ? "secondary" : "ghost"} size="sm" className="px-2 text-xs sm:px-3 sm:text-sm"><Link to="/">Load game</Link></Button>
          <Button asChild variant={path === "/review" ? "secondary" : "ghost"} size="sm" className="px-2 text-xs sm:px-3 sm:text-sm"><Link to="/review">Review</Link></Button>
        </nav>
      </header>
      <main className="flex-1">
        {locked ? (
          <div className="mx-auto mt-20 max-w-md panel p-8 text-center">
            <Wrench className="mx-auto h-10 w-10 text-warning" />
            <h1 className="mt-4 text-2xl font-bold">Down for maintenance</h1>
            <p className="mt-2 break-words text-sm text-muted-foreground">{s.maintenance_message}</p>
          </div>
        ) : (
          children
        )}
      </main>
      <footer className="mt-8 w-full border-t border-border bg-card/50">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-8 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-10">
          <div className="min-w-0">
            <Logo />
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">© NafChessLog<br />Engine analysis by Lichess cloud, chess-api.com & Stockfish</p>
            {s.discord_url && <Button asChild variant="outline" size="sm" className="mt-4"><a href={s.discord_url} target="_blank" rel="noreferrer"><MessageCircle /> Community <ArrowUpRight /></a></Button>}
          </div>
          {(s.owner_name || s.owner_discord_id) && <section aria-label="Owner information" className="min-w-0 md:justify-self-end md:max-w-md">
            <div className="mb-3 text-xs font-semibold text-primary">Behind NafChessLog</div>
            <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg border border-border bg-surface text-muted-foreground">
                {s.owner_avatar_url && failedAvatar !== s.owner_avatar_url ? <img src={s.owner_avatar_url} alt={s.owner_name} className="h-full w-full object-cover" onError={() => setFailedAvatar(s.owner_avatar_url)} /> : <UserRound className="h-6 w-6" />}
              </div>
              <div className="min-w-0 break-words">
                <h2 className="text-base font-semibold">{s.owner_name}</h2>
                {s.owner_title && <p className="mt-1 text-sm text-muted-foreground">{s.owner_title}</p>}
                {s.owner_location && <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{s.owner_location}</p>}
              </div>
            </div>
            {s.owner_bio && <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground">{s.owner_bio}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {s.owner_url && <Button asChild variant="ghost" size="sm" className="px-0"><a href={s.owner_url} target="_blank" rel="noreferrer">Website <ArrowUpRight /></a></Button>}
              {s.owner_chess_url && <Button asChild variant="ghost" size="sm"><a href={s.owner_chess_url} target="_blank" rel="noreferrer">Chess profile <ArrowUpRight /></a></Button>}
            </div>
            {s.owner_discord_id && <div className="mt-4 max-w-sm"><OwnerPresence /></div>}
          </section>}
        </div>
      </footer>
    </div>
  );
}
