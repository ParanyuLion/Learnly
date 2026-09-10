export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith("image/")) return "ไฟล์ต้องเป็นรูปภาพ";
  if (file.size > MAX_IMAGE_BYTES) return "ไฟล์ใหญ่เกิน 4MB";
  return null;
}

export function normalizeImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, "_");
  return cleaned.replace(/^_+$/, "") === "" ? "image" : cleaned;
}
