import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/admin-config";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email?.trim().toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const [products, orders] = await Promise.all([
      prisma.product.findMany({
        orderBy: { id: "asc" },
        select: { id: true, name: true, category: true, stock: true },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          orderNumber: true,
          createdAt: true,
          status: true,
          total: true,
          currency: true,
          recipientName: true,
          city: true,
        },
      }),
    ]);

    return NextResponse.json({ products, orders }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error loading admin dashboard:", error);
    return NextResponse.json({ error: "No se pudo cargar el panel" }, { status: 500 });
  }
}
