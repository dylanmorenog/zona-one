"use client";

import {
  actualizarCapital,
  agregarEfectivoEmpleada,
  cancelarMovimiento,
  confirmarRetiro,
  editarMovimiento,
  registrarMovimiento,
  resetearDia,
} from "@/app/actions/financiero";
import { useToast } from "@/components/ui/Toast";
import { calcularComision, calcularDesdeTotal, fmt } from "@/lib/financiero";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoMov = "RETIRO" | "DEPOSITO";
type EstadoMov = "PENDIENTE" | "COMPLETADO" | "CANCELADO";
type TipoComision = "EFECTIVO" | "TRANSFERENCIA" | "DESCONTADA";

interface Movimiento {
  id: number;
  tipo: TipoMov;
  estado: EstadoMov;
  tipoComision: TipoComision;
  monto: number;
  comision: number;
  sinComision: boolean;
  ingresoDirecto: boolean;
  notas: string | null;
  hora: string;
  confirmadoEn: string | null;
}

export interface EstadoFinanciero {
  capital: number | null;
  efectivoEmpleadaInicial: number | null;
  saldoTarjetaInicial: number | null;
  efectivoEmpleada: number | null;
  saldoTarjeta: number | null;
  cajaAzulTotal: number | null;
  totalIngresoDirecto: number;
  cajaChicaTotal: number; // interno, para Panel del Día; no se muestra aquí
  pendientes: number;
  sumaRetiros: number;
  sumaDepositos: number;
  tieneApertura: boolean;
  tieneCierre: boolean;
  cierre: {
    sobrante: number;
    efectivoFinal: number;
    cajaChicaCalculada: number;
    cajaChicaReal: number;
    diferenciaCajaChica: number;
    saldoTarjetaEsperado: number;
    saldoTarjetaReal: number;
    diferencia: number;
  } | null;
  movimientos: Movimiento[];
  efectivosExtra: { id: number; hora: string; monto: number; notas: string | null }[];
  rol: string;
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function FinancieroPanel(props: EstadoFinanciero) {
  const router = useRouter();
  const toast = useToast();
  const [cargando, setCargando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalEditar, setModalEditar] = useState<Movimiento | null>(null);
  const [confirmarCancelar, setConfirmarCancelar] = useState<number | null>(null);

  const esDueno = props.rol === "DUENO";

  async function ejecutar(key: string, fn: () => Promise<void>, mensajeExito?: string) {
    setCargando(key);
    setError(null);
    try {
      await fn();
      router.refresh();
      if (mensajeExito) toast.success(mensajeExito);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ocurrió un error";
      setError(msg);
      toast.error(msg);
    } finally {
      setCargando(null);
    }
  }

  if (!props.capital) {
    return (
      <SinConfig
        esDueno={esDueno}
        cargando={!!cargando}
        onGuardar={(c) => ejecutar("config", () => actualizarCapital(c))}
      />
    );
  }

  if (!props.tieneApertura) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 px-8 py-10 text-center max-w-sm space-y-2">
          <p className="text-base font-semibold text-white">Sin apertura registrada</p>
          <p className="text-sm text-gray-500">
            Registra la apertura del día desde el <span className="text-brand-400 font-medium">Panel del Día</span> para comenzar a operar.
          </p>
        </div>
      </div>
    );
  }

  if (props.tieneCierre && props.cierre) {
    return (
      <div className="space-y-4">
        <ResumenCierre props={props} />
      </div>
    );
  }

  const hoy = new Date().toDateString();

  return (
    <>
      <PanelOperaciones
        props={props}
        cargando={cargando}
        error={error}
        esDueno={esDueno}
        onRegistrar={(d) => {
          const tipo = (d as { tipo: string }).tipo;
          const msg = tipo === "RETIRO" ? "Retiro registrado" : "Depósito registrado";
          ejecutar("nueva", () => registrarMovimiento(d as Parameters<typeof registrarMovimiento>[0]), msg);
        }}
        onConfirmarRetiro={(id) => ejecutar(`confirmar-${id}`, () => confirmarRetiro(id), "Retiro confirmado")}
        onEditar={setModalEditar}
        onCancelar={setConfirmarCancelar}
        onReiniciar={() => ejecutar("reset", () => resetearDia())}
        movimientoHoy={hoy}
      />


      {modalEditar && (
        <ModalEditar
          mov={modalEditar}
          cargando={!!cargando}
          onGuardar={(monto, notas, tipoComision) =>
            ejecutar(`editar-${modalEditar.id}`, async () => {
              await editarMovimiento(modalEditar.id, { monto, notas, tipoComision });
              setModalEditar(null);
            })
          }
          onCancelar={() => setModalEditar(null)}
        />
      )}

      {confirmarCancelar !== null && (
        <ModalConfirmarCancelar
          cargando={!!cargando}
          onConfirmar={() =>
            ejecutar(`cancelar-${confirmarCancelar}`, async () => {
              await cancelarMovimiento(confirmarCancelar);
              setConfirmarCancelar(null);
            })
          }
          onCancelar={() => setConfirmarCancelar(null)}
        />
      )}
    </>
  );
}

// ─── Sin configuración ────────────────────────────────────────────────────────

