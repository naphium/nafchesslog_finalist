import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { settingsSchema } from "./settings-schema";
export type { SiteSettings } from "./settings-schema";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

/** Public: tells /admin whether the owner account has been claimed yet. */
export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return { adminExists: (count ?? 0) > 0 };
});

/**
 * Public: creates the one and only admin account. Sign-up is closed at the
 * auth level; this is the only path that creates a user. If an admin already
 * exists (or is created concurrently — enforced by a unique partial index),
 * the request is rejected.
 */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => credentialsSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countError) return { ok: false as const, error: countError.message };
    if ((count ?? 0) > 0) return { ok: false as const, error: "An admin account already exists" };

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createError) return { ok: false as const, error: createError.message };
    const user = created.user;
    if (!user) return { ok: false as const, error: "Could not create the account" };

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: user.id, role: "admin" });
    if (roleError) {
      // Unique partial index fired — an admin was created concurrently. Undo.
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return { ok: false as const, error: "An admin account already exists" };
    }
    return { ok: true as const };
  });

/** Authenticated: confirms the signed-in user holds the admin role. */
export const verifyAdminSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return { ok: false as const };
    return { ok: data === true };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        settings: settingsSchema,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) return { ok: false as const, error: "Not authorized" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .update({ ...data.settings, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
