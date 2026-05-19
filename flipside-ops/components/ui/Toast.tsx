"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Toast = { id: number; tone: "success" | "error" | "info"; message: string };
type Ctx = { push: (t: Omit<Toast, "id">) => void };

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur, { ...t, id }]);
    setTimeout(() => {
      setItems((cur) => cur.filter((i) => i.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] space-y-2 max-w-sm">
        {items.map((i) => (
          <div
            key={i.id}
            className={
              "px-4 py-2 rounded-lg shadow border text-sm bg-surface " +
              (i.tone === "error"
                ? "border-danger-500 text-danger-700"
                : i.tone === "success"
                  ? "border-emerald-500 text-emerald-700"
                  : "border-border-soft text-ink")
            }
          >
            {i.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
