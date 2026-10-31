import { useQuery } from "@tanstack/react-query";
import { Music2, Activity } from "lucide-react";
import { useSettings } from "@/lib/use-settings";

interface Presence {
  discord_user: { id: string; username: string; global_name?: string | null; avatar: string | null };
  discord_status: "online" | "idle" | "dnd" | "offline";
  activities: { id: string; name: string; type: number; details?: string; state?: string; emoji?: { name: string } }[];
  spotify: { song: string; artist: string; album_art_url: string } | null;
}

export function OwnerPresence() {
  const settings = useSettings();
  const id = settings.owner_discord_id;
  const { data, isPending, isError } = useQuery({
    queryKey: ["owner-presence", id],
    enabled: /^\d{17,20}$/.test(id),
    queryFn: async ({ signal }): Promise<Presence> => {
      const response = await fetch(`https://api.lanyard.rest/v1/users/${id}`, { signal });
      if (!response.ok) throw new Error("Presence unavailable");
      const result = await response.json() as { success: boolean; data: Presence };
      if (!result.success) throw new Error("Presence unavailable");
      return result.data;
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: 1,
  });
  if (!id) return null;
  const user = data?.discord_user;
  const avatar = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}?size=128`
    : settings.owner_avatar_url;
  const activity = data?.activities.find((a) => a.type !== 4 && a.type !== 2);
  const custom = data?.activities.find((a) => a.type === 4);
  const status = data?.discord_status;
  const statusColor = status === "online" ? "bg-success" : status === "idle" ? "bg-warning" : status === "dnd" ? "bg-destructive" : "bg-muted-foreground";
  return (
    <div className="flex w-full max-w-sm items-start gap-3 sm:justify-self-end" aria-label="Owner Discord presence">
      <div className="relative shrink-0">
        <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-surface text-primary">
          {avatar ? <img src={avatar} alt="Owner Discord avatar" className="h-full w-full object-cover" /> : <Activity className="h-5 w-5" />}
        </div>
        {status && <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background ${statusColor}`} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{user?.global_name || user?.username || settings.owner_name || "Owner"}</div>
        <div className="truncate text-xs text-muted-foreground">{user ? `@${user.username} · ${status === "dnd" ? "Do not disturb" : status}` : isError ? "Discord presence unavailable" : isPending ? "Connecting to Discord…" : "Discord"}</div>
        {data?.spotify ? <div className="mt-2 flex items-center gap-2 text-xs"><Music2 className="h-3.5 w-3.5 shrink-0 text-success" /><span className="min-w-0 truncate">{data.spotify.song} — {data.spotify.artist}</span></div> : activity ? <div className="mt-2 space-y-0.5 text-xs"><p className="truncate text-info">{activity.type === 0 ? "Playing" : activity.type === 1 ? "Streaming" : activity.type === 3 ? "Watching" : "Using"} {activity.name}</p>{activity.details && <p className="truncate text-muted-foreground">{activity.details}</p>}{activity.state && <p className="truncate text-muted-foreground">{activity.state}</p>}</div> : null}
        {custom?.state && <p className="mt-1 truncate text-xs text-muted-foreground">{custom.emoji?.name} {custom.state}</p>}
      </div>
    </div>
  );
}