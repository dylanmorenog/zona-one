"use server";

import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/db";
import { cajaChicaEfecto } from "@/lib/financiero";

function parseLocal(fechaStr: string) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function horaCorta(date: Date) {
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export async function getDatosExportacion(fechaInicio: string, fechaFin: string) {
  const session = await getSession();
  if (session?.rol !== "DUENO") throw new Error("Solo el dueño puede exportar");

  const inicio = parseLocal(fechaInicio);
  const fin = new Date(parseLocal(fechaFin));
  fin.setDate(fin.getDate() + 1); // fin exclusivo

  const [sesionesXbox, servicios, ventas, movimientos, cierres, cierresFinanciero] =
    await Promise.all([
      prisma.sesionXbox.findMany({
        where: { inicio: { gte: inicio, lt: fin }, fin: { not: null } },
        orderBy: { inicio: "asc" },
      }),
      prisma.servicio.findMany({
        where: { hora: { gte: inicio, lt: fin } },
        include: { tipo: { select: { nombre: true } } },
        orderBy: { hora: "asc" },
      }),
      prisma.ventaProducto.findMany({
        where: { hora: { gte: inicio, lt: fin } },
        include: { producto: { select: { nombre: true } } },
        orderBy: { hora: "asc" },
      }),
      prisma.movimientoFinanciero.findMany({
        where: { hora: { gte: inicio, lt: fin } },
        orderBy: { hora: "asc" },
      }),
      prisma.cierreDia.findMany({
        where: { fecha: { gte: inicio, lt: fin } },
        orderBy: { fecha: "asc" },
      }),
      prisma.cierreFinanciero.findMany({
        where: { fecha: { gte: inicio, lt: fin } },
        orderBy: { fecha: "asc" },
      }),
    ]);

  const totalXbox = sesionesXbox.reduce((a, s) => a + Number(s.total), 0);
  const totalServicios = servicios.reduce((a, s) => a + Number(s.total), 0);
  const totalProductos = ventas.reduce((a, v) => a + Number(v.total), 0);
  const totalComisiones = movimientos.reduce(
    (a, m) => a + cajaChicaEfecto(m.estado, Number(m.comision)),
    0
  );

  // Cierre más reciente para sobrante y tarjeta
  const ultimoCierre = cierres.at(-1);
  const ultimoCierreFinanciero = cierresFinanciero.at(-1);

  return {
    resumen: {
      xbox: totalXbox,
      servicios: totalServicios,
      productos: totalProductos,
      comisiones: totalComisiones,
      cajaChica: totalXbox + totalServicios + totalProductos + totalComisiones,
      sobranteFinanciero: ultimoCierreFinanciero ? Number(ultimoCierreFinanciero.sobrante) : null,
      saldoTarjeta: ultimoCierreFinanciero ? Number(ultimoCierreFinanciero.saldoTarjetaReal) : null,
    },
    xbox: sesionesXbox.map(s => ({
      Hora: horaCorta(s.inicio),
      Monto: Number(s.total),
    })),
    servicios: servicios.map(s => ({
      Hora: horaCorta(s.hora),
      Tipo: s.tipo.nombre,
      Monto: Number(s.total),
    })),
    productos: ventas.map(v => ({
      Hora: horaCorta(v.hora),
      Producto: v.producto.nombre,
      Cantidad: v.cantidad,
      Monto: Number(v.total),
    })),
    financiero: movimientos.map(m => ({
      Hora: horaCorta(m.hora),
      Tipo: m.tipo === "RETIRO" ? "Retiro" : "Depósito",
      Monto: Number(m.monto),
      Comisión: Number(m.comision),
    })),
  };
}

export type DatosExportacion = Awaited<ReturnType<typeof getDatosExportacion>>;
