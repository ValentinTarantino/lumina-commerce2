import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/admin-config";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email?.trim().toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "El cuerpo de la solicitud no es válido" }, { status: 400 });
    }

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("stock" in payload) ||
      typeof payload.stock !== "number" ||
      !Number.isSafeInteger(payload.stock) ||
      payload.stock < 0 ||
      payload.stock > 100_000
    ) {
      return NextResponse.json({ error: "El stock debe ser un entero entre 0 y 100000" }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: { stock: payload.stock },
      select: { id: true, name: true, category: true, stock: true },
    });

    return NextResponse.json({ product });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    console.error("Error updating product stock:", error);
    return NextResponse.json({ error: "No se pudo actualizar el stock" }, { status: 500 });
  }
}
