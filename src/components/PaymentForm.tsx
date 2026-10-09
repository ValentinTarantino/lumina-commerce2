"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import type { ComponentProps } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

type PaymentResult = {
  attemptId: string;
  trackingId: string;
};

type MercadoPagoFormData = Parameters<
  NonNullable<ComponentProps<typeof CardPayment>["onSubmit"]>
>[0];

let initializedMercadoPagoKey: string | null = null;

type PaymentFormProps = {
  attemptId: string;
  clientSecret?: string;
  publishableKey?: string;
  publicKey?: string;
  amount: number;
  email: string;
  lang: "es" | "en";
  onSuccess: (result: PaymentResult) => void;
  onError: (message: string) => void;
  onPending?: () => void;
};

async function confirmPayment(attemptId: string): Promise<PaymentResult> {
  const response = await fetch("/api/payments/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error ?? "No se pudo confirmar el pago.");
  }
  if (!result.success || typeof result.trackingId !== "string") {
    throw new Error(
      result.status === "rejected"
        ? "El proveedor rechazó el pago."
        : "PAYMENT_PENDING",
    );
  }
  return { attemptId, trackingId: result.trackingId };
}

async function waitForPaymentApproval(
  attemptId: string,
  spanish: boolean,
): Promise<PaymentResult> {
  for (let retry = 0; retry < 12; retry += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      return await confirmPayment(attemptId);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "PAYMENT_PENDING") throw error;
    }
  }
  throw new Error(spanish
    ? "El pago sigue pendiente. Puedes verificar su estado más tarde."
    : "The payment is still pending. You can check its status later.");
}

