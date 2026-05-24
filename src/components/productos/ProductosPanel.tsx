"use client";

import {
  guardarProducto,
  registrarEntradaMercancia,
  registrarVentaProducto,
  toggleActivoProducto,
  eliminarProducto,
} from "@/app/actions/productos";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precioVenta: number;
  precioCosto: number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
}

interface VentaHoy {
  id: number;
  hora: string;
  productoNombre: string;
  cantidad: number;
  total: number;
  metodoPago: "EFECTIVO" | "TARJETA";
}

interface Props {
  productos: Producto[];
  ventasHoy: VentaHoy[];
  totalHoy: number;
  rol: string;
}

// ─── Config de categorías ─────────────────────────────────────────────────────

const CAT: Record<string, { label: string; badge: string }> = {
  FRITURAS:  { label: "Frituras",  badge: "bg-orange-900/40 text-orange-300" },
  DULCES:    { label: "Dulces",    badge: "bg-amber-900/40 text-amber-300"   },
  PAPELERIA: { label: "Papelería", badge: "bg-blue-900/40 text-blue-300"     },
  BEBIDAS:   { label: "Bebidas",   badge: "bg-cyan-900/40 text-cyan-300"     },
  OTRO:      { label: "Otro",      badge: "bg-gray-800 text-gray-400"        },
};
const catCfg = (c: string) => CAT[c] ?? CAT.OTRO;

const CATEGORIAS_OPCIONES = ["FRITURAS", "DULCES", "PAPELERIA", "BEBIDAS", "OTRO"] as const;

// ─── Panel principal ──────────────────────────────────────────────────────────

type Vista = "venta" | "inventario";