function SinConfig({
  esDueno,
  cargando,
  onGuardar,
}: {
  esDueno: boolean;
  cargando: boolean;
  onGuardar: (c: number) => void;
}) {
  const [capital, setCapital] = useState("");
  if (!esDueno)
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
        <p className="text-sm text-gray-500">El dueño debe configurar el capital total.</p>
      </div>
    );
  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-8">
      <p className="font-semibold text-white">Configurar capital fijo</p>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
        <input
          type="number"
          value={capital}
          onChange={(e) => setCapital(e.target.value)}
          placeholder="128,542.18"
          className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-7 pr-3 text-white focus:border-brand-500 focus:outline-none"
        />
      </div>
      <button
        onClick={() => parseFloat(capital) > 0 && onGuardar(parseFloat(capital))}
        disabled={cargando || !capital || parseFloat(capital) <= 0}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
      >
        {cargando ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

// ─── Tarjeta efectivo en caja con agregar inline ──────────────────────────────

function EfectivoCajaCard({
  efectivo,
  pendientes,
  efectivosExtra,
}: {
  efectivo: number;
  pendientes: number;
  efectivosExtra: { id: number; hora: string; monto: number; notas: string | null }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto]);

  async function confirmar() {
    const num = parseFloat(monto);
    if (!num || num <= 0) return;
    setCargando(true);
    try {
      await agregarEfectivoEmpleada({ monto: num });
      router.refresh();
      toast.success("Efectivo agregado");
      setMonto("");
      setAbierto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al agregar");
    } finally {
      setCargando(false);
    }
  }

  const sub = pendientes > 0
    ? `${pendientes} retiro${pendientes !== 1 ? "s" : ""} pendiente${pendientes !== 1 ? "s" : ""}`
    : "Disponible para entregar";

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Efectivo en caja</p>
        <p className="text-2xl font-bold text-white">${fmt(efectivo)}</p>
        <p className="mt-0.5 text-xs text-gray-600">{sub}</p>
      </div>

      {efectivosExtra.length > 0 && (
        <div className="space-y-1">
          {efectivosExtra.map((e) => (
            <div key={e.id} className="flex justify-between text-xs">
              <span className="text-emerald-400">+${fmt(e.monto)}{e.notas ? ` · ${e.notas}` : ""}</span>
              <span className="text-gray-600">
                {new Date(e.hora).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}

      {!abierto ? (
        <button
          onClick={() => setAbierto(true)}
          className="w-full rounded-lg border border-dashed border-gray-700 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-600 transition"
        >
          + Agregar efectivo
        </button>
      ) : (
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
            <input
              ref={inputRef}
              type="number" min={0} step={100} value={monto}
              onChange={(e) => setMonto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") { setAbierto(false); setMonto(""); } }}
              placeholder="0"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-1.5 pl-5 pr-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
          <button
            onClick={confirmar}
            disabled={cargando || !monto || parseFloat(monto) <= 0}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 transition"
          >
            {cargando ? "..." : "✓"}
          </button>
          <button
            onClick={() => { setAbierto(false); setMonto(""); }}
            disabled={cargando}
            className="rounded-lg border border-gray-700 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-800 disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Stats con detalles colapsables ──────────────────────────────────────────

function StatsFinanciero({ props }: { props: EstadoFinanciero }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <EfectivoCajaCard
          efectivo={props.efectivoEmpleada!}
          pendientes={props.pendientes}
          efectivosExtra={props.efectivosExtra}
        />
        <StatCard
          label="Tarjeta (esperado)"
          value={`$${fmt(props.saldoTarjeta!)}`}
          sub={`Inicial $${fmt(props.saldoTarjetaInicial!)} ± operaciones`}
          color="white"
        />
      </div>

      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition select-none"
      >
        <span className={`transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}>▾</span>
        {abierto ? "Ocultar detalles del fondo" : "Ver detalles del fondo"}
      </button>

      {abierto && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Bolsa azul"
            value={`$${fmt(props.cajaAzulTotal!)}`}
            sub="Capital − tarjeta"
            color="blue"
          />
          <StatCard
            label="Capital total"
            value={`$${fmt(props.capital!)}`}
            sub="Efectivo + bolsa azul + tarjeta"
            color="white"
          />
        </div>
      )}
    </div>
  );
}

// ─── Panel de operaciones ─────────────────────────────────────────────────────

function PanelOperaciones({
  props,
  cargando,
  error,
  esDueno,
  onRegistrar,
  onConfirmarRetiro,
  onEditar,
  onCancelar,
  onReiniciar,
  movimientoHoy,
}: {
  props: EstadoFinanciero;
  cargando: string | null;
  error: string | null;
  esDueno: boolean;
  onRegistrar: (d: { tipo: TipoMov; tipoComision: TipoComision; pendiente?: boolean; monto: number; notas?: string }) => void;
  onConfirmarRetiro: (id: number) => void;
  onEditar: (m: Movimiento) => void;
  onCancelar: (id: number) => void;
  onReiniciar: () => void;
  movimientoHoy: string;
}) {
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Stats principales */}
      <StatsFinanciero props={props} />

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Formulario */}
        <div className="w-80 shrink-0 flex flex-col gap-3">
          <FormOperacion
            efectivoEmpleada={props.efectivoEmpleada!}
            cargando={cargando === "nueva"}
            onRegistrar={onRegistrar}
          />
        </div>

        {/* Historial */}
        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-gray-800 bg-gray-900">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Operaciones de hoy
            </p>
            <div className="flex gap-3 text-xs text-gray-600">
              <span>↑ depósitos ${fmt(props.sumaDepositos)}</span>
              <span>↓ retiros ${fmt(props.sumaRetiros)}</span>
            </div>
          </div>

          {props.movimientos.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-600">Sin operaciones hoy</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-800/40">
              {props.movimientos.map((m) => {
                const esHoy = new Date(m.hora).toDateString() === movimientoHoy;
                const puedeCancelar =
                  esHoy && m.estado !== "CANCELADO" &&
                  (m.tipo === "DEPOSITO" || m.estado === "PENDIENTE" || esDueno);
                const puedeEditar = esHoy && m.estado !== "CANCELADO";
                const esPendiente = m.estado === "PENDIENTE";
                const esCancelado = m.estado === "CANCELADO";

                return (
                  <MovimientoRow
                    key={m.id}
                    mov={m}
                    esPendiente={esPendiente}
                    esCancelado={esCancelado}
                    puedeCancelar={puedeCancelar}
                    puedeEditar={puedeEditar}
                    cargandoConfirmar={cargando === `confirmar-${m.id}`}
                    cargandoCancelar={cargando === `cancelar-${m.id}`}
                    onConfirmarRetiro={() => onConfirmarRetiro(m.id)}
                    onEditar={() => onEditar(m)}
                    onCancelar={() => onCancelar(m.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Fila de movimiento en el historial ──────────────────────────────────────

function MovimientoRow({
  mov,
  esPendiente,
  esCancelado,
  puedeCancelar,
  puedeEditar,
  cargandoConfirmar,
  cargandoCancelar,
  onConfirmarRetiro,
  onEditar,
  onCancelar,
}: {
  mov: Movimiento;
  esPendiente: boolean;
  esCancelado: boolean;
  puedeCancelar: boolean;
  puedeEditar: boolean;
  cargandoConfirmar: boolean;
  cargandoCancelar: boolean;
  onConfirmarRetiro: () => void;
  onEditar: () => void;
  onCancelar: () => void;
}) {
  const hora = new Date(mov.hora).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const esRetiro = mov.tipo === "RETIRO";
  const esEspecial = mov.sinComision || mov.ingresoDirecto;

  let badgeLabel: string;
  let badgeClass: string;
  if (mov.ingresoDirecto) {
    badgeLabel = "Ingreso de efectivo";
    badgeClass = "bg-blue-900/40 text-blue-300";
  } else if (mov.sinComision) {
    badgeLabel = "Retiro sin comisión";
    badgeClass = "bg-orange-900/40 text-orange-300";
  } else {
    badgeLabel = esRetiro ? "Retiro" : "Depósito";
    badgeClass = esRetiro ? "bg-orange-900/40 text-orange-300" : "bg-emerald-900/40 text-emerald-300";
  }

  return (
    <div className={`px-4 py-3 ${esCancelado ? "opacity-40" : ""}`}>
      <div className="flex gap-3 items-start">
        <span className="shrink-0 font-mono text-xs text-gray-600 pt-0.5 w-10">{hora}</span>

        <div className="flex-1 min-w-0">
          {/* Badges y monto */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
              {badgeLabel}
            </span>

            {esPendiente && (
              <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs font-semibold text-amber-300">
                Pendiente
              </span>
            )}
            {esCancelado && (
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs font-semibold text-gray-500">
                Cancelado
              </span>
            )}

            {mov.tipoComision === "TRANSFERENCIA" && !esCancelado && !esEspecial ? (
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">
                  ${fmt(mov.monto + mov.comision)}
                </span>
                <span className="text-xs text-gray-500">
                  ${fmt(mov.monto)} retiro + ${fmt(mov.comision)} comisión
                </span>
              </div>
            ) : (
              <span className={`text-sm font-bold ${esCancelado ? "line-through text-gray-500" : "text-white"}`}>
                ${fmt(mov.monto)}
              </span>
            )}
            {!esCancelado && !esEspecial && mov.tipoComision !== "TRANSFERENCIA" && (
              <>
                <span className="text-xs text-gray-600">+${fmt(mov.comision)}</span>
                <span className="text-xs text-gray-700">
                  {mov.tipoComision === "DESCONTADA" ? "descontada" : "en efectivo"}
                </span>
              </>
            )}
          </div>

          {/* Notas */}
          {mov.notas && (
            <p className="mt-0.5 text-xs text-gray-500 truncate">{mov.notas}</p>
          )}
        </div>

        {/* Acciones */}
        {!esCancelado && (
          <div className="shrink-0 flex items-center gap-1.5">
            {esPendiente && (
              <button
                onClick={onConfirmarRetiro}
                disabled={cargandoConfirmar}
                className="rounded-lg bg-emerald-700/30 border border-emerald-700/50 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-700/50 disabled:opacity-50 transition"
              >
                {cargandoConfirmar ? "..." : "✓ Entregado"}
              </button>
            )}
            {puedeEditar && !esPendiente && (
              <button
                onClick={onEditar}
                className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition"
              >
                Editar
              </button>
            )}
            {puedeCancelar && (
              <button
                onClick={onCancelar}
                disabled={cargandoCancelar}
                className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-500 hover:text-red-400 hover:border-red-900/50 disabled:opacity-50 transition"
              >
                {cargandoCancelar ? "..." : "✕"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Formulario de operación ──────────────────────────────────────────────────

function FormOperacion({
  efectivoEmpleada,
  cargando,
  onRegistrar,
}: {
  efectivoEmpleada: number;
  cargando: boolean;
  onRegistrar: (d: {
    tipo: TipoMov;
    tipoComision: TipoComision;
    pendiente?: boolean;
    monto: number;
    notas?: string;
    sinComision?: boolean;
    ingresoDirecto?: boolean;
  }) => void;
}) {
  const [tipo, setTipo] = useState<TipoMov | null>(null);
  const [tipoComision, setTipoComision] = useState<TipoComision>("EFECTIVO");
  const [pendiente, setPendiente] = useState(false);
  const [sinComision, setSinComision] = useState(false);
  const [ingresoDirecto, setIngresoDirecto] = useState(false);
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");

  const montoNum = parseFloat(monto) || 0;

  // Para RETIRO con comisión en transferencia:
  // el empleado escribe el TOTAL que transfirió el cliente.
  const esTransferencia = tipo === "RETIRO" && tipoComision === "TRANSFERENCIA" && !sinComision;
  const { retiro: retiroCalculado, comision: comisionCalculada } =
    esTransferencia && montoNum > 0
      ? calcularDesdeTotal(montoNum)
      : { retiro: montoNum, comision: sinComision || ingresoDirecto ? 0 : montoNum > 0 ? calcularComision(montoNum) : 0 };

  const montoRetiro = esTransferencia ? retiroCalculado : montoNum;
  const comision = comisionCalculada;

  const efectivoNecesario =
    tipo === "RETIRO" && tipoComision === "TRANSFERENCIA" && !sinComision
      ? montoRetiro + comision
      : montoRetiro;

  const sinEfectivo = tipo === "RETIRO" && !pendiente && montoNum > 0 && efectivoNecesario > efectivoEmpleada;
  const valido = tipo !== null && montoNum > 0 && !cargando && !sinEfectivo && (esTransferencia ? retiroCalculado > 0 : true);

  function efectoDescripcion(): string {
    if (!tipo || montoNum === 0) return "";
    if (ingresoDirecto) return "Va directo a la bolsa azul · No afecta el efectivo de la empleada";
    if (tipo === "RETIRO") {
      if (sinComision) return `Caja: −$${fmt(montoRetiro)} · Sin comisión`;
      if (tipoComision === "EFECTIVO") return `Caja: −$${fmt(montoRetiro)} · Caja chica: +$${fmt(comision)}`;
      return `Caja: −$${fmt(montoRetiro + comision)} · Caja chica: +$${fmt(comision)}`;
    }
    if (tipoComision === "EFECTIVO") return `Caja: +$${fmt(montoRetiro)} · Caja chica: +$${fmt(comision)}`;
    return `Caja: +$${fmt(montoRetiro - comision)} · Caja chica: +$${fmt(comision)}`;
  }

  function handleTipo(t: TipoMov) {
    setTipo(t);
    setMonto("");
    setNotas("");
    setPendiente(false);
    setSinComision(false);
    setIngresoDirecto(false);
    setTipoComision("EFECTIVO");
  }

  function handleRegistrar() {
    if (!tipo || !valido) return;
    onRegistrar({
      tipo,
      tipoComision,
      pendiente: tipo === "RETIRO" ? pendiente : undefined,
      monto: montoRetiro,
      notas: notas.trim() || undefined,
      sinComision: sinComision || undefined,
      ingresoDirecto: ingresoDirecto || undefined,
    });
    setMonto("");
    setNotas("");
    setPendiente(false);
    setSinComision(false);
    setIngresoDirecto(false);
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      <p className="text-sm font-semibold text-gray-300">Nueva operación</p>

      {/* Tipo de operación */}
      <div className="grid grid-cols-2 gap-2">
        {(["RETIRO", "DEPOSITO"] as TipoMov[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTipo(t)}
            className={`flex flex-col items-center rounded-xl border py-4 transition ${
              tipo === t
                ? t === "RETIRO"
                  ? "border-orange-600/60 bg-orange-950/30 text-orange-300"
                  : "border-emerald-600/60 bg-emerald-950/30 text-emerald-300"
                : "border-gray-700 bg-gray-800/40 text-gray-500 hover:text-gray-300 hover:border-gray-600"
            }`}
          >
            <span className="text-lg mb-1">{t === "RETIRO" ? "↓" : "↑"}</span>
            <span className="text-sm font-semibold">{t === "RETIRO" ? "Retiro" : "Depósito"}</span>
            <span className="text-xs mt-0.5 opacity-60">{t === "RETIRO" ? "Cliente cobra" : "Cliente deposita"}</span>
          </button>
        ))}
      </div>

      {tipo && (
        <div className="space-y-3">

          {/* Switch "Sin comisión" — solo para RETIRO */}
          {tipo === "RETIRO" && (
            <SwitchRow
              activo={sinComision}
              onToggle={() => { setSinComision((v) => !v); if (!sinComision) setTipoComision("EFECTIVO"); }}
              colorActivo="bg-blue-600"
              label="Sin comisión"
              desc={sinComision ? "No se cobra comisión en esta operación" : "Se cobra comisión normal"}
              labelActivo="text-blue-300"
            />
          )}

          {/* Switch "Ingreso de efectivo" — solo para DEPOSITO */}
          {tipo === "DEPOSITO" && (
            <SwitchRow
              activo={ingresoDirecto}
              onToggle={() => setIngresoDirecto((v) => !v)}
              colorActivo="bg-blue-600"
              label="Ingreso de efectivo"
              desc={ingresoDirecto ? "Sin comisión · Va directo a bolsa azul" : "Depósito normal con comisión"}
              labelActivo="text-blue-300"
            />
          )}

          {/* Tipo de comisión — oculto si sinComision o ingresoDirecto */}
          {!sinComision && !ingresoDirecto && (
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Cómo se cobró la comisión</label>
              <div className="space-y-1.5">
                {tipo === "RETIRO" ? (
                  <>
                    <ComisionOpcion
                      activo={tipoComision === "EFECTIVO"}
                      onClick={() => setTipoComision("EFECTIVO")}
                      titulo="Comisión en efectivo"
                      desc="Cliente transfirió el monto exacto y pagó la comisión aparte en cash"
                    />
                    <ComisionOpcion
                      activo={tipoComision === "TRANSFERENCIA"}
                      onClick={() => setTipoComision("TRANSFERENCIA")}
                      titulo="Comisión en transferencia"
                      desc="Cliente transfirió monto + comisión juntos, recibe solo el monto en cash"
                    />
                  </>
                ) : (
                  <>
                    <ComisionOpcion
                      activo={tipoComision === "EFECTIVO"}
                      onClick={() => setTipoComision("EFECTIVO")}
                      titulo="Comisión en efectivo"
                      desc="Cliente pagó la comisión aparte en cash, recibe la transferencia completa"
                    />
                    <ComisionOpcion
                      activo={tipoComision === "DESCONTADA"}
                      onClick={() => setTipoComision("DESCONTADA")}
                      titulo="Comisión descontada"
                      desc="Se descuenta del monto que recibe el cliente en la transferencia"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Toggle pendiente (solo retiros) */}
          {tipo === "RETIRO" && (
            <SwitchRow
              activo={pendiente}
              onToggle={() => setPendiente((v) => !v)}
              colorActivo="bg-amber-500"
              label={pendiente ? "Pendiente de entrega" : "Entrega inmediata"}
              desc={pendiente ? "El cliente aún no llega" : "El cliente está presente"}
              labelActivo="text-amber-300"
            />
          )}

          {/* Monto */}
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">
              {esTransferencia ? "Total que transfirió el cliente" : "Monto de la operación"}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number" min={0} step={100} value={monto}
                onChange={(e) => setMonto(e.target.value)}
                autoFocus placeholder="0.00"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-7 pr-3 text-lg font-bold text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            {/* Desglose para comisión en transferencia */}
            {esTransferencia && montoNum > 0 && retiroCalculado > 0 && (
              <div className="mt-2 rounded-lg bg-gray-800/60 px-3 py-2.5 space-y-1">
                <p className="text-xs font-medium text-gray-300">Desglose automático:</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Retiro real (da en efectivo)</span>
                  <span className="text-white font-medium">${fmt(retiroCalculado)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Comisión incluida</span>
                  <span className="text-brand-400 font-medium">+${fmt(comision)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-gray-700 pt-1 mt-1">
                  <span className="text-gray-500">Total transferido</span>
                  <span className="text-gray-300">${fmt(montoNum)}</span>
                </div>
              </div>
            )}

            {/* Info efecto */}
            {montoNum > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {!sinComision && !ingresoDirecto && !esTransferencia && (
                  <p className="text-xs text-gray-500">
                    Comisión: <span className="text-brand-400 font-medium">${fmt(comision)}</span>
                  </p>
                )}
                <p className="text-xs text-gray-600">{efectoDescripcion()}</p>
              </div>
            )}

            {sinEfectivo && (
              <p className="mt-1 text-xs text-red-400">
                Sin efectivo suficiente. Disponible: ${fmt(efectivoEmpleada)}
              </p>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">
              Notas <span className="text-gray-600">(opcional)</span>
            </label>
            <input
              type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Nombre del cliente..."
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleRegistrar}
            disabled={!valido}
            className={`w-full rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-40 ${
              ingresoDirecto
                ? "bg-blue-700 hover:bg-blue-600"
                : tipo === "RETIRO"
                ? pendiente ? "bg-amber-700 hover:bg-amber-600" : sinComision ? "bg-brand-700 hover:bg-brand-600" : "bg-orange-700 hover:bg-orange-600"
                : "bg-emerald-700 hover:bg-emerald-600"
            }`}
          >
            {cargando ? "Registrando..." :
              ingresoDirecto ? "Registrar ingreso" :
              tipo === "RETIRO" && pendiente ? "Registrar pendiente" :
              tipo === "RETIRO" && sinComision ? "Registrar sin comisión" :
              tipo === "RETIRO" ? "Registrar retiro" : "Registrar depósito"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Switch reutilizable ──────────────────────────────────────────────────────

function SwitchRow({
  activo,
  onToggle,
  colorActivo,
  label,
  desc,
  labelActivo,
}: {
  activo: boolean;
  onToggle: () => void;
  colorActivo: string;
  label: string;
  desc: string;
  labelActivo: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-800/60 px-3 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        style={{ backgroundColor: activo ? undefined : "#4b5563" }}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
          activo ? colorActivo : ""
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 block w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            activo ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <div className="min-w-0">
        <p className={`text-xs font-medium ${activo ? labelActivo : "text-gray-400"}`}>
          {label}
        </p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  );
}

function ComisionOpcion({
  activo, onClick, titulo, desc,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition ${
        activo
          ? "border-brand-600/60 bg-brand-950/20"
          : "border-gray-700 bg-gray-800/40 hover:border-gray-600"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
          activo ? "border-brand-400 bg-brand-400" : "border-gray-600"
        }`}>
          {activo && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </span>
        <span className={`text-sm font-medium ${activo ? "text-white" : "text-gray-400"}`}>{titulo}</span>
      </div>
      <p className="mt-0.5 ml-5.5 text-xs text-gray-500">{desc}</p>
    </button>
  );
}

// ─── Modal editar ─────────────────────────────────────────────────────────────

function ModalEditar({
  mov,
  cargando,
  onGuardar,
  onCancelar,
}: {
  mov: Movimiento;
  cargando: boolean;
  onGuardar: (monto: number, notas?: string, tipoComision?: TipoComision) => void;
  onCancelar: () => void;
}) {
  const [monto, setMonto] = useState(String(mov.monto));
  const [notas, setNotas] = useState(mov.notas ?? "");
  const [tipoComision, setTipoComision] = useState<TipoComision>(mov.tipoComision);
  const montoNum = parseFloat(monto) || 0;
  const comision = montoNum > 0 ? calcularComision(montoNum) : 0;

  const opcionesComision: { value: TipoComision; label: string }[] =
    mov.tipo === "RETIRO"
      ? [
          { value: "EFECTIVO", label: "Comisión en efectivo" },
          { value: "TRANSFERENCIA", label: "Comisión en transferencia" },
        ]
      : [{ value: "DESCONTADA", label: "Comisión descontada" }];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl space-y-4">
        <h2 className="text-base font-semibold text-white">
          Editar {mov.tipo === "RETIRO" ? "retiro" : "depósito"}
        </h2>

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Monto</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-7 pr-3 text-lg font-bold text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
          {montoNum > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Comisión: <span className="text-brand-400">${fmt(comision)}</span>
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Tipo de comisión</label>
          <div className="space-y-1.5">
            {opcionesComision.map((op) => (
              <button
                key={op.value}
                type="button"
                onClick={() => setTipoComision(op.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-left transition
                  ${tipoComision === op.value
                    ? "border-brand-500 bg-brand-950/30 text-white"
                    : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                  }`}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Notas</label>
          <input
            type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
            placeholder="Nombre del cliente..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onCancelar} disabled={cargando}
            className="flex-1 rounded-lg border border-gray-700 py-2.5 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={() => montoNum > 0 && onGuardar(montoNum, notas.trim() || undefined, tipoComision)}
            disabled={cargando || montoNum <= 0}
            className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40">
            {cargando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal agregar efectivo extra ─────────────────────────────────────────────

function ModalEfectivoExtra({
  cargando,
  onGuardar,
  onCancelar,
}: {
  cargando: boolean;
  onGuardar: (monto: number, notas?: string) => void;
  onCancelar: () => void;
}) {
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const montoNum = parseFloat(monto) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Agregar efectivo</h2>
          <p className="text-xs text-gray-500 mt-0.5">Se sumará al efectivo disponible de la empleada</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Monto</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number" min={0} step={100} value={monto}
              onChange={(e) => setMonto(e.target.value)} autoFocus
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-7 pr-3 text-lg font-bold text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Notas (opcional)</label>
          <input
            type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
            placeholder="Motivo..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onCancelar} disabled={cargando}
            className="flex-1 rounded-lg border border-gray-700 py-2.5 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={() => montoNum > 0 && onGuardar(montoNum, notas.trim() || undefined)}
            disabled={cargando || montoNum <= 0}
            className="flex-1 rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40">
            {cargando ? "Guardando..." : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal confirmar cancelación ──────────────────────────────────────────────

function ModalConfirmarCancelar({
  cargando,
  onConfirmar,
  onCancelar,
}: {
  cargando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl space-y-4">
        <p className="font-semibold text-white">¿Cancelar esta operación?</p>
        <p className="text-sm text-gray-400">El efecto en efectivo y tarjeta se revertirá automáticamente.</p>
        <div className="flex gap-3">
          <button onClick={onCancelar} disabled={cargando}
            className="flex-1 rounded-lg border border-gray-700 py-2.5 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-50">
            No, regresar
          </button>
          <button onClick={onConfirmar} disabled={cargando}
            className="flex-1 rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40">
            {cargando ? "Cancelando..." : "Sí, cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal cierre del día ─────────────────────────────────────────────────────

function ModalCierre({
  saldoTarjetaEsperado,
  efectivoEmpleada,
  cajaChicaCalculada,
  cargando,
  onConfirmar,
  onCancelar,
}: {
  saldoTarjetaEsperado: number;
  efectivoEmpleada: number;
  cajaChicaCalculada: number;
  cargando: boolean;
  onConfirmar: (sobrante: number, cajaChicaReal: number, saldoTarjetaReal: number) => void;
  onCancelar: () => void;
}) {
  const [sobrante, setSobrante] = useState("");
  const [cajaChicaReal, setCajaChicaReal] = useState("");
  const [saldoReal, setSaldoReal] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const sobranteNum = parseFloat(sobrante) || 0;
  const cajaChicaNum = parseFloat(cajaChicaReal) || 0;
  const saldoRealNum = parseFloat(saldoReal) || 0;

  const difCajaChica = cajaChicaNum - cajaChicaCalculada;
  const difTarjeta = saldoRealNum - saldoTarjetaEsperado;
  const cajaChicaCuadra = cajaChicaReal !== "" && Math.abs(difCajaChica) < 0.01;
  const tarjetaCuadra = saldoReal !== "" && Math.abs(difTarjeta) < 0.01;

  const puedeConfirmar = sobrante !== "" && cajaChicaReal !== "" && saldoReal !== "" && !cargando;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Cierre del día</h2>
          <p className="text-sm text-gray-400 mt-0.5">Tres entregas al cierre del turno</p>
        </div>

        {/* Resumen calculado */}
        <div className="rounded-xl bg-gray-800/50 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Efectivo en caja</span>
            <span className="text-white font-medium">${fmt(efectivoEmpleada)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Caja chica calculada</span>
            <span className="text-white font-medium">${fmt(cajaChicaCalculada)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Tarjeta esperada</span>
            <span className="text-white font-medium">${fmt(saldoTarjetaEsperado)}</span>
          </div>
        </div>

        {/* 1. Sobrante del financiero */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">
            1. Sobrante del financiero
          </label>
          <p className="mb-1.5 text-xs text-gray-500">Efectivo que regresa a la caja azul</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input ref={ref} type="number" min={0} step={100} value={sobrante}
              onChange={(e) => setSobrante(e.target.value)} placeholder="0.00"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-7 pr-3 text-base font-bold text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 2. Caja chica */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">
            2. Caja chica física
          </label>
          <p className="mb-1.5 text-xs text-gray-500">Comisiones acumuladas del día</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input type="number" min={0} step={1} value={cajaChicaReal}
              onChange={(e) => setCajaChicaReal(e.target.value)} placeholder="0.00"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-7 pr-3 text-base font-bold text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
          {cajaChicaReal !== "" && (
            <p className={`mt-1 text-xs font-medium ${cajaChicaCuadra ? "text-emerald-400" : "text-red-400"}`}>
              {cajaChicaCuadra
                ? "✓ Coincide con lo calculado"
                : `✗ Diferencia: ${difCajaChica > 0 ? "+" : ""}$${fmt(Math.abs(difCajaChica))}`}
            </p>
          )}
        </div>

        {/* 3. Saldo tarjeta */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-300">
            3. Saldo real en la tarjeta
          </label>
          <p className="mb-1.5 text-xs text-gray-500">Lo que se ve en la app del banco</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input type="number" min={0} step={1} value={saldoReal}
              onChange={(e) => setSaldoReal(e.target.value)} placeholder="0.00"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-7 pr-3 text-base font-bold text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
          {saldoReal !== "" && (
            <p className={`mt-1 text-xs font-medium ${tarjetaCuadra ? "text-emerald-400" : "text-red-400"}`}>
              {tarjetaCuadra
                ? "✓ Coincide con lo esperado"
                : `✗ Diferencia: ${difTarjeta > 0 ? "+" : ""}$${fmt(Math.abs(difTarjeta))}`}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onCancelar} disabled={cargando}
            className="flex-1 rounded-lg border border-gray-700 py-2.5 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={() => puedeConfirmar && onConfirmar(sobranteNum, cajaChicaNum, saldoRealNum)}
            disabled={!puedeConfirmar}
            className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40">
            {cargando ? "Cerrando..." : "Confirmar cierre"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Resumen del día cerrado ──────────────────────────────────────────────────

function ResumenCierre({ props }: { props: EstadoFinanciero }) {
  const c = props.cierre!;
  const tarjetaCuadra = Math.abs(c.diferencia) < 0.01;
  const cajaChicaCuadra = Math.abs(c.diferenciaCajaChica) < 0.01;
  const todoCuadra = tarjetaCuadra && cajaChicaCuadra;

  return (
    <div className="space-y-4">
      {/* Banner resultado */}
      <div className={`rounded-xl border p-4 flex items-center gap-4 ${todoCuadra ? "border-emerald-700/50 bg-emerald-950/20" : "border-amber-700/50 bg-amber-950/10"}`}>
        <span className={`text-2xl ${todoCuadra ? "text-emerald-400" : "text-amber-400"}`}>{todoCuadra ? "✓" : "⚠"}</span>
        <p className={`font-bold ${todoCuadra ? "text-emerald-300" : "text-amber-300"}`}>
          {todoCuadra ? "Cierre perfecto — todo cuadra" : "Cierre con diferencias"}
        </p>
      </div>

      {/* Tres entregas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Sobrante financiero</p>
          <p className="text-xl font-bold text-white">${fmt(c.sobrante)}</p>
          <p className="text-xs text-gray-600 mt-0.5">Regresó a caja azul</p>
        </div>
        <div className={`rounded-xl border p-4 ${cajaChicaCuadra ? "border-gray-800 bg-gray-900" : "border-amber-800/40 bg-amber-950/10"}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Caja chica</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-bold text-white">${fmt(c.cajaChicaReal)}</p>
            {!cajaChicaCuadra && (
              <p className="text-xs text-amber-400">{c.diferenciaCajaChica > 0 ? "+" : ""}${fmt(c.diferenciaCajaChica)}</p>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            {cajaChicaCuadra ? `Calculado: $${fmt(c.cajaChicaCalculada)}` : `⚠ Esperado: $${fmt(c.cajaChicaCalculada)}`}
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${tarjetaCuadra ? "border-gray-800 bg-gray-900" : "border-red-800/40 bg-red-950/10"}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Tarjeta</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-xl font-bold ${tarjetaCuadra ? "text-white" : "text-red-400"}`}>${fmt(c.saldoTarjetaReal)}</p>
            {!tarjetaCuadra && (
              <p className="text-xs text-red-400">{c.diferencia > 0 ? "+" : ""}${fmt(c.diferencia)}</p>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            {tarjetaCuadra ? `Esperado: $${fmt(c.saldoTarjetaEsperado)}` : `⚠ Esperado: $${fmt(c.saldoTarjetaEsperado)}`}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Comisiones del día (caja chica calculada)</p>
          <p className="text-2xl font-bold text-emerald-400">${fmt(c.cajaChicaCalculada)}</p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>{props.movimientos.filter((m) => m.tipo === "RETIRO" && m.estado !== "CANCELADO").length} retiros · ${fmt(props.sumaRetiros)}</p>
          <p>{props.movimientos.filter((m) => m.tipo === "DEPOSITO" && m.estado !== "CANCELADO").length} depósitos · ${fmt(props.sumaDepositos)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900">
        <p className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-800">
          Operaciones del día
        </p>
        <div className="divide-y divide-gray-800/50 max-h-64 overflow-y-auto">
          {props.movimientos.map((m) => {
            const hora = new Date(m.hora).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
            const esRetiro = m.tipo === "RETIRO";
            const esEspecial = m.sinComision || m.ingresoDirecto;
            const badgeLabel = m.ingresoDirecto ? "Ingreso de efectivo" : m.sinComision ? "Retiro sin comisión" : esRetiro ? "Retiro" : "Depósito";
            const badgeClass = m.ingresoDirecto
              ? "bg-blue-900/40 text-blue-300"
              : esRetiro ? "bg-orange-900/40 text-orange-300" : "bg-emerald-900/40 text-emerald-300";
            return (
              <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 ${m.estado === "CANCELADO" ? "opacity-40" : ""}`}>
                <span className="font-mono text-xs text-gray-600">{hora}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                  {badgeLabel}
                </span>
                {m.estado === "PENDIENTE" && <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs font-semibold text-amber-300">Pendiente</span>}
                {m.estado === "CANCELADO" && <span className="text-xs text-gray-600">Cancelado</span>}
                {m.tipoComision === "TRANSFERENCIA" && m.estado !== "CANCELADO" && !esEspecial ? (
                  <div className="flex-1 flex flex-col">
                    <span className="text-sm text-white font-medium">${fmt(m.monto + m.comision)}</span>
                    <span className="text-xs text-gray-600">${fmt(m.monto)} + ${fmt(m.comision)} comisión</span>
                  </div>
                ) : (
                  <span className="flex-1 text-sm text-white font-medium">${fmt(m.monto)}</span>
                )}
                {m.notas && <span className="text-xs text-gray-500 truncate max-w-32">{m.notas}</span>}
                {!esEspecial && m.tipoComision !== "TRANSFERENCIA" && (
                  <span className="text-xs text-gray-500 shrink-0">+${fmt(m.comision)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: "white" | "emerald" | "red" | "blue" }) {
  const vc = color === "emerald" ? "text-emerald-400" : color === "red" ? "text-red-400" : color === "blue" ? "text-blue-300" : "text-white";
  const border = color === "blue" ? "border-blue-900/50 bg-blue-950/20" : "border-gray-800 bg-gray-900";
  return (
    <div className={`rounded-xl border p-4 ${border}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${vc}`}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-600">{sub}</p>
    </div>
  );
}
