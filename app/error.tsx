"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>เกิดข้อผิดพลาด</h1>
      <p>{error.message || "มีบางอย่างผิดพลาด"}</p>
      <button onClick={reset}>ลองใหม่</button>
    </main>
  );
}
