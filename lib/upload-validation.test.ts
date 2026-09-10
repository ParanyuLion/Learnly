import { describe, it, expect } from "vitest";
import {
  MAX_IMAGE_BYTES,
  validateImageFile,
  normalizeImageUrl,
  sanitizeFilename,
} from "./upload-validation";

describe("validateImageFile", () => {
  it("accepts an image under the size limit", () => {
    expect(validateImageFile({ type: "image/png", size: 1000 })).toBeNull();
  });

  it("accepts image/webp under the size limit", () => {
    expect(validateImageFile({ type: "image/webp", size: 1000 })).toBeNull();
  });

  it("rejects a non-image type", () => {
    expect(validateImageFile({ type: "application/pdf", size: 1000 })).toMatch(/รูป/);
  });

  it("rejects image/svg+xml", () => {
    expect(validateImageFile({ type: "image/svg+xml", size: 1000 })).toMatch(/รูป/);
  });

  it("rejects a file over the size limit", () => {
    expect(validateImageFile({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 })).toMatch(/4MB/);
  });

  it("accepts a file exactly at the size limit", () => {
    expect(validateImageFile({ type: "image/jpeg", size: MAX_IMAGE_BYTES })).toBeNull();
  });
});

describe("normalizeImageUrl", () => {
  it("returns a trimmed non-empty string unchanged", () => {
    expect(normalizeImageUrl("  https://x/y.png  ")).toBe("https://x/y.png");
  });

  it("returns null for an empty or whitespace string", () => {
    expect(normalizeImageUrl("")).toBeNull();
    expect(normalizeImageUrl("   ")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(normalizeImageUrl(undefined)).toBeNull();
    expect(normalizeImageUrl(null)).toBeNull();
    expect(normalizeImageUrl(42)).toBeNull();
  });
});

describe("sanitizeFilename", () => {
  it("replaces disallowed characters with underscores", () => {
    expect(sanitizeFilename("my photo (1).PNG")).toBe("my_photo__1_.PNG");
  });

  it("keeps letters, digits, dot, dash, underscore", () => {
    expect(sanitizeFilename("a-b_c.1.png")).toBe("a-b_c.1.png");
  });

  it("falls back to 'image' when nothing survives", () => {
    expect(sanitizeFilename("   ")).toBe("image");
  });
});
