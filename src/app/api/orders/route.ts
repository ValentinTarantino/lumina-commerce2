import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Los pedidos solo se crean después de verificar el pago." },
    { status: 410 },
  );
}
