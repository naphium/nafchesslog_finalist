import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { settingsSchema } from "./settings-schema";
export type { SiteSettings } from "./settings-schema";

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verifyToken(token: string) {
  const secret = process.env["ADMIN_PASSWORD"];
  if (!secret) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, `admin:${exp}`));
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const secret = process.env["ADMIN_PASSWORD"];
    if (!secret) return { ok: false as const, error: "Admin password not configured" };
    const a = await hmac("cmp", data.password);
    const b = await hmac("cmp", secret);
    if (!safeEqual(a, b)) return { ok: false as const, error: "Incorrect password" };
    const exp = String(Date.now() + 1000 * 60 * 60 * 12);
    return { ok: true as const, token: `${exp}.${await hmac(secret, `admin:${exp}`)}` };
  });

export const verifyAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => ({ ok: await verifyToken(data.token) }));

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().max(200),
        settings: settingsSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!(await verifyToken(data.token))) return { ok: false as const, error: "Session expired" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .update({ ...data.settings, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
