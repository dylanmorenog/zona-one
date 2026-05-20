"use server";

import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

function inicioFinDia() {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  return { inicio, fin };
}

export async function getDatosServicios() {
  const { inicio, fin } = inicioFinDia();

  const [tipos, serviciosHoy] = await Promise.all([
    prisma.tipoServicio.findMany({
      where: { activo: true },
      orderBy: { id: "asc" },
    }),
    prisma.servicio.findMany({
      where: { hora: { gte: inicio, lt: fin } },
      include: { tipo: { select: { nombre: true } } },
      orderBy: { hora: "desc" },
    }),
  ]);

  const totalHoy = serviciosHoy.reduce((acc, s) => acc + Number(s.total), 0);

  return {
    tipos: tipos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      precioBase: Number(t.precioBase),
      porUnidad: t.porUnidad,
    })),
    serviciosHoy: serviciosHoy.map((s) => ({
      id: s.id,
      hora: s.hora.toISOString(),
      tipoNombre: s.tipo.nombre,
      cantidad: s.cantidad,
      precioUnitario: Number(s.precioUnitario),
      total: Number(s.total),
      metodoPago: s.metodoPago as "EFECTIVO" | "TARJETA",
      notas: s.notas,
    })),
    totalHoy,
  };
}

export async function registrarServicio({
  tipoId,
  cantidad,
  precioUnitario,
  notas,
  metodoPago,
}: {
  tipoId: number;
  cantidad: number;
  precioUnitario: number;
  notas?: string;
  metodoPago: "EFECTIVO" | "TARJETA";
}) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  if (!Number.isInteger(cantidad) || cantidad <= 0)
    throw new Error("La cantidad debe ser un número entero mayor a 0");
  if (!Number.isFinite(precioUnitario) || precioUnitario <= 0)
    throw new Error("El precio debe ser mayor a 0");

  const hoy = new Date();
  const hoyInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (await prisma.cierreDia.findFirst({ where: { fecha: hoyInicio } })) {
    throw new Error("El día ya fue cerrado. Las operaciones reanudan mañana.");
  }

  const empleado = await prisma.usuario.findFirst({
    where: { rol: session.rol, activo: true },
  });
  if (!empleado) throw new Error("Empleado no encontrado");

  await prisma.servicio.create({
    data: {
      tipoId,
      cantidad,
      precioUnitario,
      total: cantidad * precioUnitario,
      metodoPago,
      notas: notas || null,
      empleadoId: empleado.id,
    },
  });

  revalidatePath("/dashboard/servicios");
}
