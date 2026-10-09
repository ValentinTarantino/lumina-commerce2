import { NextResponse } from "next/server";
import { callPaymentService } from "@/lib/payment-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = await callPaymentService<{
      stripe: { enabled: boolean; publishableKey: string | null };
      mercadoPago: { enabled: boolean; publicKey: string | null };
    }>("/config");
    return NextResponse.json(config);
  } catch (error) {
    console.error("Could not load payment configuration:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la configuración de pagos." },
      { status: 503 },
    );
  }
}
