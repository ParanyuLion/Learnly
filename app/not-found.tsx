import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <h1 className="page-title">ไม่พบหน้านี้</h1>
      <p>
        <Link href="/" className="btn btn-primary">
          กลับหน้าแรก
        </Link>
      </p>
    </main>
  );
}
