import { useQuery } from "@tanstack/react-query";
import { Music2, Activity, UserRound } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/lib/use-settings";

interface Presence {
  discord_user: { id: string; username: string; global_name?: string | null; avatar: string | null };
  discord_status: "online" | "idle" | "dnd" | "offline";
  activities: { id: string; name: string; type: number; details?: string; state?: string; emoji?: { name: string } }[];
  spotify: { song: string; artist: string; album_art_url: string } | null;
}

export function OwnerPresence({ variant = "compact" }: { variant?: "compact" | "footer" }) {
  const settings = useSettings();
  const [failedAvatar, setFailedAvatar] = useState("");
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
  if (!id && variant === "compact") return null;
  const user = data?.discord_user;
  const avatar = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}?size=128`
    : settings.owner_avatar_url;
  const activities = data?.activities.filter((a) => a.type !== 4 && !(a.type === 2 && data.spotify)) ?? [];
  const custom = data?.activities.find((a) => a.type === 4);
  const status = data?.discord_status;
  const statusColor = status === "online" ? "bg-success" : status === "idle" ? "bg-warning" : status === "dnd" ? "bg-destructive" : "bg-muted-foreground";
  return (
    <div className="flex w-full min-w-0 items-start gap-3" aria-label={id ? "Owner Discord presence" : "Owner profile"}>
      <div className="relative shrink-0">
        <div className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface text-primary ${variant === "footer" ? "h-14 w-14" : "h-12 w-12"}`}>
          {avatar && failedAvatar !== avatar ? <img src={avatar} alt="Owner avatar" className="h-full w-full object-cover" onError={() => setFailedAvatar(avatar)} /> : id ? <Activity className="h-5 w-5" /> : <UserRound className="h-6 w-6" />}
        </div>
        {status && <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background ${statusColor}`} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`break-words font-semibold ${variant === "footer" ? "text-lg" : "text-sm"}`}>{(variant === "footer" && settings.owner_name) || user?.global_name || user?.username || "Owner"}</div>
        {variant === "footer" && settings.owner_title && <p className="mt-0.5 break-words text-sm text-muted-foreground">{settings.owner_title}</p>}
        {id && <div className="mt-1 break-words text-xs text-muted-foreground" role="status">{user ? `@${user.username} · ${status === "dnd" ? "Do not disturb" : status === "idle" ? "Idle" : status === "online" ? "Online" : "Offline"}` : isError ? "Discord presence unavailable" : isPending ? "Connecting to Discord…" : "Discord"}</div>}
        {data?.spotify && <div className="mt-3 flex min-w-0 items-center gap-2.5 border-l-2 border-success pl-3"><Music2 className="h-4 w-4 shrink-0 text-success" /><div className="min-w-0 text-xs"><p className="font-semibold text-success">Listening to Spotify</p><p className="mt-0.5 break-words text-foreground">{data.spotify.song}</p><p className="break-words text-muted-foreground">{data.spotify.artist}</p></div></div>}
        {(variant === "footer" ? activities : activities.slice(0, 1)).map((activity) => <div key={activity.id} className="mt-3 space-y-0.5 border-l-2 border-info pl-3 text-xs"><p className="break-words font-semibold text-info">{activity.type === 0 ? "Playing" : activity.type === 1 ? "Streaming" : activity.type === 2 ? "Listening to" : activity.type === 3 ? "Watching" : activity.type === 5 ? "Competing in" : "Using"} {activity.name}</p>{activity.details && <p className="break-words text-foreground">{activity.details}</p>}{activity.state && <p className="break-words text-muted-foreground">{activity.state}</p>}</div>)}
        {custom?.state && <p className="mt-2 break-words text-xs text-muted-foreground">{custom.emoji?.name} {custom.state}</p>}
      </div>
    </div>
  );
}