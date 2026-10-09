import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { verifyAndFinalizePayment } from "@/lib/confirm-payment";
import { PaymentServiceError } from "@/lib/payment-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Debes iniciar sesión para confirmar el pago." }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "La solicitud no es JSON válido." }, { status: 400 });
    }
    if (
      typeof body !== "object" ||
      body === null ||
      !("attemptId" in body) ||
      typeof body.attemptId !== "string" ||
      body.attemptId.length < 8 ||
      body.attemptId.length > 100
    ) {
      return NextResponse.json({ error: "El intento de pago no es válido." }, { status: 400 });
    }

    const result = await verifyAndFinalizePayment(body.attemptId, session.user.id);
    if (!result.approved) {
      return NextResponse.json(
        { status: result.status, error: "El pago todavía no fue aprobado." },
        { status: 202 },
      );
    }
    return NextResponse.json({
      success: true,
      trackingId: result.orderNumber,
      total: result.total,
      currency: result.currency,
    });
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Could not confirm payment:", error);
    return NextResponse.json({ error: "No se pudo confirmar el pago." }, { status: 500 });
  }
}
