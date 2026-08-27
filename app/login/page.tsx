"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await fetchJson("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const raw = params.get("from") || "/";
    const from = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
    router.push(from);
    router.refresh();
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">เข้าสู่ระบบ</h1>
      </div>
      {error && <p className="error-banner">{error}</p>}
      <input
        className="text-input"
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="รหัสผ่าน"
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={submit}>
          เข้าสู่ระบบ
        </button>
      </div>
    </main>
  );
}
