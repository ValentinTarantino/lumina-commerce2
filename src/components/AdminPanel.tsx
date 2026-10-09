"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Package, RefreshCw, Save, X } from "lucide-react";
import { translations } from "@/constants/translations";
import { useLang } from "@/store/useLang";
import type { Product } from "@/types/product";

interface AdminProduct {
  id: string;
  name: string;
  category: string;
  stock: number;
}

interface AdminOrder {
  orderNumber: string;
  createdAt: string;
  status: string;
  total: number;
  currency: string;
  recipientName: string;
  city: string;
}

interface AdminDashboard {
  products: AdminProduct[];
  orders: AdminOrder[];
}

export default function AdminPanel({
  isOpen,
  onClose,
  onInventoryUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onInventoryUpdated: (products: Product[]) => void;
}) {
  const { lang } = useLang();
  const t = translations[lang].admin;
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [savingProduct, setSavingProduct] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshAttempt, setRefreshAttempt] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    let isCurrent = true;
    const load = async () => {
      try {
        const response = await fetch("/api/admin", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t.loadError);
        if (!isCurrent) return;

        setDashboard(data);
        setStockDrafts(
          Object.fromEntries(data.products.map((product: AdminProduct) => [product.id, String(product.stock)])),
        );
        setError("");
      } catch (loadError) {
        if (!isCurrent) return;
        console.error("Error loading admin panel:", loadError);
        setError(loadError instanceof Error ? loadError.message : t.loadError);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    void load();
    return () => {
      isCurrent = false;
    };
  }, [isOpen, refreshAttempt, t.loadError]);

  const refreshDashboard = () => {
    setIsLoading(true);
    setError("");
    setRefreshAttempt((attempt) => attempt + 1);
  };

  const updateStock = async (product: AdminProduct) => {
    const stock = Number(stockDrafts[product.id]);
    if (!Number.isSafeInteger(stock) || stock < 0 || stock > 100_000) {
      setError(t.invalidStock);
      return;
    }

    setSavingProduct(product.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t.saveError);
      }

      setDashboard((current) => current
        ? {
            ...current,
            products: current.products.map((item) =>
              item.id === product.id ? data.product : item,
            ),
          }
        : current);
      setStockDrafts((current) => ({ ...current, [product.id]: String(data.product.stock) }));
      setNotice(t.saved);

      try {
        const catalogResponse = await fetch("/api/products", { cache: "no-store" });
        if (!catalogResponse.ok) throw new Error("Catalog refresh failed");
        const catalog: Product[] = await catalogResponse.json();
        onInventoryUpdated(catalog);
      } catch (refreshError) {
        console.error("Stock saved, but catalog refresh failed:", refreshError);
        setError(t.refreshError);
      }
    } catch (saveError) {
      console.error("Error updating product stock:", saveError);
      setError(saveError instanceof Error ? saveError.message : t.saveError);
    } finally {
      setSavingProduct(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
          <motion.button
            type="button"
            aria-label={t.close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-panel-title"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#09090b] shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-white/10 p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-300">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="admin-panel-title" className="text-xl font-black uppercase italic tracking-tight text-white">
                    {t.title}
                  </h2>
                  <p className="text-xs text-white/40">{t.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshDashboard}
                  disabled={isLoading}
                  aria-label={t.refresh}
                  className="rounded-xl border border-white/10 p-3 text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t.close}
                  className="rounded-xl border border-white/10 p-3 text-white/60 transition hover:bg-white/5 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-8 overflow-y-auto p-5 sm:p-7">
              {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
              {notice && <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{notice}</p>}
              {isLoading && !dashboard && <p className="py-12 text-center text-sm text-white/50">{t.loading}</p>}

              {dashboard && (
                <>
                  <section>
                    <div className="mb-4 flex items-end justify-between">
                      <div>
                        <h3 className="text-lg font-black uppercase italic text-white">{t.inventory}</h3>
                        <p className="text-xs text-white/40">{t.inventoryDescription}</p>
                      </div>
                      <span className="text-xs font-bold text-white/40">{dashboard.products.length} {t.products}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {dashboard.products.map((product) => (
                        <form
                          key={product.id}
                          onSubmit={(event) => {
                            event.preventDefault();
                            void updateStock(product);
                          }}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">{product.name}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-widest text-white/40">{product.category}</p>
                          </div>
                          <label className="sr-only" htmlFor={`stock-${product.id}`}>{t.stock}</label>
                          <input
                            id={`stock-${product.id}`}
                            type="number"
                            min="0"
                            max="100000"
                            step="1"
                            required
                            value={stockDrafts[product.id] ?? String(product.stock)}
                            onChange={(event) => setStockDrafts((current) => ({
                              ...current,
                              [product.id]: event.target.value,
                            }))}
                            className="w-20 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-center text-sm text-white outline-none focus:border-indigo-500"
                          />
                          <button
                            type="submit"
                            disabled={savingProduct === product.id || stockDrafts[product.id] === String(product.stock)}
                            aria-label={`${t.saveStock}: ${product.name}`}
                            className="rounded-lg bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                        </form>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="mb-4">
                      <h3 className="text-lg font-black uppercase italic text-white">{t.orders}</h3>
                      <p className="text-xs text-white/40">{t.ordersDescription}</p>
                    </div>
                    {dashboard.orders.length === 0 ? (
                      <p className="rounded-2xl border border-white/10 p-6 text-center text-sm text-white/40">{t.noOrders}</p>
                    ) : (
                      <div className="space-y-2">
                        {dashboard.orders.map((order) => (
                          <article key={order.orderNumber} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                            <div>
                              <p className="font-bold text-white">{order.orderNumber}</p>
                              <p className="mt-1 text-xs text-white/40">{order.recipientName} · {order.city}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-white">
                                {new Intl.NumberFormat(lang === "es" ? "es-AR" : "en-US", {
                                  style: "currency",
                                  currency: order.currency,
                                }).format(order.total)}
                              </p>
                              <p className="mt-1 text-xs text-white/40">{order.status} · {new Date(order.createdAt).toLocaleDateString()}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
