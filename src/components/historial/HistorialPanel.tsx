"use client";

import {
  getDiaActual,
  getDiaSummary,
  getListaDias,
  getComparativoSemanal,
  getReporteMensual,
  type DiaActual,
  type DiaSummary,
  type ComparativoRow,
  type ReporteMensual,
  type ListaDiasResult,
} from "@/app/actions/historial";
import { fmt } from "@/lib/financiero";
import { useEffect, useState } from "react";
import { ExportarExcel } from "./ExportarExcel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatFecha(fechaStr: string) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatFechaCorta(fechaStr: string) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function mesLabel(mesStr: string) {
  const [y, m] = mesStr.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function HistorialPanel({ rol }: { rol: string }) {
  const esDueno = rol === "DUENO";

  // Día actual
  const [diaActual, setDiaActual] = useState<DiaActual | null>(null);
  const [cargandoActual, setCargandoActual] = useState(true);

  // Lista paginada
  const [lista, setLista] = useState<ListaDiasResult | null>(null);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [pagina, setPagina] = useState(1);

  // Detalle del día seleccionado
  const [fecha, setFecha] = useState<string | null>(null);
  const [dia, setDia] = useState<DiaSummary | null>(null);
  const [cargandoDia, setCargandoDia] = useState(false);
  const [errorDia, setErrorDia] = useState<string | null>(null);

  // Reportes dueño
  const [comparativo, setComparativo] = useState<ComparativoRow[] | null>(null);
  const [reporte, setReporte] = useState<ReporteMensual | null>(null);
  const [cargandoReportes, setCargandoReportes] = useState(false);

  const [errorLista, setErrorLista] = useState<string | null>(null);

  async function cargarActual() {
    setCargandoActual(true);
    try {
      const data = await getDiaActual();
      setDiaActual(data);
    } catch { /* silencioso */ }
    finally { setCargandoActual(false); }
  }

  async function cargarLista(p: number) {
    setCargandoLista(true);
    setErrorLista(null);
    try {
      const data = await getListaDias(p);
      setLista(data);
      setPagina(data.paginaActual);
    } catch (e) {
      setErrorLista(e instanceof Error ? e.message : "Error al cargar el historial");
    } finally { setCargandoLista(false); }
  }

  async function cargarDia(f: string) {
    setFecha(f);
    setCargandoDia(true);
    setErrorDia(null);
    setDia(null);
    try {
      const data = await getDiaSummary(f);
      setDia(data);
    } catch (e) {
      setErrorDia(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setCargandoDia(false);
    }
  }

  async function cargarReportes() {
    setCargandoReportes(true);
    try {
      const [sem, mes] = await Promise.all([getComparativoSemanal(), getReporteMensual()]);
      setComparativo(sem);
      setReporte(mes);
    } catch { /* silencioso */ }
    finally { setCargandoReportes(false); }
  }

  useEffect(() => {
    cargarActual();
    cargarLista(1);
    if (esDueno) cargarReportes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function irAPagina(p: number) {
    cargarLista(p);
    setFecha(null);
    setDia(null);
  }

  return (
    <div className="space-y-6 pb-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div />
        {esDueno && <ExportarExcel />}
      </div>

      {/* Día actual — siempre visible */}
      <DiaActualCard
        data={diaActual}
        cargando={cargandoActual}
        onRefrescar={cargarActual}
      />

      {/* Separador */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-gray-800" />
        <span className="text-xs text-gray-600 uppercase tracking-wider">Historial</span>
        <div className="flex-1 border-t border-gray-800" />
      </div>

      {/* Lista paginada de días */}
      {errorLista && <p className="text-sm text-red-400">{errorLista}</p>}
      <ListaDias
        lista={lista}
        cargando={cargandoLista}
        fechaSeleccionada={fecha}
        onSeleccionar={cargarDia}
        onAnterior={() => lista && irAPagina(lista.paginaActual - 1)}
        onSiguiente={() => lista && irAPagina(lista.paginaActual + 1)}
      />

      {/* Detalle del día seleccionado */}
      {cargandoDia && (
        <p className="text-sm text-gray-500">Cargando detalle...</p>
      )}
      {errorDia && <p className="text-sm text-red-400">{errorDia}</p>}
      {dia && fecha && <ResumenDia dia={dia} fecha={fecha} />}

      {/* Reportes dueño */}
      {esDueno && (
        <div className="space-y-6">
          {cargandoReportes && <p className="text-sm text-gray-600">Cargando reportes...</p>}
          {comparativo !== null && comparativo.length > 0 && (
            <ComparativoSemanal rows={comparativo} />
          )}
          {reporte !== null && <ReporteMensualView reporte={reporte} />}
        </div>
      )}
    </div>
  );
}

// ─── Día actual ───────────────────────────────────────────────────────────────

function DiaActualCard({
  data,
  cargando,
  onRefrescar,
}: {
  data: DiaActual | null;
  cargando: boolean;
  onRefrescar: () => void;
}) {
  const hoyLabel = (() => {
    const d = new Date();
    const s = d.toLocaleDateString("es-MX", {
      weekday: "long", day: "numeric", month: "long",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  return (
    <div className={`rounded-xl border bg-gray-900 overflow-hidden ${
      data?.cerrado ? "border-gray-700" : "border-brand-600/40"
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        data?.cerrado ? "border-gray-800" : "border-brand-600/20"
      }`}>
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
            data?.cerrado
              ? "bg-gray-800 text-gray-400"
              : "bg-brand-600/20 text-brand-400"
          }`}>
            {data?.cerrado ? "Cerrado" : "● Hoy"}
          </span>
          <span className="text-sm font-medium text-white">{hoyLabel}</span>
          {data && !data.cerrado && data.retirosPendientes > 0 && (
            <span className="text-xs font-medium bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
              {data.retirosPendientes} pendiente{data.retirosPendientes !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={onRefrescar}
          disabled={cargando}
          className="text-xs text-gray-500 hover:text-gray-300 transition disabled:opacity-40"
        >
          {cargando ? "..." : "↺ Actualizar"}
        </button>
      </div>

      {cargando && !data && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-gray-600">Cargando...</p>
        </div>
      )}

      {data && (
        <>
          {/* Datos del día */}
          <div className="grid grid-cols-2 divide-x divide-gray-800/60">
            {/* Caja chica */}
            <div className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Caja chica del día
              </p>
              <FilaArea label="Xbox" value={data.totalXbox} color="text-violet-400" />
              <FilaArea label="Servicios" value={data.totalServicios} color="text-sky-400" />
              <FilaArea label="Productos (efectivo)" value={data.totalProductosEfectivo} color="text-amber-400" />
              {data.totalProductosTarjeta > 0 && (
                <FilaArea label="Productos (tarjeta)" value={data.totalProductosTarjeta} color="text-purple-400" />
              )}
              <FilaArea label="Comisiones" value={data.totalComisiones} color="text-emerald-400" />
              <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-400">Total</span>
                <span className="text-base font-bold text-white">${fmt(data.cajaChicaTotal)}</span>
              </div>
              {data.totalGastos > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Gastos</span>
                  <span className="text-xs text-red-400">−${fmt(data.totalGastos)}</span>
                </div>
              )}
            </div>

            {/* Financiero */}
            <div className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Financiero
              </p>
              {data.tieneApertura ? (
                <>
                  <FilaArea label="Efectivo empleada" value={data.efectivoEmpleada!} color="text-white" />
                  <FilaArea label="Tarjeta (esperado)" value={data.saldoTarjeta!} color="text-white" />
                  {data.bolsaAzul !== null && (
                    <FilaArea label="Bolsa azul" value={data.bolsaAzul} color="text-blue-400" />
                  )}
                  {!data.cerrado && data.retirosPendientes > 0 && (
                    <p className="text-xs text-amber-400 pt-1">
                      {data.retirosPendientes} retiro{data.retirosPendientes !== 1 ? "s" : ""} sin entregar
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-600">Sin apertura financiero</p>
              )}
            </div>
          </div>

          {/* Cuentas del cierre — solo si cerrado */}
          {data.cerrado && data.cierre && (
            <div className="border-t border-gray-800">
              <div className="px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Cuentas del cierre
                </p>
              </div>
              <div className="divide-y divide-gray-800/60">
                <FilaCuenta
                  numero={1}
                  label="Caja chica física"
                  entregado={data.cierre.efectivoReal}
                  esperado={data.cierre.efectivoEsperado}
                  diferencia={data.cierre.diferencia}
                />
                {data.cierreFinanciero ? (
                  <>
                    <FilaCuenta
                      numero={2}
                      label="Sobrante → caja azul"
                      entregado={data.cierreFinanciero.sobranteEntregado}
                      esperado={data.cierreFinanciero.sobranteCalculado}
                      diferencia={data.cierreFinanciero.diferenciaSobrante}
                    />
                    <FilaCuenta
                      numero={3}
                      label="Saldo en tarjeta"
                      entregado={data.cierreFinanciero.saldoTarjetaReportado}
                      esperado={data.cierreFinanciero.saldoTarjetaEsperado}
                      diferencia={data.cierreFinanciero.diferenciaTarjeta}
                    />
                    {data.cierreFinanciero.bolsaAzulEsperada !== null &&
                      data.cierreFinanciero.bolsaAzulReal !== null && (
                        <FilaCuenta
                          numero={4}
                          label="Bolsa azul"
                          entregado={data.cierreFinanciero.bolsaAzulReal}
                          esperado={data.cierreFinanciero.bolsaAzulEsperada}
                          diferencia={data.cierreFinanciero.diferenciaBolsaAzul ?? 0}
                        />
                      )}
                  </>
                ) : (
                  <div className="px-4 py-3">
                    <p className="text-xs text-gray-600">Sin apertura financiero ese día</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilaArea({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${color}`}>${fmt(value)}</span>
    </div>
  );
}

function FilaCuenta({
  numero, label, entregado, esperado, diferencia,
}: {
  numero: number; label: string; entregado: number; esperado: number; diferencia: number;
}) {
  const cuadra = Math.abs(diferencia) < 0.01;
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs text-gray-600">{numero}.</span>
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <p className="text-xs text-gray-600">
          Real: ${fmt(entregado)} · Esperado: ${fmt(esperado)}
        </p>
      </div>
      <span className={`text-sm font-semibold shrink-0 ${cuadra ? "text-emerald-400" : "text-red-400"}`}>
        {cuadra ? "✓ Cuadra" : `${diferencia > 0 ? "+" : ""}$${fmt(diferencia)}`}
      </span>
    </div>
  );
}

// ─── Lista paginada ───────────────────────────────────────────────────────────

function ListaDias({
  lista,
  cargando,
  fechaSeleccionada,
  onSeleccionar,
  onAnterior,
  onSiguiente,
}: {
  lista: ListaDiasResult | null;
  cargando: boolean;
  fechaSeleccionada: string | null;
  onSeleccionar: (fecha: string) => void;
  onAnterior: () => void;
  onSiguiente: () => void;
}) {
  if (cargando) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
        <p className="text-sm text-gray-500">Cargando historial...</p>
      </div>
    );
  }

  if (!lista || lista.total === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
        <p className="text-sm text-gray-500">Aún no hay días cerrados</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Días cerrados
        </p>
        <p className="text-xs text-gray-500">
          Página {lista.paginaActual} de {lista.totalPaginas}
        </p>
      </div>

      <div className="divide-y divide-gray-800/60">
        {lista.dias.map((d) => {
          const cuadra = Math.abs(d.diferencia) < 0.01;
          const seleccionado = fechaSeleccionada === d.fecha;
          return (
            <button
              key={d.fecha}
              onClick={() => onSeleccionar(d.fecha)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition hover:bg-gray-800/50 ${seleccionado ? "bg-gray-800/70 border-l-2 border-brand-500" : ""}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{formatFecha(d.fecha)}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Xbox ${fmt(d.totalXbox)} · Servicios ${fmt(d.totalServicios)} · Productos ${fmt(d.totalProductos)}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-sm font-semibold text-white">${fmt(d.totalGeneral)}</span>
                <span className={`text-xs font-medium ${cuadra ? "text-emerald-400" : "text-red-400"}`}>
                  {cuadra ? "✓" : `${d.diferencia > 0 ? "+" : ""}$${fmt(Math.abs(d.diferencia))}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Controles de paginación */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
        <button
          onClick={onAnterior}
          disabled={lista.paginaActual <= 1}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          ← Anterior
        </button>
        <span className="text-xs text-gray-600">{lista.total} días en total</span>
        <button
          onClick={onSiguiente}
          disabled={lista.paginaActual >= lista.totalPaginas}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}

// ─── Resumen del día ──────────────────────────────────────────────────────────

function ResumenDia({ dia, fecha }: { dia: DiaSummary; fecha: string }) {
  if (!dia.tieneDatos && !dia.tieneCierre) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
        <p className="text-sm text-gray-500">Sin operaciones registradas para {formatFecha(fecha)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {formatFecha(fecha)}
      </p>

      {/* Grid 2 columnas */}
      <div className="grid grid-cols-2 gap-3">
        <TarjetaXbox xbox={dia.xbox} />
        <TarjetaProductos productos={dia.productos} />
        <TarjetaServicios servicios={dia.servicios} />
        <TarjetaFinanciero comisiones={dia.comisiones} financieroDetalle={dia.financieroDetalle} />
        {dia.gastos.total > 0 && (
          <TarjetaGastos gastos={dia.gastos} />
        )}
      </div>

      {/* Caja chica — ancho completo */}
      <TarjetaCajaChica total={dia.cajaChicaTotal} />

      {/* Ganancia neta — solo si hay gastos */}
      {dia.gastos.total > 0 && (
        <TarjetaGananciaNeta
          cajaChicaTotal={dia.cajaChicaTotal}
          totalGastos={dia.gastos.total}
          gananciaNeta={dia.gananciaNeta}
        />
      )}

      {/* Cierre del día */}
      {dia.tieneCierre && dia.cierre ? (
        <CierreDia cierre={dia.cierre} cierreFinanciero={dia.cierreFinanciero} />
      ) : dia.tieneDatos ? (
        <div className="rounded-lg border border-gray-800 px-4 py-3">
          <p className="text-xs text-gray-600">Día sin cerrar — no hay cuentas de cierre</p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Tarjetas de área ─────────────────────────────────────────────────────────

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function TarjetaXbox({ xbox }: { xbox: DiaSummary["xbox"] }) {
  const [abierto, setAbierto] = useState(false);
  const tieneDetalle = xbox.detalle.length > 0;

  return (
    <div
      className={`rounded-xl border bg-gray-900 ${tieneDetalle ? "cursor-pointer hover:border-violet-700/50 transition-colors" : ""} ${abierto ? "border-violet-700/40" : "border-gray-800"}`}
      onClick={() => tieneDetalle && setAbierto(v => !v)}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Renta Xbox</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-violet-400 bg-violet-500/10 rounded-md px-2 py-0.5">
              {xbox.sesiones} sesión{xbox.sesiones !== 1 ? "es" : ""}
            </span>
            {tieneDetalle && (
              <span className="text-gray-600 text-xs">{abierto ? "▲" : "▼"}</span>
            )}
          </div>
        </div>
        <p className="text-2xl font-bold text-violet-300">${fmt(xbox.total)}</p>
      </div>

      {abierto && tieneDetalle && (
        <div className="border-t border-gray-800 divide-y divide-gray-800/60">
          {xbox.detalle.map((s, i) => (
            <div key={s.id} className="px-4 py-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-gray-400">
                  Sesión {i + 1} · {horaCorta(s.inicio)}
                </span>
                <span className="text-xs font-semibold text-violet-300">${fmt(s.total)}</span>
              </div>
              <div className="flex gap-3 text-xs text-gray-600">
                {s.duracionMinutos !== null && (
                  <span>{s.duracionMinutos} min</span>
                )}
                {s.controlesExtra > 0 && (
                  <span>+{s.controlesExtra} control{s.controlesExtra !== 1 ? "es" : ""} (${fmt(s.montoControles)})</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaProductos({ productos }: { productos: DiaSummary["productos"] }) {
  const [abierto, setAbierto] = useState(false);
  const tieneDetalle = productos.detalle.length > 0;

  return (
    <div
      className={`rounded-xl border bg-gray-900 ${tieneDetalle ? "cursor-pointer hover:border-amber-700/50 transition-colors" : ""} ${abierto ? "border-amber-700/40" : "border-gray-800"}`}
      onClick={() => tieneDetalle && setAbierto(v => !v)}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Productos</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-amber-400 bg-amber-500/10 rounded-md px-2 py-0.5">
              {productos.ventas} venta{productos.ventas !== 1 ? "s" : ""}
            </span>
            {tieneDetalle && (
              <span className="text-gray-600 text-xs">{abierto ? "▲" : "▼"}</span>
            )}
          </div>
        </div>
        <p className="text-2xl font-bold text-amber-300">${fmt(productos.total)}</p>
        {productos.totalTarjeta > 0 && (
          <p className="mt-0.5 text-xs text-gray-500">
            ${fmt(productos.totalEfectivo)} efectivo · ${fmt(productos.totalTarjeta)} tarjeta
          </p>
        )}
      </div>

      {abierto && tieneDetalle && (
        <div className="border-t border-gray-800 divide-y divide-gray-800/60">
          {productos.detalle.map(v => (
            <div key={v.id} className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-300">{v.nombre}</p>
                <p className="text-xs text-gray-600">
                  {horaCorta(v.hora)} · ×{v.cantidad}
                  {v.metodoPago === "TARJETA" && (
                    <span className="ml-1.5 rounded-full bg-purple-900/40 text-purple-300 px-1.5 py-0.5">tarjeta</span>
                  )}
                </p>
              </div>
              <span className="text-xs font-semibold text-amber-300">${fmt(v.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaServicios({ servicios }: { servicios: DiaSummary["servicios"] }) {
  const [abierto, setAbierto] = useState(false);
  const tieneDetalle = servicios.detalle.length > 0;

  return (
    <div
      className={`rounded-xl border bg-gray-900 ${tieneDetalle ? "cursor-pointer hover:border-sky-700/50 transition-colors" : ""} ${abierto ? "border-sky-700/40" : "border-gray-800"}`}
      onClick={() => tieneDetalle && setAbierto(v => !v)}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Servicios</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-sky-400 bg-sky-500/10 rounded-md px-2 py-0.5">
              {servicios.detalle.length} servicio{servicios.detalle.length !== 1 ? "s" : ""}
            </span>
            {tieneDetalle && (
              <span className="text-gray-600 text-xs">{abierto ? "▲" : "▼"}</span>
            )}
          </div>
        </div>

        {!abierto && (
          servicios.porTipo.length === 0 ? (
            <p className="text-sm text-gray-600">Sin servicios</p>
          ) : (
            <>
              <div className="space-y-1.5 mb-3">
                {servicios.porTipo.map(t => (
                  <div key={t.nombre} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 truncate mr-2">{t.nombre}</span>
                    <span className="text-xs text-sky-300 shrink-0">${fmt(t.total)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-500">Total</span>
                <p className="text-xl font-bold text-sky-300">${fmt(servicios.total)}</p>
              </div>
            </>
          )
        )}

        {abierto && (
          <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-500">Total</span>
            <p className="text-xl font-bold text-sky-300">${fmt(servicios.total)}</p>
          </div>
        )}
      </div>

      {abierto && tieneDetalle && (
        <div className="border-t border-gray-800 divide-y divide-gray-800/60">
          {servicios.detalle.map(s => (
            <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-300">{s.nombre}</p>
                <p className="text-xs text-gray-600">{horaCorta(s.hora)}{s.cantidad > 1 ? ` · ×${s.cantidad}` : ""}</p>
              </div>
              <span className="text-xs font-semibold text-sky-300">${fmt(s.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaFinanciero({ comisiones, financieroDetalle }: { comisiones: number; financieroDetalle: DiaSummary["financieroDetalle"] }) {
  const [abierto, setAbierto] = useState(false);
  const tieneDetalle = financieroDetalle.length > 0;

  return (
    <div
      className={`rounded-xl border bg-gray-900 ${tieneDetalle ? "cursor-pointer hover:border-emerald-700/50 transition-colors" : ""} ${abierto ? "border-emerald-700/40" : "border-gray-800"}`}
      onClick={() => tieneDetalle && setAbierto(v => !v)}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Financiero</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-emerald-400 bg-emerald-500/10 rounded-md px-2 py-0.5">
              Comisiones
            </span>
            {tieneDetalle && (
              <span className="text-gray-600 text-xs">{abierto ? "▲" : "▼"}</span>
            )}
          </div>
        </div>
        <p className="text-2xl font-bold text-emerald-300">${fmt(comisiones)}</p>
        {!abierto && <p className="text-xs text-gray-600 mt-1">Retiros y depósitos completados</p>}
      </div>

      {abierto && tieneDetalle && (
        <div className="border-t border-gray-800 divide-y divide-gray-800/60">
          {financieroDetalle.map(m => (
            <div key={m.id} className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-300 capitalize">{m.tipo.toLowerCase()}</p>
                <p className="text-xs text-gray-600">{horaCorta(m.hora)} · Monto: ${fmt(m.monto)}</p>
              </div>
              <span className="text-xs font-semibold text-emerald-300">+${fmt(m.comision)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaCajaChica({ total }: { total: number }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 px-5 py-4 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Caja chica total del día</p>
        <p className="text-xs text-gray-600">Xbox + Servicios + Productos + Comisiones</p>
      </div>
      <p className="text-3xl font-bold text-white">${fmt(total)}</p>
    </div>
  );
}

function TarjetaGastos({ gastos }: { gastos: DiaSummary["gastos"] }) {
  const [abierto, setAbierto] = useState(false);
  const tieneDetalle = gastos.detalle.length > 0;

  return (
    <div
      className={`col-span-2 rounded-xl border bg-gray-900 ${tieneDetalle ? "cursor-pointer hover:border-red-700/50 transition-colors" : ""} ${abierto ? "border-red-700/40" : "border-gray-800"}`}
      onClick={() => tieneDetalle && setAbierto(v => !v)}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Gastos</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-400 bg-red-500/10 rounded-md px-2 py-0.5">
              {gastos.detalle.length} gasto{gastos.detalle.length !== 1 ? "s" : ""}
            </span>
            {tieneDetalle && (
              <span className="text-gray-600 text-xs">{abierto ? "▲" : "▼"}</span>
            )}
          </div>
        </div>
        <p className="text-2xl font-bold text-red-400">−${fmt(gastos.total)}</p>
      </div>

      {abierto && tieneDetalle && (
        <div className="border-t border-gray-800 divide-y divide-gray-800/60">
          {gastos.detalle.map(g => (
            <div key={g.id} className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-300">{g.descripcion}</p>
                {g.categoriaNombre && (
                  <p className="text-xs text-gray-600">{g.categoriaNombre}</p>
                )}
              </div>
              <span className="text-xs font-semibold text-red-400">−${fmt(g.monto)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaGananciaNeta({
  cajaChicaTotal,
  totalGastos,
  gananciaNeta,
}: {
  cajaChicaTotal: number;
  totalGastos: number;
  gananciaNeta: number;
}) {
  const positiva = gananciaNeta >= 0;
  return (
    <div className={`rounded-xl border px-5 py-4 flex items-center justify-between ${positiva ? "border-emerald-700/40 bg-emerald-950/10" : "border-amber-700/40 bg-amber-950/10"}`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Ganancia neta</p>
        <p className="text-xs text-gray-600">
          Caja chica ${fmt(cajaChicaTotal)} − Gastos ${fmt(totalGastos)}
        </p>
      </div>
      <p className={`text-3xl font-bold ${positiva ? "text-emerald-300" : "text-amber-300"}`}>
        ${fmt(gananciaNeta)}
      </p>
    </div>
  );
}

// ─── Cierre del día ───────────────────────────────────────────────────────────

function CierreDia({
  cierre,
  cierreFinanciero,
}: {
  cierre: NonNullable<DiaSummary["cierre"]>;
  cierreFinanciero: DiaSummary["cierreFinanciero"];
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Cuentas del cierre
        </p>
      </div>
      <div className="divide-y divide-gray-800/60">
        <CuentaCierre
          numero={1}
          label="Caja chica física"
          entregado={cierre.efectivoReal}
          esperado={cierre.efectivoEsperado}
          diferencia={cierre.diferencia}
        />
        {cierreFinanciero ? (
          <>
            <CuentaCierre
              numero={2}
              label="Sobrante → caja azul"
              entregado={cierreFinanciero.sobranteEntregado}
              esperado={cierreFinanciero.sobranteCalculado}
              diferencia={cierreFinanciero.diferenciaSobrante}
            />
            <CuentaCierre
              numero={3}
              label="Saldo en tarjeta"
              entregado={cierreFinanciero.saldoTarjetaReportado}
              esperado={cierreFinanciero.saldoTarjetaEsperado}
              diferencia={cierreFinanciero.diferenciaTarjeta}
            />
            {cierreFinanciero.bolsaAzulEsperada !== null && cierreFinanciero.bolsaAzulReal !== null && (
              <CuentaCierre
                numero={4}
                label="Bolsa azul"
                entregado={cierreFinanciero.bolsaAzulReal}
                esperado={cierreFinanciero.bolsaAzulEsperada}
                diferencia={cierreFinanciero.diferenciaBolsaAzul ?? 0}
              />
            )}
          </>
        ) : (
          <div className="px-4 py-3">
            <p className="text-xs text-gray-600">Sin apertura financiero ese día</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CuentaCierre({
  numero, label, entregado, esperado, diferencia,
}: {
  numero: number; label: string; entregado: number; esperado: number; diferencia: number;
}) {
  const cuadra = Math.abs(diferencia) < 0.01;
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs text-gray-600">{numero}.</span>
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <p className="text-xs text-gray-600">
          Real: ${fmt(entregado)} · Esperado: ${fmt(esperado)}
        </p>
      </div>
      <span className={`text-sm font-semibold shrink-0 ${cuadra ? "text-emerald-400" : "text-red-400"}`}>
        {cuadra ? "✓ Cuadra" : `${diferencia > 0 ? "+" : ""}$${fmt(diferencia)}`}
      </span>
    </div>
  );
}

// ─── Comparativo semanal ──────────────────────────────────────────────────────

function ComparativoSemanal({ rows }: { rows: ComparativoRow[] }) {
  const total = {
    xbox: rows.reduce((a, r) => a + r.totalXbox, 0),
    servicios: rows.reduce((a, r) => a + r.totalServicios, 0),
    productos: rows.reduce((a, r) => a + r.totalProductos, 0),
    comisiones: rows.reduce((a, r) => a + r.totalComisiones, 0),
    total: rows.reduce((a, r) => a + r.cajaChicaTotal, 0),
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Comparativo — últimos 7 días
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {["Fecha", "Xbox", "Servicios", "Productos", "Comisiones", "Total"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {rows.map(r => (
              <tr key={r.fecha} className="hover:bg-gray-800/30 transition">
                <td className="px-4 py-2.5 text-gray-400">{formatFechaCorta(r.fecha)}</td>
                <td className="px-4 py-2.5 text-violet-300">${fmt(r.totalXbox)}</td>
                <td className="px-4 py-2.5 text-sky-300">${fmt(r.totalServicios)}</td>
                <td className="px-4 py-2.5 text-amber-300">${fmt(r.totalProductos)}</td>
                <td className="px-4 py-2.5 text-emerald-300">${fmt(r.totalComisiones)}</td>
                <td className="px-4 py-2.5 font-semibold text-white">${fmt(r.cajaChicaTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-700 bg-gray-800/40">
              <td className="px-4 py-2.5 text-xs font-semibold text-gray-400">7 días</td>
              <td className="px-4 py-2.5 text-sm font-semibold text-violet-300">${fmt(total.xbox)}</td>
              <td className="px-4 py-2.5 text-sm font-semibold text-sky-300">${fmt(total.servicios)}</td>
              <td className="px-4 py-2.5 text-sm font-semibold text-amber-300">${fmt(total.productos)}</td>
              <td className="px-4 py-2.5 text-sm font-semibold text-emerald-300">${fmt(total.comisiones)}</td>
              <td className="px-4 py-2.5 text-sm font-bold text-white">${fmt(total.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Reporte mensual con gráfica ──────────────────────────────────────────────

function ReporteMensualView({ reporte }: { reporte: ReporteMensual }) {
  const { totales } = reporte;
  const max = Math.max(totales.xbox, totales.servicios, totales.productos, totales.comisiones, 1);
  const totalMes = totales.xbox + totales.servicios + totales.productos + totales.comisiones;

  const barras = [
    { label: "Renta Xbox", value: totales.xbox, color: "bg-violet-500", text: "text-violet-300" },
    { label: "Servicios", value: totales.servicios, color: "bg-sky-500", text: "text-sky-300" },
    { label: "Productos", value: totales.productos, color: "bg-amber-500", text: "text-amber-300" },
    { label: "Comisiones", value: totales.comisiones, color: "bg-emerald-500", text: "text-emerald-300" },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Reporte por fuente — {mesLabel(reporte.mes)}
        </p>
        <p className="text-sm font-semibold text-white">
          Total: ${fmt(totalMes)}
        </p>
      </div>

      {reporte.dias.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-600 text-center">
          Sin cierres registrados este mes
        </p>
      ) : (
        <div className="p-5 space-y-5">
          <div className="flex items-end gap-4 h-36">
            {barras.map(b => (
              <div key={b.label} className="flex flex-col items-center gap-1.5 flex-1">
                <span className={`text-xs font-semibold ${b.text}`}>${fmt(b.value)}</span>
                <div className="w-full flex items-end" style={{ height: "100px" }}>
                  <div
                    className={`w-full rounded-t-lg ${b.color} opacity-80 transition-all`}
                    style={{ height: `${Math.round((b.value / max) * 100)}px` }}
                  />
                </div>
                <span className="text-xs text-gray-500 text-center leading-tight">{b.label}</span>
              </div>
            ))}
          </div>

          {totalMes > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {barras.map(b => (
                <div key={b.label} className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
                  <p className={`text-lg font-bold ${b.text}`}>
                    {Math.round((b.value / totalMes) * 100)}%
                  </p>
                  <p className="text-xs text-gray-600">{b.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
