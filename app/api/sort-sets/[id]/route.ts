import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const set = await prisma.sortSet.findUnique({
    where: { id: params.id },
    include: { categories: { include: { items: true } } },
  });

  if (!set) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(set);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const rawCategories = Array.isArray(body.categories) ? body.categories : null;

  if (!title || !rawCategories) {
    return NextResponse.json({ error: "title and categories are required" }, { status: 400 });
  }

  const categories: { name: string; items: string[] }[] = [];

  for (const cat of rawCategories) {
    const name = typeof cat.name === "string" ? cat.name.trim() : "";
    const items = Array.isArray(cat.items)
      ? cat.items.map((t: unknown) => (typeof t === "string" ? t.trim() : "")).filter(Boolean)
      : [];

    if (!name || items.length === 0) {
      return NextResponse.json(
        { error: "each category needs a name and at least one item" },
        { status: 400 }
      );
    }

    categories.push({ name, items });
  }

  if (categories.length < 2) {
    return NextResponse.json({ error: "at least 2 categories are required" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.sortCategory.deleteMany({ where: { setId: params.id } });

    return tx.sortSet.update({
      where: { id: params.id },
      data: {
        title,
        categories: {
          create: categories.map((cat) => ({
            name: cat.name,
            items: {
              create: cat.items.map((text) => ({ text, setId: params.id })),
            },
          })),
        },
      },
      include: { categories: { include: { items: true } } },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.sortSet.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
