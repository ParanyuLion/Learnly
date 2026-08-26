import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sets = await prisma.gameSet.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pairs: true } } },
  });
  return NextResponse.json(sets);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const set = await prisma.gameSet.create({ data: { title } });
  return NextResponse.json(set, { status: 201 });
}
