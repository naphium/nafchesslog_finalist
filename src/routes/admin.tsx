import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, LogOut, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { adminLogin, updateSettings, verifyAdmin, type SiteSettings } from "@/lib/settings.functions";
import { settingsQuery, useSettings } from "@/lib/use-settings";
import { DEFAULT_SETTINGS } from "@/lib/use-settings";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — NafChessLog" },
      { name: "description", content: "Site settings for NafChessLog." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin — NafChessLog" },
      { property: "og:description", content: "Site settings for NafChessLog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

const TOKEN_KEY = "nafchesslog-admin";

function Admin() {
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const verify = useServerFn(verifyAdmin);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return setChecking(false);
    void verify({ data: { token: t } })
      .then((r) => (r.ok ? setToken(t) : localStorage.removeItem(TOKEN_KEY)))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setChecking(false));
  }, [verify]);

  if (checking)
    return (
      <div className="grid h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  return token ? (
    <SettingsForm
      token={token}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }}
    />
  ) : (
    <Login onToken={(t) => (localStorage.setItem(TOKEN_KEY, t), setToken(t))} />
  );
}

function Login({ onToken }: { onToken: (t: string) => void }) {
  const login = useServerFn(adminLogin);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mx-auto mt-16 max-w-sm panel space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await login({ data: { password: pw } }).catch((e: Error) => ({ ok: false as const, error: e.message }));
        setBusy(false);
        if (r.ok) onToken(r.token);
        else toast.error(r.error);
      }}
    >
      <Lock className="h-8 w-8 text-primary" />
      <h1 className="text-xl font-bold">Admin sign in</h1>
      <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Admin password" autoComplete="current-password" />
      <Button type="submit" className="w-full" disabled={busy || !pw}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Unlock
      </Button>
    </form>
  );
}

function SettingsForm({ token, onLogout }: { token: string; onLogout: () => void }) {
  const current = useSettings();
  const qc = useQueryClient();
  const save = useServerFn(updateSettings);
  const [s, setS] = useState<SiteSettings>(current);
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(current), [current]);
  const up = (p: Partial<SiteSettings>) => setS((x) => ({ ...x, ...p }));
  const textField = (id: "coach_name" | "coach_discord_id" | "coach_avatar_url" | "owner_name" | "owner_discord_id" | "owner_url" | "owner_title" | "owner_location" | "owner_avatar_url" | "owner_chess_url", title: string, placeholder: string) => (
    <div className="space-y-2"><Label htmlFor={id}>{title}</Label><Input id={id} value={s[id]} placeholder={placeholder} onChange={(e) => up({ [id]: e.target.value })} /></div>
  );

  return (
    <div className="mx-auto max-w-3xl px-3 pb-16 sm:px-4">
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">Site settings</h1>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
      <div className="divide-y divide-border border-y border-border">
        <section className="space-y-4 py-5">
          <h2 className="text-lg font-semibold">Move coach</h2>
          <Row title="Show coach" desc="Above the review summary."><Switch checked={s.coach_enabled} onCheckedChange={(v) => up({ coach_enabled: v })} /></Row>
          {textField("coach_name", "Coach name", "Coach")}
          {textField("coach_discord_id", "Discord user ID", "17–20 digit user ID")}
          <p className="text-xs text-warning">Discord is not connected. Automatic avatar lookup is unavailable.</p>
          {textField("coach_avatar_url", "Coach photo link (optional)", "https://…")}
          <div className="flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/15 text-primary">{s.coach_avatar_url ? <img src={s.coach_avatar_url} alt="Coach preview" className="h-full w-full object-cover" /> : "♞"}</span><span className="min-w-0 break-words text-sm">{s.coach_name}</span></div>
        </section>
        <section className="space-y-4 py-5">
          <h2 className="text-lg font-semibold">Owner information</h2>
          {textField("owner_name", "Owner name", "Name displayed in the footer")}
          {textField("owner_discord_id", "Owner Discord user ID", "17–20 digit user ID")}
          <p className="text-xs text-muted-foreground">Join the Lanyard Discord server at discord.gg/lanyard to share your live presence.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {textField("owner_title", "Title / role", "Your role")}
            {textField("owner_location", "Location", "City, country")}
          </div>
          <div className="space-y-2"><Label htmlFor="owner_bio">About the owner</Label><Textarea id="owner_bio" value={s.owner_bio} maxLength={300} onChange={(e) => up({ owner_bio: e.target.value })} /></div>
          {textField("owner_url", "Owner website / social link", "https://…")}
          {textField("owner_chess_url", "Chess profile link", "https://…")}
          {textField("owner_avatar_url", "Owner photo link", "https://…")}
        </section>
        <section className="py-5">
          <h2 className="mb-3 text-lg font-semibold">Review preferences</h2>
          <Row title="Sound by default" desc="Move sounds for new reviews."><Switch checked={s.default_sound} onCheckedChange={(v) => up({ default_sound: v })} /></Row>
          <Row title="Best-move arrows by default" desc="Engine suggestions on the board."><Switch checked={s.default_arrow} onCheckedChange={(v) => up({ default_arrow: v })} /></Row>
        </section>
        <Row title="Maintenance mode" desc="Locks public pages behind a maintenance notice.">
          <Switch checked={s.maintenance_mode} onCheckedChange={(v) => up({ maintenance_mode: v })} />
        </Row>
        <div className="space-y-2 py-5"><Label htmlFor="maintenance_message">Maintenance notice</Label><Textarea id="maintenance_message" value={s.maintenance_message} maxLength={500} onChange={(e) => up({ maintenance_message: e.target.value })} /></div>
        <div className="space-y-3 p-5">
          <div className="flex justify-between">
            <Label>Cloud engine depth</Label>
            <span className="tabular text-sm text-primary">{s.engine_depth}</span>
          </div>
          <Slider min={10} max={18} step={1} value={[s.engine_depth]} onValueChange={([v]) => up({ engine_depth: v ?? 16 })} />
        </div>
        <div className="space-y-3 p-5">
          <div className="flex justify-between">
            <Label>Local Stockfish depth (fallback)</Label>
            <span className="tabular text-sm text-primary">{s.local_depth}</span>
          </div>
          <Slider min={10} max={30} step={1} value={[s.local_depth]} onValueChange={([v]) => up({ local_depth: v ?? 14 })} />
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <Label>Announcement banner</Label>
            <Switch checked={s.announcement_enabled} onCheckedChange={(v) => up({ announcement_enabled: v })} />
          </div>
          <Textarea value={s.announcement_text} maxLength={500} onChange={(e) => up({ announcement_text: e.target.value })} placeholder="e.g. New: brilliant move detection!" />
        </div>
        <div className="space-y-2 p-5">
          <Label>Discord / community link</Label>
          <Input value={s.discord_url} onChange={(e) => up({ discord_url: e.target.value })} placeholder="https://discord.gg/…" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end"><Button variant="ghost" size="sm" onClick={() => setS(current)}>Discard changes</Button><Button variant="ghost" size="sm" onClick={() => setS(DEFAULT_SETTINGS)}>Reset to defaults</Button></div>
      <Button
        className="mt-6 w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await save({ data: { token, settings: s } }).catch((e: Error) => ({ ok: false as const, error: e.message }));
          setBusy(false);
          if (r.ok) {
            toast.success("Settings saved");
            await qc.invalidateQueries({ queryKey: settingsQuery.queryKey });
          } else toast.error(r.error);
          if (!r.ok && r.error === "Session expired") onLogout();
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
      </Button>
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-5">
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{desc}</div>
      </div>
      {children}
    </div>
  );
}
