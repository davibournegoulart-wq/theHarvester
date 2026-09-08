"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "net-scraper-active-case";

type ActiveCase = { id: string; name: string } | null;

type ActiveCaseContextValue = {
  activeCase: ActiveCase;
  setActiveCase: (c: ActiveCase) => void;
  hydrated: boolean;
};

const ActiveCaseContext = createContext<ActiveCaseContextValue | null>(null);

export function ActiveCaseProvider({ children }: { children: ReactNode }) {
  const [activeCase, setActiveCaseState] = useState<ActiveCase>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setActiveCaseState(JSON.parse(raw));
    } catch {
      // localStorage indisponível — segue sem caso ativo restaurado
    } finally {
      setHydrated(true);
    }
  }, []);

  function setActiveCase(c: ActiveCase) {
    setActiveCaseState(c);
    try {
      if (c) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // segue funcionando só em memória
    }
  }

  return (
    <ActiveCaseContext.Provider value={{ activeCase, setActiveCase, hydrated }}>{children}</ActiveCaseContext.Provider>
  );
}

export function useActiveCase(): ActiveCaseContextValue {
  const ctx = useContext(ActiveCaseContext);
  if (!ctx) throw new Error("useActiveCase precisa estar dentro de ActiveCaseProvider");
  return ctx;
}
