"use server";

import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireDueno() {
  const session = await getSession();
  if (session?.rol !== "DUENO") throw new Error("Solo el dueño puede modificar la configuración");
  return session;
}

// ─── Xbox ─────────────────────────────────────────────────────────────────────

export async function getConfigXbox() {
  await requireDueno();
  const [config, consolas] = await Promise.all([
    prisma.configuracionXbox.findFirst(),
    prisma.consola.findMany({ orderBy: { numero: "asc" } }),
  ]);
  return {
    config: config
      ? {
          id: config.id,
          precioPorHora: Number(config.precioPorHora),
          precioPorMediaHora: Number(config.precioPorMediaHora),
          precioPorMinuto: Number(config.precioPorMinuto),
          precioControlExtra: Number(config.precioControlExtra),
        }
      : null,
    consolas: consolas.map(c => ({ id: c.id, nombre: c.nombre, numero: c.numero, activa: c.activa })),
  };
}

export async function updateConfigXbox(data: {
  precioPorHora: number;
  precioPorMediaHora: number;
  precioControlExtra: number;
}) {
  await requireDueno();
  const precioPorMinuto = +(data.precioPorMediaHora / 30).toFixed(4);
  const existing = await prisma.configuracionXbox.findFirst();
  if (existing) {
    await prisma.configuracionXbox.update({
      where: { id: existing.id },
      data: { ...data, precioPorMinuto },
    });
  } else {
    await prisma.configuracionXbox.create({ data: { ...data, precioPorMinuto } });
  }
  revalidatePath("/dashboard/xbox");
  revalidatePath("/dashboard/configuracion");
}

export async function toggleConsola(id: number, activa: boolean) {
  await requireDueno();
  await prisma.consola.update({ where: { id }, data: { activa } });
  revalidatePath("/dashboard/xbox");
  revalidatePath("/dashboard/configuracion");
}

export async function addConsola(numero: number) {
  await requireDueno();
  await prisma.consola.create({ data: { nombre: `Xbox ${numero}`, numero, activa: true } });
  revalidatePath("/dashboard/xbox");
  revalidatePath("/dashboard/configuracion");
}

// ─── Servicios ────────────────────────────────────────────────────────────────

export async function getServicios() {
  await requireDueno();
  const rows = await prisma.tipoServicio.findMany({ orderBy: { nombre: "asc" } });
  return rows.map(s => ({
    id: s.id,
    nombre: s.nombre,
    precioBase: Number(s.precioBase),
    porUnidad: s.porUnidad,
    activo: s.activo,
  }));
}

export async function createServicio(data: { nombre: string; precioBase: number; porUnidad: boolean }) {
  await requireDueno();
  await prisma.tipoServicio.create({ data });
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/servicios");
}

export async function updateServicio(id: number, data: { nombre: string; precioBase: number; porUnidad: boolean }) {
  await requireDueno();
  await prisma.tipoServicio.update({ where: { id }, data });
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/servicios");
}

export async function toggleServicio(id: number, activo: boolean) {
  await requireDueno();
  await prisma.tipoServicio.update({ where: { id }, data: { activo } });
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/servicios");
}

// ─── Productos ────────────────────────────────────────────────────────────────

type CategoriaProductoEnum = "DULCES" | "FRITURAS" | "PAPELERIA" | "BEBIDAS" | "OTRO";

export async function getProductos() {
  await requireDueno();
  const rows = await prisma.producto.findMany({
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    include: { _count: { select: { ventas: true } } },
  });
  return rows.map(p => ({
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoria as CategoriaProductoEnum,
    categoriaExtra: p.categoriaExtra ?? null,
    precioVenta: Number(p.precioVenta),
    precioCosto: Number(p.precioCosto),
    stockActual: p.stockActual,
    stockMinimo: p.stockMinimo,
    activo: p.activo,
    tieneVentas: p._count.ventas > 0,
  }));
}

export async function createProducto(data: {
  nombre: string;
  categoria: CategoriaProductoEnum;
  categoriaExtra?: string;
  precioVenta: number;
  precioCosto: number;
  stockMinimo: number;
}) {
  await requireDueno();
  await prisma.producto.create({ data });
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/productos");
}

export async function updateProducto(id: number, data: {
  nombre: string;
  categoria: CategoriaProductoEnum;
  categoriaExtra?: string | null;
  precioVenta: number;
  precioCosto: number;
  stockMinimo: number;
}) {
  await requireDueno();
  await prisma.producto.update({ where: { id }, data });
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/productos");
}

