"use server";

import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/db";
import { cajaChicaEfecto } from "@/lib/financiero";

function rangoFecha(fechaStr: string) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  return {
    inicio: new Date(y, m - 1, d),
    fin: new Date(y, m - 1, d + 1),
    fecha: new Date(y, m - 1, d),
  };
}

// ─── Resumen de un día específico ────────────────────────────────────────────

export async function getDiaSummary(fechaStr: string) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const { inicio, fin, fecha } = rangoFecha(fechaStr);

  const [sesionesXbox, servicios, ventas, movimientos, gastosDelDia, cierreDia, cierreFinanciero] =
    await Promise.all([
      prisma.sesionXbox.findMany({
        where: { inicio: { gte: inicio, lt: fin }, fin: { not: null } },
      }),
      prisma.servicio.findMany({
        where: { hora: { gte: inicio, lt: fin } },
        include: { tipo: { select: { nombre: true } } },
      }),
      prisma.ventaProducto.findMany({
        where: { hora: { gte: inicio, lt: fin } },
        include: { producto: { select: { nombre: true } } },
      }),
      prisma.movimientoFinanciero.findMany({
        where: { hora: { gte: inicio, lt: fin } },
      }),
      prisma.gasto.findMany({
        where: { fecha: { gte: inicio, lt: fin } },
        include: { categoria: { select: { nombre: true } } },
        orderBy: { creadoEn: "asc" },
      }),
      prisma.cierreDia.findFirst({ where: { fecha } }),
      prisma.cierreFinanciero.findFirst({ where: { fecha } }),
    ]);

  const totalXbox = sesionesXbox.reduce((a, s) => a + Number(s.total), 0);

  const serviciosPorTipo: Record<string, { cantidad: number; total: number }> = {};
  for (const s of servicios) {
    const n = s.tipo.nombre;
    if (!serviciosPorTipo[n]) serviciosPorTipo[n] = { cantidad: 0, total: 0 };
    serviciosPorTipo[n].cantidad += s.cantidad;
    serviciosPorTipo[n].total += Number(s.total);
  }
  const totalServicios = servicios.reduce((a, s) => a + Number(s.total), 0);
  const totalProductos = ventas.reduce((a, v) => a + Number(v.total), 0);
  const totalComisiones = movimientos.reduce(
    (a, m) => a + cajaChicaEfecto(m.estado, Number(m.comision)), 0
  );
  const totalGastos = gastosDelDia.reduce((a, g) => a + Number(g.monto), 0);

  return {
    fecha: fechaStr,
    tieneDatos:
      sesionesXbox.length > 0 ||
      servicios.length > 0 ||
      ventas.length > 0 ||
      movimientos.length > 0 ||
      gastosDelDia.length > 0,
    tieneCierre: !!cierreDia,

    xbox: {
      sesiones: sesionesXbox.length,
      total: totalXbox,
      detalle: sesionesXbox.map(s => ({
        id: s.id,
        inicio: s.inicio.toISOString(),
        duracionMinutos: s.duracionMinutos ?? null,
        controlesExtra: s.controlesExtra,
        montoControles: Number(s.montoControles),
        montoTiempo: Number(s.montoTiempo),
        total: Number(s.total),
      })),
    },
    servicios: {
      porTipo: Object.entries(serviciosPorTipo).map(([nombre, v]) => ({ nombre, ...v })),
      total: totalServicios,
      detalle: servicios.map(s => ({
        id: s.id,
        nombre: s.tipo.nombre,
        hora: s.hora.toISOString(),
        cantidad: s.cantidad,
        total: Number(s.total),
      })),
    },
    productos: {
      ventas: ventas.length,
      total: totalProductos,
      detalle: ventas.map(v => ({
        id: v.id,
        nombre: v.producto.nombre,
        hora: v.hora.toISOString(),
        cantidad: v.cantidad,
        total: Number(v.total),
      })),
    },
    comisiones: totalComisiones,
    financieroDetalle: movimientos.map(m => ({
      id: m.id,
      hora: m.hora.toISOString(),
      tipo: m.tipo,
      monto: Number(m.monto),
      comision: Number(m.comision),
      estado: m.estado,
    })),
    cajaChicaTotal: totalXbox + totalServicios + totalProductos + totalComisiones,

    gastos: {
      total: totalGastos,
      detalle: gastosDelDia.map(g => ({
        id: g.id,
        descripcion: g.descripcion,
        categoriaNombre: g.categoria?.nombre ?? null,
        monto: Number(g.monto),
      })),
    },
    gananciaNeta: totalXbox + totalServicios + totalProductos + totalComisiones - totalGastos,

    cierre: cierreDia
      ? {
          efectivoEsperado: Number(cierreDia.efectivoEsperado),
          efectivoReal: Number(cierreDia.efectivoReal),
          diferencia: Number(cierreDia.diferencia),
        }
      : null,

    cierreFinanciero: cierreFinanciero
      ? {
          sobranteEntregado: Number(cierreFinanciero.sobrante),
          sobranteCalculado: Number(cierreFinanciero.efectivoFinal),
          diferenciaSobrante: Number(cierreFinanciero.sobrante) - Number(cierreFinanciero.efectivoFinal),
          saldoTarjetaReportado: Number(cierreFinanciero.saldoTarjetaReal),
          saldoTarjetaEsperado: Number(cierreFinanciero.saldoTarjetaEsperado),
          diferenciaTarjeta: Number(cierreFinanciero.diferencia),
        }
      : null,
  };
}

