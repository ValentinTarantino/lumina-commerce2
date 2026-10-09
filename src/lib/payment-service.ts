export class PaymentServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function callPaymentService<T>(
  path: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const token = process.env.PAYMENTS_INTERNAL_TOKEN;
  if (!token) {
    throw new PaymentServiceError("El servicio de pagos no está configurado.", 503);
  }

  const baseUrl = (process.env.PAYMENTS_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/internal/payments${path}`, {
      method: payload ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(payload ? { "Content-Type": "application/json" } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("Payment service request failed:", error);
    throw new PaymentServiceError("No se pudo conectar con el servicio de pagos.", 503);
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch (error) {
    console.error("Payment service returned a non-JSON response:", error);
    throw new PaymentServiceError("El servicio de pagos devolvió una respuesta no válida.", 502);
  }

  if (!response.ok) {
    const detail =
      typeof result === "object" &&
      result !== null &&
      "detail" in result &&
      typeof result.detail === "string"
        ? result.detail
        : "El servicio de pagos rechazó la solicitud.";
    throw new PaymentServiceError(detail, response.status);
  }

  return result as T;
}
