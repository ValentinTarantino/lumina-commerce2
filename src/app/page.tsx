"use client";

import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { 
  ShoppingCart, Zap, ShieldCheck, Globe, ArrowRight,
  Smartphone, Tv, Tablet, Search, Star, Menu, X, 
  ChevronRight, Heart, User, Plus, Minus, ChevronDown, Headset, Truck, CheckCircle2
} from "lucide-react";
import { useCart } from "@/store/useCart";
import { useLang } from "@/store/useLang";
import CartDrawer from "@/components/CartDrawer";
import AdminPanel from "@/components/AdminPanel";
import { translations } from "@/constants/translations";
import type { Product } from "@/types/product";
import { ADMIN_EMAIL } from "@/lib/admin-config";
import { heroSceneAccents } from "@/constants/heroScene";

const HeroThreeScene = dynamic(() => import("@/components/HeroThreeScene"), {
  ssr: false,
  loading: () => <div className="hero-three-loading absolute inset-0" aria-hidden="true" />,
});

type TrackingItem = { id: string; name: string; quantity: number };
type TrackingOrder = {
  createdAt: string;
  deliveryDate: string;
  status: string;
  address: string;
  items: TrackingItem[];
};

function ProductZoom({ image, alt }: { image: string, alt: string }) {
  return (
    <div className="relative aspect-video md:aspect-square overflow-hidden rounded-2xl md:rounded-3xl bg-white/[0.02] border border-white/10 group/zoom">
      <img 
        src={image} 
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/zoom:scale-125"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
    </div>
  );
}

function getDeliveryProgress(createdAt: string, deliveryDate: string, status: string, now: number) {
  if (status === "ENTREGADO") return 100;
  const start = new Date(createdAt).getTime();
  const end = new Date(deliveryDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round(Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)));
}

