"use server";

import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/db";
import { cajaChicaEfecto } from "@/lib/financiero";
import { getMexicoDia, getMexicoRango } from "@/lib/fecha";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");
  return session;
}

async function requireDueno() {
  const session = await getSession();
  if (!session || session.rol !== "DUENO") throw new Error("No autorizado");
  return session;
}

async function getUsuarioId(rol: string) {
  const u = await prisma.usuario.findFirst({ where: { rol: rol as "DUENO" | "EMPLEADO", activo: true } });
  if (!u) throw new Error("Usuario no encontrado");
  return u.id;
}

function fechaHoyStr(): string {
  return getMexicoDia().mexStr;
}

function parseFecha(fechaStr: string) {
  return getMexicoRango(fechaStr);
}

export async function getGastosDelDia(fechaStr?: string) {
  const session = await requireAuth();
  const fecha = session.rol === "EMPLEADO" ? fechaHoyStr() : (fechaStr ?? fechaHoyStr());
  const { fechaDate } = parseFecha(fecha);

  const gastos = await prisma.gasto.findMany({
    where: { fecha: fechaDate },
    include: { categoria: { select: { nombre: true } } },
    orderBy: { creadoEn: "asc" },
  });

  return gastos.map(g => ({
    id: g.id,
    categoriaId: g.categoriaId,
    categoriaNombre: g.categoria?.nombre ?? null,
    descripcion: g.descripcion,
    monto: Number(g.monto),
    fecha: g.fecha.toISOString().split("T")[0],
  }));
}

export async function getResumenGastosDia(fechaStr?: string) {
  const session = await requireAuth();
  const fecha = session.rol === "EMPLEADO" ? fechaHoyStr() : (fechaStr ?? fechaHoyStr());
  const { fechaDate, inicio, fin } = parseFecha(fecha);

  const [sesionesXbox, servicios, ventas, movimientos, gastos] = await Promise.all([
    prisma.sesionXbox.findMany({ where: { inicio: { gte: inicio, lt: fin }, fin: { not: null } } }),
    prisma.servicio.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
    prisma.ventaProducto.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
    prisma.movimientoFinanciero.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
    prisma.gasto.findMany({ where: { fecha: fechaDate } }),
  ]);

  const totalXbox = sesionesXbox.reduce((a, s) => a + Number(s.total), 0);
  const totalServicios = servicios.reduce((a, s) => a + Number(s.total), 0);
  const totalProductos = ventas.reduce((a, v) => a + Number(v.total), 0);
  const totalComisiones = movimientos.reduce(
    (a, m) => a + cajaChicaEfecto(m.estado, Number(m.comision)), 0
  );
  const totalIngresos = totalXbox + totalServicios + totalProductos + totalComisiones;
  const totalGastos = gastos.reduce((a, g) => a + Number(g.monto), 0);

  return {
    totalIngresos,
    totalGastos,
    gananciaNeta: totalIngresos - totalGastos,
  };
}

export async function createGasto(data: {
  categoriaId: number | null;
  descripcion: string;
  monto: number;
  fecha: string;
}) {
  const session = await requireAuth();
  if (!data.descripcion.trim()) throw new Error("La descripción es obligatoria");
  if (data.monto <= 0) throw new Error("El monto debe ser mayor a cero");

  if (session.rol === "EMPLEADO" && data.fecha !== fechaHoyStr()) {
    throw new Error("Los empleados solo pueden registrar gastos del día actual");
  }

  const empleadoId = await getUsuarioId(session.rol);
  const [y, m, d] = data.fecha.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));

  const gasto = await prisma.gasto.create({
    data: {
      categoriaId: data.categoriaId,
      descripcion: data.descripcion.trim(),
      monto: data.monto,
      fecha,
      empleadoId,
    },
    include: { categoria: { select: { nombre: true } } },
  });

  revalidatePath("/dashboard/gastos");
  revalidatePath("/dashboard/historial");

  return {
    id: gasto.id,
    categoriaId: gasto.categoriaId,
    categoriaNombre: gasto.categoria?.nombre ?? null,
    descripcion: gasto.descripcion,
    monto: Number(gasto.monto),
    fecha: gasto.fecha.toISOString().split("T")[0],
  };
}

export async function updateGasto(
  id: number,
  data: {
    categoriaId: number | null;
    descripcion: string;
    monto: number;
    fecha: string;
  }
) {
  await requireDueno();
  if (!data.descripcion.trim()) throw new Error("La descripción es obligatoria");
  if (data.monto <= 0) throw new Error("El monto debe ser mayor a cero");

  const [y, m, d] = data.fecha.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));

  await prisma.gasto.update({
    where: { id },
    data: {
      categoriaId: data.categoriaId,
      descripcion: data.descripcion.trim(),
      monto: data.monto,
      fecha,
    },
  });

  revalidatePath("/dashboard/gastos");
  revalidatePath("/dashboard/historial");
}

export async function deleteGasto(id: number) {
  const session = await requireAuth();

  if (session.rol === "EMPLEADO") {
    const gasto = await prisma.gasto.findUnique({ where: { id } });
    if (!gasto) throw new Error("Gasto no encontrado");
    const hoy = fechaHoyStr();
    const fechaGasto = gasto.fecha.toISOString().split("T")[0];
    if (fechaGasto !== hoy) {
      throw new Error("Los empleados solo pueden eliminar gastos del día actual");
    }
  }

  await prisma.gasto.delete({ where: { id } });
  revalidatePath("/dashboard/gastos");
  revalidatePath("/dashboard/historial");
}