export async function toggleProducto(id: number, activo: boolean) {
  await requireDueno();
  await prisma.producto.update({ where: { id }, data: { activo } });
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/productos");
}

export async function deleteProducto(id: number) {
  await requireDueno();
  const count = await prisma.ventaProducto.count({ where: { productoId: id } });
  if (count > 0) throw new Error("Este producto tiene ventas registradas y no puede eliminarse. Solo puedes desactivarlo.");
  await prisma.producto.delete({ where: { id } });
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/productos");
}

// ─── Categorías de producto (custom) ─────────────────────────────────────────

export async function getCategoriasProducto() {
  await requireDueno();
  const rows = await prisma.categoriaProductoConfig.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
  });
  return rows.map(r => ({ id: r.id, nombre: r.nombre }));
}

export async function createCategoriaProducto(nombre: string) {
  await requireDueno();
  const trimmed = nombre.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío");
  const created = await prisma.categoriaProductoConfig.create({ data: { nombre: trimmed } });
  revalidatePath("/dashboard/configuracion");
  return { id: created.id, nombre: created.nombre };
}

export async function deleteCategoriaProducto(id: number) {
  await requireDueno();
  await prisma.categoriaProductoConfig.update({ where: { id }, data: { activa: false } });
  revalidatePath("/dashboard/configuracion");
}

export async function deleteCategoriaProductoConReasignacion(
  id: number,
  nombreOrigen: string,
  reasignarA: { categoria: CategoriaProductoEnum; categoriaExtra: string | null } | null
) {
  await requireDueno();
  await prisma.producto.updateMany({
    where: { categoria: "OTRO", categoriaExtra: nombreOrigen },
    data: reasignarA
      ? { categoria: reasignarA.categoria, categoriaExtra: reasignarA.categoriaExtra }
      : { categoria: "OTRO", categoriaExtra: null },
  });
  await prisma.categoriaProductoConfig.update({ where: { id }, data: { activa: false } });
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/productos");
}

export async function updateCategoriaProducto(id: number, nombre: string) {
  await requireDueno();
  const trimmed = nombre.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío");
  await prisma.categoriaProductoConfig.update({ where: { id }, data: { nombre: trimmed } });
  revalidatePath("/dashboard/configuracion");
}

// ─── Financiero ───────────────────────────────────────────────────────────────

export async function getConfigFinanciero() {
  await requireDueno();
  const cfg = await prisma.configFinanciero.findFirst();
  return cfg ? { id: cfg.id, capitalTotal: Number(cfg.capitalTotal) } : null;
}

export async function updateConfigFinanciero(capitalTotal: number) {
  await requireDueno();
  const existing = await prisma.configFinanciero.findFirst();
  if (existing) {
    await prisma.configFinanciero.update({ where: { id: existing.id }, data: { capitalTotal } });
  } else {
    await prisma.configFinanciero.create({ data: { id: 1, capitalTotal } });
  }
  revalidatePath("/dashboard/configuracion");
  revalidatePath("/dashboard/financiero");
}

// ─── Categorías de gasto ──────────────────────────────────────────────────────

const CATEGORIAS_DEFAULT = ["Salarios", "Consumibles", "Servicios (luz/internet)", "Mantenimiento", "Mercancía", "Otros"];

export async function getCategoriasGasto() {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");
  const rows = await prisma.categoriaGasto.findMany({ orderBy: [{ esDefault: "desc" }, { nombre: "asc" }] });
  if (rows.length === 0) {
    // Seed inicial
    await prisma.categoriaGasto.createMany({
      data: CATEGORIAS_DEFAULT.map(nombre => ({ nombre, esDefault: true })),
    });
    return CATEGORIAS_DEFAULT.map((nombre, i) => ({ id: i + 1, nombre, esDefault: true, activa: true }));
  }
  return rows.map(r => ({ id: r.id, nombre: r.nombre, esDefault: r.esDefault, activa: r.activa }));
}

export async function createCategoriaGasto(nombre: string) {
  await requireDueno();
  const trimmed = nombre.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío");
  await prisma.categoriaGasto.create({ data: { nombre: trimmed, esDefault: false } });
  revalidatePath("/dashboard/configuracion");
}

export async function deleteCategoriaGasto(id: number) {
  await requireDueno();
  const cat = await prisma.categoriaGasto.findUnique({ where: { id } });
  if (cat?.esDefault) throw new Error("No se pueden eliminar las categorías predeterminadas");
  await prisma.categoriaGasto.delete({ where: { id } });
  revalidatePath("/dashboard/configuracion");
}
