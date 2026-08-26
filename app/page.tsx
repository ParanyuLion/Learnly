"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SetSummary = {
  id: string;
  title: string;
  createdAt: string;
  _count: { pairs: number };
};

export default function HomePage() {
  const [sets, setSets] = useState<SetSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/sets")
      .then((res) => res.json())
      .then(setSets);
  }, []);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>ชุดโจทย์ของฉัน</h1>
      <p>
        <Link href="/edit/new">+ สร้างชุดโจทย์ใหม่</Link>
      </p>
      {sets === null && <p>กำลังโหลด...</p>}
      {sets?.length === 0 && <p>ยังไม่มีชุดโจทย์ สร้างชุดแรกกันเลย</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {sets?.map((set) => (
          <li
            key={set.id}
            style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #ddd" }}
          >
            <span>
              {set.title} ({set._count.pairs} คู่)
            </span>
            <span>
              <Link href={`/play/${set.id}`}>เล่น</Link>
              {" | "}
              <Link href={`/edit/${set.id}`}>แก้ไข</Link>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