import { useSession, signIn, signOut } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();
  const { addItem, totalItems } = useCart();
  const { lang, toggleLang } = useLang();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  
  const t = translations[lang];
  const isAdminAccount = session?.user?.email?.trim().toLowerCase() === ADMIN_EMAIL;

  const [activeCategory, setActiveCategory] = useState("Todos");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTrackingNow(Date.now()), 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const heroSlides = [
    { name: "Neural Engine", nameEs: "Motor neuronal", metric: "99.8%", detail: "AI COMPUTE", detailEs: "CÓMPUTO DE IA" },
    { name: "Quantum Core", nameEs: "Núcleo cuántico", metric: "2.4 THz", detail: "PROCESSING", detailEs: "PROCESAMIENTO" },
    { name: "Photon Network", nameEs: "Red fotónica", metric: "0.4 ms", detail: "LOW LATENCY", detailEs: "BAJA LATENCIA" },
    { name: "Cloud Matrix", nameEs: "Matriz en la nube", metric: "12.8 TB", detail: "MEMORY LINK", detailEs: "ENLACE DE MEMORIA" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isMobileSearchOpen) mobileSearchRef.current?.focus();
  }, [isMobileSearchOpen]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingResult, setTrackingResult] = useState<TrackingOrder | null>(null);
  const [trackingNow, setTrackingNow] = useState(() => Date.now());
  const [isTracking, setIsTracking] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const trackingProgress = trackingResult
    ? getDeliveryProgress(
        trackingResult.createdAt,
        trackingResult.deliveryDate,
        trackingResult.status,
        trackingNow,
      )
    : 0;

  const fetchUserOrders = async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/user/orders');
      const data = await res.json();
      if (res.ok) setUserOrders(data);
    } catch (e) {
      console.error("Error fetching history");
    }
  };

  useEffect(() => {
    if (session) fetchUserOrders();
  }, [session]);

  const handleTrack = async (codeToTrack?: string) => {
    const code = codeToTrack || trackingCode;
    if (!code) return;
    
    if (codeToTrack) setTrackingCode(codeToTrack);
    
    setIsTracking(true);
    setTrackingError("");
    try {
      const res = await fetch(`/api/orders/${code}`);
      const data = await res.json();
      if (res.ok) {
        setTrackingResult(data);
        setShowHistory(false);
      } else {
        setTrackingError(t.tracking.error);
        setTrackingResult(null);
      }
    } catch (e) {
      setTrackingError(lang === "es" ? "Error de conexión" : "Connection error");
    } finally {
      setIsTracking(false);
    }
  };

  useEffect(() => {
    setQuantity(1);
  }, [selectedProduct]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Product API returned HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error("Product API response is not a JSON array");
        }

        setProducts(data as Product[]);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching products:", error);
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const categories = ["Todos", ...new Set(products.map((product) => product.category))];
  const filteredProducts = products.filter(p => 
    (activeCategory === "Todos" || p.category === activeCategory) && 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsMobileSearchOpen(false);
    setIsMobileMenuOpen(false);
    document.getElementById("productos")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-[#020203] text-white selection:bg-indigo-500/30">
      {isAdminAccount && (
        <AdminPanel
          isOpen={isAdminPanelOpen}
          onClose={() => setIsAdminPanelOpen(false)}
          onInventoryUpdated={setProducts}
        />
      )}
      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        onOrderSuccess={fetchUserOrders}
      />
      
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, scale: 0.95, x: "-50%" }}
            className="fixed bottom-12 left-1/2 z-[200] bg-white text-black px-6 md:px-8 py-4 md:py-5 rounded-2xl md:rounded-[2rem] shadow-2xl flex items-center gap-4 border border-white/20 w-[90%] max-w-xs md:min-w-[320px]"
          >
            <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-0.5 italic">{lang === "es" ? "Notificación" : "Notification"}</p>
              <p className="text-sm font-black italic uppercase tracking-tight">{toastMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-black/95 md:bg-black/90 md:backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-6xl bg-[#09090b] border border-white/10 rounded-[1.75rem] md:rounded-[2.5rem] p-4 sm:p-6 md:p-8 lg:p-10 shadow-2xl md:shadow-[0_32px_120px_rgba(0,0,0,0.7)] overflow-hidden max-h-[calc(100dvh-1rem)] md:max-h-[90vh] overflow-y-auto will-change-transform"
            >
              <div className="absolute -top-40 left-1/4 hidden md:block w-96 h-96 rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
              <button 
                onClick={() => setSelectedProduct(null)}
                aria-label={lang === "es" ? "Cerrar detalle del producto" : "Close product details"}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2.5 bg-white/[0.04] hover:bg-white/10 rounded-xl border border-white/10 transition-all z-20"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6 md:gap-10 lg:gap-12 items-center">
                <div className="relative">
                  <div className="absolute -inset-6 hidden md:block bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
                  <ProductZoom image={selectedProduct.image} alt={selectedProduct.name} />
                </div>

                <div className="space-y-5 md:space-y-7 lg:pr-2">
                  <div>
                    <div className="flex items-center gap-2.5 mb-4 pr-12">
                      <span className="w-7 h-px bg-indigo-400"></span>
                      <span className="text-indigo-300 font-black text-[10px] tracking-[0.3em] uppercase">{selectedProduct.category}</span>
                      <span className="ml-auto text-[9px] font-bold tracking-[0.25em] uppercase text-white/20">Lumina / {selectedProduct.id}</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl xl:text-5xl font-black italic uppercase tracking-[-0.06em] mb-4 leading-[0.98] text-white">{selectedProduct.name}</h2>
                    <p className="text-white/55 text-sm md:text-base leading-relaxed max-w-xl">
                      {lang === "en"
                        ? (selectedProduct.description_en || "A masterpiece of digital engineering designed to exceed all expectations.")
                        : (selectedProduct.description || "Una obra maestra de ingeniería digital diseñada para superar cualquier expectativa.")}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-white/[0.07] to-white/[0.025] border border-white/10 p-5 md:p-6 rounded-2xl md:rounded-[1.75rem] space-y-5 shadow-inner">
                    <div className="flex items-end justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-white/35 uppercase tracking-[0.2em] mb-1">{t.products.finalPrice}</span>
                        <span className="text-4xl md:text-5xl font-black tracking-tight text-white">${selectedProduct.price.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-white/35 uppercase tracking-[0.2em] mb-2">{t.cart.quantity}</span>
                        <div className="flex items-center gap-3 bg-black/50 p-1.5 rounded-xl border border-white/10">
                          <button 
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            aria-label={lang === "es" ? "Reducir cantidad" : "Decrease quantity"}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-6 text-center font-black tabular-nums">{quantity}</span>
                          <button 
                            onClick={() => setQuantity(Math.min(selectedProduct.stock, quantity + 1))}
                            aria-label={lang === "es" ? "Aumentar cantidad" : "Increase quantity"}
                            className={`p-1 transition-colors ${quantity >= selectedProduct.stock ? 'text-white/10 cursor-not-allowed' : 'hover:text-indigo-400'}`}
                            disabled={quantity >= selectedProduct.stock}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        addItem(selectedProduct, quantity);
                        setSelectedProduct(null);
                        setToastMessage(lang === "es" ? "Añadido al ecosistema." : "Added to ecosystem.");
                        setShowToast(true);
                      }}
                      disabled={selectedProduct.stock === 0}
                      className="premium-btn w-full py-4 md:py-5 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ShoppingCart className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
                      {selectedProduct.stock === 0
                        ? t.products.outOfStock
                        : lang === "es" ? "Añadir al Carrito" : "Add to Cart"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3.5 bg-white/[0.025] border border-white/[0.07] rounded-xl">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-300" />
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/45">{lang === "es" ? "Garantía Global" : "Global Warranty"}</span>
                    </div>
                    <div className="flex items-center gap-3 p-3.5 bg-white/[0.025] border border-white/[0.07] rounded-xl">
                      <Globe className="w-4 h-4 shrink-0 text-indigo-300" />
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/45">{lang === "es" ? "Envío Priority" : "Priority Shipping"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/[0.03] bg-black/40 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 md:h-24 flex items-center gap-4 md:gap-8">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label={lang === "es" ? "Lumina - inicio" : "Lumina - home"}
            className="shrink-0 text-xl md:text-2xl font-black tracking-tighter flex items-center gap-2 md:gap-3"
          >
            <span className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/40">
              <Zap className="w-5 h-5 md:w-6 md:h-6 fill-white" />
            </span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">LUMINA.</span>
          </button>

          <div className="hidden lg:flex shrink-0 items-center gap-7 text-[11px] xl:text-[13px] font-bold uppercase tracking-widest text-white/40">
            <button onClick={() => document.getElementById("productos")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white transition-colors">{t.nav.explore}</button>
            <button onClick={() => document.getElementById("novedades")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white transition-colors">{t.nav.news}</button>
            <button onClick={() => document.getElementById("tracking")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-white transition-colors">{t.nav.tracking}</button>
          </div>

          <form onSubmit={submitSearch} role="search" className="hidden md:flex flex-1 max-w-sm mx-auto">
            <label className="flex w-full items-center gap-3 rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 transition-colors focus-within:border-indigo-400/40 focus-within:bg-white/[0.05]">
              <Search className="h-4 w-4 shrink-0 text-white/35" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t.nav.search}
                aria-label={t.nav.search}
                className="w-full bg-transparent text-xs text-white placeholder:text-white/35 outline-none"
              />
            </label>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-4">
            <button
              type="button"
              onClick={toggleLang}
              aria-label={lang === "es" ? "Switch language to English" : "Cambiar idioma a español"}
              className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-3 md:px-4 py-2 rounded-xl hover:bg-white/10 transition-all group text-[9px] md:text-[10px] font-black uppercase tracking-widest text-white/60"
            >
              <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 text-white/40 group-hover:text-indigo-400 transition-colors" aria-hidden="true" />
              {lang.toUpperCase()}
            </button>

            <div className="hidden md:block">
              {session ? (
                <div className="relative group">
                  <button type="button" aria-label={session.user?.email || "Account"} className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/5 text-sm text-white/80 transition-transform duration-300 group-hover:scale-110 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                    {session.user?.image ? (
                      <img src={session.user.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-blue-500/30 text-[10px] font-bold">
                        {session.user?.name?.charAt(0).toUpperCase() || <User size={14} />}
                      </span>
                    )}
                  </button>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0a0b] bg-green-500" />
                  <div className="invisible absolute right-0 top-full z-50 mt-4 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0b]/95 opacity-0 shadow-2xl backdrop-blur-xl transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    <div className="border-b border-white/5 p-4">
                      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/40">{lang === "es" ? "Conectado como" : "Signed in as"}</p>
                      <p className="truncate text-xs font-bold text-white/80">{session.user?.email}</p>
                    </div>
                    {isAdminAccount && (
                      <button onClick={() => setIsAdminPanelOpen(true)} className="w-full p-4 text-left text-[10px] font-black uppercase tracking-widest text-indigo-300 hover:bg-indigo-500/10 transition-colors">{t.admin.open}</button>
                    )}
                    <button onClick={() => signOut()} className="w-full p-4 text-left text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-colors">{t.nav.logout}</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => signIn("google")} className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-white text-black rounded-lg md:rounded-xl hover:bg-indigo-600 hover:text-white transition-all duration-300 text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl shadow-white/5 active:scale-95">
                  <User size={13} className="md:w-3.5 md:h-3.5" />
                  {t.nav.login}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`${t.nav.cart}${mounted && totalItems() > 0 ? `, ${totalItems()}` : ""}`}
              className="relative flex h-10 items-center gap-2 rounded-lg md:rounded-xl border border-white/5 bg-white/5 px-2.5 text-white/80 transition-all hover:bg-white/10 md:px-3"
            >
              <ShoppingCart className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="hidden lg:inline text-[9px] font-black uppercase tracking-widest">{t.nav.cart}</span>
              {mounted && totalItems() > 0 && (
                <span className="flex min-w-5 h-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-black text-white shadow-lg shadow-indigo-600/40">
                  {totalItems()}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsMobileSearchOpen((open) => !open)}
              aria-label={isMobileSearchOpen ? (lang === "es" ? "Cerrar búsqueda" : "Close search") : t.nav.search}
              aria-expanded={isMobileSearchOpen}
              className="md:hidden flex h-10 w-9 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              {isMobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label={lang === "es" ? "Abrir menú" : "Open menu"}
              className="lg:hidden flex h-10 w-9 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
        {isMobileSearchOpen && (
          <form onSubmit={submitSearch} role="search" className="md:hidden border-t border-white/[0.05] bg-black/30 px-4 py-3">
            <label className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 focus-within:border-indigo-400/40">
              <Search className="h-4 w-4 shrink-0 text-white/35" aria-hidden="true" />
              <input
                ref={mobileSearchRef}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t.nav.search}
                aria-label={t.nav.search}
                className="w-full bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
              />
            </label>
          </form>
        )}
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] lg:hidden"
            />
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[80%] max-w-sm bg-[#0a0a0b] border-r border-white/5 z-[101] p-8 lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="text-xl font-black tracking-tighter flex items-center gap-2">
                  <span className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/30">
                    <Zap className="w-5 h-5 fill-white" />
                  </span>
                  LUMINA.
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-white/40 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col gap-4 mb-auto">
                <button 
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-base font-medium text-left text-white/75 hover:text-white transition-colors"
                >
                  {t.nav.explore}
                </button>
                <button 
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    document.getElementById('novedades')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-base font-medium text-left text-white/75 hover:text-white transition-colors"
                >
                  {t.nav.news}
                </button>
                <button 
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    document.getElementById('tracking')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-base font-medium text-left text-white/75 hover:text-white transition-colors"
                >
                  {t.nav.tracking}
                </button>
              </div>

              <div className="mt-auto pt-8 border-t border-white/5 flex flex-col gap-6">
                <button 
                  onClick={() => toggleLang()}
                  className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-black uppercase tracking-widest">{lang === 'es' ? 'Idioma' : 'Language'}</span>
                  </div>
                  <span className="text-xs font-black text-indigo-400">{lang === "es" ? "ESPAÑOL" : "ENGLISH"}</span>
                </button>

                {session ? (
                  <>
                    {isAdminAccount && (
                      <button
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setIsAdminPanelOpen(true);
                        }}
                        className="w-full p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-300 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-3"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {t.admin.open}
                      </button>
                    )}
                    <button 
                      onClick={() => signOut()}
                      className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-3"
                    >
                      <Zap className="w-3 h-3 fill-red-400" />
                      {lang === 'es' ? 'Cerrar Sesión' : 'Sign Out'}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => signIn('google')}
                    className="w-full p-4 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-[0.2em] italic hover:bg-indigo-400 transition-colors"
                  >
                    {lang === 'es' ? 'Iniciar Sesión' : 'Sign In'}
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <section className="relative pt-44 pb-32 px-6 overflow-hidden min-h-[90vh] flex items-center">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute top-[10%] left-[-5%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[180px] animate-pulse-soft"></div>
          <div className="absolute bottom-[10%] right-[-5%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[160px] animate-pulse-soft delay-1000"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        </div>

        <div className="max-w-7xl mx-auto w-full relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-20 items-center">
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center lg:items-start text-center lg:text-left"
          >
            <h1 className="text-6xl xs:text-7xl md:text-8xl lg:text-9xl font-black mb-6 md:mb-10 leading-[0.85] md:leading-[0.8] tracking-tighter uppercase italic">
              {t.hero.defying} <br /> 
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/20">{t.hero.limits}</span>
            </h1>
            
            <p className="max-w-lg text-base md:text-lg text-white/40 mb-12 leading-relaxed font-medium italic border-l-0 lg:border-l-2 border-indigo-600/30 lg:pl-8">
              {t.hero.tagline}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 w-full sm:w-auto">
              <button 
                onClick={() => document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth' })}
                className="premium-btn w-full sm:w-auto px-12 group"
              >
                {t.hero.exploreBtn} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
              </button>
              <button 
                onClick={() => document.getElementById('destacados')?.scrollIntoView({ behavior: 'smooth' })}
                className="premium-btn-outline w-full sm:w-auto px-12"
              >
                {t.hero.launchesBtn}
              </button>
            </div>
          </motion.div>

          <div className="relative w-full max-w-2xl mx-auto lg:mx-0">
            <div className="relative z-10 w-full aspect-[4/3] md:aspect-square">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_52%_48%,rgba(79,70,229,0.2),transparent_58%)]" />
              <HeroThreeScene slide={currentSlide} />

              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#05050b]/80 via-[#05050b]/25 to-transparent pointer-events-none z-[1]" />

              <div className="absolute bottom-5 left-3 md:bottom-8 md:left-6 z-10 pointer-events-none">
                <div className="mb-1.5 flex items-center gap-2">
                  <p className="text-[8px] md:text-[9px] font-bold tracking-[0.2em] text-[#39ff14] uppercase font-mono">
                    {lang === "es" ? heroSlides[currentSlide].nameEs : heroSlides[currentSlide].name}
                  </p>
                </div>
                <p className="text-[8px] md:text-[9px] font-bold tracking-[0.24em] text-[#39ff14]/80 uppercase font-mono">
                  {lang === "es" ? heroSlides[currentSlide].detailEs : heroSlides[currentSlide].detail}
                </p>
                <p className="mt-1 text-xl md:text-2xl font-bold tracking-tight text-[#39ff14] font-mono drop-shadow-[0_0_12px_rgba(57,255,20,0.4)]">{heroSlides[currentSlide].metric}</p>
              </div>

              <div className="absolute bottom-7 md:bottom-10 right-3 md:right-6 z-10 flex items-center gap-2">
                {heroSlides.map((slide, idx) => (
                  <button
                    key={slide.name}
                    type="button"
                    aria-label={lang === "es" ? `Mostrar diapositiva ${idx + 1}: ${slide.nameEs}` : `Show slide ${idx + 1}: ${slide.name}`}
                    aria-current={currentSlide === idx ? "true" : undefined}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      currentSlide === idx ? "w-8" : "w-2 bg-white/25 hover:bg-white/50"
                    }`}
                    style={currentSlide === idx ? {
                      backgroundColor: heroSceneAccents[idx],
                      boxShadow: `0 0 12px ${heroSceneAccents[idx]}cc`,
                    } : undefined}
                  />
                ))}
              </div>
            </div>
            <div className="absolute -inset-4 bg-indigo-600/5 blur-3xl -z-10 lg:hidden"></div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent to-[#020203] pointer-events-none z-20" />
      </section>

      <section id="productos" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center lg:items-end justify-between mb-16 gap-10 text-center lg:text-left">
          <div className="max-w-2xl flex flex-col items-center lg:items-start">
            <div className="text-indigo-500 font-black text-[10px] tracking-widest uppercase mb-4 italic opacity-60">{lang === "es" ? "Categorías Premium" : "Premium Categories"}</div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-8 uppercase italic leading-none">{t.products.title}</h2>
            
            <div className="relative z-40 w-full max-w-[280px]">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full bg-white/5 border border-white/10 px-6 py-4 rounded-2xl flex items-center justify-between group hover:border-white/30 transition-all backdrop-blur-xl"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="text-[9px] font-black text-white/20 uppercase tracking-widest italic">{t.products.filter}</span>
                  <span className="text-xs font-black uppercase tracking-widest italic">{(t.products.categories as any)[activeCategory] || activeCategory}</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform duration-500 ${isDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              
              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-3 bg-[#0a0a0b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
                  >
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setActiveCategory(cat);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest italic transition-all hover:bg-white hover:text-black ${
                          activeCategory === cat ? "text-indigo-400" : "text-white/40"
                        }`}
                      >
                        {(t.products.categories as any)[cat] || cat}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[400px] md:h-[500px] bg-white/[0.02] border border-white/[0.05] rounded-[2rem] md:rounded-[2.5rem] animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 min-h-[600px]">
            <AnimatePresence>
              {filteredProducts.map((product) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setSelectedProduct(product)}
                  className="group glass-card overflow-hidden flex flex-col cursor-pointer"
                >
                  <div className="relative aspect-[4/5] overflow-hidden m-4 rounded-[1.5rem]">
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out" 
                    />
                    <div className="absolute top-4 left-4 flex gap-2">
                      <span className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase italic">
                        {(t.products.categories as any)[product.category] || product.category}
                      </span>
                    </div>
                  </div>

                  <div className="p-8 pt-2 flex flex-col flex-grow">
                    <h3 className="text-2xl font-black mb-6 tracking-tight group-hover:text-indigo-400 transition-colors uppercase italic">
                      {product.name}
                    </h3>
                    <div className="mt-auto flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-1 italic">{t.products.finalPrice}</span>
                        <span className="text-3xl font-black text-white italic">${product.price.toLocaleString()}</span>
                        <span className={`mt-2 text-[10px] font-bold uppercase tracking-widest ${product.stock > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {product.stock > 0 ? t.products.inStock : t.products.outOfStock}
                        </span>
                      </div>
                      <div 
                        className="bg-white text-black w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-xl active:scale-90 group-hover:shadow-indigo-600/20"
                      >
                        <ArrowRight className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <section id="novedades" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative flex flex-col lg:min-h-[600px] rounded-[2rem] md:rounded-[4rem] overflow-hidden group shadow-2xl shadow-indigo-600/10 bg-[#0a0a0b]"
          >
            <div className="absolute inset-0 lg:relative lg:h-full">
              <img 
                src="https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=2000" 
                alt="Lumina Tech Center" 
                className="w-full h-full object-cover opacity-40 md:opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#020203] via-[#020203]/95 md:via-[#020203]/70 to-transparent"></div>
            </div>
            
            <div className="relative p-8 md:p-24 flex flex-col justify-center max-w-3xl z-10 lg:absolute lg:inset-0">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-8 md:w-12 h-px bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"></span>
                <span className="text-indigo-400 font-black text-[10px] md:text-xs tracking-[0.3em] uppercase italic drop-shadow-lg">{t.news.expansion}</span>
              </div>
              
              <h2 className="text-3xl xs:text-4xl md:text-7xl font-black mb-6 md:mb-8 leading-[1] md:leading-[0.9] tracking-tighter italic uppercase text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                {t.news.title} <br /> <span className="text-white/60">{t.news.subtitle}</span>
              </h2>
              
              <p className="text-white/80 text-base md:text-lg mb-10 leading-relaxed italic drop-shadow-md">
                {t.news.desc}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                <div className="flex flex-col bg-white/5 p-4 md:p-6 rounded-2xl border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 italic">{t.news.hqSouth}</span>
                  <span className="text-xs md:text-sm font-black uppercase italic text-white tracking-wider">Buenos Aires</span>
                </div>
                <div className="flex flex-col bg-white/5 p-4 md:p-6 rounded-2xl border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 italic">{t.news.hqCentral}</span>
                  <span className="text-xs md:text-sm font-black uppercase italic text-white tracking-wider">São Paulo</span>
                </div>
                <div className="flex flex-col bg-white/5 p-4 md:p-6 rounded-2xl border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 italic">{t.news.hqNorth}</span>
                  <span className="text-xs md:text-sm font-black uppercase italic text-white tracking-wider">Miami & NYC</span>
                </div>
              </div>
            </div>

            <div className="absolute top-12 right-12 hidden xl:block">
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl text-right">
                <div className="text-4xl font-black italic mb-1 tracking-tighter">2026</div>
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">{t.news.opening}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="destacados" className="py-24 px-6 md:py-32 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[32rem] h-[32rem] bg-indigo-600/[0.07] rounded-full blur-[140px] pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="flex flex-col lg:flex-row items-center lg:items-end justify-between mb-14 gap-8 text-center lg:text-left">
            <div className="max-w-2xl">
              <div className="text-indigo-400 font-black text-xs tracking-[0.3em] uppercase mb-4 italic">              {t.featured.subtitle}</div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5 uppercase italic">              {t.featured.title}</h2>
              <p className="text-white/55 text-base md:text-lg italic leading-relaxed">{t.featured.desc}</p>
            </div>
            <div className="hidden lg:block h-px flex-1 bg-white/[0.08] mx-10 mb-6" />
            <button
              onClick={() => {
                setActiveCategory("Todos");
                setSearchQuery("");
                document.getElementById("productos")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="premium-btn-outline whitespace-nowrap w-full sm:w-auto"
            >
              {t.featured.catalogBtn}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: "MacBook Pro 14 M3",
                category: "LAPTOPS",
                image: "/products/macbook-pro-14-m3.png",
                accent: "from-indigo-500/30"
              },
              {
                name: "Bose QuietComfort Ultra",
                category: lang === "es" ? "AUDIO PREMIUM" : "PREMIUM AUDIO",
                image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=1000",
                accent: "from-violet-500/30"
              },
              {
                name: "Xbox Series X",
                category: "GAMING",
                image: "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&q=80&w=1000",
                accent: "from-emerald-500/25"
              }
            ].map((item, idx) => {
              const product = products.find((candidate) => candidate.name.toLowerCase() === item.name.toLowerCase());

              return (
              <motion.button
                whileHover={{ y: -8 }}
                key={item.name}
                type="button"
                onClick={() => {
                  setActiveCategory("Todos");
                  setSearchQuery(item.name);
                  document.getElementById("productos")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group relative h-[430px] md:h-[500px] rounded-[2rem] md:rounded-[2.75rem] overflow-hidden border border-white/[0.08] bg-[#0a0a0b] text-left"
              >
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="w-full h-full object-cover opacity-45 grayscale transition-all duration-700 group-hover:scale-105 group-hover:opacity-65 group-hover:grayscale-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#020203] via-black/25 to-black/10" />
                <div className={`absolute inset-0 bg-gradient-to-br ${item.accent} via-transparent to-transparent opacity-50 transition-opacity group-hover:opacity-90`} />

                <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-[0.25em] text-white/55 italic">{String(idx + 1).padStart(2, "0")} / 03</span>
                  <span className="px-3 py-1.5 rounded-full bg-indigo-600/20 border border-indigo-400/30 text-[9px] font-black tracking-[0.16em] uppercase italic text-indigo-200">
                    {item.category}
                  </span>
                </div>

                <div className="absolute bottom-7 md:bottom-9 left-6 md:left-8 right-6 md:right-8">
                  <div className="text-indigo-300 font-black text-[9px] tracking-[0.28em] uppercase italic mb-3">
                    {product ? (product.stock > 0 ? t.products.inStock : t.products.outOfStock) : t.featured.label}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter mb-4 text-white transition-colors group-hover:text-indigo-200">
                    {item.name}
                  </h3>
                  <div className="flex items-center justify-between border-t border-white/15 pt-4">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35 italic">{t.featured.discover}</span>
                    {product && <span className="text-lg font-black italic text-white">${product.price.toLocaleString()}</span>}
                    <ArrowRight className="h-4 w-4 text-indigo-300 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      <section id="tracking" className="py-32 px-6 bg-[#020203] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="text-indigo-500 font-black text-[10px] tracking-[0.5em] uppercase mb-4 italic opacity-80">{t.tracking.tagline}</div>
            <h2 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic mb-6">{t.tracking.title}</h2>
            <p className="text-white/40 max-w-lg mx-auto text-sm italic">{t.tracking.desc}</p>
          </div>

          <div className="glass-panel p-8 md:p-12 border-white/5 relative overflow-hidden group">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                <input 
                  type="text" 
                  value={trackingCode}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setTrackingCode(val);
                    if (!val) {
                      setTrackingResult(null);
                      setTrackingError("");
                    }
                  }}
                  placeholder={t.tracking.placeholder}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-6 pl-16 pr-6 text-lg font-black tracking-widest text-white outline-none focus:border-indigo-500/50 transition-all italic placeholder:text-white/10"
                />
              </div>
              <button 
                onClick={() => handleTrack()}
                disabled={isTracking}
                className="premium-btn px-12 h-[76px] disabled:opacity-50"
              >
                {isTracking ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t.tracking.trackBtn}
              </button>
            </div>

            {session && (
              <div className="mt-6 flex justify-center">
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-indigo-400 transition-colors flex items-center gap-2 italic"
                >
                  {showHistory ? t.tracking.hideHistory : t.tracking.forgotCode}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}

            <AnimatePresence>
              {showHistory && userOrders.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-8"
                >
                  <div className="flex items-center justify-between mb-4 px-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 italic">
                      {lang === 'es' ? 'Mostrando' : 'Showing'} {userOrders.length} {lang === 'es' ? 'pedidos' : 'orders'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                    {userOrders.map((order) => (
                      <button
                        key={order.orderNumber}
                        onClick={() => handleTrack(order.orderNumber)}
                        className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/5 hover:border-indigo-500/30 transition-all text-left group"
                      >
                        <div>
                          <p className="text-[9px] font-black text-white/20 uppercase mb-1">{t.tracking.historyDate}: {new Date(order.createdAt).toLocaleDateString()}</p>
                          <p className="text-sm font-black text-white/80 italic tracking-wider">{order.orderNumber}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-white/10 group-hover:text-indigo-400 transition-colors" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {trackingError && (
              <motion.p 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-red-500 text-xs font-black uppercase tracking-widest mt-6 ml-4 italic"
              >
                ⚠ {trackingError}
              </motion.p>
            )}

            <AnimatePresence>
              {trackingResult && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-12 pt-12 border-t border-white/5"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
                          <Truck className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-1 italic">{t.tracking.status}</p>
                          <h4 className="text-2xl font-black italic uppercase text-indigo-400">
                            {t.tracking.orderStatuses[trackingResult.status as keyof typeof t.tracking.orderStatuses] || trackingResult.status}
                          </h4>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/30 italic">
                          <span>{t.tracking.progress}</span>
                          <span>{trackingProgress}%</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${trackingProgress}%` }}
                            className="h-full bg-gradient-to-r from-indigo-600 to-purple-600"
                          ></motion.div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2 italic">{t.tracking.destination}</p>
                          <p className="text-sm font-black italic uppercase text-white/80 line-clamp-2">{trackingResult.address}</p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2 italic">{t.tracking.delivery}</p>
                          <p className="text-sm font-black italic uppercase text-white/80">{new Date(trackingResult.deliveryDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8">
                      <h5 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-6 italic">{t.tracking.contents}</h5>
                      <div className="space-y-4">
                        {trackingResult.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                            <span className="text-sm font-black italic text-white/80 uppercase">{item.name}</span>
                            <span className="text-[10px] font-black bg-white/5 px-3 py-1 rounded-full text-white/40">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <footer className="relative overflow-hidden border-t border-white/[0.08] bg-gradient-to-b from-[#0c0b12] via-[#08080b] to-[#070708]">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-indigo-600/[0.12] blur-[120px]" />
        <div className="pointer-events-none absolute bottom-24 left-0 h-72 w-72 rounded-full bg-violet-600/[0.07] blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-3 border-b border-white/[0.08] py-8 md:grid-cols-3 md:gap-4 md:py-10">
            <button
              onClick={() => document.getElementById("productos")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left md:p-5"
            >
              <span>
                <span className="block text-sm font-semibold text-white/90">{t.footer.catalogTitle}</span>
                <span className="mt-1 block text-xs leading-relaxed text-white/45">{t.footer.catalogDesc}</span>
              </span>
            </button>
            <button
              onClick={() => document.getElementById("productos")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left md:p-5"
            >
              <span>
                <span className="block text-sm font-semibold text-white/90">{t.footer.stockTitle}</span>
                <span className="mt-1 block text-xs leading-relaxed text-white/45">{t.footer.stockDesc}</span>
              </span>
            </button>
            <button
              onClick={() => document.getElementById("tracking")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left md:p-5"
            >
              <span>
                <span className="block text-sm font-semibold text-white/90">{t.footer.trackingTitle}</span>
                <span className="mt-1 block text-xs leading-relaxed text-white/45">{t.footer.trackingDesc}</span>
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-10 py-12 md:grid-cols-[1.5fr_0.8fr_0.8fr] md:gap-16 md:py-16">
            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                aria-label={lang === "es" ? "Lumina - inicio" : "Lumina - home"}
                className="flex items-center gap-3 text-2xl font-black tracking-tighter transition-opacity hover:opacity-80"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-600/30">
                  <Zap className="h-5 w-5 fill-white" />
                </span>
                LUMINA.
              </button>
              <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-300/80">{t.footer.eyebrow}</p>
              <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">{t.footer.headline}</h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/45">{t.footer.desc}</p>
            </div>

            <div className="flex flex-col items-center gap-5 md:items-start">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">{t.footer.shop}</h2>
              <button onClick={() => document.getElementById("productos")?.scrollIntoView({ behavior: "smooth" })} className="text-sm text-white/45 transition-colors hover:text-white">{t.footer.categories}</button>
              <button onClick={() => document.getElementById("destacados")?.scrollIntoView({ behavior: "smooth" })} className="text-sm text-white/45 transition-colors hover:text-white">{t.footer.featured}</button>
              <button onClick={() => document.getElementById("novedades")?.scrollIntoView({ behavior: "smooth" })} className="text-sm text-white/45 transition-colors hover:text-white">{t.footer.news}</button>
            </div>

            <div className="flex flex-col items-center gap-5 md:items-start">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">{t.footer.help}</h2>
              <button onClick={() => document.getElementById("tracking")?.scrollIntoView({ behavior: "smooth" })} className="text-sm text-white/45 transition-colors hover:text-white">{t.footer.tracking}</button>
              <button onClick={() => setIsCartOpen(true)} className="text-sm text-white/45 transition-colors hover:text-white">{t.footer.cart}</button>
              <button onClick={toggleLang} className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/50 transition-colors hover:border-white/20 hover:text-white">
                <Globe className="h-3.5 w-3.5" />
                {lang === "es" ? "ESPAÑOL" : "ENGLISH"}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] py-5 text-center md:flex-row md:text-left">
            <p className="text-[11px] text-white/35">{t.footer.rights}</p>
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="text-[11px] text-white/40 transition-colors hover:text-white">
              {lang === "es" ? "Volver arriba ↑" : "Back to top ↑"}
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
