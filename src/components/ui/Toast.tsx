"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    // Las alertas de warning duran más (6s) para que el empleado las vea
    const duration = type === "warning" ? 6000 : 3000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (msg) => add("success", msg),
    error:   (msg) => add("error", msg),
    warning: (msg) => add("warning", msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}

// ─── Contenedor de toasts ─────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastItem[];
  onClose: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={onClose} />
      ))}
    </div>
  );
}

// ─── Tarjeta individual ───────────────────────────────────────────────────────

const STYLES: Record<ToastType, { border: string; bg: string; text: string; btn: string; icon: string }> = {
  success: {
    border: "border-emerald-700/60",
    bg:     "bg-emerald-950/90",
    text:   "text-emerald-200",
    btn:    "text-emerald-500 hover:text-emerald-300",
    icon:   "✓",
  },
  error: {
    border: "border-red-700/60",
    bg:     "bg-red-950/90",
    text:   "text-red-200",
    btn:    "text-red-500 hover:text-red-300",
    icon:   "✗",
  },
  warning: {
    border: "border-amber-600/60",
    bg:     "bg-amber-950/90",
    text:   "text-amber-200",
    btn:    "text-amber-500 hover:text-amber-300",
    icon:   "⚠",
  },
};

function ToastCard({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: (id: number) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const s = STYLES[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all duration-300 min-w-[280px] max-w-[360px]
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}
        ${s.border} ${s.bg} ${s.text}`}
    >
      <span className="text-base mt-0.5 shrink-0">{s.icon}</span>
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className={`shrink-0 text-lg leading-none transition ${s.btn}`}
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  );
}
