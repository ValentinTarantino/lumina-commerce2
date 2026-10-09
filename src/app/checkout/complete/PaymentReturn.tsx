"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useCart } from "@/store/useCart";

export default function PaymentReturn({ attemptId }: { attemptId: string }) {
  const clearCart = useCart((state) => state.clearCart);
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState("Verificando el pago...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!attemptId) return;
    let active = true;

    const verify = async () => {
      for (let retry = 0; retry < 12 && active; retry += 1) {
        try {
          const response = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId }),
          });
          const result = await response.json();
          if (result.success && typeof result.trackingId === "string") {
            if (active) {
              setOrderNumber(result.trackingId);
              setMessage("");
              clearCart();
            }
            return;
          }
          if (result.status === "rejected") {
            if (active) {
              setMessage("El pago fue rechazado. Vuelve a la tienda para iniciar otro intento.");
              setFailed(true);
            }
            return;
          }
          if (!response.ok && response.status !== 202) {
            throw new Error(result.error ?? "No se pudo verificar el pago.");
          }
        } catch (error) {
          if (active) {
            setMessage(error instanceof Error ? error.message : "No se pudo verificar el pago.");
            setFailed(true);
          }
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      if (active) {
        setMessage("El proveedor todavía está confirmando el pago. Vuelve a intentarlo en unos minutos.");
        setFailed(true);
      }
    };

    void verify();
    return () => {
      active = false;
    };
  }, [attemptId, clearCart]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020203] px-6 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center sm:p-12">
        {orderNumber ? (
          <>
            <CheckCircle2 className="mx-auto mb-6 h-14 w-14 text-emerald-400" />
            <h1 className="mb-3 text-3xl font-black uppercase italic">Pago confirmado</h1>
            <p className="mb-2 text-sm text-white/50">Tu pedido ya está en preparación.</p>
            <p className="mb-8 text-xl font-bold tracking-widest text-indigo-300">{orderNumber}</p>
            <Link href="/" className="premium-btn inline-flex min-w-48 justify-center px-6 py-4">
              Volver a la tienda
            </Link>
          </>
        ) : (
          <>
            {!failed && <LoaderCircle className="mx-auto mb-6 h-12 w-12 animate-spin text-indigo-400" />}
            <h1 className="mb-3 text-2xl font-black uppercase italic">
              {failed || !attemptId ? "Pago pendiente" : "Confirmando pago"}
            </h1>
            <p role={failed ? "alert" : "status"} className="mb-8 text-sm leading-relaxed text-white/50">
              {attemptId ? message : "No se recibió una referencia de pago válida."}
            </p>
            {(failed || !attemptId) && (
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <button onClick={() => window.location.reload()} className="premium-btn px-6 py-4">
                  Verificar nuevamente
                </button>
                <Link href="/" className="rounded-xl border border-white/10 px-6 py-4 text-sm font-bold text-white/70">
                  Volver a la tienda
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
