"use client";

import { useState, useTransition } from "react";
import {
  updateConfigXbox,
  toggleConsola,
  createServicio,
  updateServicio,
  toggleServicio,
  createProducto,
  updateProducto,
  toggleProducto,
  deleteProducto,
  updateConfigFinanciero,
  createCategoriaGasto,
  deleteCategoriaGasto,
  createCategoriaProducto,
  deleteCategoriaProducto,
  deleteCategoriaProductoConReasignacion,
  updateCategoriaProducto,
} from "@/app/actions/configuracion";
import { fmt } from "@/lib/financiero";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CategoriaProducto = "DULCES" | "FRITURAS" | "PAPELERIA" | "BEBIDAS" | "OTRO";
const CATEGORIAS_LABELS: Record<CategoriaProducto, string> = {
  DULCES: "Dulces",
  FRITURAS: "Frituras",
  PAPELERIA: "Papelería",
  BEBIDAS: "Bebidas",
  OTRO: "Otro",
};

interface ConfigXboxData {
  id: number;
  precioPorHora: number;
  precioPorMediaHora: number;
  precioPorMinuto: number;
  precioControlExtra: number;
}
interface Consola { id: number; nombre: string; numero: number; activa: boolean }
interface TipoServicio { id: number; nombre: string; precioBase: number; porUnidad: boolean; activo: boolean }
interface Producto { id: number; nombre: string; categoria: CategoriaProducto; categoriaExtra: string | null; precioVenta: number; precioCosto: number; stockActual: number; stockMinimo: number; activo: boolean; tieneVentas: boolean }
interface CategoriaGasto { id: number; nombre: string; esDefault: boolean; activa: boolean }
interface CategoriaProductoCustom { id: number; nombre: string }

interface Props {
  configXbox: ConfigXboxData | null;
  consolas: Consola[];
  servicios: TipoServicio[];
  productos: Producto[];
  configFinanciero: { id: number; capitalTotal: number } | null;
  categoriasGasto: CategoriaGasto[];
  categoriasProducto: CategoriaProductoCustom[];
}

// ─── Componentes utilitarios ──────────────────────────────────────────────────

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(true);
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/40 transition"
      >
        <span className="text-sm font-semibold text-white">{titulo}</span>
        <span className="text-gray-600 text-sm">{abierto ? "▲" : "▼"}</span>
      </button>
      {abierto && <div className="border-t border-gray-800">{children}</div>}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", step, min, placeholder }: {
  value: string | number; onChange: (v: string) => void;
  type?: string; step?: string; min?: string; placeholder?: string;
}) {
  return (
    <input
      type={type}
      step={step}
      min={min}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
    />
  );
}

function BtnPrimary({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition"
    >
      {children}
    </button>
  );
}

function BtnGhost({ onClick, disabled, children, className = "" }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border border-gray-700 hover:border-gray-500 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50 transition ${className}`}
    >
      {children}
    </button>
  );
}

function ErrorMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="text-xs text-red-400">{msg}</p>;
}

function OkMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="text-xs text-emerald-400">{msg}</p>;
}

// ─── Sección Xbox ─────────────────────────────────────────────────────────────

function SeccionXbox({ configXbox, consolas }: { configXbox: ConfigXboxData | null; consolas: Consola[] }) {
  const [pending, startT] = useTransition();
  const [hora, setHora] = useState(String(configXbox?.precioPorHora ?? ""));
  const [mediaHora, setMediaHora] = useState(String(configXbox?.precioPorMediaHora ?? ""));
  const [control, setControl] = useState(String(configXbox?.precioControlExtra ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function guardar() {
    const h = parseFloat(hora), mh = parseFloat(mediaHora), c = parseFloat(control);
    if (isNaN(h) || isNaN(mh) || isNaN(c) || h <= 0 || mh <= 0 || c < 0) {
      setError("Ingresa precios válidos mayores a 0"); return;
    }
    setError(null); setOk(null);
    startT(async () => {
      try {
        await updateConfigXbox({ precioPorHora: h, precioPorMediaHora: mh, precioControlExtra: c });
        setOk("Precios guardados");
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  }

  function handleToggleConsola(id: number, activa: boolean) {
    startT(async () => {
      await toggleConsola(id, !activa);
    });
  }

  const consolasActivas = consolas.filter(c => c.activa).length;

  return (
    <Seccion titulo="Xbox">
      <div className="p-5 space-y-5">
        {/* Precios */}
        <div className="grid grid-cols-3 gap-4">
          <Campo label="Precio por hora">
            <Input type="number" step="0.50" min="0" value={hora} onChange={setHora} placeholder="35.00" />
          </Campo>
          <Campo label="Precio media hora">
            <Input type="number" step="0.50" min="0" value={mediaHora} onChange={setMediaHora} placeholder="20.00" />
          </Campo>
          <Campo label="Control extra">
            <Input type="number" step="0.50" min="0" value={control} onChange={setControl} placeholder="5.00" />
          </Campo>
        </div>

        <div className="flex items-center gap-3">
          <BtnPrimary onClick={guardar} disabled={pending}>
            {pending ? "Guardando..." : "Guardar precios"}
          </BtnPrimary>
          <ErrorMsg msg={error} />
          <OkMsg msg={ok} />
        </div>

        {/* Consolas */}
        <div className="pt-4 border-t border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Consolas — {consolasActivas} activa{consolasActivas !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-2">
            {consolas.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${c.activa ? "bg-emerald-400" : "bg-gray-700"}`} />
                  <span className="text-sm text-gray-300">{c.nombre}</span>
                </div>
                <button
                  onClick={() => handleToggleConsola(c.id, c.activa)}
                  disabled={pending}
                  className={`text-xs px-3 py-1 rounded-md transition ${
                    c.activa
                      ? "text-red-400 hover:bg-red-950/30"
                      : "text-emerald-400 hover:bg-emerald-950/30"
                  }`}
                >
                  {c.activa ? "Desactivar" : "Activar"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Seccion>
  );
}

