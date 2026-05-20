"use client";

import { loginAction } from "@/app/actions/auth";
import type { Rol } from "@/lib/session";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

// ─── Teclado numérico ────────────────────────────────────────────────────────

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "borrar", "0", ""];

function TecladoPin({
  onDigito,
  onBorrar,
}: {
  onDigito: (d: string) => void;
  onBorrar: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
      {TECLAS.map((tecla, i) => {
        if (tecla === "") return <div key={i} />;

        if (tecla === "borrar") {
          return (
            <button
              key={i}
              type="button"
              onClick={onBorrar}
              className="flex items-center justify-center h-14 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-300 transition select-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6H6a2 2 0 00-2 2v8a2 2 0 002 2h6l4-4-4-4z" />
              </svg>
            </button>
          );
        }

        return (
          <button
            key={i}
            type="button"
            onClick={() => onDigito(tecla)}
            className="flex items-center justify-center h-14 rounded-xl bg-gray-800 hover:bg-brand-700 active:bg-brand-600 text-white text-xl font-semibold transition select-none"
          >
            {tecla}
          </button>
        );
      })}
    </div>
  );
}

// ─── Indicador de dígitos ─────────────────────────────────────────────────────

function PuntosPIN({ cantidad, error }: { cantidad: number; error: boolean }) {
  return (
    <div className={`flex gap-4 ${error ? "animate-shake" : ""}`}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
            i < cantidad
              ? "bg-brand-500 border-brand-500 scale-110"
              : "bg-transparent border-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Fase = "seleccion" | "pin";

export default function LoginPage() {
  const [fase, setFase] = useState<Fase>("seleccion");
  const [rolSeleccionado, setRolSeleccionado] = useState<Rol | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(false);

  function seleccionarRol(rol: Rol) {
    setRolSeleccionado(rol);
    setPin("");
    setError(false);
    setFase("pin");
  }

  function cancelar() {
    setFase("seleccion");
    setRolSeleccionado(null);
    setPin("");
    setError(false);
    setCargando(false);
  }

  function agregarDigito(d: string) {
    if (cargando || pin.length >= 4) return;
    setPin((prev) => prev + d);
    setError(false);
  }

  function borrarDigito() {
    if (cargando) return;
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  }

  const verificarPin = useCallback(
    async (pinCompleto: string) => {
      if (!rolSeleccionado) return;
      setCargando(true);
      const resultado = await loginAction(rolSeleccionado, pinCompleto);
      // Si llegamos aquí es porque loginAction devolvió error (redirect no llega)
      if (resultado?.error) {
        setError(true);
        setTimeout(() => {
          setPin("");
          setError(false);
          setCargando(false);
        }, 700);
      }
    },
    [rolSeleccionado]
  );

  // Auto-submit al llegar a 4 dígitos
  useEffect(() => {
    if (pin.length === 4) {
      verificarPin(pin);
    }
  }, [pin, verificarPin]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
      {/* Logo */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-40 h-40 rounded-full overflow-hidden mb-4">
          <Image src="/logo.png" alt="Zona One" width={160} height={160} priority />
        </div>
        <h1 className="text-2xl font-bold text-white">Zona One</h1>
      </div>

      {/* ── Fase 1: Selección de rol ── */}
      {fase === "seleccion" && (
        <div className="w-full max-w-sm space-y-3">
          <p className="text-center text-gray-400 text-sm mb-6">
            ¿Cómo vas a entrar hoy?
          </p>

          <button
            onClick={() => seleccionarRol("EMPLEADO")}
            className="w-full flex items-center gap-4 p-5 bg-gray-900 border border-gray-800 hover:border-brand-600 hover:bg-gray-800 rounded-2xl transition group"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-800 group-hover:bg-brand-600/20 flex items-center justify-center shrink-0 transition">
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">Turno de Trabajo</p>
              <p className="text-gray-400 text-sm">Registrar operaciones del día</p>
            </div>
            <svg className="w-5 h-5 text-gray-600 group-hover:text-brand-400 ml-auto transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => seleccionarRol("DUENO")}
            className="w-full flex items-center gap-4 p-5 bg-gray-900 border border-gray-800 hover:border-brand-600 hover:bg-gray-800 rounded-2xl transition group"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-800 group-hover:bg-brand-600/20 flex items-center justify-center shrink-0 transition">
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">Administración</p>
              <p className="text-gray-400 text-sm">Reportes, configuración y más</p>
            </div>
            <svg className="w-5 h-5 text-gray-600 group-hover:text-brand-400 ml-auto transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Fase 2: Ingreso de PIN ── */}
      {fase === "pin" && (
        <div className="flex flex-col items-center gap-8 w-full max-w-sm">
          {/* Encabezado del rol */}
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Ingresando como</p>
            <p className="text-white font-semibold text-lg">
              {rolSeleccionado === "DUENO" ? "Administración" : "Turno de Trabajo"}
            </p>
          </div>

          {/* Indicador de progreso */}
          <PuntosPIN cantidad={pin.length} error={error} />

          {/* Mensaje de error */}
          <div className={`text-red-400 text-sm transition-opacity ${error ? "opacity-100" : "opacity-0"}`}>
            PIN incorrecto
          </div>

          {/* Teclado */}
          <TecladoPin onDigito={agregarDigito} onBorrar={borrarDigito} />

          {/* Cancelar */}
          <button
            onClick={cancelar}
            className="text-gray-500 hover:text-gray-300 text-sm transition"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