export type DiaSummary = Awaited<ReturnType<typeof getDiaSummary>>;

// ─── Lista paginada de días ───────────────────────────────────────────────────

const PAGE_SIZE = 20;

export async function getListaDias(page: number = 1) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const total = await prisma.cierreDia.count();
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginaActual = Math.max(1, Math.min(page, totalPaginas));

  const dias = await prisma.cierreDia.findMany({
    orderBy: { fecha: "desc" },
    skip: (paginaActual - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      fecha: true,
      totalGeneral: true,
      totalXbox: true,
      totalServicios: true,
      totalProductos: true,
      totalComisiones: true,
      efectivoReal: true,
      diferencia: true,
    },
  });

  return {
    dias: dias.map((d) => ({
      fecha: d.fecha.toISOString().split("T")[0],
      totalGeneral: Number(d.totalGeneral),
      totalXbox: Number(d.totalXbox),
      totalServicios: Number(d.totalServicios),
      totalProductos: Number(d.totalProductos),
      totalComisiones: Number(d.totalComisiones),
      efectivoReal: Number(d.efectivoReal),
      diferencia: Number(d.diferencia),
    })),
    paginaActual,
    totalPaginas,
    total,
  };
}

export type ListaDiasResult = Awaited<ReturnType<typeof getListaDias>>;

// ─── Comparativo semanal (DUEÑO) ─────────────────────────────────────────────

export async function getComparativoSemanal() {
  const session = await getSession();
  if (session?.rol !== "DUENO") throw new Error("Solo el dueño");

  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6);

  const cierres = await prisma.cierreDia.findMany({
    where: { fecha: { gte: inicio } },
    orderBy: { fecha: "asc" },
  });

  return cierres.map(c => ({
    fecha: c.fecha.toISOString().split("T")[0],
    totalXbox: Number(c.totalXbox),
    totalServicios: Number(c.totalServicios),
    totalProductos: Number(c.totalProductos),
    totalComisiones: Number(c.totalComisiones),
    cajaChicaTotal: Number(c.totalGeneral),
  }));
}

export type ComparativoRow = Awaited<ReturnType<typeof getComparativoSemanal>>[number];

// ─── Reporte mensual (DUEÑO) ──────────────────────────────────────────────────

export async function getReporteMensual() {
  const session = await getSession();
  if (session?.rol !== "DUENO") throw new Error("Solo el dueño");

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);

  const cierres = await prisma.cierreDia.findMany({
    where: { fecha: { gte: inicioMes, lt: finMes } },
    orderBy: { fecha: "asc" },
  });

  const totales = {
    xbox: cierres.reduce((a, c) => a + Number(c.totalXbox), 0),
    servicios: cierres.reduce((a, c) => a + Number(c.totalServicios), 0),
    productos: cierres.reduce((a, c) => a + Number(c.totalProductos), 0),
    comisiones: cierres.reduce((a, c) => a + Number(c.totalComisiones), 0),
  };

  return {
    mes: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`,
    totales,
    dias: cierres.map(c => ({
      fecha: c.fecha.toISOString().split("T")[0],
      totalXbox: Number(c.totalXbox),
      totalServicios: Number(c.totalServicios),
      totalProductos: Number(c.totalProductos),
      totalComisiones: Number(c.totalComisiones),
      cajaChicaTotal: Number(c.totalGeneral),
    })),
  };
}

export type ReporteMensual = Awaited<ReturnType<typeof getReporteMensual>>;
