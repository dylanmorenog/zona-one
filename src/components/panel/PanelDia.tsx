"use client";

import { cerrarDiaCompleto } from "@/app/actions/panel";
import { useToast } from "@/components/ui/Toast";
import { fmt } from "@/lib/financiero";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Consola = {
  id: number;
  nombre: string;
  numero: number;
  sesionActiva: { id: number; inicio: string; tiempoDefinidoMinutos: number | null; pausadoEn: string | null } | null;
};

type CierreResumen = {
  totalXbox: number;
  totalServicios: number;
  totalProductos: number;
  totalComisiones: number;
  totalGeneral: number;
  efectivoEsperado: number;
  efectivoReal: number;
  diferencia: number;
  sobranteEntregado: number | null;
  sobranteCalculado: number | null;
  saldoTarjetaReportado: number | null;
  saldoTarjetaEsperado: number | null;
};

export type PanelData = {
  totalXbox: number;
  sesionesCount: number;
  minutosXbox: number;
  totalServicios: number;
  cantidadServicios: number;
  totalProductos: number;
  cantidadVentas: number;
  totalComisiones: number;
  cajaChicaTotal: number;
  totalGastos: number;
  gananciaNeta: number;
  pendientesRetiro: number;
  consolas: Consola[];
  tieneAperturaFinanciero: boolean;
  tieneCierreFinanciero: boolean;
  efectivoEmpleadaCalculado: number | null;
  saldoTarjetaCalculado: number | null;
  productosStockBajo: { id: number; nombre: string; stockActual: number; stockMinimo: number }[];
  capitalDesajustado: boolean;
  tieneCierreDia: boolean;
  cierre: CierreResumen | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMinutos(min: number): string {
  if (min === 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function tiempoTranscurrido(inicio: Date, ahora: Date) {
  const ms = Math.max(0, ahora.getTime() - inicio.getTime());
  const totalSeg = Math.floor(ms / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function PanelDia({ data, rol }: { data: PanelData; rol: string }) {
  const router = useRouter();
  const toast = useToast();
  const [ahora, setAhora] = useState(new Date());
  const [modalCierre, setModalCierre] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data.tieneCierreDia) return;
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, [data.tieneCierreDia]);

  async function handleCerrar(
    cajaChicaReal: number,
    sobranteFinanciero?: number,
    saldoTarjetaReal?: number
  ) {
    setCargando(true);
    setError(null);
    try {
      await cerrarDiaCompleto({ cajaChicaReal, sobranteFinanciero, saldoTarjetaReal });
      setModalCierre(false);
      router.refresh();
      toast.success("Día cerrado correctamente");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ocurrió un error";
      setError(msg);
      toast.error(msg);
    } finally {
      setCargando(false);
    }
  }

  if (data.tieneCierreDia && data.cierre) {
    return <VistaDeciaCerrado cierre={data.cierre} />;
  }

  const alertas = data.productosStockBajo.length > 0 || data.capitalDesajustado;

  return (
    <div className="space-y-3 pb-4">

      {/* Fila principal: 4 tarjetas + caja chica + botón cerrar */}
      <div className="flex items-stretch gap-3">
        <div className="grid grid-cols-4 gap-3 flex-1">
          <CompactCard
            label="Renta Xbox"
            value={`$${fmt(data.totalXbox)}`}
            sub={`${data.sesionesCount} ses. · ${formatMinutos(data.minutosXbox)}`}
            accent="text-violet-300"
            border="border-violet-900/30 bg-violet-950/10"
          />
          <CompactCard
            label="Servicios"
            value={`$${fmt(data.totalServicios)}`}
            sub={`${data.cantidadServicios} servicio${data.cantidadServicios !== 1 ? "s" : ""}`}
            accent="text-sky-300"
            border="border-sky-900/30 bg-sky-950/10"
          />
          <CompactCard
            label="Productos"
            value={`$${fmt(data.totalProductos)}`}
            sub={`${data.cantidadVentas} venta${data.cantidadVentas !== 1 ? "s" : ""}`}
            accent="text-amber-300"
            border="border-amber-900/30 bg-amber-950/10"
          />
          <CompactCard
            label="Comisiones"
            value={`$${fmt(data.totalComisiones)}`}
            sub="Financiero"
            accent="text-emerald-300"
            border="border-emerald-900/30 bg-emerald-950/10"
          />
        </div>

        {/* Caja chica destacada */}
        <div className="rounded-xl border border-brand-700/50 bg-brand-950/20 px-5 py-3 flex flex-col justify-center shrink-0 min-w-[148px]">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-1">
            Caja chica total
          </p>
          <p className="text-3xl font-bold text-white">${fmt(data.cajaChicaTotal)}</p>
        </div>

        {/* Botón cerrar el día */}
        <button
          onClick={() => { setError(null); setModalCierre(true); }}
          className="rounded-xl border border-red-900/50 bg-red-950/20 hover:bg-red-950/40 px-5 flex flex-col items-center justify-center gap-0.5 text-sm font-semibold text-red-300 hover:text-red-200 transition shrink-0 min-w-[96px]"
        >
          <span className="text-lg leading-none">✕</span>
          <span>Cerrar</span>
          <span>el día</span>
        </button>
      </div>

      {/* Barra financiero: efectivo + pendientes */}
      {data.tieneAperturaFinanciero && data.efectivoEmpleadaCalculado !== null && (
        <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Efectivo empleada</span>
            <span className="text-sm font-semibold text-white">
              ${fmt(data.efectivoEmpleadaCalculado)}
            </span>
          </div>
          <div className="w-px h-4 bg-gray-800 shrink-0" />
          {data.pendientesRetiro > 0 ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-800/40 bg-amber-950/20 px-2.5 py-1 text-xs font-semibold text-amber-300">
              ▲ {data.pendientesRetiro} retiro{data.pendientesRetiro !== 1 ? "s" : ""} pendiente{data.pendientesRetiro !== 1 ? "s" : ""} sin entregar
            </div>
          ) : (
            <span className="text-xs text-gray-600">Sin retiros pendientes</span>
          )}
        </div>
      )}

      {/* Gastos del día — solo dueño */}
      {rol === "DUENO" && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Gastos del día</span>
            <span className="text-sm font-semibold text-red-400">−${fmt(data.totalGastos)}</span>
          </div>
          <div className="w-px h-4 bg-gray-800 shrink-0" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Ganancia neta</span>
            <span className={`text-sm font-semibold ${data.gananciaNeta >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
              ${fmt(data.gananciaNeta)}
            </span>
          </div>
        </div>
      )}

      {/* Consolas compactas */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2.5">
          Estado de consolas
        </p>
        {data.consolas.length === 0 ? (
          <p className="text-sm text-gray-600">Sin consolas configuradas</p>
        ) : (
          <div className="flex gap-2">
            {data.consolas.map(c => (
              <ConsolaCompacta key={c.id} consola={c} ahora={ahora} />
            ))}
          </div>
        )}
      </div>

      {/* Alertas */}
      {alertas && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/10 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-0.5">Alertas</p>
          {data.capitalDesajustado && (
            <div className="flex items-start gap-2 text-sm text-amber-300">
              <span className="shrink-0">▲</span>
              <span>Diferencia detectada en el saldo de tarjeta al cierre financiero de hoy</span>
            </div>
          )}
          {data.productosStockBajo.map(p => (
            <div key={p.id} className="flex items-start gap-2 text-sm text-amber-300">
              <span className="shrink-0">▲</span>
              <span>
                <span className="font-medium">{p.nombre}</span>
                {" — "}stock bajo:{" "}
                <span className="text-amber-400">{p.stockActual} / mínimo {p.stockMinimo}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {modalCierre && (
        <ModalCierreDia
          data={data}
          cargando={cargando}
          error={error}
          onConfirmar={handleCerrar}
          onCancelar={() => setModalCierre(false)}
        />
      )}
    </div>
  );
}

// ─── Tarjeta compacta ─────────────────────────────────────────────────────────

function CompactCard({ label, value, sub, accent, border }: {
  label: string; value: string; sub: string; accent: string; border: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${border}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${accent}`}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-600">{sub}</p>
    </div>
  );
}

// ─── Consola compacta ─────────────────────────────────────────────────────────

function ConsolaCompacta({ consola, ahora }: { consola: Consola; ahora: Date }) {
  const { sesionActiva } = consola;
  const libre = sesionActiva === null;
  const pausado = !!sesionActiva?.pausadoEn;

  let tiempoStr = "";
  let porAcabar = false;

  if (!libre && sesionActiva) {
    const inicio = new Date(sesionActiva.inicio);
    if (pausado) {
      // Timer congelado en el momento de la pausa
      const pausa = new Date(sesionActiva.pausadoEn!);
      tiempoStr = tiempoTranscurrido(inicio, pausa);
    } else {
      tiempoStr = tiempoTranscurrido(inicio, ahora);
      if (sesionActiva.tiempoDefinidoMinutos !== null) {
        const elapsedMin = Math.floor((ahora.getTime() - inicio.getTime()) / 60000);
        porAcabar = sesionActiva.tiempoDefinidoMinutos - elapsedMin <= 5;
      }
    }
  }

  return (
    <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 flex-1 ${
      libre
        ? "border-gray-800 bg-gray-800/30"
        : pausado
        ? "border-amber-800/50 bg-amber-950/10"
        : porAcabar
        ? "border-amber-800/50 bg-amber-950/10"
        : "border-red-900/40 bg-red-950/10"
    }`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${
        libre ? "bg-emerald-500" : pausado ? "bg-amber-400" : porAcabar ? "bg-amber-400 animate-pulse" : "bg-red-500 animate-pulse"
      }`} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{consola.nombre}</p>
        {libre ? (
          <p className="text-xs text-emerald-400">Libre</p>
        ) : pausado ? (
          <p className="text-xs text-amber-400">Pausado · {tiempoStr}</p>
        ) : (
          <p className={`text-xs font-mono ${porAcabar ? "text-amber-300 font-semibold" : "text-red-300"}`}>
            {tiempoStr}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Modal de cierre del día ──────────────────────────────────────────────────

function ModalCierreDia({
  data,
  cargando,
  error,
  onConfirmar,
  onCancelar,
}: {
  data: PanelData;
  cargando: boolean;
  error: string | null;
  onConfirmar: (cajaChicaReal: number, sobrante?: number, saldoTarjeta?: number) => void;
  onCancelar: () => void;
}) {
  const [cajaChicaReal, setCajaChicaReal] = useState("");
  const [sobranteReal, setSobranteReal] = useState("");
  const [saldoTarjetaReal, setSaldoTarjetaReal] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const consolasActivas = data.consolas.filter(c => c.sesionActiva !== null);
  const hayFinanciero = data.tieneAperturaFinanciero && !data.tieneCierreFinanciero;

  const cajaNum = parseFloat(cajaChicaReal) || 0;
  const sobranteNum = parseFloat(sobranteReal) || 0;
  const saldoNum = parseFloat(saldoTarjetaReal) || 0;

  const difCaja = cajaChicaReal !== "" ? cajaNum - data.cajaChicaTotal : null;
  const difSobrante =
    sobranteReal !== "" && data.efectivoEmpleadaCalculado !== null
      ? sobranteNum - data.efectivoEmpleadaCalculado
      : null;
  const difTarjeta =
    saldoTarjetaReal !== "" && data.saldoTarjetaCalculado !== null
      ? saldoNum - data.saldoTarjetaCalculado
      : null;

  const cajaValida = cajaChicaReal !== "" && Number.isFinite(cajaNum) && cajaNum >= 0;
  const sobranteValido = !hayFinanciero || (sobranteReal !== "" && Number.isFinite(sobranteNum) && sobranteNum >= 0);
  const saldoValido = !hayFinanciero || (saldoTarjetaReal !== "" && Number.isFinite(saldoNum) && saldoNum >= 0);
  const puedeConfirmar = cajaValida && sobranteValido && saldoValido && !cargando;

  function cuadraClass(dif: number | null) {
    if (dif === null) return "";
    return Math.abs(dif) < 0.01 ? "text-emerald-400" : "text-red-400";
  }

  function cuadraMsg(dif: number | null) {
    if (dif === null) return null;
    if (Math.abs(dif) < 0.01) return "✓ Coincide";
    return `✗ Diferencia: ${dif > 0 ? "+" : ""}$${fmt(Math.abs(dif))}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold text-white">Cerrar el día</h2>
          <p className="text-sm text-gray-400 mt-0.5">Confirma los totales antes de cerrar</p>
        </div>

        {consolasActivas.length > 0 && (
          <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2.5 text-sm text-amber-300">
            ▲ Hay {consolasActivas.length} sesión{consolasActivas.length !== 1 ? "es" : ""} de Xbox
            activa{consolasActivas.length !== 1 ? "s" : ""}. Al cerrar quedarán sin contabilizar.
          </div>
        )}

        {/* 1. Caja chica */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            1. Efectivo real en caja chica física
          </label>
          <div className="rounded-lg bg-gray-800/60 px-3 py-2.5 text-xs space-y-1">
            <div className="flex justify-between text-gray-500">
              <span>Renta de Xbox</span><span>${fmt(data.totalXbox)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Servicios</span><span>${fmt(data.totalServicios)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Productos</span><span>${fmt(data.totalProductos)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Comisiones</span><span>${fmt(data.totalComisiones)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-1 font-medium text-gray-300">
              <span>Total esperado</span><span>${fmt(data.cajaChicaTotal)}</span>
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              ref={ref} type="number" min={0} step={1} value={cajaChicaReal}
              onChange={e => setCajaChicaReal(e.target.value)} placeholder="0.00"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-7 pr-3 text-lg font-bold text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
          {difCaja !== null && (
            <p className={`text-xs font-medium ${cuadraClass(difCaja)}`}>{cuadraMsg(difCaja)}</p>
          )}
        </div>

        {/* 2. Sobrante */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            2. Sobrante que regresa a la caja azul
          </label>
          {data.efectivoEmpleadaCalculado !== null ? (
            <p className="text-xs text-gray-500">
              Calculado:{" "}
              <span className="text-gray-300 font-medium">${fmt(data.efectivoEmpleadaCalculado)}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-600">Sin apertura financiero registrada hoy</p>
          )}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number" min={0} step={100} value={sobranteReal}
              onChange={e => setSobranteReal(e.target.value)} placeholder="0.00"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-7 pr-3 text-lg font-bold text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
          {difSobrante !== null && (
            <p className={`text-xs font-medium ${cuadraClass(difSobrante)}`}>{cuadraMsg(difSobrante)}</p>
          )}
        </div>

        {/* 3. Saldo tarjeta */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            3. Saldo en tarjeta
          </label>
          {data.saldoTarjetaCalculado !== null ? (
            <p className="text-xs text-gray-500">
              Esperado:{" "}
              <span className="text-gray-300 font-medium">${fmt(data.saldoTarjetaCalculado)}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-600">Sin apertura financiero registrada hoy</p>
          )}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number" min={0} step={1} value={saldoTarjetaReal}
              onChange={e => setSaldoTarjetaReal(e.target.value)} placeholder="0.00"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-7 pr-3 text-lg font-bold text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
          {difTarjeta !== null && (
            <p className={`text-xs font-medium ${cuadraClass(difTarjeta)}`}>{cuadraMsg(difTarjeta)}</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancelar} disabled={cargando}
            className="flex-1 rounded-lg border border-gray-700 py-2.5 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() =>
              puedeConfirmar &&
              onConfirmar(cajaNum, hayFinanciero ? sobranteNum : undefined, hayFinanciero ? saldoNum : undefined)
            }
            disabled={!puedeConfirmar}
            className="flex-1 rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40 transition"
          >
            {cargando ? "Cerrando..." : "Confirmar cierre"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Vista de día cerrado ─────────────────────────────────────────────────────

function CuentaRow({
  numero,
  label,
  entregado,
  esperado,
  diferencia,
}: {
  numero: number;
  label: string;
  entregado: number;
  esperado: number | null;
  diferencia: number | null;
}) {
  const cuadra = diferencia === null || Math.abs(diferencia) < 0.01;
  return (
    <div
      className={`rounded-xl border p-4 flex items-center justify-between ${
        esperado === null
          ? "border-gray-800 bg-gray-900"
          : cuadra
          ? "border-emerald-800/40 bg-emerald-950/10"
          : "border-red-800/40 bg-red-950/10"
      }`}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-0.5">
          {numero}. {label}
        </p>
        <p className={`text-2xl font-bold ${cuadra ? "text-white" : "text-red-300"}`}>
          ${fmt(entregado)}
        </p>
      </div>
      <div className="text-right">
        {esperado !== null ? (
          <>
            <p className="text-sm text-gray-500">Esperado: ${fmt(esperado)}</p>
            <p className={`text-sm font-semibold mt-0.5 ${cuadra ? "text-emerald-400" : "text-red-400"}`}>
              {cuadra
                ? "✓ Cuadra"
                : `${diferencia! > 0 ? "+" : ""}$${fmt(diferencia!)} diferencia`}
            </p>
          </>
        ) : (
          <p className="text-xs text-gray-600">Sin apertura financiero</p>
        )}
      </div>
    </div>
  );
}

function VistaDeciaCerrado({ cierre }: { cierre: CierreResumen }) {
  const difs = [
    cierre.diferencia,
    cierre.sobranteEntregado !== null && cierre.sobranteCalculado !== null
      ? cierre.sobranteEntregado - cierre.sobranteCalculado
      : null,
    cierre.saldoTarjetaReportado !== null && cierre.saldoTarjetaEsperado !== null
      ? cierre.saldoTarjetaReportado - cierre.saldoTarjetaEsperado
      : null,
  ];
  const todoCuadra = difs.every(d => d === null || Math.abs(d) < 0.01);

  return (
    <div className="space-y-4 pb-4">
      {/* Banner */}
      <div
        className={`rounded-xl border p-4 flex items-center gap-4 ${
          todoCuadra
            ? "border-emerald-700/50 bg-emerald-950/20"
            : "border-amber-700/50 bg-amber-950/10"
        }`}
      >
        <span className={`text-2xl font-bold ${todoCuadra ? "text-emerald-400" : "text-amber-400"}`}>
          {todoCuadra ? "✓" : "⚠"}
        </span>
        <div>
          <p className={`font-bold ${todoCuadra ? "text-emerald-300" : "text-amber-300"}`}>
            {todoCuadra ? "Día cerrado — todo cuadra" : "Día cerrado con diferencias"}
          </p>
          <p className="text-sm text-gray-500">Las operaciones reanudan a partir de mañana</p>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Renta Xbox", value: cierre.totalXbox, accent: "text-violet-300" },
          { label: "Servicios", value: cierre.totalServicios, accent: "text-sky-300" },
          { label: "Productos", value: cierre.totalProductos, accent: "text-amber-300" },
          { label: "Comisiones", value: cierre.totalComisiones, accent: "text-emerald-300" },
          { label: "Total día", value: cierre.totalGeneral, accent: "text-white" },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              {item.label}
            </p>
            <p className={`text-xl font-bold ${item.accent}`}>${fmt(item.value)}</p>
          </div>
        ))}
      </div>

      {/* Las 3 cuentas confirmadas */}
      <CuentaRow
        numero={1}
        label="Caja chica física entregada"
        entregado={cierre.efectivoReal}
        esperado={cierre.efectivoEsperado}
        diferencia={cierre.diferencia}
      />
      <CuentaRow
        numero={2}
        label="Sobrante que regresó a caja azul"
        entregado={cierre.sobranteEntregado ?? 0}
        esperado={cierre.sobranteCalculado}
        diferencia={
          cierre.sobranteEntregado !== null && cierre.sobranteCalculado !== null
            ? cierre.sobranteEntregado - cierre.sobranteCalculado
            : null
        }
      />
      <CuentaRow
        numero={3}
        label="Saldo en tarjeta reportado"
        entregado={cierre.saldoTarjetaReportado ?? 0}
        esperado={cierre.saldoTarjetaEsperado}
        diferencia={
          cierre.saldoTarjetaReportado !== null && cierre.saldoTarjetaEsperado !== null
            ? cierre.saldoTarjetaReportado - cierre.saldoTarjetaEsperado
            : null
        }
      />
    </div>
  );
}
