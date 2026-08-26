"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetch-json";
import styles from "./page.module.css";

type SetSummary = {
  id: string;
  title: string;
  createdAt: string;
  _count: { pairs: number };
};

const ACCENTS = ["coral", "mint", "lavender", "yellow"] as const;

export default function HomePage() {
  const [sets, setSets] = useState<SetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<SetSummary[]>("/api/sets")
      .then(setSets)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">ชุดโจทย์ของฉัน</h1>
        <Link href="/edit/new" className="btn btn-primary">
          + สร้างชุดใหม่
        </Link>
      </div>

      {error && <p className="error-banner">{error}</p>}
      {sets === null && !error && <p>กำลังโหลด...</p>}
      {sets?.length === 0 && (
        <div className="empty-state">
          <p>ยังไม่มีชุดโจทย์ สร้างชุดแรกกันเลย</p>
        </div>
      )}

      <div className={styles.grid}>
        {sets?.map((set, i) => (
          <div key={set.id} className={styles.card}>
            <div className={styles.cardTop} data-accent={ACCENTS[i % ACCENTS.length]} />
            <div className={styles.cardBody}>
              <span className={styles.cardTitle}>{set.title}</span>
              <span className="badge">{set._count.pairs} คู่</span>
              <div className={styles.cardActions}>
                <Link href={`/play/${set.id}`} className="btn btn-primary btn-sm">
                  เล่น
                </Link>
                <Link href={`/edit/${set.id}`} className="btn btn-outline btn-sm">
                  แก้ไข
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
