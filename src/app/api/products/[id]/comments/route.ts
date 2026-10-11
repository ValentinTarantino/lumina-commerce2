import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/admin-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type CommentRow = { id: string; text: string; createdAt: Date; userName: string | null };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const comments = await prisma.$queryRaw<CommentRow[]>`
      SELECT c."id", c."text", c."createdAt", u."name" AS "userName"
      FROM "ProductComment" c
      JOIN "User" u ON u."id" = c."userId"
      WHERE c."productId" = ${id}
      ORDER BY c."createdAt" DESC
      LIMIT 50
    `;

    return NextResponse.json(
      comments.map(({ userName, ...comment }) => ({ ...comment, user: { name: userName } })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error fetching product comments:", error);
    return NextResponse.json({ error: "No se pudieron cargar los comentarios" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Inicia sesión para comentar" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (text.length < 2 || text.length > 600) {
      return NextResponse.json({ error: "El comentario debe tener entre 2 y 600 caracteres" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const [comment] = await prisma.$queryRaw<CommentRow[]>`
      WITH inserted AS (
        INSERT INTO "ProductComment" ("id", "text", "productId", "userId")
        VALUES (${randomUUID()}, ${text}, ${id}, ${session.user.id})
        RETURNING "id", "text", "createdAt", "userId"
      )
      SELECT inserted."id", inserted."text", inserted."createdAt", u."name" AS "userName"
      FROM inserted
      JOIN "User" u ON u."id" = inserted."userId"
    `;
    if (!comment) throw new Error("Comment insert returned no row");

    const { userName, ...commentData } = comment;
    return NextResponse.json({ ...commentData, user: { name: userName } }, { status: 201 });
  } catch (error) {
    console.error("Error creating product comment:", error);
    return NextResponse.json({ error: "No se pudo publicar el comentario" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email?.trim().toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id: productId } = await params;
    const commentId = new URL(request.url).searchParams.get("commentId");
    if (!commentId) {
      return NextResponse.json({ error: "Comentario no válido" }, { status: 400 });
    }

    const deleted = await prisma.$executeRaw`
      DELETE FROM "ProductComment"
      WHERE "id" = ${commentId} AND "productId" = ${productId}
    `;
    if (deleted === 0) {
      return NextResponse.json({ error: "Comentario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product comment:", error);
    return NextResponse.json({ error: "No se pudo eliminar el comentario" }, { status: 500 });
  }
}
