"use server";

import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

function inicioFinDia() {
  const hoy = new Date();
  return {
    inicio: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()),
    fin: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1),
  };
}

export async function getDatosProductos() {
  const { inicio, fin } = inicioFinDia();

  const [productos, ventasHoy] = await Promise.all([
    prisma.producto.findMany({ orderBy: [{ categoria: "asc" }, { nombre: "asc" }] }),
    prisma.ventaProducto.findMany({
      where: { hora: { gte: inicio, lt: fin } },
      include: { producto: { select: { nombre: true } } },
      orderBy: { hora: "desc" },
    }),
  ]);

  const totalHoy = ventasHoy.reduce((acc, v) => acc + Number(v.total), 0);

  return {
    productos: productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria as string,
      precioVenta: Number(p.precioVenta),
      precioCosto: Number(p.precioCosto),
      stockActual: p.stockActual,
      stockMinimo: p.stockMinimo,
      activo: p.activo,
    })),
    ventasHoy: ventasHoy.map((v) => ({
      id: v.id,
      hora: v.hora.toISOString(),
      productoNombre: v.producto.nombre,
      cantidad: v.cantidad,
      total: Number(v.total),
      metodoPago: v.metodoPago as "EFECTIVO" | "TARJETA",
    })),
    totalHoy,
  };
}

async function getEmpleadoId(rol: string) {
  const u = await prisma.usuario.findFirst({ where: { rol: rol as "DUENO" | "EMPLEADO", activo: true } });
  if (!u) throw new Error("Usuario no encontrado");
  return u.id;
}

export async function registrarVentaProducto({
  productoId,
  cantidad,
  metodoPago,
}: {
  productoId: number;
  cantidad: number;
  metodoPago: "EFECTIVO" | "TARJETA";
}) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  if (!Number.isInteger(cantidad) || cantidad <= 0)
    throw new Error("La cantidad debe ser un número entero mayor a 0");

  const hoy = new Date();
  const hoyInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (await prisma.cierreDia.findFirst({ where: { fecha: hoyInicio } })) {
    throw new Error("El día ya fue cerrado. Las operaciones reanudan mañana.");
  }

  const empleadoId = await getEmpleadoId(session.rol);

  await prisma.$transaction(async (tx) => {
    const producto = await tx.producto.findUnique({ where: { id: productoId } });
    if (!producto || !producto.activo) throw new Error("Producto no disponible");
    if (producto.stockActual < cantidad)
      throw new Error(`Stock insuficiente. Disponible: ${producto.stockActual}`);

    await tx.ventaProducto.create({
      data: {
        productoId,
        cantidad,
        precioUnitario: producto.precioVenta,
        total: Number(producto.precioVenta) * cantidad,
        metodoPago,
        empleadoId,
      },
    });

    await tx.producto.update({
      where: { id: productoId },
      data: { stockActual: { decrement: cantidad } },
    });
  });

  revalidatePath("/dashboard/productos");
}

export async function registrarEntradaMercancia({
  productoId,
  cantidad,
}: {
  productoId: number;
  cantidad: number;
}) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  await prisma.producto.update({
    where: { id: productoId },
    data: { stockActual: { increment: cantidad } },
  });

  revalidatePath("/dashboard/productos");
}

export async function guardarProducto(
  id: number | null,
  data: {
    nombre: string;
    categoria: string;
    precioVenta: number;
    precioCosto: number;
    stockMinimo: number;
    stockInicial?: number;
  }
) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  if (id) {
    if (session.rol === "DUENO") {
      await prisma.producto.update({
        where: { id },
        data: {
          nombre: data.nombre,
          categoria: data.categoria as "DULCES" | "FRITURAS" | "PAPELERIA" | "BEBIDAS" | "OTRO",
          precioVenta: data.precioVenta,
          precioCosto: data.precioCosto,
          stockMinimo: data.stockMinimo,
        },
      });
    } else {
      await prisma.producto.update({
        where: { id },
        data: {
          nombre: data.nombre,
          precioVenta: data.precioVenta,
          stockMinimo: data.stockMinimo,
        },
      });
    }
  } else {
    if (session.rol !== "DUENO") throw new Error("Solo el dueño puede crear productos");
    await prisma.producto.create({
      data: {
        nombre: data.nombre,
        categoria: data.categoria as "DULCES" | "FRITURAS" | "PAPELERIA" | "BEBIDAS" | "OTRO",
        precioVenta: data.precioVenta,
        precioCosto: data.precioCosto,
        stockMinimo: data.stockMinimo,
        stockActual: data.stockInicial ?? 0,
      },
    });
  }

  revalidatePath("/dashboard/productos");
}

export async function eliminarProducto(id: number) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const count = await prisma.ventaProducto.count({ where: { productoId: id } });
  if (count > 0) throw new Error("Este producto tiene ventas registradas. Solo puedes desactivarlo.");

  await prisma.producto.delete({ where: { id } });
  revalidatePath("/dashboard/productos");
}

export async function toggleActivoProducto(id: number) {
  const session = await getSession();
  if (session?.rol !== "DUENO") throw new Error("No autorizado");

  const p = await prisma.producto.findUnique({ where: { id } });
  if (!p) throw new Error("Producto no encontrado");

  await prisma.producto.update({ where: { id }, data: { activo: !p.activo } });
  revalidatePath("/dashboard/productos");
}
