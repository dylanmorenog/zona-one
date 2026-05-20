"use client";

import { logoutAction } from "@/app/actions/auth";
import type { Rol } from "@/lib/session";
import { useEffect, useState } from "react";

function RelojFecha() {
  const [ahora, setAhora] = useState<Date | null>(null);

  useEffect(() => {
    setAhora(new Date());
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!ahora) return null;

  const fecha = ahora.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hora = ahora.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="text-right">
      <p className="text-white text-sm font-medium tabular-nums">{hora}</p>
      <p className="text-gray-500 text-xs capitalize">{fecha}</p>
    </div>
  );
}

export function Header({ rol }: { rol: Rol }) {
  const esDueno = rol === "DUENO";

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
      {/* Turno activo */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            esDueno
              ? "bg-violet-500/15 text-violet-400"
              : "bg-emerald-500/15 text-emerald-400"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {esDueno ? "Administración" : "Turno de Trabajo"}
        </span>
      </div>

      {/* Reloj + cerrar sesión */}
      <div className="flex items-center gap-6">
        <RelojFecha />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Cerrar sesión
          </button>
        </form>
      </div>
    </header>
  );
}
