import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>ไม่พบหน้านี้</h1>
      <p>
        <Link href="/">กลับหน้าแรก</Link>
      </p>
    </main>
  );
}
