import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { verifyAndFinalizePayment } from "@/lib/confirm-payment";
import { callPaymentService, PaymentServiceError } from "@/lib/payment-service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "string" || value.length < min || value.length > max) {
    throw new PaymentServiceError(`El campo ${field} no es válido.`, 400);
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Debes iniciar sesión para pagar." }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "La solicitud no es JSON válido." }, { status: 400 });
    }
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Los datos del pago no son válidos." }, { status: 400 });
    }
    const token = readText(body.token, "token", 8, 500);
    const paymentMethodId = readText(body.payment_method_id, "medio de pago", 1, 80);
    const installments = body.installments;
    if (typeof installments !== "number" || !Number.isSafeInteger(installments) || installments < 1 || installments > 36) {
      throw new PaymentServiceError("La cantidad de cuotas no es válida.", 400);
    }
    const payer = isRecord(body.payer) ? body.payer : {};
    const identification = isRecord(payer.identification) ? payer.identification : {};
    const payerEmail = readText(payer.email ?? session.user.email, "email", 3, 254);
    const identificationType = readText(identification.type, "tipo de documento", 1, 30);
    const identificationNumber = readText(identification.number, "número de documento", 3, 30);
    const cardholderName = readText(body.cardholder_name, "titular de la tarjeta", 2, 100);
    const issuerId =
      body.issuer_id === undefined || body.issuer_id === null
        ? null
        : readText(body.issuer_id, "emisor", 1, 40);
    const attemptId = readText(body.attemptId, "intento de pago", 8, 100);

    const attempt = await prisma.paymentAttempt.findFirst({
      where: { id: attemptId, user: { email: session.user.email }, provider: "mercadopago" },
    });
    if (!attempt?.quoteId) {
      throw new PaymentServiceError("No se encontró una cotización válida para este pago.", 404);
    }
    if (attempt.status === "APPROVED") {
      const confirmed = await verifyAndFinalizePayment(attempt.id, attempt.userId);
      return NextResponse.json(confirmed, { status: confirmed.approved ? 200 : 202 });
    }
    if (attempt.status !== "PENDING" || attempt.providerPaymentId) {
      throw new PaymentServiceError("Este intento ya fue procesado. Inicia un nuevo pago.", 409);
    }

    const charge = await callPaymentService<{
      paymentId: string;
      status: string;
    }>("/mercadopago/charge", {
      reference: attempt.reference,
      quote_id: attempt.quoteId,
      total_usd: attempt.totalUsd.toNumber(),
      token,
      payment_method_id: paymentMethodId,
      installments,
      payer_email: payerEmail,
      identification_type: identificationType,
      identification_number: identificationNumber,
      cardholder_name: cardholderName,
      issuer_id: issuerId,
    });
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        providerPaymentId: charge.paymentId,
        status: "PROCESSING",
      },
    });

    const result = await verifyAndFinalizePayment(attempt.id, attempt.userId);
    return NextResponse.json(
      result.approved ? result : { ...result, status: charge.status },
      { status: result.approved ? 200 : 202 },
    );
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Could not charge Mercado Pago card:", error);
    return NextResponse.json({ error: "No se pudo procesar el pago." }, { status: 500 });
  }
}
