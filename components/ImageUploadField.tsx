"use client";

import { useRef, useState } from "react";
import { validateImageFile } from "@/lib/upload-validation";
import styles from "./ImageUploadField.module.css";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
};

export function ImageUploadField({ value, onChange, label = "รูปภาพ" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `อัปโหลดไม่สำเร็จ (${res.status})`);
      }
      onChange(body.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {value ? (
        <div className={styles.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className={styles.thumb} />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onChange(null)}
            disabled={uploading}
          >
            ✕ ลบรูป
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "กำลังอัปโหลด..." : "+ เพิ่มรูป"}
        </button>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
