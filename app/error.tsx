"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page">
      <h1 className="page-title">เกิดข้อผิดพลาด</h1>
      <p className="error-banner">{error.message || "มีบางอย่างผิดพลาด"}</p>
      <button className="btn btn-primary" onClick={reset}>
        ลองใหม่
      </button>
    </main>
  );
}