export function ProductosPanel({ productos, ventasHoy, totalHoy, rol }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [vista, setVista] = useState<Vista>("venta");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalVenta, setModalVenta] = useState<Producto | null>(null);
  const [modalEntrada, setModalEntrada] = useState<Producto | null>(null);
  const [modalProducto, setModalProducto] = useState<Producto | "nuevo" | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<Producto | null>(null);

  const esDueno = rol === "DUENO";

  async function ejecutar(fn: () => Promise<void>, mensajeExito?: string) {
    setCargando(true);
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
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1 w-fit">
        {(["venta", "inventario"] as Vista[]).map((v) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              vista === v ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {v === "venta" ? "Venta" : "Inventario"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {vista === "venta" && (
        <VistaVenta
          productos={productos.filter((p) => p.activo)}
          ventasHoy={ventasHoy}
          totalHoy={totalHoy}
          onSeleccionar={setModalVenta}
        />
      )}

      {vista === "inventario" && (
        <VistaInventario
          productos={productos}
          esDueno={esDueno}
          onEntrada={setModalEntrada}
          onEditar={(p) => setModalProducto(p)}
          onToggleActivo={esDueno ? (p) => ejecutar(() => toggleActivoProducto(p.id)) : undefined}
          onNuevo={esDueno ? () => setModalProducto("nuevo") : undefined}
          onEliminar={setConfirmEliminar}
          cargando={cargando}
        />
      )}

      {modalVenta && (
        <ModalVenta
          producto={modalVenta}
          cargando={cargando}
          onConfirmar={(productoId, cantidad, metodoPago) =>
            ejecutar(async () => {
              await registrarVentaProducto({ productoId, cantidad, metodoPago });
              setModalVenta(null);
            }, "Venta registrada")
          }
          onCancelar={() => setModalVenta(null)}
        />
      )}

      {modalEntrada && (
        <ModalEntrada
          producto={modalEntrada}
          cargando={cargando}
          onConfirmar={(productoId, cantidad) =>
            ejecutar(async () => {
              await registrarEntradaMercancia({ productoId, cantidad });
              setModalEntrada(null);
            })
          }
          onCancelar={() => setModalEntrada(null)}
        />
      )}

      {modalProducto && (
        <ModalProducto
          producto={modalProducto === "nuevo" ? null : modalProducto}
          esDueno={esDueno}
          cargando={cargando}
          onGuardar={(id, data) =>
            ejecutar(async () => {
              await guardarProducto(id, data);
              setModalProducto(null);
            })
          }
          onCancelar={() => setModalProducto(null)}
        />
      )}

      {confirmEliminar && (
        <ModalConfirmEliminar
          producto={confirmEliminar}
          cargando={cargando}
          onConfirmar={() =>
            ejecutar(async () => {
              await eliminarProducto(confirmEliminar.id);
              setConfirmEliminar(null);
            }, "Producto eliminado")
          }
          onCancelar={() => setConfirmEliminar(null)}
        />
      )}
    </div>
  );
}

// ─── Vista Venta ──────────────────────────────────────────────────────────────

const FILTROS = ["TODOS", ...CATEGORIAS_OPCIONES] as const;
type Filtro = (typeof FILTROS)[number];

function VistaVenta({
  productos,
  ventasHoy,
  totalHoy,
  onSeleccionar,
}: {
  productos: Producto[];
  ventasHoy: VentaHoy[];
  totalHoy: number;
  onSeleccionar: (p: Producto) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("TODOS");

  // Solo mostrar filtros que tienen productos
  const categoriasConProductos = new Set(productos.map((p) => p.categoria));
  const filtrosDisponibles = FILTROS.filter(
    (f) => f === "TODOS" || categoriasConProductos.has(f)
  );

  const productosFiltrados =
    filtro === "TODOS" ? productos : productos.filter((p) => p.categoria === filtro);

  return (
    <div className="flex gap-5 flex-1 min-h-0">
      {/* Lista de productos */}
      <div className="flex-1 flex flex-col min-h-0 gap-3">
        {/* Filtros */}
        <div className="flex gap-1.5 flex-wrap">
          {filtrosDisponibles.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                filtro === f
                  ? "bg-gray-700 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/60"
              }`}
            >
              {f === "TODOS" ? "Todos" : CAT[f]?.label ?? f}
              <span className="ml-1.5 text-xs opacity-60">
                {f === "TODOS"
                  ? productos.length
                  : productos.filter((p) => p.categoria === f).length}
              </span>
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900">
          {productosFiltrados.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-gray-600">
              Sin productos en esta categoría
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {/* Encabezado */}
              <div className="grid grid-cols-[1fr_72px_80px_44px] items-center gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
                <span>Producto</span>
                <span className="text-right">Precio</span>
                <span className="text-right">Stock</span>
                <span />
              </div>

              {productosFiltrados.map((p) => {
                const agotado = p.stockActual <= 0;
                const bajo = p.stockActual > 0 && p.stockActual <= p.stockMinimo;
                const cfg = catCfg(p.categoria);

                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[1fr_72px_80px_44px] items-center gap-3 px-4 py-3 transition ${
                      agotado ? "opacity-50" : "hover:bg-gray-800/40"
                    }`}
                  >
                    {/* Nombre + categoría */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      <span className="truncate text-sm font-medium text-white">
                        {p.nombre}
                      </span>
                    </div>

                    {/* Precio */}
                    <span className="text-right text-sm font-semibold text-white">
                      ${p.precioVenta.toFixed(0)}
                    </span>

                    {/* Stock */}
                    <div className="text-right">
                      <span
                        className={`text-sm font-medium ${
                          agotado
                            ? "text-red-400"
                            : bajo
                            ? "text-amber-400"
                            : "text-gray-400"
                        }`}
                      >
                        {agotado ? "Agotado" : bajo ? `⚠ ${p.stockActual}` : p.stockActual}
                      </span>
                    </div>

                    {/* Botón + */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => !agotado && onSeleccionar(p)}
                        disabled={agotado}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-500 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-lg font-bold leading-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Panel derecho */}
      <div className="w-60 shrink-0 flex flex-col gap-4">
        {/* Total */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
            Ventas del día
          </p>
          <p className="text-3xl font-bold text-white">${totalHoy.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-gray-600">
            {ventasHoy.length} venta{ventasHoy.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Historial */}
        <div className="flex-1 rounded-xl border border-gray-800 bg-gray-900 flex flex-col min-h-0">
          <p className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-800">
            Historial de hoy
          </p>
          {ventasHoy.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-600">Sin ventas hoy</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {ventasHoy.map((v) => {
                const hora = new Date(v.hora).toLocaleTimeString("es-MX", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800/40 last:border-0"
                  >
                    <span className="shrink-0 font-mono text-xs text-gray-600">{hora}</span>
                    <span className="flex-1 min-w-0 truncate text-sm text-gray-300">
                      {v.productoNombre}
                      {v.cantidad > 1 && (
                        <span className="ml-1 text-gray-600">×{v.cantidad}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-white">
                      ${v.total.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Vista Inventario ─────────────────────────────────────────────────────────

function VistaInventario({
  productos,
  esDueno,
  onEntrada,
  onEditar,
  onToggleActivo,
  onNuevo,
  onEliminar,
  cargando,
}: {
  productos: Producto[];
  esDueno: boolean;
  onEntrada: (p: Producto) => void;
  onEditar: (p: Producto) => void;
  onToggleActivo?: (p: Producto) => void;
  onNuevo?: () => void;
  onEliminar: (p: Producto) => void;
  cargando: boolean;
}) {
  const bajoMinimo = productos.filter((p) => p.activo && p.stockActual <= p.stockMinimo);

  const colsDueno = "grid-cols-[1fr_70px_60px_80px_80px_80px_180px]";
  const colsEmpleado = "grid-cols-[1fr_70px_60px_80px_140px]";
  const cols = esDueno ? colsDueno : colsEmpleado;

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {bajoMinimo.length > 0 && (
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 px-4 py-3">
          <p className="text-sm font-semibold text-amber-300 mb-0.5">
            ⚠ {bajoMinimo.length} producto{bajoMinimo.length > 1 ? "s" : ""} con stock bajo
          </p>
          <p className="text-xs text-amber-400/70">
            {bajoMinimo.map((p) => `${p.nombre} (${p.stockActual})`).join(" · ")}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {productos.filter((p) => p.activo).length} activos ·{" "}
          {productos.filter((p) => !p.activo).length} inactivos
        </p>
        {esDueno && onNuevo && (
          <button
            onClick={onNuevo}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Agregar producto
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900">
        <div className="divide-y divide-gray-800/60">
          <div className={`grid ${cols} gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600`}>
            <span>Producto</span>
            <span className="text-center">Stock</span>
            <span className="text-center">Mín</span>
            <span className="text-right">P. Venta</span>
            {esDueno && <span className="text-right">P. Costo</span>}
            {esDueno && <span className="text-right">Ganancia</span>}
            <span />
          </div>

          {productos.map((p) => {
            const agotado = p.stockActual <= 0;
            const bajo = p.stockActual > 0 && p.stockActual <= p.stockMinimo;
            const ganancia = p.precioVenta - p.precioCosto;
            const margen = p.precioVenta > 0 ? Math.round((ganancia / p.precioVenta) * 100) : 0;
            const cfg = catCfg(p.categoria);

            return (
              <div
                key={p.id}
                className={`grid ${cols} gap-3 items-center px-4 py-3 ${!p.activo ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  <span className="truncate text-sm font-medium text-white">{p.nombre}</span>
                </div>
                <div className="text-center">
                  <span className={`text-sm font-bold ${agotado ? "text-red-400" : bajo ? "text-amber-400" : "text-white"}`}>
                    {p.stockActual}
                  </span>
                </div>
                <div className="text-center text-sm text-gray-500">{p.stockMinimo}</div>
                <div className="text-right text-sm text-white">${p.precioVenta.toFixed(0)}</div>
                {esDueno && (
                  <div className="text-right text-sm text-gray-400">${p.precioCosto.toFixed(2)}</div>
                )}
                {esDueno && (
                  <div className="text-right">
                    <p className="text-sm text-emerald-400">${ganancia.toFixed(0)}</p>
                    <p className="text-xs text-gray-600">{margen}%</p>
                  </div>
                )}
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => onEntrada(p)}
                    disabled={cargando || !p.activo}
                    className="rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                  >
                    +Stock
                  </button>
                  <button
                    onClick={() => onEditar(p)}
                    disabled={cargando}
                    className="rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                  >
                    Editar
                  </button>
                  {esDueno && onToggleActivo && (
                    <button
                      onClick={() => onToggleActivo(p)}
                      disabled={cargando}
                      className={`rounded-md border px-2.5 py-1 text-xs disabled:opacity-40 ${
                        p.activo
                          ? "border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-950/50"
                          : "border-emerald-900/50 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/50"
                      }`}
                    >
                      {p.activo ? "Off" : "On"}
                    </button>
                  )}
                  <button
                    onClick={() => onEliminar(p)}
                    disabled={cargando}
                    className="rounded-md border border-red-900/50 bg-red-950/20 px-2.5 py-1 text-xs text-red-400 hover:bg-red-950/40 disabled:opacity-40"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Modal Venta (compacto) ───────────────────────────────────────────────────

function ModalVenta({
  producto,
  cargando,
  onConfirmar,
  onCancelar,
}: {
  producto: Producto;
  cargando: boolean;
  onConfirmar: (id: number, cantidad: number, metodo: "EFECTIVO" | "TARJETA") => void;
  onCancelar: () => void;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState<"EFECTIVO" | "TARJETA">("EFECTIVO");
  const btnConfirmar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btnConfirmar.current?.focus();
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelar();
      if (e.key === "Enter") onConfirmar(producto.id, cantidad, metodoPago);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cantidad, metodoPago, onCancelar, onConfirmar, producto.id]);

  const total = cantidad * producto.precioVenta;
  const cfg = catCfg(producto.categoria);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancelar}>
      <div
        className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Producto */}
        <div className="mb-4 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs ${cfg.badge}`}>{cfg.label}</span>
          <span className="font-semibold text-white">{producto.nombre}</span>
          <span className="ml-auto text-sm text-gray-400">${producto.precioVenta}/u</span>
        </div>

        {/* Cantidad */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-400">Cantidad</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCantidad((v) => Math.max(1, v - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-white hover:bg-gray-700 text-base font-bold"
            >
              −
            </button>
            <span className="w-8 text-center text-lg font-bold text-white">{cantidad}</span>
            <button
              onClick={() => setCantidad((v) => Math.min(producto.stockActual, v + 1))}
              disabled={cantidad >= producto.stockActual}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-white hover:bg-gray-700 text-base font-bold disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        {/* Método de pago */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {(["EFECTIVO", "TARJETA"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetodoPago(m)}
              className={`rounded-lg border py-2 text-sm font-medium transition ${
                metodoPago === m
                  ? "border-brand-500 bg-brand-600/20 text-brand-300"
                  : "border-gray-700 bg-gray-800 text-gray-500 hover:bg-gray-700"
              }`}
            >
              {m === "EFECTIVO" ? "Efectivo" : "Tarjeta"}
            </button>
          ))}
        </div>

        {/* Total + confirmar */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-600">Total</p>
            <p className="text-2xl font-bold text-white">${total.toFixed(2)}</p>
          </div>
          <button
            ref={btnConfirmar}
            onClick={() => onConfirmar(producto.id, cantidad, metodoPago)}
            disabled={cargando}
            className="flex-1 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-500 active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            {cargando ? "..." : "Registrar"}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-700">Enter para confirmar · Esc para cancelar</p>
      </div>
    </div>
  );
}

// ─── Modal Entrada de mercancía ───────────────────────────────────────────────

function ModalEntrada({
  producto,
  cargando,
  onConfirmar,
  onCancelar,
}: {
  producto: Producto;
  cargando: boolean;
  onConfirmar: (id: number, cantidad: number) => void;
  onCancelar: () => void;
}) {
  const [cantidad, setCantidad] = useState<string>("1");
  const cantidadNum = parseInt(cantidad) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <h2 className="mb-1 text-base font-semibold text-white">Entrada de mercancía</h2>
        <p className="mb-4 text-sm text-gray-400">{producto.nombre}</p>

        <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-800/60 px-4 py-3">
          <span className="text-sm text-gray-400">Stock actual</span>
          <span className="text-lg font-bold text-white">{producto.stockActual}</span>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-gray-400">Cantidad a agregar</label>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-center text-xl font-bold text-white focus:border-brand-500 focus:outline-none"
          />
        </div>

        {cantidadNum > 0 && (
          <div className="mb-4 flex items-center justify-center gap-3 text-sm">
            <span className="text-gray-500">{producto.stockActual}</span>
            <span className="text-gray-700">+{cantidadNum} =</span>
            <span className="text-lg font-bold text-emerald-400">
              {producto.stockActual + cantidadNum}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            disabled={cargando}
            className="flex-1 rounded-lg border border-gray-700 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => cantidadNum > 0 && onConfirmar(producto.id, cantidadNum)}
            disabled={cargando || cantidadNum <= 0}
            className="flex-1 rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            {cargando ? "..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Crear/Editar producto ──────────────────────────────────────────────

function ModalProducto({
  producto,
  esDueno,
  cargando,
  onGuardar,
  onCancelar,
}: {
  producto: Producto | null;
  esDueno: boolean;
  cargando: boolean;
  onGuardar: (
    id: number | null,
    data: {
      nombre: string;
      categoria: string;
      precioVenta: number;
      precioCosto: number;
      stockMinimo: number;
      stockInicial?: number;
    }
  ) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [categoria, setCategoria] = useState(producto?.categoria ?? "OTRO");
  const [precioVenta, setPrecioVenta] = useState(producto ? String(producto.precioVenta) : "");
  const [precioCosto, setPrecioCosto] = useState(producto ? String(producto.precioCosto) : "");
  const [stockMinimo, setStockMinimo] = useState(producto ? String(producto.stockMinimo) : "5");
  const [stockInicial, setStockInicial] = useState("0");

  const esNuevo = !producto;
  const precioCostoValido = !esDueno || (precioCosto !== "" && parseFloat(precioCosto) > 0);
  const valido = nombre.trim() !== "" && parseFloat(precioVenta) > 0 && precioCostoValido;
  const gananciaPreview =
    esDueno && parseFloat(precioVenta) > 0 && parseFloat(precioCosto) > 0
      ? parseFloat(precioVenta) - parseFloat(precioCosto)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <h2 className="mb-5 text-base font-semibold text-white">
          {esNuevo ? "Agregar producto" : `Editar — ${producto.nombre}`}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-gray-400">Nombre</label>
            <input
              autoFocus
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Categoría</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            >
              {CATEGORIAS_OPCIONES.map((c) => (
                <option key={c} value={c}>{CAT[c]?.label ?? c}</option>
              ))}
            </select>
          </div>

          <div className={`grid gap-3 ${esDueno ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="mb-1 block text-sm text-gray-400">Precio venta *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                <input
                  type="number" min={0} step={0.5} value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-6 pr-3 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
            {esDueno && (
              <div>
                <label className="mb-1 block text-sm text-gray-400">Precio costo *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                  <input
                    type="number" min={0} step={0.5} value={precioCosto}
                    onChange={(e) => setPrecioCosto(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-6 pr-3 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-gray-400">Stock mínimo</label>
              <input
                type="number" min={0} value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            {esNuevo && (
              <div>
                <label className="mb-1 block text-sm text-gray-400">Stock inicial</label>
                <input
                  type="number" min={0} value={stockInicial}
                  onChange={(e) => setStockInicial(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {gananciaPreview !== null && (
            <div className="flex justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-sm">
              <span className="text-gray-500">Ganancia</span>
              <span className="text-emerald-400 font-medium">
                ${gananciaPreview.toFixed(2)}
                {parseFloat(precioVenta) > 0 && (
                  <span className="ml-1 text-gray-600 text-xs">
                    ({Math.round((gananciaPreview / parseFloat(precioVenta)) * 100)}%)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancelar}
            disabled={cargando}
            className="flex-1 rounded-lg border border-gray-700 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() =>
              valido &&
              onGuardar(producto?.id ?? null, {
                nombre: nombre.trim(),
                categoria,
                precioVenta: parseFloat(precioVenta),
                precioCosto: parseFloat(precioCosto),
                stockMinimo: parseInt(stockMinimo) || 0,
                ...(esNuevo ? { stockInicial: parseInt(stockInicial) || 0 } : {}),
              })
            }
            disabled={!valido || cargando}
            className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
          >
            {cargando ? "..." : esNuevo ? "Agregar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Confirmar Eliminar ─────────────────────────────────────────────────

function ModalConfirmEliminar({
  producto,
  cargando,
  onConfirmar,
  onCancelar,
}: {
  producto: Producto;
  cargando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancelar}>
      <div
        className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-base font-semibold text-white">¿Eliminar producto?</h2>
        <p className="mb-1 text-sm text-gray-400">
          Se eliminará <span className="text-white">{producto.nombre}</span> permanentemente.
        </p>
        <p className="mb-5 text-xs text-gray-600">
          Solo es posible si no tiene ventas registradas.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            disabled={cargando}
            className="flex-1 rounded-lg border border-gray-700 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={cargando}
            className="flex-1 rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
          >
            {cargando ? "..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
