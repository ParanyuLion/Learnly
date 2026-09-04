import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const set = await prisma.sortSet.findUnique({
    where: { id: params.id },
    include: { categories: true, items: true },
  });

  if (!set) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: set.id,
    title: set.title,
    categories: set.categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
    items: set.items.map((i) => ({ id: i.id, text: i.text, categoryId: i.categoryId })),
  });
}

type CategoryTreeInput = {
  name: string;
  items: string[];
  children: CategoryTreeInput[];
};

function parseCategoryTree(raw: unknown): CategoryTreeInput[] | null {
  if (!Array.isArray(raw)) return null;

  const result: CategoryTreeInput[] = [];
  for (const node of raw) {
    const name = typeof node?.name === "string" ? node.name.trim() : "";
    const items = Array.isArray(node?.items)
      ? node.items.map((t: unknown) => (typeof t === "string" ? t.trim() : "")).filter(Boolean)
      : [];
    const children = parseCategoryTree(node?.children ?? []);

    if (!name || children === null) return null;

    result.push({ name, items, children });
  }
  return result;
}

function collectLeaves(tree: CategoryTreeInput[]): CategoryTreeInput[] {
  return tree.flatMap((node) => (node.children.length === 0 ? [node] : collectLeaves(node.children)));
}

function validateTree(tree: CategoryTreeInput[]): string | null {
  for (const node of tree) {
    if (node.children.length > 0 && node.items.length > 0) {
      return `category "${node.name}" cannot have both items and subcategories`;
    }
    if (node.children.length === 0 && node.items.length === 0) {
      return `leaf category "${node.name}" needs at least one item`;
    }
    const childError = validateTree(node.children);
    if (childError) return childError;
  }
  return null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const tree = parseCategoryTree(body.categories);

  if (!title || !tree) {
    return NextResponse.json({ error: "title and categories are required" }, { status: 400 });
  }

  const treeError = validateTree(tree);
  if (treeError) {
    return NextResponse.json({ error: treeError }, { status: 400 });
  }

  if (collectLeaves(tree).length < 2) {
    return NextResponse.json({ error: "at least 2 leaf categories are required" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.sortCategory.deleteMany({ where: { setId: params.id } });

    async function createNode(node: CategoryTreeInput, parentId: string | null) {
      const category = await tx.sortCategory.create({
        data: {
          name: node.name,
          setId: params.id,
          parentId,
          items:
            node.items.length > 0
              ? { create: node.items.map((text) => ({ text, setId: params.id })) }
              : undefined,
        },
      });

      for (const child of node.children) {
        await createNode(child, category.id);
      }
    }

    for (const node of tree) {
      await createNode(node, null);
    }

    return tx.sortSet.update({
      where: { id: params.id },
      data: { title },
      include: { categories: true, items: true },
    });
  });

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    categories: updated.categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
    items: updated.items.map((i) => ({ id: i.id, text: i.text, categoryId: i.categoryId })),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.sortSet.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
