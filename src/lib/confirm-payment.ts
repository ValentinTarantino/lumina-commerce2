import { randomUUID } from "node:crypto";
import { Prisma, type PaymentAttempt } from "@prisma/client";
import { callPaymentService, PaymentServiceError } from "@/lib/payment-service";
import { prisma } from "@/lib/prisma";

type PaymentItem = {
  id: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
};

export type PaymentConfirmation =
  | { approved: true; orderNumber: string; total: number; currency: string }
  | { approved: false; status: string };

function parsePaymentItems(value: Prisma.JsonValue): PaymentItem[] {
  if (!Array.isArray(value)) {
    throw new PaymentServiceError("El detalle de pago guardado no es válido.", 500);
  }

  return value.map((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item) ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.image !== "string" ||
      typeof item.price !== "number" ||
      typeof item.quantity !== "number"
    ) {
      throw new PaymentServiceError("El detalle de pago guardado no es válido.", 500);
    }
    return {
      id: item.id,
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
    };
  });
}

async function createOrderForApprovedPayment(attempt: PaymentAttempt) {
  const items = parsePaymentItems(attempt.items);
  const expectedCurrency = attempt.provider === "stripe" ? "USD" : "ARS";
  if (
    (attempt.provider !== "stripe" && attempt.provider !== "mercadopago") ||
    attempt.currency !== expectedCurrency
  ) {
    throw new PaymentServiceError("El proveedor o la moneda guardados no son válidos.", 500);
  }
  let total: number;
  if (attempt.currency === "ARS") {
    if (!attempt.totalArs) {
      throw new PaymentServiceError("Falta el total en pesos de este pago aprobado.", 500);
    }
    total = attempt.totalArs.toNumber();
  } else {
    total = attempt.totalUsd.toNumber();
  }
  const existing = await prisma.order.findUnique({
    where: { paymentAttemptId: attempt.id },
    select: { orderNumber: true, total: true, currency: true },
  });
  if (existing) return existing;

  const orderNumber = `LUM-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}-AR`;
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 5);
  const warrantyUntil = new Date();
  warrantyUntil.setFullYear(warrantyUntil.getFullYear() + 2);

  return prisma.$transaction(async (transaction) => {
    const claim = await transaction.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["PENDING", "PROCESSING", "APPROVED"] } },
      data: { status: "APPROVED" },
    });
    if (claim.count !== 1) {
      const alreadyCreated = await transaction.order.findUnique({
        where: { paymentAttemptId: attempt.id },
        select: { orderNumber: true, total: true, currency: true },
      });
      if (alreadyCreated) return alreadyCreated;
      throw new PaymentServiceError("Este intento de pago ya no puede confirmarse.", 409);
    }

    for (const item of [...items].sort((left, right) => left.id.localeCompare(right.id))) {
      const result = await transaction.product.updateMany({
        where: { id: item.id, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (result.count !== 1) {
        throw new PaymentServiceError(
          `El pago fue aprobado, pero no hay stock suficiente de ${item.name}. Contacta con soporte.`,
          409,
        );
      }
    }

    const order = await transaction.order.create({
      data: {
        orderNumber,
        user: { connect: { id: attempt.userId } },
        items: items as Prisma.InputJsonValue,
        total,
        currency: attempt.currency,
        address: attempt.address,
        recipientName: attempt.recipientName,
        phone: attempt.phone,
        city: attempt.city,
        zipCode: attempt.zipCode,
        additionalInfo: attempt.additionalInfo,
        deliveryDate,
        warrantyUntil,
        status: "PROCESANDO",
        paymentAttempt: { connect: { id: attempt.id } },
      },
      select: { orderNumber: true, total: true, currency: true },
    });
    return order;
  });
}

export async function verifyAndFinalizePayment(
  attemptId: string,
  userId: string,
): Promise<PaymentConfirmation> {
  const attempt = await prisma.paymentAttempt.findFirst({
    where: { id: attemptId, userId },
  });
  if (!attempt) {
    throw new PaymentServiceError("No se encontró el intento de pago.", 404);
  }

  const existingOrder = await prisma.order.findUnique({
    where: { paymentAttemptId: attempt.id },
    select: { orderNumber: true, total: true, currency: true },
  });
  if (existingOrder) return { approved: true, ...existingOrder };
  if (!attempt.providerPaymentId) {
    throw new PaymentServiceError("El proveedor todavía no creó el pago.", 409);
  }
  if (attempt.provider !== "stripe" && attempt.provider !== "mercadopago") {
    throw new PaymentServiceError("El proveedor guardado no es válido.", 500);
  }
  if (attempt.currency !== (attempt.provider === "stripe" ? "USD" : "ARS")) {
    throw new PaymentServiceError("La moneda guardada no coincide con el proveedor.", 500);
  }
  if (attempt.provider === "mercadopago" && !attempt.quoteId) {
    throw new PaymentServiceError("Falta la cotización asociada a este pago.", 500);
  }

  const result = attempt.provider === "stripe"
    ? await callPaymentService<{ status: string; approved: boolean }>("/stripe/verify", {
          reference: attempt.reference,
          payment_intent_id: attempt.providerPaymentId,
          total_usd: attempt.totalUsd.toNumber(),
        })
    : await callPaymentService<{ status: string; approved: boolean }>("/mercadopago/verify", {
          reference: attempt.reference,
          payment_id: attempt.providerPaymentId,
          quote_id: attempt.quoteId,
          total_usd: attempt.totalUsd.toNumber(),
        });

  if (!result.approved) {
    const status = result.status === "rejected" ? "REJECTED" : "PROCESSING";
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status } });
    return { approved: false, status: result.status };
  }

  const order = await createOrderForApprovedPayment(attempt);
  return { approved: true, ...order };
}
