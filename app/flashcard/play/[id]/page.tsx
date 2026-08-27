"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { shuffleCards, moveToBack, buildQuizChoices, type Card } from "@/lib/flashcard-game";
import { fetchJson } from "@/lib/fetch-json";
import styles from "./page.module.css";

const QUIZ_MAX_CHOICES = 5;
const QUIZ_ADVANCE_DELAY_MS = 800;

type PlayMode = "flip" | "quiz";

export default function PlayFlashcardSetPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("");
  const [sourceCards, setSourceCards] = useState<Card[] | null>(null);
  const [deck, setDeck] = useState<Card[] | null>(null);
  const [totalCards, setTotalCards] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<PlayMode>("flip");
  const [quizDeck, setQuizDeck] = useState<Card[] | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(0);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<{ title: string; cards: Card[] }>(`/api/flashcard-sets/${params.id}`)
      .then((data) => {
        setTitle(data.title);
        setSourceCards(data.cards);
        setTotalCards(data.cards.length);
        setDeck(shuffleCards(data.cards));
        setQuizDeck(shuffleCards(data.cards));
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  const currentQuizCard = quizDeck?.[0];

  // Memoized so the choice order stays stable while a question is on screen
  // (buildQuizChoices reshuffles internally, so calling it fresh every render
  // would make the buttons jump around while the user is looking at them).
  const quizChoices = useMemo(() => {
    if (!currentQuizCard || !sourceCards) return [];
    return buildQuizChoices(currentQuizCard, sourceCards, QUIZ_MAX_CHOICES);
  }, [currentQuizCard?.id, sourceCards]);

  const flipProgressed = deck !== null && deck.length < totalCards;
  const quizProgressed = quizAnswered > 0;
  const hasStarted = mode === "flip" ? flipProgressed : quizProgressed;

  function toggleMode() {
    if (hasStarted) return;
    setMode((m) => (m === "flip" ? "quiz" : "flip"));
  }

  function playAgain() {
    if (!sourceCards) return;
    setDeck(shuffleCards(sourceCards));
    setFlipped(false);
    setQuizDeck(shuffleCards(sourceCards));
    setQuizAnswered(0);
    setQuizCorrect(0);
    setSelectedChoice(null);
  }

  function markKnown() {
    setDeck((prev) => (prev ? prev.slice(1) : prev));
    setFlipped(false);
  }

  function markUnknown() {
    setDeck((prev) => (prev ? moveToBack(prev) : prev));
    setFlipped(false);
  }

  function selectQuizAnswer(choice: string) {
    if (!currentQuizCard || selectedChoice) return;
    const isCorrect = choice === currentQuizCard.back;
    setSelectedChoice(choice);
    if (isCorrect) setQuizCorrect((c) => c + 1);
    setTimeout(() => {
      setQuizDeck((prev) => (prev ? prev.slice(1) : prev));
      setQuizAnswered((a) => a + 1);
      setSelectedChoice(null);
    }, QUIZ_ADVANCE_DELAY_MS);
  }

  if (error) return <p className="error-banner">{error}</p>;
  if (!deck || !quizDeck) {
    return (
      <main className="page">
        <div className="page-header">
          <h1 className="page-title">
            <span className="skeleton" style={{ display: "inline-block", width: 160, height: 24 }} />
          </h1>
          <Link href="/" className="btn btn-ghost btn-sm">
            ← กลับหน้าแรก
          </Link>
        </div>
        <div className="skeleton" style={{ width: 80, height: 16, marginBottom: 12 }} />
        <div className={styles.cardStage}>
          <div className={`${styles.card} skeleton`} />
        </div>
        <div className={styles.actions}>
          <div className="skeleton" style={{ width: 120, height: 44, borderRadius: 14 }} />
          <div className="skeleton" style={{ width: 120, height: 44, borderRadius: 14 }} />
        </div>
      </main>
    );
  }

  const current = deck[0];
  const wonFlip = mode === "flip" && totalCards > 0 && deck.length === 0;
  const wonQuiz = mode === "quiz" && totalCards > 0 && quizDeck.length === 0;

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <Link href="/" className="btn btn-ghost btn-sm">
          ← กลับหน้าแรก
        </Link>
      </div>

      {totalCards > 0 && (
        <div className={styles.toolbar}>
          <div
            className={styles.modeSwitch}
            data-mode={mode}
            title={hasStarted ? "ล็อกโหมดแล้วหลังเริ่มเล่น" : undefined}
          >
            <button
              type="button"
              className={styles.modeLabel}
              data-active={mode === "flip"}
              onClick={() => mode !== "flip" && toggleMode()}
              disabled={hasStarted}
            >
              โหมดพลิกการ์ด
            </button>
            <button
              type="button"
              className={styles.modeTrack}
              onClick={toggleMode}
              disabled={hasStarted}
              role="switch"
              aria-checked={mode === "quiz"}
              aria-label="สลับโหมดการเล่น"
            >
              <span className={styles.modeThumb} />
            </button>
            <button
              type="button"
              className={styles.modeLabel}
              data-active={mode === "quiz"}
              onClick={() => mode !== "quiz" && toggleMode()}
              disabled={hasStarted}
            >
              โหมดควิซ
            </button>
          </div>
        </div>
      )}

      {wonFlip && (
        <div className={styles.winBanner}>
          <span>ยินดีด้วย! จำได้ครบทุกใบแล้ว 🎉</span>
          <button className="btn btn-primary btn-sm" onClick={playAgain}>
            เล่นอีกครั้ง
          </button>
        </div>
      )}
      {wonQuiz && (
        <div className={styles.winBanner}>
          <span>
            เล่นควิซจบแล้ว! ตอบถูก {quizCorrect} จาก {totalCards} ข้อ 🎉
          </span>
          <button className="btn btn-primary btn-sm" onClick={playAgain}>
            เล่นอีกครั้ง
          </button>
        </div>
      )}

      {mode === "flip" && !wonFlip && current && (
        <>
          <p className={styles.progress}>เหลือ {deck.length} ใบ</p>
          <div className={styles.cardStage}>
            <button
              className={styles.card}
              data-flipped={flipped}
              onClick={() => setFlipped((f) => !f)}
            >
              {flipped ? current.back : current.front}
            </button>
          </div>
          <div className={styles.actions}>
            <button className={`btn ${styles.dontKnowBtn}`} onClick={markUnknown}>
              ยังไม่จำ ✗
            </button>
            <button className={`btn ${styles.knowBtn}`} onClick={markKnown}>
              จำได้ ✓
            </button>
          </div>
        </>
      )}

      {mode === "quiz" && !wonQuiz && currentQuizCard && (
        <>
          <p className={styles.progress}>
            ข้อ {quizAnswered + 1} จาก {totalCards} (ถูก {quizCorrect})
          </p>
          <div className={styles.quizQuestion}>{currentQuizCard.front}</div>
          <div className={styles.quizChoices}>
            {quizChoices.map((choice) => {
              const isCorrectChoice = choice === currentQuizCard.back;
              const state = selectedChoice
                ? isCorrectChoice
                  ? "correct"
                  : selectedChoice === choice
                    ? "incorrect"
                    : undefined
                : undefined;
              return (
                <button
                  key={choice}
                  type="button"
                  className={styles.quizChoice}
                  data-state={state}
                  disabled={!!selectedChoice}
                  onClick={() => selectQuizAnswer(choice)}
                >
                  {choice}
                </button>
              );
            })}
          </div>
        </>
      )}

      {totalCards === 0 && (
        <div className="empty-state">
          <p>ชุดนี้ยังไม่มีการ์ด</p>
          <Link href={`/flashcard/edit/${params.id}`} className="btn btn-primary">
            เพิ่มการ์ด
          </Link>
        </div>
      )}
    </main>
  );
}
