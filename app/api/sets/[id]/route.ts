import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const set = await prisma.gameSet.findUnique({
    where: { id: params.id },
    include: { pairs: true },
  });

  if (!set) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(set);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const pairs = Array.isArray(body.pairs) ? body.pairs : null;

  if (!title || !pairs) {
    return NextResponse.json({ error: "title and pairs are required" }, { status: 400 });
  }

  for (const pair of pairs) {
    const left = typeof pair.left === "string" ? pair.left.trim() : "";
    const right = typeof pair.right === "string" ? pair.right.trim() : "";
    if (!left || !right) {
      return NextResponse.json({ error: "each pair needs left and right text" }, { status: 400 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.pair.deleteMany({ where: { setId: params.id } });
    return tx.gameSet.update({
      where: { id: params.id },
      data: {
        title,
        pairs: {
          create: pairs.map((p: { left: string; right: string }) => ({
            left: p.left.trim(),
            right: p.right.trim(),
          })),
        },
      },
      include: { pairs: true },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.gameSet.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
