import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const set = await prisma.flashcardSet.findUnique({
    where: { id: params.id },
    include: { cards: true },
  });

  if (!set) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(set);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const rawCards = Array.isArray(body.cards) ? body.cards : null;

  if (!title || !rawCards) {
    return NextResponse.json({ error: "title and cards are required" }, { status: 400 });
  }

  const cards: { front: string; back: string }[] = [];

  for (const c of rawCards) {
    const front = typeof c.front === "string" ? c.front.trim() : "";
    const back = typeof c.back === "string" ? c.back.trim() : "";

    if (!front || !back) {
      return NextResponse.json(
        { error: "each card needs a non-blank front and back" },
        { status: 400 }
      );
    }

    cards.push({ front, back });
  }

  if (cards.length === 0) {
    return NextResponse.json({ error: "at least 1 card is required" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.flashcard.deleteMany({ where: { setId: params.id } });

    return tx.flashcardSet.update({
      where: { id: params.id },
      data: {
        title,
        cards: { create: cards },
      },
      include: { cards: true },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.flashcardSet.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