function StripeForm({
  attemptId,
  cardholderName,
  onCardholderNameChange,
  lang,
  onSuccess,
  onError,
}: Pick<PaymentFormProps, "attemptId" | "onSuccess" | "onError" | "lang"> & {
  cardholderName: string;
  onCardholderNameChange: (value: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const spanish = lang === "es";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/complete?attemptId=${encodeURIComponent(attemptId)}`,
          payment_method_data: {
            billing_details: { name: cardholderName.trim() },
          },
        },
        redirect: "if_required",
      });
      if (result.error) {
        onError(result.error.message ?? (spanish ? "No se pudo procesar la tarjeta." : "The card could not be processed."));
        return;
      }
      if (result.paymentIntent?.status !== "succeeded") {
        onError(spanish
          ? "El pago todavía no fue aprobado. Verifica los datos o intenta con otra tarjeta."
          : "The payment has not been approved. Check the details or try another card.");
        return;
      }
      onSuccess(await confirmPayment(attemptId));
    } catch (error) {
      onError(error instanceof Error ? error.message : spanish ? "No se pudo confirmar el pago." : "The payment could not be confirmed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/50">
        {spanish ? "Titular de la tarjeta" : "Cardholder name"}
      </label>
      <input
        autoComplete="cc-name"
        value={cardholderName}
        onChange={(event) => onCardholderNameChange(event.target.value)}
        className="mb-5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none focus:border-indigo-500/50"
        required
      />
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
          <p className="font-bold mb-1">
            {spanish ? "¡Modo de demostración activo!" : "Demo mode active!"}
          </p>
          <p>
            {spanish 
              ? "Para simular un pago exitoso, ingresa la tarjeta " 
              : "To simulate a successful payment, enter the card "}
            <strong className="tracking-widest bg-indigo-500/20 px-1 rounded text-indigo-200 select-all cursor-pointer">4242 4242 4242 4242</strong>
            <br/>
            {spanish 
              ? "con cualquier fecha futura y CVC." 
              : "with any future date and CVC."}
          </p>
        </div>
        <PaymentElement />
        <button
          type="submit"
          disabled={!stripe || !elements || submitting || cardholderName.trim().length < 2}
          className="premium-btn w-full h-14 disabled:opacity-50"
        >
          {submitting
            ? (spanish ? "Procesando pago..." : "Processing payment...")
            : (spanish ? "Pagar con Stripe" : "Pay with Stripe")}
        </button>
      </form>
    </div>
  );
}

export default function PaymentForm(props: PaymentFormProps) {
  const {
    attemptId,
    clientSecret,
    publishableKey,
    publicKey,
    amount,
    email,
    lang,
    onSuccess,
    onError,
    onPending,
  } = props;
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );
  const [mercadoPagoReady, setMercadoPagoReady] = useState(false);
  const [cardholderName, setCardholderName] = useState("");
  const spanish = lang === "es";

  const mercadoPagoInitialization = useMemo(
    () => ({ amount, payer: { email } }),
    [amount, email]
  );

  const mercadoPagoCustomization = useMemo(
    () => ({
      visual: {
        style: {
          theme: "dark",
          customVariables: {
            formBackgroundColor: "#171717",
            baseColor: "#4f46e5",
            buttonTextColor: "#ffffff",
            buttonBackgroundColor: "#4f46e5"
          }
        }
      },
      paymentMethods: {
        maxInstallments: 1,
      }
    }),
    []
  );

  const mpRefs = useRef({ onSuccess, onError, onPending, attemptId, spanish, cardholderName });
  useEffect(() => {
    mpRefs.current = { onSuccess, onError, onPending, attemptId, spanish, cardholderName };
  });

  const handleMercadoPagoSubmit = useCallback(async (formData: MercadoPagoFormData) => {
    const { onSuccess, onError, onPending, attemptId, spanish } = mpRefs.current;
    try {
      const mpName = (formData as any).cardholderName || "Comprador Lumina";
      const response = await fetch("/api/payments/mercadopago/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          ...formData,
          cardholder_name: mpName,
        }),
      });
      const result = await response.json();
      if (result.approved && typeof result.orderNumber === "string") {
        onSuccess({ attemptId, trackingId: result.orderNumber });
        return;
      }
      if (response.status === 202) {
        if (result.status === "rejected") {
          onError(spanish
            ? "Mercado Pago rechazó el pago. Inicia un nuevo intento para probar otra tarjeta."
            : "Mercado Pago rejected the payment. Start a new attempt to try another card.");
          return;
        }
        onPending?.();
        onSuccess(await waitForPaymentApproval(attemptId, spanish));
        return;
      }
      if (!response.ok) {
        throw new Error(result.error ?? (spanish ? "No se pudo procesar el pago." : "The payment could not be processed."));
      }
      throw new Error(spanish ? "El pago todavía no fue confirmado." : "The payment has not been confirmed yet.");
    } catch (error) {
      onError(error instanceof Error ? error.message : spanish ? "No se pudo procesar el pago." : "The payment could not be processed.");
    }
  }, []);

  const handleMercadoPagoError = useCallback((error: any) => {
    mpRefs.current.onError(error.message);
  }, []);

  useEffect(() => {
    if (!publicKey) return;
    initMercadoPago(publicKey, { locale: spanish ? "es-AR" : "en-US" });
    const readyTimer = window.setTimeout(() => setMercadoPagoReady(true), 0);
    return () => window.clearTimeout(readyTimer);
  }, [publicKey, spanish]);

  if (clientSecret && stripePromise) {
    return (
      <Elements 
        stripe={stripePromise} 
        options={{ 
          clientSecret,
          locale: lang === "es" ? "es" : "en",
          appearance: {
            theme: "night",
            variables: {
              colorPrimary: "#4f46e5",
              colorBackground: "#171717", // Neutral-900 para encajar con el drawer
              colorText: "#ffffff",
              colorDanger: "#ef4444",
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              borderRadius: '12px',
            }
          }
        }}
      >
        <StripeForm
          attemptId={attemptId}
          cardholderName={cardholderName}
          onCardholderNameChange={setCardholderName}
          lang={lang}
          onSuccess={onSuccess}
          onError={onError}
        />
      </Elements>
    );
  }

  if (publicKey) {
    if (!mercadoPagoReady) {
      return <p className="text-sm text-white/50">{spanish ? "Cargando pago seguro..." : "Loading secure payment..."}</p>;
    }
    return (
      <div className="space-y-5">
        {/* Demo hint */}
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">
            {spanish ? "Modo demo activo" : "Demo mode active"}
          </p>
          <div className="rounded-lg bg-white/5 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Mastercard</span>
              <code className="text-xs font-mono text-indigo-300">5031 7557 3453 0604</code>
            </div>
          </div>
          <p className="text-xs text-indigo-200/50">
            {spanish
              ? "Vencimiento: 11/33 · CVV: 3 o 4 dígitos · DNI: 12345678"
              : "Expiry: 11/33 · CVV: 3 or 4 digits · ID: 12345678"}
          </p>
          <p className="text-xs font-semibold text-amber-300/80">
            {spanish
              ? "⚠ En el campo «Nombre» escribí exactamente: APRO"
              : "⚠ In the «Name» field type exactly: APRO"}
          </p>
        </div>

        <CardPayment
          initialization={mercadoPagoInitialization}
          customization={mercadoPagoCustomization}
          locale={spanish ? "es-AR" : "en-US"}
          onError={handleMercadoPagoError}
          onSubmit={handleMercadoPagoSubmit}
        />

        <p className="text-xs text-white/40">
          {spanish
            ? "El pago se procesa de forma segura por Mercado Pago. Lumina no recibe ni almacena los datos de la tarjeta."
            : "Your payment is securely processed by Mercado Pago. Lumina never receives or stores your card details."}
        </p>
      </div>
    );
  }

  return <p role="alert" className="text-sm text-red-400">La configuración de este medio de pago no está disponible.</p>;
}
