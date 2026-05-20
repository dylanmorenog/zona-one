"use client";

import {
  agregarControlXbox,
  agregarTiempoXbox,
  agregarTiempoYReanudar,
  editarSesionXbox,
  iniciarSesionXbox,
  pausarSesion,
  reanudarSesion,
  terminarSesionXbox,
} from "@/app/actions/xbox";
import {
  calcularMontoXbox,
  formatearTiempo,
  PRESETS_TIEMPO,
  type ConfigXbox,
} from "@/lib/xbox";
import { useToast } from "@/components/ui/Toast";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function fmtMinutos(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SesionActiva {
  id: number;
  inicio: string;
  tiempoDefinidoMinutos: number | null;
  controlesExtra: number;
  pausadoEn: string | null;
}

interface Consola {
  id: number;
  nombre: string;
  numero: number;
  sesionActiva: SesionActiva | null;
}

interface Props {
  consolas: Consola[];
  config: ConfigXbox | null;
}

// ─── Grid principal ───────────────────────────────────────────────────────────

export function XboxGrid({ consolas, config }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [cargando, setCargando] = useState<number | null>(null);
  const [modalCobro, setModalCobro] = useState<Consola | null>(null);
  const [modalEditar, setModalEditar] = useState<Consola | null>(null);

  async function ejecutar<T>(id: number, fn: () => Promise<T>, mensajeExito?: string) {
    setCargando(id);
    try {
      await fn();
      router.refresh();
      if (mensajeExito) toast.success(mensajeExito);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ocurrió un error");
    } finally {
      setCargando(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {consolas.map((consola) => (
          <ConsolaCard
            key={consola.id}
            consola={consola}
            config={config}
            cargandoId={cargando}
            onIniciarLibre={() =>
              ejecutar(consola.id, () => iniciarSesionXbox(consola.id), "Sesión iniciada")
            }
            onIniciarConTiempo={(min) =>
              ejecutar(consola.id, () => iniciarSesionXbox(consola.id, min), "Sesión iniciada")
            }
            onAgregarControl={() =>
              ejecutar(consola.sesionActiva!.id, () =>
                agregarControlXbox(consola.sesionActiva!.id), "Control agregado"
              )
            }
            onAgregarTiempo={(min) => {
              if (!Number.isInteger(min) || min < 1) {
                toast.error("Los minutos a agregar deben ser mayor o igual a 1");
                return;
              }
              ejecutar(consola.sesionActiva!.id, () =>
                agregarTiempoXbox(consola.sesionActiva!.id, min), "Tiempo agregado"
              );
            }}
            onAgregarTiempoYReanudar={(min) => {
              if (!Number.isInteger(min) || min < 1) {
                toast.error("Los minutos a agregar deben ser mayor o igual a 1");
                return;
              }
              ejecutar(consola.sesionActiva!.id, () =>
                agregarTiempoYReanudar(consola.sesionActiva!.id, min), "Tiempo agregado — sesión reanudada"
              );
            }}
            onEditar={() => setModalEditar(consola)}
            onPausar={() =>
              ejecutar(consola.sesionActiva!.id, () =>
                pausarSesion(consola.sesionActiva!.id), "Sesión pausada"
              )
            }
            onReanudar={() =>
              ejecutar(consola.sesionActiva!.id, () =>
                reanudarSesion(consola.sesionActiva!.id), "Sesión reanudada"
              )
            }
            onCobrar={() => setModalCobro(consola)}
          />
        ))}
      </div>

      {config && <ListaPrecios config={config} />}

      {modalEditar?.sesionActiva && config && (
        <ModalEditarSesion
          consola={modalEditar}
          sesion={modalEditar.sesionActiva}
          config={config}
          cargando={cargando === modalEditar.sesionActiva.id}
          onConfirmar={async (nuevoTiempo) => {
            await ejecutar(
              modalEditar.sesionActiva!.id,
              () => editarSesionXbox(modalEditar.sesionActiva!.id, nuevoTiempo),
              "Sesión actualizada"
            );
            setModalEditar(null);
          }}
          onCancelar={() => setModalEditar(null)}
        />
      )}

      {modalCobro?.sesionActiva && config && (
        <ModalCobro
          consola={modalCobro}
          sesion={modalCobro.sesionActiva}
          config={config}
          cargando={cargando === modalCobro.sesionActiva.id}
          onConfirmar={async (sesionId, metodoPago) => {
            await ejecutar(sesionId, () =>
              terminarSesionXbox({ sesionId, metodoPago }), "Sesión cerrada"
            );
            setModalCobro(null);
          }}
          onCancelar={() => setModalCobro(null)}
        />
      )}
    </div>
  );
}

// ─── Tarjeta de consola ───────────────────────────────────────────────────────

type ModoIniciar = "idle" | "eligiendo" | "eligiendo-tiempo";

function ConsolaCard({
  consola,
  config,
  cargandoId,
  onIniciarLibre,
  onIniciarConTiempo,
  onAgregarControl,
  onAgregarTiempo,
  onAgregarTiempoYReanudar,
  onEditar,
  onPausar,
  onReanudar,
  onCobrar,
}: {
  consola: Consola;
  config: ConfigXbox | null;
  cargandoId: number | null;
  onIniciarLibre: () => void;
  onIniciarConTiempo: (minutos: number) => void;
  onAgregarControl: () => void;
  onAgregarTiempo: (minutos: number) => void;
  onAgregarTiempoYReanudar: (minutos: number) => void;
  onEditar: () => void;
  onPausar: () => void;
  onReanudar: () => void;
  onCobrar: () => void;
}) {
  const sesion = consola.sesionActiva;
  const activa = !!sesion;
  const cargando =
    cargandoId === consola.id ||
    (sesion ? cargandoId === sesion.id : false);

  const [segundos, setSegundos] = useState(0);
  const [modoIniciar, setModoIniciar] = useState<ModoIniciar>("idle");
  const [menuMas, setMenuMas] = useState(false);
  const [subAgregarTiempo, setSubAgregarTiempo] = useState(false);
  const refMenuMas = useRef<HTMLDivElement>(null);

  // Cerrar menú + al click afuera
  useEffect(() => {
    if (!menuMas) return;
    function handler(e: MouseEvent) {
      if (refMenuMas.current && !refMenuMas.current.contains(e.target as Node)) {
        setMenuMas(false);
        setSubAgregarTiempo(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuMas]);

  // Resetear modo iniciar si la consola cambia de estado
  useEffect(() => {
    setModoIniciar("idle");
    setMenuMas(false);
    setSubAgregarTiempo(false);
  }, [activa]);

  // Cronómetro — se congela si está pausada
  const pausado = !!sesion?.pausadoEn;

  useEffect(() => {
    if (!sesion) { setSegundos(0); return; }
    if (sesion.pausadoEn) {
      // Congelar en el momento de la pausa
      const inicio = new Date(sesion.inicio).getTime();
      const pausa = new Date(sesion.pausadoEn).getTime();
      setSegundos(Math.floor((pausa - inicio) / 1000));
      return;
    }
    const inicio = new Date(sesion.inicio).getTime();
    const tick = () => setSegundos(Math.floor((Date.now() - inicio) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sesion]);

  // Display del tiempo
  const esTiempoDefinido = sesion?.tiempoDefinidoMinutos != null;
  const segundosTotales = esTiempoDefinido ? sesion!.tiempoDefinidoMinutos! * 60 : 0;
  const segundosRestantes = segundosTotales - segundos;
  const tiempoTerminado = esTiempoDefinido && segundosRestantes <= 0;
  const advertencia = esTiempoDefinido && segundosRestantes > 0 && segundosRestantes <= 300;

  const tiempoDisplay = esTiempoDefinido
    ? tiempoTerminado
      ? `+${formatearTiempo(Math.abs(segundosRestantes))}`
      : formatearTiempo(segundosRestantes)
    : formatearTiempo(segundos);

  const montoActual =
    activa && config
      ? calcularMontoXbox(
          sesion!.tiempoDefinidoMinutos ?? Math.max(1, Math.ceil(segundos / 60)),
          sesion!.controlesExtra,
          config
        ).total
      : 0;

  const colorTiempo = pausado
    ? "text-amber-400"
    : tiempoTerminado
    ? "text-red-400"
    : advertencia
    ? "text-amber-400"
    : "text-white";

  return (
    <div
      className={`flex flex-col rounded-xl border p-5 transition-colors ${
        activa
          ? pausado
            ? "border-amber-700/50 bg-amber-950/20"
            : tiempoTerminado
            ? "border-red-700/50 bg-red-950/20"
            : "border-brand-700/50 bg-brand-950/30"
          : "border-gray-700/50 bg-gray-800/50"
      }`}
    >
      {/* Encabezado */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl ${
              activa
                ? pausado
                  ? "bg-amber-600/20"
                  : tiempoTerminado
                  ? "bg-red-600/20"
                  : "bg-brand-600/20"
                : "bg-gray-700/50"
            }`}
          >
            🎮
          </div>
          <div>
            <p className="font-semibold text-white">{consola.nombre}</p>
            {sesion && sesion.controlesExtra > 0 ? (
              <p className="text-xs text-gray-400">
                +{sesion.controlesExtra} control{sesion.controlesExtra > 1 ? "es" : ""} extra
              </p>
            ) : (
              <p className="text-xs text-gray-500">Consola {consola.numero}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {esTiempoDefinido && !tiempoTerminado && (
            <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
              {fmtMinutos(sesion!.tiempoDefinidoMinutos!)}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              activa
                ? pausado
                  ? "bg-amber-900/40 text-amber-400"
                  : tiempoTerminado
                  ? "bg-red-900/40 text-red-400"
                  : "bg-red-900/30 text-red-400"
                : "bg-emerald-900/30 text-emerald-400"
            }`}
          >
            {activa ? (pausado ? "Pausado" : tiempoTerminado ? "¡Tiempo!" : "En juego") : "Libre"}
          </span>
        </div>
      </div>

      {/* Cronómetro */}
      <div className="mb-5 flex-1">
        {activa ? (
          <>
            <p className={`font-mono text-4xl font-bold tracking-widest ${colorTiempo}`}>
              {tiempoDisplay}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              ${montoActual.toFixed(2)}{" "}
              {tiempoTerminado ? "— tiempo agotado" : "en curso"}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-600">Sin sesión activa</p>
        )}
      </div>

      {/* Botones de acción */}
      {activa ? (
        <div className="space-y-2">
          {pausado ? (
            tiempoTerminado ? (
              /* Tiempo expirado: Cobrar + presets para agregar más tiempo */
              <div className="space-y-2">
                <button
                  onClick={onCobrar}
                  disabled={cargando}
                  className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
                >
                  Cobrar
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESETS_TIEMPO.filter(p => p.minutos >= 30).map((p) => (
                    <button
                      key={p.minutos}
                      onClick={() => onAgregarTiempoYReanudar(p.minutos)}
                      disabled={cargando}
                      className="rounded-lg border border-amber-600/40 bg-amber-950/20 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-950/40 disabled:opacity-50"
                    >
                      {cargando ? "..." : `+${p.label}`}
                      {config && (
                        <span className="ml-1 text-amber-500/70">
                          ${calcularMontoXbox(p.minutos, 0, config).montoTiempo.toFixed(0)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Pausa manual: Cobrar + Reanudar */
              <div className="flex gap-2">
                <button
                  onClick={onCobrar}
                  disabled={cargando}
                  className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
                >
                  Cobrar
                </button>
                <button
                  onClick={onReanudar}
                  disabled={cargando}
                  className="flex-1 rounded-lg border border-amber-600/50 bg-amber-950/30 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-950/50 disabled:opacity-50"
                >
                  {cargando ? "..." : "Reanudar"}
                </button>
              </div>
            )
          ) : (
          <div className="flex gap-2">
            {/* Pausar */}
            <button
              onClick={onPausar}
              disabled={cargando}
              className="flex-1 rounded-lg border border-gray-600 bg-gray-700/50 py-2.5 text-sm font-semibold text-gray-200 transition hover:bg-gray-700 disabled:opacity-50"
            >
              {cargando ? "..." : "Pausar"}
            </button>

            {/* Botón + con menú */}
            <div className="relative" ref={refMenuMas}>
              <button
                onClick={() => { setMenuMas((v) => !v); setSubAgregarTiempo(false); }}
                disabled={cargando}
                title="Agregar control o tiempo"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-600 bg-gray-800 text-xl font-bold text-white transition hover:bg-gray-700 disabled:opacity-50"
              >
                +
              </button>

              {menuMas && (
                <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
                  {!subAgregarTiempo ? (
                    <>
                      <button
                        onClick={() => { setMenuMas(false); onAgregarControl(); }}
                        disabled={sesion.controlesExtra >= 4}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-gray-800 disabled:opacity-40"
                      >
                        <span>🎮</span>
                        <span className="text-gray-100">
                          Control extra
                          <span className="ml-2 text-gray-500">+$5</span>
                        </span>
                      </button>
                      <div className="h-px bg-gray-800" />
                      <button
                        onClick={() => setSubAgregarTiempo(true)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-gray-800"
                      >
                        <span>⏱</span>
                        <span className="text-gray-100">Agregar tiempo</span>
                        <svg className="ml-auto h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div className="h-px bg-gray-800" />
                      <button
                        onClick={() => { setMenuMas(false); onEditar(); }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-gray-800"
                      >
                        <span>✏️</span>
                        <span className="text-gray-100">Editar sesión</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setSubAgregarTiempo(false)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-gray-500 transition hover:bg-gray-800"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        Agregar tiempo
                      </button>
                      <div className="h-px bg-gray-800" />
                      {PRESETS_TIEMPO.map((p) => (
                        <button
                          key={p.minutos}
                          onClick={() => { setMenuMas(false); setSubAgregarTiempo(false); onAgregarTiempo(p.minutos); }}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-sm transition hover:bg-gray-800"
                        >
                          <span className="text-gray-100">+{p.label}</span>
                          {config && (
                            <span className="text-gray-500">
                              +${calcularMontoXbox(p.minutos, 0, config).montoTiempo.toFixed(0)}
                            </span>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      ) : (
        /* ── Iniciar sesión: estados inline ── */
        <div className="space-y-2">
          {modoIniciar === "idle" && (
            <button
              onClick={() => setModoIniciar("eligiendo")}
              disabled={cargando}
              className="w-full rounded-lg border border-gray-600 bg-gray-700/50 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-gray-700 disabled:opacity-50"
            >
              {cargando ? "Iniciando..." : "Iniciar sesión"}
            </button>
          )}

          {modoIniciar === "eligiendo" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setModoIniciar("idle"); onIniciarLibre(); }}
                  disabled={cargando}
                  className="flex flex-col items-center rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-3 text-left transition hover:bg-gray-700 disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-white">Tiempo Libre</span>
                  <span className="text-xs text-gray-500">Cobra al final</span>
                </button>
                <button
                  onClick={() => setModoIniciar("eligiendo-tiempo")}
                  disabled={cargando}
                  className="flex flex-col items-center rounded-lg border border-gray-600 bg-gray-700/60 px-3 py-3 text-left transition hover:bg-gray-700 disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-white">Poner tiempo</span>
                  <span className="text-xs text-gray-500">Tiempo fijo</span>
                </button>
              </div>
              <button
                onClick={() => setModoIniciar("idle")}
                className="w-full text-xs text-gray-600 transition hover:text-gray-400"
              >
                Cancelar
              </button>
            </>
          )}

          {modoIniciar === "eligiendo-tiempo" && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS_TIEMPO.map((p) => (
                  <button
                    key={p.minutos}
                    onClick={() => { setModoIniciar("idle"); onIniciarConTiempo(p.minutos); }}
                    disabled={cargando}
                    className="flex flex-col items-center rounded-lg border border-gray-700 bg-gray-800 px-2 py-3 transition hover:border-brand-600 hover:bg-brand-950/30 disabled:opacity-50"
                  >
                    <span className="text-sm font-semibold text-white">{p.label}</span>
                    {config && (
                      <span className="text-xs text-gray-400">
                        ${calcularMontoXbox(p.minutos, 0, config).montoTiempo.toFixed(0)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setModoIniciar("eligiendo")}
                className="w-full text-xs text-gray-600 transition hover:text-gray-400"
              >
                ← Volver
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal de edición de sesión ──────────────────────────────────────────────

function ModalEditarSesion({
  consola,
  sesion,
  config,
  cargando,
  onConfirmar,
  onCancelar,
}: {
  consola: Consola;
  sesion: SesionActiva;
  config: ConfigXbox;
  cargando: boolean;
  onConfirmar: (nuevoTiempo: number | null) => void;
  onCancelar: () => void;
}) {
  const minutosElapsed = Math.floor(
    (Date.now() - new Date(sesion.inicio).getTime()) / 60000
  );
  const [seleccion, setSeleccion] = useState<number | null | "custom">(
    sesion.tiempoDefinidoMinutos ?? null
  );
  const [custom, setCustom] = useState("");

  const tiempoFinal =
    seleccion === "custom"
      ? parseInt(custom) || 0
      : seleccion;

  const valido =
    seleccion === null ||
    (typeof tiempoFinal === "number" && tiempoFinal > minutosElapsed);

  const OPCIONES: { label: string; valor: number | null }[] = [
    { label: "Tiempo libre", valor: null },
    ...PRESETS_TIEMPO.filter((p) => p.minutos > minutosElapsed).map((p) => ({
      label: p.label,
      valor: p.minutos,
    })),
    { label: "Personalizado", valor: "custom" as unknown as number },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Editar sesión</h2>
          <p className="text-sm text-gray-500 mt-0.5">{consola.nombre} · {minutosElapsed} min transcurridos</p>
        </div>

        <div className="space-y-1.5">
          {OPCIONES.map((op) => {
            const activo = op.valor === "custom" as unknown as number
              ? seleccion === "custom"
              : seleccion === op.valor;
            return (
              <button
                key={String(op.valor)}
                onClick={() => setSeleccion(op.valor === "custom" as unknown as number ? "custom" : op.valor)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition
                  ${activo
                    ? "border-brand-500 bg-brand-950/30 text-white"
                    : "border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600"
                  }`}
              >
                <span>{op.label}</span>
                {op.valor !== null && op.valor !== ("custom" as unknown as number) && config && (
                  <span className="text-xs text-gray-500">
                    ${calcularMontoXbox(op.valor as number, sesion.controlesExtra, config).total.toFixed(0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {seleccion === "custom" && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Minutos totales (mín. {minutosElapsed + 1})</label>
            <input
              type="number"
              min={minutosElapsed + 1}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              autoFocus
              placeholder={String(minutosElapsed + 1)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
        )}

        {!valido && (
          <p className="text-xs text-red-400">
            El tiempo debe ser mayor al ya transcurrido ({minutosElapsed} min)
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancelar}
            disabled={cargando}
            className="flex-1 rounded-lg border border-gray-700 py-2.5 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => valido && onConfirmar(typeof tiempoFinal === "number" ? tiempoFinal : null)}
            disabled={!valido || cargando}
            className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40 transition"
          >
            {cargando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de cobro ───────────────────────────────────────────────────────────

function ModalCobro({
  consola,
  sesion,
  config,
  cargando,
  onConfirmar,
  onCancelar,
}: {
  consola: Consola;
  sesion: SesionActiva;
  config: ConfigXbox;
  cargando: boolean;
  onConfirmar: (sesionId: number, metodoPago: "EFECTIVO" | "TARJETA") => void;
  onCancelar: () => void;
}) {
  const [metodoPago, setMetodoPago] = useState<"EFECTIVO" | "TARJETA">("EFECTIVO");
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const inicio = new Date(sesion.inicio).getTime();
    if (sesion.pausadoEn) {
      const pausa = new Date(sesion.pausadoEn).getTime();
      setSegundos(Math.floor((pausa - inicio) / 1000));
      return;
    }
    const tick = () => setSegundos(Math.floor((Date.now() - inicio) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sesion.inicio, sesion.pausadoEn]);

  const duracionReal = Math.max(1, Math.ceil(segundos / 60));
  const minutosParaCobro = sesion.tiempoDefinidoMinutos ?? duracionReal;
  const { montoTiempo, montoControles, total } = calcularMontoXbox(
    minutosParaCobro,
    sesion.controlesExtra,
    config
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <h2 className="mb-5 text-lg font-semibold text-white">
          Cobrar — {consola.nombre}
        </h2>

        {/* Desglose */}
        <div className="mb-4 space-y-2 rounded-lg bg-gray-800/60 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Tiempo real</span>
            <span className="font-mono text-white">{formatearTiempo(segundos)}</span>
          </div>
          {sesion.tiempoDefinidoMinutos && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Tiempo cobrado</span>
              <span className="text-brand-300">{fmtMinutos(sesion.tiempoDefinidoMinutos)}</span>
            </div>
          )}
          <div className="h-px bg-gray-700" />
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Por tiempo</span>
            <span className="text-gray-200">${montoTiempo.toFixed(2)}</span>
          </div>
          {sesion.controlesExtra > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                {sesion.controlesExtra} control{sesion.controlesExtra > 1 ? "es" : ""} extra
              </span>
              <span className="text-gray-200">+${montoControles.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Método de pago */}
        <p className="mb-2 text-sm text-gray-400">Método de pago</p>
        <div className="mb-5 grid grid-cols-2 gap-2">
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

        {/* Total */}
        <div className="mb-6 rounded-lg border border-brand-700/40 bg-brand-950/30 p-4 text-center">
          <p className="mb-0.5 text-xs text-gray-500">Total a cobrar</p>
          <p className="text-4xl font-bold text-white">${total.toFixed(2)}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            disabled={cargando}
            className="flex-1 rounded-lg border border-gray-600 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(sesion.id, metodoPago)}
            disabled={cargando}
            className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
          >
            {cargando ? "Guardando..." : "Confirmar cobro"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lista de precios ─────────────────────────────────────────────────────────

function ListaPrecios({ config }: { config: ConfigXbox }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Lista de precios
      </p>
      <div className="flex flex-wrap gap-3">
        {PRESETS_TIEMPO.map((p) => {
          const monto = calcularMontoXbox(p.minutos, 0, config).montoTiempo;
          return (
            <div key={p.minutos} className="flex items-center gap-2 rounded-lg border border-gray-700/60 bg-gray-800/60 px-3 py-2">
              <span className="text-sm text-gray-400">{p.label}</span>
              <span className="text-sm font-semibold text-white">${monto.toFixed(0)}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 rounded-lg border border-gray-700/60 bg-gray-800/60 px-3 py-2">
          <span className="text-sm text-gray-400">Control extra</span>
          <span className="text-sm font-semibold text-white">+${config.precioControlExtra.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