// ─── Sección Servicios ────────────────────────────────────────────────────────

type ModoServicio = { tipo: "nuevo" } | { tipo: "editar"; servicio: TipoServicio } | null;

function SeccionServicios({ servicios }: { servicios: TipoServicio[] }) {
  const [pending, startT] = useTransition();
  const [modo, setModo] = useState<ModoServicio>(null);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [porUnidad, setPorUnidad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function abrirNuevo() {
    setNombre(""); setPrecio(""); setPorUnidad(true); setError(null);
    setModo({ tipo: "nuevo" });
  }

  function abrirEditar(s: TipoServicio) {
    setNombre(s.nombre); setPrecio(String(s.precioBase)); setPorUnidad(s.porUnidad); setError(null);
    setModo({ tipo: "editar", servicio: s });
  }

  function guardar() {
    const p = parseFloat(precio);
    if (!nombre.trim()) { setError("El nombre es requerido"); return; }
    if (isNaN(p) || p <= 0) { setError("El precio debe ser mayor a 0"); return; }
    setError(null);
    startT(async () => {
      try {
        if (modo?.tipo === "nuevo") {
          await createServicio({ nombre: nombre.trim(), precioBase: p, porUnidad });
        } else if (modo?.tipo === "editar") {
          await updateServicio(modo.servicio.id, { nombre: nombre.trim(), precioBase: p, porUnidad });
        }
        setModo(null);
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  }

  function handleToggle(id: number, activo: boolean) {
    startT(async () => { await toggleServicio(id, !activo); });
  }

  const activos = servicios.filter(s => s.activo);
  const inactivos = servicios.filter(s => !s.activo);

  return (
    <Seccion titulo={`Servicios (${activos.length})`}>
      <div className="p-5 space-y-3">
        {/* Lista activos */}
        {activos.length === 0 && (
          <p className="text-sm text-gray-600 py-2">Sin servicios activos</p>
        )}
        {activos.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-2.5 gap-3">
            <div className="min-w-0">
              <p className="text-sm text-gray-200 truncate">{s.nombre}</p>
              <p className="text-xs text-gray-500">${fmt(s.precioBase)}{s.porUnidad ? " / unidad" : " fijo"}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <BtnGhost onClick={() => abrirEditar(s)} disabled={pending}>Editar</BtnGhost>
              <BtnGhost onClick={() => handleToggle(s.id, s.activo)} disabled={pending} className="text-red-400 hover:text-red-300">Desactivar</BtnGhost>
            </div>
          </div>
        ))}

        {/* Inactivos colapsados */}
        {inactivos.length > 0 && (
          <details className="group">
            <summary className="text-xs text-gray-600 hover:text-gray-400 cursor-pointer list-none">
              {inactivos.length} servicio{inactivos.length !== 1 ? "s" : ""} inactivo{inactivos.length !== 1 ? "s" : ""} ▼
            </summary>
            <div className="mt-2 space-y-2">
              {inactivos.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/10 px-4 py-2.5 gap-3 opacity-60">
                  <p className="text-sm text-gray-400 truncate">{s.nombre}</p>
                  <BtnGhost onClick={() => handleToggle(s.id, s.activo)} disabled={pending} className="text-emerald-400 hover:text-emerald-300">Activar</BtnGhost>
                </div>
              ))}
            </div>
          </details>
        )}

        <button
          onClick={abrirNuevo}
          className="w-full rounded-lg border border-dashed border-gray-700 hover:border-brand-600 py-2.5 text-sm text-gray-500 hover:text-brand-400 transition"
        >
          + Agregar servicio
        </button>

        {/* Modal inline */}
        {modo && (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 space-y-3">
            <p className="text-sm font-semibold text-white">
              {modo.tipo === "nuevo" ? "Nuevo servicio" : `Editar: ${modo.tipo === "editar" ? modo.servicio.nombre : ""}`}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombre">
                <Input value={nombre} onChange={setNombre} placeholder="Impresión B/N" />
              </Campo>
              <Campo label="Precio base">
                <Input type="number" step="0.50" min="0" value={precio} onChange={setPrecio} placeholder="2.00" />
              </Campo>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={porUnidad}
                  onChange={e => setPorUnidad(e.target.checked)}
                  className="rounded border-gray-600"
                />
                Precio por unidad
              </label>
              <span className="text-xs text-gray-600">(desmarca si el precio es fijo por servicio)</span>
            </div>
            <ErrorMsg msg={error} />
            <div className="flex gap-2">
              <BtnPrimary onClick={guardar} disabled={pending}>
                {pending ? "Guardando..." : "Guardar"}
              </BtnPrimary>
              <BtnGhost onClick={() => setModo(null)}>Cancelar</BtnGhost>
            </div>
          </div>
        )}
      </div>
    </Seccion>
  );
}

