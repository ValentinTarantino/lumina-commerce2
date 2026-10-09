import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LangStore {
  lang: 'es' | 'en';
  setLang: (lang: 'es' | 'en') => void;
  toggleLang: () => void;
}

export const useLang = create<LangStore>()(
  persist(
    (set) => ({
      lang: 'es',
      setLang: (lang) => set({ lang }),
      toggleLang: () => set((state) => ({ lang: state.lang === 'es' ? 'en' : 'es' })),
    }),
    {
      name: 'lumina-language-storage',
    }
  )
);
