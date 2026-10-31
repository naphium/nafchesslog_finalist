import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SiteSettings } from "./settings.functions";

export const DEFAULT_SETTINGS: SiteSettings = {
  maintenance_mode: false,
  engine_depth: 16,
  local_depth: 14,
  announcement_enabled: false,
  announcement_text: "",
  discord_url: "",
  coach_enabled: true,
  coach_name: "Coach",
  coach_discord_id: "",
  coach_avatar_url: "",
  owner_name: "",
  owner_discord_id: "",
  owner_bio: "",
  owner_url: "",
  owner_title: "",
  owner_location: "",
  owner_avatar_url: "",
  owner_chess_url: "",
  maintenance_message: "NafChessLog is getting tuned up. Please check back shortly.",
  default_sound: true,
  default_arrow: true,
};

export const settingsQuery = {
  queryKey: ["site_settings"],
  queryFn: async (): Promise<SiteSettings> => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("maintenance_mode,engine_depth,local_depth,announcement_enabled,announcement_text,discord_url,coach_enabled,coach_name,coach_discord_id,coach_avatar_url,owner_name,owner_discord_id,owner_bio,owner_url,owner_title,owner_location,owner_avatar_url,owner_chess_url,maintenance_message,default_sound,default_arrow")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return DEFAULT_SETTINGS;
    return data;
  },
  staleTime: 60_000,
};

/** Non-blocking: renders with defaults until the settings arrive. */
export function useSettings(): SiteSettings {
  const { data } = useQuery(settingsQuery);
  return data ?? DEFAULT_SETTINGS;
}