// ─── Sección Productos ────────────────────────────────────────────────────────

const CATS_ENUM: CategoriaProducto[] = ["DULCES", "FRITURAS", "PAPELERIA", "BEBIDAS"];

// Valor del select para categorías: enum key o "CUSTOM:nombre"
type ValorCategoria = CategoriaProducto | `CUSTOM:${string}`;

function labelCategoria(p: Producto): string {
  if (p.categoriaExtra) return p.categoriaExtra;
  return CATEGORIAS_LABELS[p.categoria] ?? p.categoria;
}

type ModoProducto = { tipo: "nuevo" } | { tipo: "editar"; producto: Producto } | null;
type ConfirmDelete = { id: number; nombre: string; tieneVentas: boolean } | null;

function SeccionProductos({
  productos,
  categoriasProducto: initialCatsCustom,
}: {
  productos: Producto[];
  categoriasProducto: CategoriaProductoCustom[];
}) {
  const [pending, startT] = useTransition();
  const [modo, setModo] = useState<ModoProducto>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete>(null);
  const [catsCustom, setCatsCustom] = useState(initialCatsCustom);
  const [nuevaCat, setNuevaCat] = useState("");
  const [mostrarFormCat, setMostrarFormCat] = useState(false);
  const [errorCat, setErrorCat] = useState<string | null>(null);
  const [editandoCatId, setEditandoCatId] = useState<number | null>(null);
  const [editandoCatNombre, setEditandoCatNombre] = useState("");
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<{ id: number; nombre: string; productCount: number } | null>(null);
  const [reasignarCatVal, setReasignarCatVal] = useState<"sin_categoria" | ValorCategoria>("sin_categoria");

  // Campos del formulario de producto
  const [nombre, setNombre] = useState("");
  const [valorCat, setValorCat] = useState<ValorCategoria>("DULCES");
  const [precioVenta, setPrecioVenta] = useState("");
  const [precioCosto, setPrecioCosto] = useState("");
  const [stockMin, setStockMin] = useState("5");
  const [error, setError] = useState<string | null>(null);

  // Filtro de lista
  const [filtro, setFiltro] = useState<"TODOS" | ValorCategoria>("TODOS");

  function valorCatDeProducto(p: Producto): ValorCategoria {
    if (p.categoriaExtra) return `CUSTOM:${p.categoriaExtra}`;
    return p.categoria;
  }

  function abrirNuevo() {
    setNombre(""); setValorCat("DULCES"); setPrecioVenta(""); setPrecioCosto(""); setStockMin("5"); setError(null);
    setModo({ tipo: "nuevo" });
  }

  function abrirEditar(p: Producto) {
    setNombre(p.nombre); setValorCat(valorCatDeProducto(p));
    setPrecioVenta(String(p.precioVenta)); setPrecioCosto(String(p.precioCosto));
    setStockMin(String(p.stockMinimo)); setError(null);
    setModo({ tipo: "editar", producto: p });
  }

  function parsearCategoria(v: ValorCategoria): { categoria: CategoriaProducto; categoriaExtra: string | null } {
    if (v.startsWith("CUSTOM:")) {
      return { categoria: "OTRO", categoriaExtra: v.slice(7) };
    }
    return { categoria: v as CategoriaProducto, categoriaExtra: null };
  }

  function guardar() {
    const pv = parseFloat(precioVenta), pc = parseFloat(precioCosto), sm = parseInt(stockMin);
    if (!nombre.trim()) { setError("El nombre es requerido"); return; }
    if (isNaN(pv) || pv <= 0) { setError("El precio de venta debe ser mayor a 0"); return; }
    if (isNaN(pc) || pc < 0) { setError("El precio de costo no puede ser negativo"); return; }
    if (isNaN(sm) || sm < 0) { setError("El stock mínimo no puede ser negativo"); return; }
    setError(null);
    const { categoria, categoriaExtra } = parsearCategoria(valorCat);
    startT(async () => {
      try {
        const data = { nombre: nombre.trim(), categoria, categoriaExtra: categoriaExtra ?? undefined, precioVenta: pv, precioCosto: pc, stockMinimo: sm };
        if (modo?.tipo === "nuevo") {
          await createProducto(data);
        } else if (modo?.tipo === "editar") {
          await updateProducto(modo.producto.id, { ...data, categoriaExtra });
        }
        setModo(null);
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  }

  function handleToggle(id: number, activo: boolean) {
    startT(async () => { await toggleProducto(id, !activo); });
  }

  function pedirConfirmDelete(p: Producto) {
    setConfirmDelete({ id: p.id, nombre: p.nombre, tieneVentas: p.tieneVentas });
  }

  function confirmarEliminar() {
    if (!confirmDelete) return;
    if (confirmDelete.tieneVentas) { setConfirmDelete(null); return; }
    startT(async () => {
      try {
        await deleteProducto(confirmDelete.id);
        setConfirmDelete(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al eliminar");
        setConfirmDelete(null);
      }
    });
  }

  function agregarCategoria() {
    if (!nuevaCat.trim()) { setErrorCat("Escribe un nombre"); return; }
    setErrorCat(null);
    startT(async () => {
      try {
        const created = await createCategoriaProducto(nuevaCat.trim());
        setCatsCustom(prev => [...prev, created]);
        setNuevaCat("");
        setMostrarFormCat(false);
      } catch (e) { setErrorCat(e instanceof Error ? e.message : "Error"); }
    });
  }

  function pedirEliminarCategoria(id: number) {
    const cat = catsCustom.find(c => c.id === id);
    if (!cat) return;
    const productCount = productos.filter(p => p.categoriaExtra === cat.nombre).length;
    if (productCount > 0) {
      setReasignarCatVal("sin_categoria");
      setConfirmDeleteCat({ id, nombre: cat.nombre, productCount });
    } else {
      eliminarCategoria(id, cat.nombre, null);
    }
  }

  function eliminarCategoria(id: number, nombreOrigen: string, reasignarA: { categoria: CategoriaProducto; categoriaExtra: string | null } | null) {
    startT(async () => {
      try {
        await deleteCategoriaProductoConReasignacion(id, nombreOrigen, reasignarA);
        setCatsCustom(prev => prev.filter(c => c.id !== id));
        if (filtro === `CUSTOM:${nombreOrigen}`) setFiltro("TODOS");
        setConfirmDeleteCat(null);
      } catch (e) { setErrorCat(e instanceof Error ? e.message : "Error"); }
    });
  }

  function confirmarEliminarCategoria() {
    if (!confirmDeleteCat) return;
    let reasignarA: { categoria: CategoriaProducto; categoriaExtra: string | null } | null = null;
    if (reasignarCatVal !== "sin_categoria") {
      const val = reasignarCatVal as ValorCategoria;
      if ((val as string).startsWith("CUSTOM:")) {
        reasignarA = { categoria: "OTRO", categoriaExtra: (val as string).slice(7) };
      } else {
        reasignarA = { categoria: val as CategoriaProducto, categoriaExtra: null };
      }
    }
    eliminarCategoria(confirmDeleteCat.id, confirmDeleteCat.nombre, reasignarA);
  }

  function guardarEdicionCategoria(id: number) {
    if (!editandoCatNombre.trim()) return;
    startT(async () => {
      try {
        await updateCategoriaProducto(id, editandoCatNombre.trim());
        const nombreAnterior = catsCustom.find(c => c.id === id)?.nombre;
        setCatsCustom(prev => prev.map(c => c.id === id ? { ...c, nombre: editandoCatNombre.trim() } : c));
        if (filtro === `CUSTOM:${nombreAnterior}`) setFiltro(`CUSTOM:${editandoCatNombre.trim()}`);
        setEditandoCatId(null);
        setEditandoCatNombre("");
      } catch (e) { setErrorCat(e instanceof Error ? e.message : "Error"); }
    });
  }

  const productosActivos = productos.filter(p => p.activo);
  const inactivos = productos.filter(p => !p.activo);
  const filtrados = filtro === "TODOS"
    ? productosActivos
    : productosActivos.filter(p => valorCatDeProducto(p) === filtro);

  // Opciones de categorías para el selector del form
  const opcionesCategoria: { value: ValorCategoria; label: string }[] = [
    ...CATS_ENUM.map(c => ({ value: c as ValorCategoria, label: CATEGORIAS_LABELS[c] })),
    ...catsCustom.map(c => ({ value: `CUSTOM:${c.nombre}` as ValorCategoria, label: c.nombre })),
  ];

  // Chips de filtro
  const filtroOpciones: { value: "TODOS" | ValorCategoria; label: string }[] = [
    { value: "TODOS", label: "Todos" },
    ...CATS_ENUM.map(c => ({ value: c as ValorCategoria, label: CATEGORIAS_LABELS[c] })),
    ...catsCustom.map(c => ({ value: `CUSTOM:${c.nombre}` as ValorCategoria, label: c.nombre })),
  ];

  return (
    <Seccion titulo={`Productos (${productosActivos.length})`}>
      <div className="p-5 space-y-4">
        {/* Filtro por categoría */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Todos + categorías fijas */}
          {[{ value: "TODOS" as const, label: "Todos" }, ...CATS_ENUM.map(c => ({ value: c as ValorCategoria, label: CATEGORIAS_LABELS[c] }))].map(o => (
            <button
              key={o.value}
              onClick={() => setFiltro(o.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filtro === o.value ? "bg-brand-600 text-white" : "bg-gray-800 text-gray-500 hover:text-gray-200"
              }`}
            >
              {o.label}
            </button>
          ))}

          {/* Categorías personalizadas con editar/eliminar */}
          {catsCustom.map(c => {
            const val = `CUSTOM:${c.nombre}` as ValorCategoria;
            return editandoCatId === c.id ? (
              <div key={c.id} className="flex items-center gap-1">
                <input
                  value={editandoCatNombre}
                  onChange={e => setEditandoCatNombre(e.target.value)}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") guardarEdicionCategoria(c.id);
                    if (e.key === "Escape") { setEditandoCatId(null); setEditandoCatNombre(""); }
                  }}
                  className="rounded-full border border-brand-600 bg-gray-900 px-3 py-1 text-xs text-white focus:outline-none w-32"
                />
                <button onClick={() => guardarEdicionCategoria(c.id)} disabled={pending || !editandoCatNombre.trim()} className="text-xs text-brand-400 hover:text-brand-300 transition">✓</button>
                <button onClick={() => { setEditandoCatId(null); setEditandoCatNombre(""); }} className="text-xs text-gray-500 hover:text-gray-300 transition">✕</button>
              </div>
            ) : (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  filtro === val ? "bg-brand-600 text-white" : "bg-gray-800 text-gray-500 hover:text-gray-200"
                }`}
              >
                <button onClick={() => setFiltro(val)} className="leading-none pr-1">{c.nombre}</button>
                <button
                  onClick={() => { setEditandoCatId(c.id); setEditandoCatNombre(c.nombre); }}
                  disabled={pending}
                  title="Editar"
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition leading-none text-[10px]"
                >✎</button>
                <button
                  onClick={() => pedirEliminarCategoria(c.id)}
                  disabled={pending}
                  title="Eliminar"
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition leading-none"
                >✕</button>
              </div>
            );
          })}

          {/* Botón agregar categoría inline tras las existentes */}
          {mostrarFormCat ? (
            <div className="flex items-center gap-1.5">
              <input
                value={nuevaCat}
                onChange={e => setNuevaCat(e.target.value)}
                placeholder="Nueva categoría"
                autoFocus
                onKeyDown={e => e.key === "Enter" && agregarCategoria()}
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 w-36"
              />
              <BtnPrimary onClick={agregarCategoria} disabled={pending || !nuevaCat.trim()}>Agregar</BtnPrimary>
              <BtnGhost onClick={() => { setMostrarFormCat(false); setNuevaCat(""); setErrorCat(null); }}>Cancelar</BtnGhost>
            </div>
          ) : (
            <button
              onClick={() => { setMostrarFormCat(true); setErrorCat(null); }}
              className="rounded-full border border-dashed border-gray-700 hover:border-gray-500 px-3 py-1 text-xs text-gray-500 hover:text-gray-300 transition"
            >
              + Categoría
            </button>
          )}
        </div>
        <ErrorMsg msg={errorCat} />

        {/* Lista activos */}
        {filtrados.length === 0 && (
          <p className="text-sm text-gray-600 py-2">Sin productos en esta categoría</p>
        )}
        <div className="space-y-2">
          {filtrados.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-2.5 gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-200 truncate">{p.nombre}</p>
                  <span className="text-xs text-gray-600 bg-gray-800 rounded px-1.5 py-0.5 shrink-0">
                    {labelCategoria(p)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Venta: ${fmt(p.precioVenta)} · Costo: ${fmt(p.precioCosto)} · Stock mín: {p.stockMinimo}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <BtnGhost onClick={() => abrirEditar(p)} disabled={pending}>Editar</BtnGhost>
                <BtnGhost onClick={() => handleToggle(p.id, true)} disabled={pending} className="text-amber-400 hover:text-amber-300">Desactivar</BtnGhost>
                <BtnGhost onClick={() => pedirConfirmDelete(p)} disabled={pending} className="text-red-400 hover:text-red-300">Eliminar</BtnGhost>
              </div>
            </div>
          ))}
        </div>

        {/* Inactivos */}
        {inactivos.length > 0 && (
          <details>
            <summary className="text-xs text-gray-600 hover:text-gray-400 cursor-pointer list-none">
              {inactivos.length} producto{inactivos.length !== 1 ? "s" : ""} inactivo{inactivos.length !== 1 ? "s" : ""} ▼
            </summary>
            <div className="mt-2 space-y-2">
              {inactivos.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/10 px-4 py-2.5 gap-3 opacity-60">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-400 truncate">{p.nombre}</p>
                    <p className="text-xs text-gray-600">{labelCategoria(p)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <BtnGhost onClick={() => handleToggle(p.id, false)} disabled={pending} className="text-emerald-400 hover:text-emerald-300">Activar</BtnGhost>
                    {!p.tieneVentas && (
                      <BtnGhost onClick={() => pedirConfirmDelete(p)} disabled={pending} className="text-red-400 hover:text-red-300">Eliminar</BtnGhost>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        <button
          onClick={abrirNuevo}
          className="w-full rounded-lg border border-dashed border-gray-700 hover:border-brand-600 py-2.5 text-sm text-gray-500 hover:text-brand-400 transition"
        >
          + Agregar producto
        </button>

        {/* Formulario nuevo/editar producto */}
        {modo && (
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 space-y-3">
            <p className="text-sm font-semibold text-white">
              {modo.tipo === "nuevo" ? "Nuevo producto" : `Editar: ${modo.tipo === "editar" ? modo.producto.nombre : ""}`}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombre">
                <Input value={nombre} onChange={setNombre} placeholder="Sabritas" />
              </Campo>
              <Campo label="Categoría">
                <select
                  value={valorCat}
                  onChange={e => setValorCat(e.target.value as ValorCategoria)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                >
                  {opcionesCategoria.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Precio de venta">
                <Input type="number" step="0.50" min="0" value={precioVenta} onChange={setPrecioVenta} placeholder="15.00" />
              </Campo>
              <Campo label="Precio de costo">
                <Input type="number" step="0.50" min="0" value={precioCosto} onChange={setPrecioCosto} placeholder="10.00" />
              </Campo>
              <Campo label="Stock mínimo">
                <Input type="number" step="1" min="0" value={stockMin} onChange={setStockMin} placeholder="5" />
              </Campo>
            </div>
            <ErrorMsg msg={error} />
            <div className="flex gap-2">
              <BtnPrimary onClick={guardar} disabled={pending}>
                {pending ? "Guardando..." : "Guardar"}
              </BtnPrimary>
              <BtnGhost onClick={() => setModo(null)}>Cancelar</BtnGhost>
            </div>
          </div>
        )}

        {/* Modal de confirmación de eliminación */}
        {/* Modal confirmación eliminar categoría con productos */}
        {confirmDeleteCat && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteCat(null); }}
          >
            <div className="w-full max-w-sm mx-4 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-6 space-y-4">
              <p className="text-sm font-semibold text-white">¿Eliminar categoría?</p>
              <p className="text-sm text-gray-400">
                <span className="text-white">{confirmDeleteCat.nombre}</span> tiene{" "}
                <span className="text-white">{confirmDeleteCat.productCount}</span>{" "}
                producto{confirmDeleteCat.productCount !== 1 ? "s" : ""} asignado{confirmDeleteCat.productCount !== 1 ? "s" : ""}.
                ¿Qué hacemos con ellos?
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Reasignar a</label>
                <select
                  value={reasignarCatVal}
                  onChange={e => setReasignarCatVal(e.target.value as typeof reasignarCatVal)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="sin_categoria">Sin categoría</option>
                  {CATS_ENUM.map(c => (
                    <option key={c} value={c}>{CATEGORIAS_LABELS[c]}</option>
                  ))}
                  {catsCustom.filter(c => c.id !== confirmDeleteCat.id).map(c => (
                    <option key={c.id} value={`CUSTOM:${c.nombre}`}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmarEliminarCategoria}
                  disabled={pending}
                  className="flex-1 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition"
                >
                  {pending ? "Eliminando..." : "Eliminar categoría"}
                </button>
                <BtnGhost onClick={() => setConfirmDeleteCat(null)}>Cancelar</BtnGhost>
              </div>
            </div>
          </div>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
          >
            <div className="w-full max-w-sm mx-4 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-6 space-y-4">
              {confirmDelete.tieneVentas ? (
                <>
                  <p className="text-sm font-semibold text-white">No se puede eliminar</p>
                  <p className="text-sm text-gray-400">
                    <span className="text-white">{confirmDelete.nombre}</span> tiene ventas registradas.
                    Solo puedes desactivarlo para que no aparezca en el módulo de ventas.
                  </p>
                  <div className="flex gap-2">
                    <BtnPrimary onClick={() => { handleToggle(confirmDelete.id, true); setConfirmDelete(null); }}>
                      Desactivar en su lugar
                    </BtnPrimary>
                    <BtnGhost onClick={() => setConfirmDelete(null)}>Cancelar</BtnGhost>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-white">¿Eliminar producto?</p>
                  <p className="text-sm text-gray-400">
                    Se eliminará <span className="text-white">{confirmDelete.nombre}</span> permanentemente.
                    Esta acción no se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmarEliminar}
                      disabled={pending}
                      className="flex-1 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition"
                    >
                      {pending ? "Eliminando..." : "Sí, eliminar"}
                    </button>
                    <BtnGhost onClick={() => setConfirmDelete(null)}>Cancelar</BtnGhost>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Seccion>
  );
}

// ─── Sección Financiero ───────────────────────────────────────────────────────

function SeccionFinanciero({ configFinanciero }: { configFinanciero: { id: number; capitalTotal: number } | null }) {
  const [pending, startT] = useTransition();
  const [capital, setCapital] = useState(String(configFinanciero?.capitalTotal ?? ""));
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function guardar() {
    const c = parseFloat(capital);
    if (isNaN(c) || c < 0) { setError("Ingresa un monto válido"); return; }
    setError(null); setOk(null);
    startT(async () => {
      try {
        await updateConfigFinanciero(c);
        setOk("Capital actualizado");
        setEditando(false);
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  }

  return (
    <Seccion titulo="Financiero">
      <div className="p-5 space-y-4">
        {/* Capital */}
        <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Capital total del servicio</p>
            {editando ? (
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" step="0.01" min="0" value={capital} onChange={setCapital} />
              </div>
            ) : (
              <p className="text-2xl font-bold text-white">
                ${fmt(configFinanciero?.capitalTotal ?? 0)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editando ? (
              <>
                <BtnPrimary onClick={guardar} disabled={pending}>
                  {pending ? "..." : "Guardar"}
                </BtnPrimary>
                <BtnGhost onClick={() => { setEditando(false); setError(null); }}>Cancelar</BtnGhost>
              </>
            ) : (
              <BtnGhost onClick={() => setEditando(true)}>Editar</BtnGhost>
            )}
          </div>
        </div>
        <ErrorMsg msg={error} />
        <OkMsg msg={ok} />

        {/* Comisión */}
        <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
          <p className="text-xs text-gray-500 mb-2">Comisión por operación</p>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-950/30 border border-emerald-900/40 px-4 py-2.5">
              <p className="text-lg font-bold text-emerald-300">$20</p>
              <p className="text-xs text-gray-600">por cada $1,000</p>
            </div>
            <p className="text-xs text-gray-600 max-w-xs">
              Calculada automáticamente: ⌈monto / 1,000⌉ × $20
            </p>
          </div>
        </div>
      </div>
    </Seccion>
  );
}

// ─── Sección Gastos ───────────────────────────────────────────────────────────

function SeccionGastos({ categorias: initialCats }: { categorias: CategoriaGasto[] }) {
  const [pending, startT] = useTransition();
  const [cats, setCats] = useState(initialCats);
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState<string | null>(null);

  function agregar() {
    if (!nueva.trim()) { setError("Escribe un nombre"); return; }
    setError(null);
    startT(async () => {
      try {
        await createCategoriaGasto(nueva.trim());
        setCats(prev => [...prev, { id: Date.now(), nombre: nueva.trim(), esDefault: false, activa: true }]);
        setNueva("");
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  }

  function eliminar(id: number) {
    startT(async () => {
      try {
        await deleteCategoriaGasto(id);
        setCats(prev => prev.filter(c => c.id !== id));
      } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    });
  }

  const defaults = cats.filter(c => c.esDefault);
  const custom = cats.filter(c => !c.esDefault);

  return (
    <Seccion titulo="Categorías de gastos">
      <div className="p-5 space-y-4">
        {/* Predeterminadas */}
        <div>
          <p className="text-xs text-gray-600 mb-2 uppercase tracking-wider">Predeterminadas</p>
          <div className="flex flex-wrap gap-2">
            {defaults.map(c => (
              <span key={c.id} className="rounded-full bg-gray-800 border border-gray-700 px-3 py-1 text-xs text-gray-400">
                {c.nombre}
              </span>
            ))}
          </div>
        </div>

        {/* Personalizadas */}
        {custom.length > 0 && (
          <div>
            <p className="text-xs text-gray-600 mb-2 uppercase tracking-wider">Personalizadas</p>
            <div className="flex flex-wrap gap-2">
              {custom.map(c => (
                <div key={c.id} className="flex items-center gap-1.5 rounded-full bg-brand-950/40 border border-brand-800/40 pl-3 pr-1.5 py-1">
                  <span className="text-xs text-brand-300">{c.nombre}</span>
                  <button
                    onClick={() => eliminar(c.id)}
                    disabled={pending}
                    className="text-gray-600 hover:text-red-400 transition text-xs leading-none"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agregar nueva */}
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <Input
              value={nueva}
              onChange={setNueva}
              placeholder="Nueva categoría..."
            />
          </div>
          <BtnPrimary onClick={agregar} disabled={pending || !nueva.trim()}>
            Agregar
          </BtnPrimary>
        </div>
        <ErrorMsg msg={error} />
      </div>
    </Seccion>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function ConfiguracionPanel({
  configXbox, consolas, servicios, productos, configFinanciero, categoriasGasto, categoriasProducto,
}: Props) {
  return (
    <div className="space-y-4 pb-6">
      <SeccionXbox configXbox={configXbox} consolas={consolas} />
      <SeccionServicios servicios={servicios} />
      <SeccionProductos productos={productos} categoriasProducto={categoriasProducto} />
      <SeccionFinanciero configFinanciero={configFinanciero} />
      <SeccionGastos categorias={categoriasGasto} />
    </div>
  );
}
