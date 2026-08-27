import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "./auth";

describe("signSession / verifySession", () => {
  it("verifies a token signed with the same secret", async () => {
    const token = await signSession("secret-a");
    expect(await verifySession(token, "secret-a")).toBe(true);
  });

  it("rejects a token verified against a different secret", async () => {
    const token = await signSession("secret-a");
    expect(await verifySession(token, "secret-b")).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const token = await signSession("secret-a");
    const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(await verifySession(tampered, "secret-a")).toBe(false);
  });

  it("produces a deterministic token for the same secret", async () => {
    const a = await signSession("secret-a");
    const b = await signSession("secret-a");
    expect(a).toBe(b);
  });
});
