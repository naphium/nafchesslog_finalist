import { z } from "zod";

const optionalUrl = z.union([z.literal(""), z.string().url().max(300)]).refine((s) => !s || s.startsWith("https://"), "Use an HTTPS link");
export const settingsSchema = z.object({
  maintenance_mode: z.boolean(),
  engine_depth: z.number().int().min(10).max(18),
  local_depth: z.number().int().min(10).max(30),
  announcement_enabled: z.boolean(),
  announcement_text: z.string().max(500),
  discord_url: optionalUrl,
  coach_enabled: z.boolean(),
  coach_name: z.string().trim().min(1).max(60),
  coach_discord_id: z.union([z.literal(""), z.string().regex(/^\d{17,20}$/, "Enter a valid Discord user ID")]),
  coach_avatar_url: optionalUrl,
  owner_name: z.string().max(100),
  owner_discord_id: z.union([z.literal(""), z.string().regex(/^\d{17,20}$/, "Enter a valid Discord user ID")]),
  owner_bio: z.string().max(300),
  owner_url: optionalUrl,
  owner_title: z.string().trim().max(100),
  owner_location: z.string().trim().max(100),
  owner_avatar_url: optionalUrl,
  owner_chess_url: optionalUrl,
  maintenance_message: z.string().max(500),
  default_sound: z.boolean(),
  default_arrow: z.boolean(),
});
export type SiteSettings = z.infer<typeof settingsSchema>;