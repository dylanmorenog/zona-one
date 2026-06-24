"use client";

import {
  guardarProducto,
  ajustarStock,
  ponerStockEnCero,
  registrarVentaProducto,
  toggleActivoProducto,
  eliminarProducto,
} from "@/app/actions/productos";
import {
  createCategoriaProducto,
  deleteCategoriaProducto,
} from "@/app/actions/configuracion";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  categoriaExtra: string | null;
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
  categoriasCustom: { id: number; nombre: string }[];
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

const CUSTOM_BADGE = "bg-purple-900/40 text-purple-300";

function getCatDisplay(p: Pick<Producto, "categoria" | "categoriaExtra">) {
  if (p.categoriaExtra) return { label: p.categoriaExtra, badge: CUSTOM_BADGE };
  return CAT[p.categoria] ?? CAT.OTRO;
}

const CATEGORIAS_ENUM = ["FRITURAS", "DULCES", "PAPELERIA", "BEBIDAS", "OTRO"] as const;

// ─── Panel principal ──────────────────────────────────────────────────────────

type Vista = "venta" | "inventario";

export function ProductosPanel({ productos, ventasHoy, totalHoy, categoriasCustom, rol }: Props) {
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

  const [busqueda, setBusqueda] = useState("");
  const busquedaRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1 w-fit shrink-0">
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

        {/* Buscador */}
        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={busquedaRef}
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full rounded-xl border border-gray-800 bg-gray-900 py-1.5 pl-9 pr-8 text-sm text-white placeholder-gray-600 focus:border-gray-600 focus:outline-none"
          />
          {busqueda && (
            <button
              onClick={() => { setBusqueda(""); busquedaRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>
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
          busqueda={busqueda}
          onSeleccionar={setModalVenta}
        />
      )}

      {vista === "inventario" && (
        <VistaInventario
          productos={productos}
          categoriasCustom={categoriasCustom}
          busqueda={busqueda}
          esDueno={esDueno}
          onEntrada={setModalEntrada}
          onEditar={(p) => setModalProducto(p)}
          onToggleActivo={esDueno ? (p) => ejecutar(() => toggleActivoProducto(p.id)) : undefined}
          onNuevo={() => setModalProducto("nuevo")}
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
        <ModalAjusteStock
          producto={modalEntrada}
          cargando={cargando}
          onConfirmar={(productoId, cantidad, operacion) =>
            ejecutar(async () => {
              await ajustarStock(productoId, cantidad, operacion);
              setModalEntrada(null);
            }, operacion === "agregar" ? "Stock agregado" : "Stock quitado")
          }
          onCancelar={() => setModalEntrada(null)}
        />
      )}

      {modalProducto && (
        <ModalProducto
          producto={modalProducto === "nuevo" ? null : modalProducto}
          esDueno={esDueno}
          categoriasCustom={categoriasCustom}
          cargando={cargando}
          onGuardar={(id, data) =>
            ejecutar(async () => {
              await guardarProducto(id, data);
              setModalProducto(null);
            })
          }
          onPonerStockCero={(id) =>
            ejecutar(async () => {
              await ponerStockEnCero(id);
              setModalProducto(null);
            }, "Stock puesto en 0")
          }
          onEliminar={(p) => {
            setModalProducto(null);
            setConfirmEliminar(p);
          }}
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

const FILTROS = ["TODOS", ...CATEGORIAS_ENUM] as const;
type Filtro = (typeof FILTROS)[number];

function VistaVenta({
  productos,
  ventasHoy,
  totalHoy,
  busqueda,
  onSeleccionar,
}: {
  productos: Producto[];
  ventasHoy: VentaHoy[];
  totalHoy: number;
  busqueda: string;
  onSeleccionar: (p: Producto) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("TODOS");

  const categoriasConProductos = new Set(productos.map((p) => p.categoria));
  const filtrosDisponibles = FILTROS.filter(
    (f) => f === "TODOS" || categoriasConProductos.has(f)
  );

  const q = busqueda.trim().toLowerCase();
  const productosFiltrados = (() => {
    const porCategoria = filtro === "TODOS" ? productos : productos.filter((p) => p.categoria === filtro);
    if (!q) return porCategoria;
    return productos.filter((p) => p.nombre.toLowerCase().includes(q));
  })();

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
              {q ? `Sin resultados para "${busqueda}"` : "Sin productos en esta categoría"}
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
                const cfg = getCatDisplay(p);

                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[1fr_72px_80px_44px] items-center gap-3 px-4 py-3 transition ${
                      agotado ? "opacity-50" : "hover:bg-gray-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      <span className="truncate text-sm font-medium text-white">
                        {p.nombre}
                      </span>
                    </div>
                    <span className="text-right text-sm font-semibold text-white">
                      ${p.precioVenta.toFixed(0)}
                    </span>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${agotado ? "text-red-400" : bajo ? "text-amber-400" : "text-gray-400"}`}>
                        {agotado ? "Agotado" : bajo ? `⚠ ${p.stockActual}` : p.stockActual}
                      </span>
                    </div>
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
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
            Ventas del día
          </p>
          <p className="text-3xl font-bold text-white">${totalHoy.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-gray-600">
            {ventasHoy.length} venta{ventasHoy.length !== 1 ? "s" : ""}
          </p>
        </div>

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
  categoriasCustom,
  busqueda,
  esDueno,
  onEntrada,
  onEditar,
  onToggleActivo,
  onNuevo,
  onEliminar,
  cargando,
}: {
  productos: Producto[];
  categoriasCustom: { id: number; nombre: string }[];
  busqueda: string;
  esDueno: boolean;
  onEntrada: (p: Producto) => void;
  onEditar: (p: Producto) => void;
  onToggleActivo?: (p: Producto) => void;
  onNuevo: () => void;
  onEliminar: (p: Producto) => void;
  cargando: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [nuevaCat, setNuevaCat] = useState("");
  const [creandoCat, setCreandoCat] = useState(false);
  const inputCatRef = useRef<HTMLInputElement>(null);

  const bajoMinimo = productos.filter((p) => p.activo && p.stockActual <= p.stockMinimo);

  const colsDueno = "grid-cols-[1fr_70px_60px_80px_80px_80px_180px]";
  const colsEmpleado = "grid-cols-[1fr_70px_60px_80px_140px]";
  const cols = esDueno ? colsDueno : colsEmpleado;

  // Build category groups preserving DB order
  const q = busqueda.trim().toLowerCase();
  type Grupo = { key: string; label: string; badge: string; productos: Producto[] };
  const grupos: Grupo[] = [];
  const grupoMap = new Map<string, Grupo>();
  for (const p of productos) {
    if (q && !p.nombre.toLowerCase().includes(q)) continue;
    const key = p.categoriaExtra ? `custom:${p.categoriaExtra}` : p.categoria;
    const cfg = getCatDisplay(p);
    if (!grupoMap.has(key)) {
      const g: Grupo = { key, label: cfg.label, badge: cfg.badge, productos: [] };
      grupoMap.set(key, g);
      grupos.push(g);
    }
    grupoMap.get(key)!.productos.push(p);
  }

  async function agregarCategoria() {
    const nombre = nuevaCat.trim();
    if (!nombre) return;
    setCreandoCat(true);
    try {
      await createCategoriaProducto(nombre);
      router.refresh();
      setNuevaCat("");
      toast.success(`Categoría "${nombre}" creada`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear categoría");
    } finally {
      setCreandoCat(false);
    }
  }

  async function eliminarCategoria(id: number, nombre: string) {
    try {
      await deleteCategoriaProducto(id);
      router.refresh();
      toast.success(`Categoría "${nombre}" eliminada`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar categoría");
    }
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
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

      {/* Categorías personalizadas */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Categorías personalizadas
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {categoriasCustom.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1.5 rounded-full border border-purple-800/50 bg-purple-900/20 pl-3 pr-1.5 py-1 text-xs font-medium text-purple-300"
            >
              {c.nombre}
              <button
                onClick={() => eliminarCategoria(c.id, c.nombre)}
                className="flex items-center justify-center w-4 h-4 rounded-full text-purple-500 hover:text-red-400 hover:bg-red-900/30 transition"
                title="Eliminar categoría"
              >
                ×
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <input
              ref={inputCatRef}
              type="text"
              value={nuevaCat}
              onChange={(e) => setNuevaCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") agregarCategoria(); }}
              placeholder="Nueva categoría..."
              className="w-36 rounded-lg border border-dashed border-gray-700 bg-transparent px-2.5 py-1 text-xs text-gray-400 placeholder-gray-600 focus:border-gray-500 focus:outline-none"
            />
            <button
              onClick={agregarCategoria}
              disabled={creandoCat || !nuevaCat.trim()}
              className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-40 transition"
            >
              {creandoCat ? "..." : "+ Agregar"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {productos.filter((p) => p.activo).length} activos ·{" "}
          {productos.filter((p) => !p.activo).length} inactivos
        </p>
        <button
          onClick={onNuevo}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agregar producto
        </button>
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

          {grupos.map((grupo) => (
            <div key={grupo.key}>
              {/* Category group header */}
              <div className="px-4 py-1.5 bg-gray-800/30 border-b border-gray-800/60">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${grupo.badge}`}>
                  {grupo.label}
                </span>
                <span className="ml-2 text-xs text-gray-600">{grupo.productos.length}</span>
              </div>

              {grupo.productos.map((p) => {
                const agotado = p.stockActual <= 0;
                const bajo = p.stockActual > 0 && p.stockActual <= p.stockMinimo;
                const ganancia = p.precioVenta - p.precioCosto;
                const margen = p.precioVenta > 0 ? Math.round((ganancia / p.precioVenta) * 100) : 0;

                return (
                  <div
                    key={p.id}
                    className={`grid ${cols} gap-3 items-center px-4 py-3 ${!p.activo ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
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
          ))}

          {grupos.length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-gray-600">
              {q ? `Sin resultados para "${busqueda}"` : "Sin productos registrados"}
            </div>
          )}
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
  const cfg = getCatDisplay(producto);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancelar}>
      <div
        className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs ${cfg.badge}`}>{cfg.label}</span>
          <span className="font-semibold text-white">{producto.nombre}</span>
          <span className="ml-auto text-sm text-gray-400">${producto.precioVenta}/u</span>
        </div>

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

// ─── Modal Ajuste de stock ────────────────────────────────────────────────────

function ModalAjusteStock({
  producto,
  cargando,
  onConfirmar,
  onCancelar,
}: {
  producto: Producto;
  cargando: boolean;
  onConfirmar: (id: number, cantidad: number, operacion: "agregar" | "quitar") => void;
  onCancelar: () => void;
}) {
  const [operacion, setOperacion] = useState<"agregar" | "quitar">("agregar");
  const [cantidad, setCantidad] = useState<string>("1");
  const cantidadNum = parseInt(cantidad) || 0;

  const resultante = operacion === "agregar"
    ? producto.stockActual + cantidadNum
    : producto.stockActual - cantidadNum;
  const sinStock = operacion === "quitar" && resultante < 0;
  const valido = cantidadNum > 0 && !sinStock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <h2 className="mb-1 text-base font-semibold text-white">Ajustar stock</h2>
        <p className="mb-4 text-sm text-gray-400">{producto.nombre}</p>

        {/* Toggle agregar / quitar */}
        <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl border border-gray-800 bg-gray-800/40 p-1">
          <button
            onClick={() => setOperacion("agregar")}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              operacion === "agregar"
                ? "bg-emerald-700 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            + Agregar stock
          </button>
          <button
            onClick={() => setOperacion("quitar")}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              operacion === "quitar"
                ? "bg-red-700 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            − Quitar stock
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-800/60 px-4 py-3">
          <span className="text-sm text-gray-400">Stock actual</span>
          <span className="text-lg font-bold text-white">{producto.stockActual}</span>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-gray-400">Cantidad</label>
          <input
            type="number"
            min={1}
            max={operacion === "quitar" ? producto.stockActual : undefined}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-center text-xl font-bold text-white focus:border-brand-500 focus:outline-none"
          />
        </div>

        {cantidadNum > 0 && (
          <div className="mb-4 flex items-center justify-center gap-3 text-sm">
            <span className="text-gray-500">{producto.stockActual}</span>
            <span className="text-gray-700">{operacion === "agregar" ? `+${cantidadNum}` : `−${cantidadNum}`} =</span>
            <span className={`text-lg font-bold ${sinStock ? "text-red-400" : operacion === "agregar" ? "text-emerald-400" : "text-amber-400"}`}>
              {resultante}
            </span>
          </div>
        )}

        {sinStock && (
          <p className="mb-3 text-xs text-red-400 text-center">
            No hay suficiente stock. Disponible: {producto.stockActual}
          </p>
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
            onClick={() => valido && onConfirmar(producto.id, cantidadNum, operacion)}
            disabled={cargando || !valido}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition ${
              operacion === "agregar" ? "bg-emerald-700 hover:bg-emerald-600" : "bg-red-700 hover:bg-red-600"
            }`}
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
  categoriasCustom,
  cargando,
  onGuardar,
  onPonerStockCero,
  onEliminar,
  onCancelar,
}: {
  producto: Producto | null;
  esDueno: boolean;
  categoriasCustom: { id: number; nombre: string }[];
  cargando: boolean;
  onGuardar: (
    id: number | null,
    data: {
      nombre: string;
      categoria: string;
      categoriaExtra?: string | null;
      precioVenta: number;
      precioCosto: number;
      stockMinimo: number;
      stockInicial?: number;
    }
  ) => void;
  onPonerStockCero: (id: number) => void;
  onEliminar: (p: Producto) => void;
  onCancelar: () => void;
}) {
  // Category select value: enum key OR "custom:nombre"
  const initSelect = (() => {
    if (producto?.categoriaExtra) return `custom:${producto.categoriaExtra}`;
    return producto?.categoria ?? "OTRO";
  })();

  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [categoriaSelect, setCategoriaSelect] = useState(initSelect);
  const [precioVenta, setPrecioVenta] = useState(producto ? String(producto.precioVenta) : "");
  const [precioCosto, setPrecioCosto] = useState(producto && esDueno ? String(producto.precioCosto) : "");
  const [stockMinimo, setStockMinimo] = useState(producto ? String(producto.stockMinimo) : "5");
  const [stockInicial, setStockInicial] = useState("0");

  const esNuevo = !producto;
  const isCustom = categoriaSelect.startsWith("custom:");
  const categoriaEnum = isCustom ? "OTRO" : categoriaSelect;
  const categoriaExtra = isCustom ? categoriaSelect.slice(7) : null;

  const precioCostoValido = !esDueno || precioCosto === "" || parseFloat(precioCosto) >= 0;
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
              value={categoriaSelect}
              onChange={(e) => setCategoriaSelect(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            >
              {CATEGORIAS_ENUM.map((c) => (
                <option key={c} value={c}>{CAT[c]?.label ?? c}</option>
              ))}
              {categoriasCustom.length > 0 && (
                <>
                  <option disabled>── Personalizadas ──</option>
                  {categoriasCustom.map((c) => (
                    <option key={`custom:${c.nombre}`} value={`custom:${c.nombre}`}>{c.nombre}</option>
                  ))}
                </>
              )}
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
                <label className="mb-1 block text-sm text-gray-400">Precio costo</label>
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

        {/* Acciones de stock/eliminación — solo en modo edición */}
        {!esNuevo && producto && (
          <div className="mt-4 flex gap-2 border-t border-gray-800 pt-4">
            <button
              onClick={() => producto.stockActual > 0 && onPonerStockCero(producto.id)}
              disabled={cargando || producto.stockActual === 0}
              className="flex-1 rounded-lg border border-amber-800/50 py-2 text-xs font-medium text-amber-400 hover:bg-amber-950/30 disabled:opacity-30 transition"
            >
              Stock a 0
            </button>
            <button
              onClick={() => onEliminar(producto)}
              disabled={cargando}
              className="flex-1 rounded-lg border border-red-900/50 py-2 text-xs font-medium text-red-400 hover:bg-red-950/30 disabled:opacity-30 transition"
            >
              Eliminar
            </button>
          </div>
        )}

        <div className="mt-4 flex gap-3">
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
                categoria: categoriaEnum,
                categoriaExtra,
                precioVenta: parseFloat(precioVenta),
                precioCosto: esDueno ? parseFloat(precioCosto) || 0 : 0,
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
