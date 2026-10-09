import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: "asc" },
    });

    return NextResponse.json(
      products.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price.toNumber(),
        image: product.image,
        category: product.category,
        description: product.description,
        description_en: product.descriptionEn,
        stock: product.stock,
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "No se pudo cargar el catálogo" },
      { status: 500 },
    );
  }
}
