"use client";

import { registrarServicio } from "@/app/actions/servicios";
import { useRouter } from "next/navigation";
import { useState } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TipoServicio {
  id: number;
  nombre: string;
  precioBase: number;
  porUnidad: boolean;
}

interface RegistroServicio {
  id: number;
  hora: string;
  tipoNombre: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  metodoPago: "EFECTIVO" | "TARJETA";
  notas: string | null;
}

interface Props {
  tipos: TipoServicio[];
  serviciosHoy: RegistroServicio[];
  totalHoy: number;
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function ServiciosPanel({ tipos, serviciosHoy, totalHoy }: Props) {
  const router = useRouter();
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoServicio | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegistrar(data: {
    tipoId: number;
    cantidad: number;
    precioUnitario: number;
    notas?: string;
    metodoPago: "EFECTIVO" | "TARJETA";
  }) {
    setCargando(true);
    setError(null);
    try {
      await registrarServicio(data);
      setTipoSeleccionado(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex gap-5 h-full">
      {/* ── Botones de servicio ── */}
      <div className="flex-1 space-y-4 min-w-0">
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {tipos.map((tipo) => {
            const esOtro = tipo.precioBase === 0;
            return (
              <button
                key={tipo.id}
                onClick={() => setTipoSeleccionado(tipo)}
                className={`flex flex-col items-center justify-center rounded-xl border px-3 py-5 text-center transition active:scale-95 ${
                  esOtro
                    ? "border-dashed border-gray-600 bg-gray-800/40 hover:border-gray-500 hover:bg-gray-800/60"
                    : "border-gray-700/60 bg-gray-800/60 hover:border-brand-600/60 hover:bg-gray-800"
                }`}
              >
                <span className="text-sm font-semibold leading-tight text-white">
                  {tipo.nombre}
                </span>
                <span
                  className={`mt-1.5 text-sm font-medium ${
                    esOtro ? "text-gray-500" : "text-brand-400"
                  }`}
                >
                  {esOtro
                    ? "Precio libre"
                    : tipo.porUnidad
                    ? `$${tipo.precioBase.toFixed(0)} c/u`
                    : `$${tipo.precioBase.toFixed(0)}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Panel derecho: total + historial ── */}
      <div className="w-72 shrink-0 flex flex-col gap-4">
        {/* Total del día */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
            Total del día
          </p>
          <p className="text-4xl font-bold text-white">
            ${totalHoy.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {serviciosHoy.length} servicio{serviciosHoy.length !== 1 ? "s" : ""} registrado{serviciosHoy.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Historial del día */}
        <div className="flex-1 rounded-xl border border-gray-800 bg-gray-900 flex flex-col min-h-0">
          <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Historial de hoy
          </p>

          {serviciosHoy.length === 0 ? (
            <div className="flex-1 flex items-center justify-center pb-6">
              <p className="text-sm text-gray-600">Sin registros hoy</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60">
              {serviciosHoy.map((s) => {
                const hora = new Date(s.hora).toLocaleTimeString("es-MX", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const nombre =
                  s.notas && s.tipoNombre === "Otro" ? s.notas : s.tipoNombre;

                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="shrink-0 font-mono text-xs text-gray-500">
                      {hora}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-gray-200">
                        {nombre}
                        {s.cantidad > 1 && (
                          <span className="ml-1 text-gray-500">x{s.cantidad}</span>
                        )}
                      </p>
                      <span
                        className={`text-xs ${
                          s.metodoPago === "TARJETA"
                            ? "text-violet-400"
                            : "text-gray-600"
                        }`}
                      >
                        {s.metodoPago === "TARJETA" ? "Tarjeta" : "Efectivo"}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-white">
                      ${s.total.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de registro ── */}
      {tipoSeleccionado && (
        <ModalRegistrar
          tipo={tipoSeleccionado}
          cargando={cargando}
          onConfirmar={handleRegistrar}
          onCancelar={() => setTipoSeleccionado(null)}
        />
      )}
    </div>
  );
}

// ─── Modal de registro ────────────────────────────────────────────────────────

function ModalRegistrar({
  tipo,
  cargando,
  onConfirmar,
  onCancelar,
}: {
  tipo: TipoServicio;
  cargando: boolean;
  onConfirmar: (data: {
    tipoId: number;
    cantidad: number;
    precioUnitario: number;
    notas?: string;
    metodoPago: "EFECTIVO" | "TARJETA";
  }) => void;
  onCancelar: () => void;
}) {
  const esPersonalizado = tipo.precioBase === 0;

  const [cantidad, setCantidad] = useState(1);
  const [precioInput, setPrecioInput] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [metodoPago, setMetodoPago] = useState<"EFECTIVO" | "TARJETA">("EFECTIVO");

  const precioUnitario = esPersonalizado
    ? parseFloat(precioInput) || 0
    : tipo.precioBase;
  const total = tipo.porUnidad ? cantidad * precioUnitario : precioUnitario;

  const puedeConfirmar =
    !cargando && precioUnitario > 0 && (!esPersonalizado || descripcion.trim() !== "");

  function handleConfirmar() {
    if (!puedeConfirmar) return;
    onConfirmar({
      tipoId: tipo.id,
      cantidad: tipo.porUnidad ? cantidad : 1,
      precioUnitario,
      notas: descripcion.trim() || undefined,
      metodoPago,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        {/* Título */}
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">{tipo.nombre}</h2>
          {!esPersonalizado && (
            <p className="text-sm text-gray-400">
              {tipo.porUnidad
                ? `$${tipo.precioBase.toFixed(0)} por unidad`
                : `Precio fijo: $${tipo.precioBase.toFixed(0)}`}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {/* Descripción (solo para "Otro") */}
          {esPersonalizado && (
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">
                Descripción
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="¿Qué servicio fue?"
                autoFocus
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
              />
            </div>
          )}

          {/* Precio (solo para servicios personalizados) */}
          {esPersonalizado && (
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Precio</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={precioInput}
                  onChange={(e) => setPrecioInput(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-7 pr-3 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Cantidad (solo porUnidad) */}
          {tipo.porUnidad && (
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Cantidad</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCantidad((v) => Math.max(1, v - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-600 bg-gray-800 text-lg text-white hover:bg-gray-700"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) =>
                    setCantidad(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-16 rounded-lg border border-gray-700 bg-gray-800 py-2 text-center text-lg font-semibold text-white focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={() => setCantidad((v) => v + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-600 bg-gray-800 text-lg text-white hover:bg-gray-700"
                >
                  +
                </button>
                <span className="text-sm text-gray-500">
                  = ${(cantidad * precioUnitario).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Método de pago */}
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">
              Método de pago
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["EFECTIVO", "TARJETA"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodoPago(m)}
                  className={`rounded-lg border py-2.5 text-sm font-medium transition ${
                    metodoPago === m
                      ? "border-brand-500 bg-brand-600/20 text-brand-300"
                      : "border-gray-600 bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {m === "EFECTIVO" ? "Efectivo" : "Tarjeta"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="my-5 rounded-lg border border-gray-800 bg-gray-800/50 p-4 text-center">
          <p className="mb-0.5 text-xs text-gray-500">Total</p>
          <p className="text-3xl font-bold text-white">${total.toFixed(2)}</p>
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            disabled={cargando}
            className="flex-1 rounded-lg border border-gray-600 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!puedeConfirmar}
            className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-40"
          >
            {cargando ? "Guardando..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
