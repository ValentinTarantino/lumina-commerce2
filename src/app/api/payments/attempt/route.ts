import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { callPaymentService, PaymentServiceError } from "@/lib/payment-service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type PaymentProvider = "stripe" | "mercadopago";

type ExchangeQuote = {
  totalArs: string;
  exchangeRate: string;
  updatedAt: string;
  source: string;
  quoteId: string;
};

type ShippingDetails = {
  recipientName: string;
  phone: string;
  address: string;
  city: string;
  zipCode: string;
  additionalInfo: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") {
    throw new PaymentServiceError(`El campo ${field} es obligatorio.`, 400);
  }
  const text = value.trim();
  if (text.length < min || text.length > max) {
    throw new PaymentServiceError(`El campo ${field} no es válido.`, 400);
  }
  return text;
}

function readShipping(payload: Record<string, unknown>): ShippingDetails {
  const phone = readText(payload.phone, "teléfono", 8, 20);
  if (!/^\d+$/.test(phone)) {
    throw new PaymentServiceError("El teléfono solo debe contener números.", 400);
  }

  const additionalInfo =
    payload.additionalInfo === undefined || payload.additionalInfo === null
      ? null
      : readText(payload.additionalInfo, "instrucciones adicionales", 0, 500);

  return {
    recipientName: readText(payload.recipientName, "nombre", 3, 100),
    phone,
    address: readText(payload.address, "dirección", 5, 200),
    city: readText(payload.city, "ciudad", 2, 80),
    zipCode: readText(payload.zipCode, "código postal", 4, 20),
    additionalInfo,
  };
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
    if (!isRecord(body) || (body.provider !== "stripe" && body.provider !== "mercadopago")) {
      return NextResponse.json({ error: "Selecciona un medio de pago válido." }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
      return NextResponse.json({ error: "El carrito está vacío o no es válido." }, { status: 400 });
    }

    const quantities = new Map<string, number>();
    for (const item of body.items) {
      if (
        !isRecord(item) ||
        typeof item.id !== "string" ||
        !item.id.trim() ||
        typeof item.quantity !== "number" ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100
      ) {
        return NextResponse.json({ error: "Hay productos o cantidades no válidas." }, { status: 400 });
      }
      const productId = item.id.trim();
      const quantity = (quantities.get(productId) ?? 0) + item.quantity;
      if (quantity > 100) {
        return NextResponse.json({ error: "La cantidad solicitada supera el límite permitido." }, { status: 400 });
      }
      quantities.set(productId, quantity);
    }

    const shipping = readShipping(body);
    const provider = body.provider as PaymentProvider;
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    const products = await prisma.product.findMany({ where: { id: { in: [...quantities.keys()] } } });
    if (products.length !== quantities.size) {
      return NextResponse.json({ error: "Uno o más productos ya no están disponibles." }, { status: 409 });
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    let subtotalCents = 0;
    const items = [...quantities].map(([id, quantity]) => {
      const product = productMap.get(id);
      if (!product) {
        throw new PaymentServiceError("Uno o más productos ya no están disponibles.", 409);
      }
      if (product.stock < quantity) {
        throw new PaymentServiceError(`No hay stock suficiente de ${product.name}.`, 409);
      }
      const unitPriceCents = Math.round(product.price.toNumber() * 100);
      subtotalCents += unitPriceCents * quantity;
      return {
        id: product.id,
        name: product.name,
        image: product.image,
        price: unitPriceCents / 100,
        quantity,
      };
    });
    const subtotalUsd = subtotalCents / 100;
    const totalUsd = (subtotalCents + 2000) / 100;
    const reference = `PAY-${randomUUID().replace(/-/g, "")}`;

    let quote: ExchangeQuote | undefined;
    if (provider === "mercadopago") {
      quote = await callPaymentService<ExchangeQuote>("/quote", {
        reference,
        total_usd: totalUsd,
      });
    }

    const attempt = await prisma.paymentAttempt.create({
      data: {
        reference,
        provider,
        status: "PENDING",
        currency: provider === "stripe" ? "USD" : "ARS",
        subtotalUsd,
        totalUsd,
        totalArs: quote?.totalArs,
        exchangeRate: quote?.exchangeRate,
        quoteId: quote?.quoteId,
        items: items as Prisma.InputJsonValue,
        ...shipping,
        userId: user.id,
      },
    });

    if (provider === "mercadopago") {
      return NextResponse.json({
        attemptId: attempt.id,
        provider,
        reference,
        totalUsd,
        quoteId: quote?.quoteId,
        amount: Number(quote?.totalArs),
        currency: "ARS",
        exchangeRate: quote?.exchangeRate,
        exchangeRateUpdatedAt: quote?.updatedAt,
        exchangeRateSource: quote?.source,
      });
    }

    try {
      const intent = await callPaymentService<{ paymentIntentId: string; clientSecret: string }>(
        "/stripe/intent",
        { reference, total_usd: totalUsd, email: user.email },
      );
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { providerPaymentId: intent.paymentIntentId },
      });
      return NextResponse.json({
        attemptId: attempt.id,
        provider,
        reference,
        totalUsd,
        clientSecret: intent.clientSecret,
        amount: totalUsd,
        currency: "USD",
      });
    } catch (error) {
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: "FAILED" },
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Could not create payment attempt:", error);
    return NextResponse.json({ error: "No se pudo iniciar el pago." }, { status: 500 });
  }
}
