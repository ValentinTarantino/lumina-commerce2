import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Trash2, CreditCard, ChevronRight, CheckCircle2, Truck, MapPin, User } from "lucide-react";
import { useCart } from "@/store/useCart";
import { useLang } from "@/store/useLang";
import { useSession, signIn } from "next-auth/react";
import { translations } from "@/constants/translations";
import PaymentForm from "@/components/PaymentForm";

type PaymentProvider = "stripe" | "mercadopago";

type PaymentConfig = {
  stripe: { enabled: boolean; publishableKey: string | null };
  mercadoPago: { enabled: boolean; publicKey: string | null };
};

type PaymentAttempt = {
  attemptId: string;
  provider: PaymentProvider;
  reference: string;
  totalUsd: number;
  amount: number;
  currency: "USD" | "ARS";
  clientSecret?: string;
  exchangeRate?: string;
  exchangeRateUpdatedAt?: string;
  exchangeRateSource?: string;
};

export default function CartDrawer({ isOpen, onClose, onOrderSuccess }: { isOpen: boolean, onClose: () => void, onOrderSuccess?: () => void }) {
  const { lang } = useLang();
  const t = translations[lang].cart;
  const tc = translations[lang].checkout;
  
  const { items, removeItem, totalPrice, clearCart } = useCart();
  const { data: session } = useSession();
  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");
  const [paymentStage, setPaymentStage] = useState<"details" | "payment">("details");
  const [provider, setProvider] = useState<PaymentProvider>("stripe");
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [paymentConfigLoading, setPaymentConfigLoading] = useState(false);
  const [paymentAttempt, setPaymentAttempt] = useState<PaymentAttempt | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    recipientName: "",
    phone: "",
    address: "",
    city: "",
    zipCode: "",
    additionalInfo: ""
  });
  const [orderId, setOrderId] = useState("");
  const [showAuthAlert, setShowAuthAlert] = useState(false);
  const [orderError, setOrderError] = useState("");

  const loadPaymentConfiguration = async () => {
    const controller = new AbortController();
    setPaymentConfigLoading(true);
    setOrderError("");
    try {
      const response = await fetch("/api/payments/config", { signal: controller.signal });
      const config = await response.json();
      if (!response.ok) {
        throw new Error(config.error ?? "No se pudo cargar la configuración de pagos.");
      }
      setPaymentConfig(config as PaymentConfig);
      if (!config.stripe?.enabled && config.mercadoPago?.enabled) {
        setProvider("mercadopago");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setOrderError(error instanceof Error ? error.message : "No se pudo cargar la configuración de pagos.");
      }
      setPaymentConfig(null);
    } finally {
      setPaymentConfigLoading(false);
    }
  };

  const finishPaidOrder = (trackingId: string) => {
    setOrderId(trackingId);
    setPaymentPending(false);
    setStep("success");
    clearCart();
    onOrderSuccess?.();
  };

  const verifyPendingPayment = async () => {
    if (!paymentAttempt || isVerifyingPayment) return;
    setIsVerifyingPayment(true);
    setOrderError("");
    try {
      const response = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: paymentAttempt.attemptId }),
      });
      const result = await response.json();
      if (result.success && typeof result.trackingId === "string") {
        finishPaidOrder(result.trackingId);
      } else if (result.status === "rejected") {
        setPaymentPending(false);
        setOrderError(lang === "es" ? "El proveedor rechazó el pago. Puedes iniciar otro intento." : "The provider rejected the payment. You can start another attempt.");
      } else if (response.status === 202) {
        setPaymentPending(true);
        setOrderError(lang === "es" ? "El pago sigue pendiente. No vuelvas a pagar hasta que el proveedor lo resuelva." : "The payment is still pending. Do not submit another payment until the provider resolves it.");
      } else {
        throw new Error(result.error ?? tc.orderError);
      }
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : tc.orderError);
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  const handleCheckout = async () => {
    if (!session) {
      setShowAuthAlert(true);
      return;
    }
    
    if (step === "cart") {
      setStep("checkout");
      void loadPaymentConfiguration();
      return;
    }

    if (!paymentConfig || paymentConfigLoading) return;
    if (
      (provider === "stripe" && !paymentConfig.stripe.enabled) ||
      (provider === "mercadopago" && !paymentConfig.mercadoPago.enabled)
    ) {
      setOrderError("El medio de pago seleccionado no está disponible.");
      return;
    }

    setIsSubmitting(true);
    setOrderError("");
    try {
      const response = await fetch("/api/payments/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          items: items.map(({ id, quantity }) => ({ id, quantity })),
          ...formData
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setOrderError(data.error ?? tc.orderError);
        return;
      }
      setPaymentAttempt(data as PaymentAttempt);
      setPaymentPending(false);
      setPaymentStage("payment");
    } catch (error) {
      console.error("Error starting payment:", error);
      setOrderError(tc.orderError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeAndReset = () => {
    onClose();
    if (paymentPending) return;
    setTimeout(() => {
      setStep("cart");
      setPaymentStage("details");
      setPaymentAttempt(null);
      setPaymentPending(false);
      setShowAuthAlert(false);
    }, 500);
  };

  const isFormValid = 
    formData.recipientName.length >= 3 && 
    formData.phone.length >= 8 && 
    formData.address.length >= 5 && 
    formData.city.length >= 3 && 
    formData.zipCode.length >= 4;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Solo números
    setFormData({ ...formData, phone: value });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAndReset}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#020203] border-l border-white/[0.05] z-[210] flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)]"
          >
            {/* Header */}
            <div className="p-8 border-b border-white/[0.03] flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
                    <ShoppingBag className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight italic uppercase">
                    {step === "cart" ? t.titleCart : step === "checkout" ? t.titleShipping : t.titleSuccess}
                  </h2>
                </div>
                <p className="text-[10px] font-black tracking-widest text-white/20 uppercase italic">Lumina Luxury Commerce</p>
              </div>
              <button 
                onClick={closeAndReset} 
                className="p-3 hover:bg-white/5 border border-white/10 rounded-2xl transition-all hover:rotate-90"
              >
                <X className="w-6 h-6 text-white/40" />
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-8 relative">
              <AnimatePresence>
                {showAuthAlert && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 z-50 bg-[#020203]/95 backdrop-blur-xl p-12 flex flex-col items-center justify-center text-center"
                  >
                    <div className="w-20 h-20 bg-indigo-600/10 border border-indigo-500/20 rounded-full flex items-center justify-center mb-8">
                      <CreditCard className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-4">{t.authTitle}</h3>
                    <p className="text-white/40 text-sm mb-10 leading-relaxed italic">
                      {t.authDesc}
                    </p>
                    <div className="flex flex-col w-full gap-3">
                      <button 
                        onClick={() => signIn("google")}
                        className="premium-btn w-full"
                      >
                        {t.authBtn}
                      </button>
                      <button 
                        onClick={() => setShowAuthAlert(false)}
                        className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-colors py-4 italic"
                      >
                        {t.authExplore}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {step === "cart" && (
                  <motion.div
                    key="cart-list"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    {items.length === 0 ? (
                      <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-24 h-24 bg-white/[0.02] rounded-full flex items-center justify-center border border-white/[0.05]">
                          <ShoppingBag className="w-10 h-10 text-white/10" />
                        </div>
                        <div>
                          <p className="text-xl font-black italic uppercase tracking-tight mb-2">{t.empty}</p>
                          <p className="text-white/20 text-sm max-w-[200px] mx-auto">{t.emptyDesc}</p>
                        </div>
                      </div>
                    ) : (
                      items.map((item) => (
                        <div key={item.id} className="flex gap-6 group relative">
                          <div className="w-28 h-32 rounded-2xl overflow-hidden flex-shrink-0 bg-white/[0.02] border border-white/[0.05]">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" />
                          </div>
                          <div className="flex-1 flex flex-col py-1">
                            <h3 className="font-black text-lg tracking-tight uppercase italic">{item.name}</h3>
                            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest mb-4 italic">Premium Hardware</p>
                            <div className="mt-auto flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest italic">{t.quantity}</span>
                                <span className="bg-white/5 border border-white/10 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black italic">
                                  {item.quantity}
                                </span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xl font-black italic">${(item.price * item.quantity).toLocaleString()}</span>
                                <button 
                                  onClick={() => removeItem(item.id)} 
                                  className="p-2 hover:bg-red-500/10 rounded-xl transition-all text-white/20 hover:text-red-500 group"
                                  title={t.remove}
                                >
                                  <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}

                {step === "checkout" && (
                  <motion.div
                    key="checkout-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-2 italic">{tc.name}</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                          <input
                            type="text"
                            value={formData.recipientName}
                            onChange={(e) => setFormData({...formData, recipientName: e.target.value})}
                            placeholder={tc.namePlaceholder}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm text-white focus:border-indigo-500/50 outline-none transition-all italic placeholder:text-white/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-2 italic">{tc.phone}</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 flex items-center justify-center text-xs font-bold">+</div>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={handlePhoneChange}
                            placeholder={tc.phonePlaceholder}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm text-white focus:border-indigo-500/50 outline-none transition-all italic placeholder:text-white/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-2 italic">{tc.address}</label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                          <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                            placeholder={tc.addressPlaceholder}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm text-white focus:border-indigo-500/50 outline-none transition-all italic placeholder:text-white/20"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-2 italic">{tc.city}</label>
                          <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData({...formData, city: e.target.value})}
                            placeholder={tc.cityPlaceholder}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:border-indigo-500/50 outline-none transition-all italic placeholder:text-white/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-2 italic">{tc.zip}</label>
                          <input
                            type="text"
                            value={formData.zipCode}
                            onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                            placeholder={tc.zipPlaceholder}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:border-indigo-500/50 outline-none transition-all italic placeholder:text-white/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/50 ml-2 italic">{tc.info}</label>
                        <textarea
                          value={formData.additionalInfo}
                          onChange={(e) => setFormData({...formData, additionalInfo: e.target.value})}
                          placeholder={tc.infoPlaceholder}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:border-indigo-500/50 outline-none transition-all italic min-h-[80px] placeholder:text-white/20"
                        />
                      </div>
                    </div>

                    {paymentStage === "details" ? (
                      <div className="space-y-4 border-t border-white/10 pt-6">
                        <p className="text-xs font-black uppercase tracking-widest text-white/50">
                          {lang === "es" ? "Medio de pago" : "Payment method"}
                        </p>
                        {paymentConfigLoading ? (
                          <p className="text-sm text-white/40">{lang === "es" ? "Cargando medios de pago..." : "Loading payment methods..."}</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {paymentConfig?.stripe.enabled && (
                              <button
                                type="button"
                                onClick={() => setProvider("stripe")}
                                className={`rounded-xl border p-4 text-left transition-colors ${provider === "stripe" ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 bg-white/[0.02]"}`}
                              >
                                <span className="font-bold text-white">Stripe</span>
                                <span className="mt-1 block text-xs text-white/40">
                                  {lang === "es" ? "Cobro en USD" : "Charged in USD"}
                                </span>
                              </button>
                            )}
                            {paymentConfig?.mercadoPago.enabled && (
                              <button
                                type="button"
                                onClick={() => setProvider("mercadopago")}
                                className={`rounded-xl border p-4 text-left transition-colors ${provider === "mercadopago" ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 bg-white/[0.02]"}`}
                              >
                                <span className="font-bold text-white">Mercado Pago</span>
                                <span className="mt-1 block text-xs text-white/40">
                                  {lang === "es" ? "Cobro en pesos argentinos" : "Charged in Argentine pesos"}
                                </span>
                              </button>
                            )}
                            {paymentConfig &&
                              !paymentConfig.stripe.enabled &&
                              !paymentConfig.mercadoPago.enabled && (
                              <p role="alert" className="text-sm text-amber-300">
                                {lang === "es"
                                  ? "El servicio responde, pero faltan las credenciales de prueba de Stripe o Mercado Pago."
                                  : "The service is responding, but Stripe or Mercado Pago test credentials are missing."}
                              </p>
                            )}
                            {!paymentConfig && !paymentConfigLoading && (
                              <p role="alert" className="text-sm text-red-400">
                                {orderError || (lang === "es" ? "No hay medios de pago disponibles." : "No payment methods are available.")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : paymentAttempt ? (
                      <div className="space-y-5 border-t border-white/10 pt-6">
                        <div>
                          <p className="text-sm font-bold text-white">
                            {lang === "es" ? "Total a pagar" : "Total due"}:{" "}
                            {new Intl.NumberFormat(lang === "es" ? "es-AR" : "en-US", {
                              style: "currency",
                              currency: paymentAttempt.currency,
                            }).format(paymentAttempt.amount)}
                          </p>
                          {paymentAttempt.provider === "mercadopago" && paymentAttempt.exchangeRate && (
                            <p className="mt-2 text-xs leading-relaxed text-white/40">
                              {lang === "es" ? "Cambio vendedor oficial" : "Official selling exchange rate"}:{" "}
                              1 USD = {paymentAttempt.exchangeRate} ARS.{" "}
                              {lang === "es"
                                ? "Fuente: DolarAPI, cotización oficial vendedor"
                                : "Source: DolarAPI official USD selling rate"} ·{" "}
                              {new Date(paymentAttempt.exchangeRateUpdatedAt ?? "").toLocaleString(
                                lang === "es" ? "es-AR" : "en-US",
                              )}
                            </p>
                          )}
                        </div>
                        {paymentAttempt.provider === "mercadopago" && paymentAttempt.currency === "ARS" && (
                          paymentConfig?.mercadoPago.publicKey ? (
                            <PaymentForm
                              attemptId={paymentAttempt.attemptId}
                              publicKey={paymentConfig.mercadoPago.publicKey}
                              amount={paymentAttempt.amount}
                              email={session?.user?.email ?? ""}
                              lang={lang}
                              onSuccess={(result) => finishPaidOrder(result.trackingId)}
                              onError={setOrderError}
                              onPending={() => setPaymentPending(true)}
                            />
                          ) : (
                            <p role="alert" className="text-sm text-red-400">Falta configurar la clave pública de Mercado Pago.</p>
                          )
                        )}
                        {paymentAttempt.provider === "stripe" && (
                          paymentConfig?.stripe.publishableKey ? (
                            <PaymentForm
                              attemptId={paymentAttempt.attemptId}
                              clientSecret={paymentAttempt.clientSecret}
                              publishableKey={paymentConfig.stripe.publishableKey}
                              amount={paymentAttempt.amount}
                              email={session?.user?.email ?? ""}
                              lang={lang}
                              onSuccess={(result) => finishPaidOrder(result.trackingId)}
                              onError={setOrderError}
                            />
                          ) : (
                            <p role="alert" className="text-sm text-red-400">Falta configurar la clave pública de Stripe.</p>
                          )
                        )}
                        {paymentPending ? (
                          <button
                            type="button"
                            onClick={verifyPendingPayment}
                            disabled={isVerifyingPayment}
                            className="w-full rounded-xl border border-white/10 py-3 text-xs font-bold uppercase tracking-widest text-white/70 disabled:opacity-50"
                          >
                            {isVerifyingPayment
                              ? (lang === "es" ? "Verificando..." : "Verifying...")
                              : (lang === "es" ? "Verificar estado del pago" : "Check payment status")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentAttempt(null);
                              setPaymentStage("details");
                              setOrderError("");
                            }}
                            className="w-full py-3 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white"
                          >
                            {lang === "es" ? "Cambiar medio de pago" : "Change payment method"}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </motion.div>
                )}

                {step === "success" && (
                  <motion.div
                    key="success-screen"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center space-y-8"
                  >
                    <div className="w-24 h-24 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-12 h-12 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-4">{t.successTitle}</h3>
                      <p className="text-white/40 text-sm max-w-[300px] mx-auto mb-8 italic">
                        {t.successDesc}
                      </p>
                      
                      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-1">{t.trackingId}</p>
                          <p className="text-2xl font-black text-indigo-400 italic tracking-widest">{orderId}</p>
                        </div>
                        <div className="pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-white/60">
                          <Truck className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">{t.estimated}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={closeAndReset}
                      className="premium-btn w-full max-w-[200px]"
                    >
                      {t.backToShop}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {step !== "success" && items.length > 0 && (
              <div className="p-8 border-t border-white/[0.03] bg-white/[0.01] space-y-6">
                {orderError && (
                  <p role="alert" className="text-sm font-bold text-red-400">
                    {orderError}
                  </p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.2em] text-white/20 italic">
                    <span>{t.total}</span>
                    <span className="text-2xl font-black italic text-white">${(totalPrice() + 20).toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleCheckout}
                    disabled={isSubmitting || (step === "checkout" && (paymentStage === "payment" || !isFormValid || paymentConfigLoading || !paymentConfig))}
                    className="premium-btn w-full h-16 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                  >
                    {isSubmitting ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {step === "cart" ? t.proceed : lang === "es" ? "Continuar al pago" : "Continue to payment"}
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                  
                  {step === "cart" && (
                    <button onClick={clearCart} className="w-full text-white/20 hover:text-red-400 text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2 py-4 italic">
                      <Trash2 className="w-3 h-3" /> {t.emptyCart}
                    </button>
                  )}
                  {step === "checkout" && paymentStage === "details" && (
                    <button onClick={() => setStep("cart")} className="w-full text-white/20 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all py-4 italic">
                      {t.back}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
