import { describe, expect, it } from "vitest";
import { settingsSchema } from "./settings-schema";

describe("admin coach configuration", () => {
  it("accepts an optional owner Discord ID without rounding", () => {
    const field = settingsSchema.shape.owner_discord_id;
    expect(field.parse("123456789012345678")).toBe("123456789012345678");
    expect(field.parse("")).toBe("");
    expect(field.safeParse("not-an-id").success).toBe(false);
  });
  const field = settingsSchema.shape.coach_discord_id;
  it("preserves a Discord ID as a string without rounding", () => {
    expect(field.parse("123456789012345678")).toBe("123456789012345678");
    expect(field.safeParse("not-an-id").success).toBe(false);
  });
  it("does not allow unsafe owner links", () => {
    expect(settingsSchema.shape.owner_url.safeParse("javascript:alert(1)").success).toBe(false);
    expect(settingsSchema.shape.owner_url.safeParse("https://example.com").success).toBe(true);
  });
  it("allows owner title and location without requiring them", () => {
    expect(settingsSchema.shape.owner_title.parse("Chess enthusiast")).toBe("Chess enthusiast");
    expect(settingsSchema.shape.owner_location.parse("Dhaka")).toBe("Dhaka");
    expect(settingsSchema.shape.owner_title.parse("")).toBe("");
  });
  it("accepts only HTTPS for owner photos", () => {
    expect(settingsSchema.shape.owner_avatar_url.safeParse("http://example.com/avatar.png").success).toBe(false);
    expect(settingsSchema.shape.owner_avatar_url.parse("https://example.com/avatar.png")).toBe("https://example.com/avatar.png");
  });
  it("accepts only HTTPS for owner chess profiles", () => {
    expect(settingsSchema.shape.owner_chess_url.safeParse("javascript:alert(1)").success).toBe(false);
    expect(settingsSchema.shape.owner_chess_url.parse("https://lichess.org/@/player")).toBe("https://lichess.org/@/player");
  });
});