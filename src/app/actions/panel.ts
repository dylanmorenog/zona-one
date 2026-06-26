"use server";

import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/db";
import { cajaChicaEfecto, efectivoEfecto, tarjetaEfecto } from "@/lib/financiero";
import { getMexicoDia } from "@/lib/fecha";
import { revalidatePath } from "next/cache";

async function getEmpleadoId(rol: string) {
  const u = await prisma.usuario.findFirst({ where: { rol: rol as "DUENO" | "EMPLEADO", activo: true } });
  if (!u) throw new Error("Usuario no encontrado");
  return u.id;
}

export async function getPanelDia() {
  const { fechaDate, inicio, fin } = getMexicoDia();

  const [
    sesionesXboxHoy,
    consolasActivas,
    serviciosHoy,
    ventasHoy,
    movimientos,
    aperturaFinanciero,
    cierreFinanciero,
    cierreDia,
    todosProductos,
    gastosHoy,
    configFinanciero,
    efectivosExtra,
  ] = await Promise.all([
    prisma.sesionXbox.findMany({ where: { inicio: { gte: inicio, lt: fin }, fin: { not: null } } }),
    prisma.consola.findMany({
      where: { activa: true },
      orderBy: { numero: "asc" },
      include: { sesiones: { where: { fin: null }, take: 1 } },
    }),
    prisma.servicio.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
    prisma.ventaProducto.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
    prisma.movimientoFinanciero.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
    prisma.aperturaFinanciero.findFirst({ where: { fecha: fechaDate } }),
    prisma.cierreFinanciero.findFirst({ where: { fecha: fechaDate } }),
    prisma.cierreDia.findFirst({ where: { fecha: fechaDate } }),
    prisma.producto.findMany({ where: { activo: true } }),
    prisma.gasto.findMany({ where: { fecha: fechaDate } }),
    prisma.configFinanciero.findFirst(),
    prisma.efectivoExtra.findMany({ where: { fecha: fechaDate } }),
  ]);

  const totalXbox = sesionesXboxHoy.reduce((a, s) => a + Number(s.total), 0);
  const minutosXbox = sesionesXboxHoy.reduce((a, s) => a + (s.duracionMinutos ?? 0), 0);

  const totalServicios = serviciosHoy.reduce((a, s) => a + Number(s.total), 0);
  const ventasEfectivo = ventasHoy.filter((v) => v.metodoPago !== "TARJETA");
  const ventasTarjeta = ventasHoy.filter((v) => v.metodoPago === "TARJETA");
  const totalProductosEfectivo = ventasEfectivo.reduce((a, v) => a + Number(v.total), 0);
  const totalProductosTarjeta = ventasTarjeta.reduce((a, v) => a + Number(v.total), 0);
  const totalProductos = totalProductosEfectivo + totalProductosTarjeta;
  const totalComisiones = movimientos.reduce(
    (a, m) => a + cajaChicaEfecto(m.estado, Number(m.comision)), 0
  );
  const totalGastos = gastosHoy.reduce((a, g) => a + Number(g.monto), 0);

  const movimientosNormales = movimientos.filter((m) => !m.ingresoDirecto);
  const deltaEfectivo = movimientosNormales.reduce(
    (a, m) => a + efectivoEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision), Number(m.comisionTransferencia ?? 0)), 0
  );
  // Tarjeta incluye ingresoDirecto (baja tarjeta igual que un depósito normal)
  const deltaTarjeta = movimientos.reduce(
    (a, m) => a + tarjetaEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision), Number(m.comisionTransferencia ?? 0)), 0
  );

  const totalEfectivoExtra = efectivosExtra.reduce((a, e) => a + Number(e.monto), 0);
  const efectivoEmpleadaCalculado = aperturaFinanciero
    ? Number(aperturaFinanciero.efectivoEmpleada) + totalEfectivoExtra + deltaEfectivo
    : null;
  // pagos de producto con tarjeta suman directo a la tarjeta, sin comisión
  const saldoTarjetaCalculado = aperturaFinanciero
    ? Number(aperturaFinanciero.saldoTarjetaInicial) + deltaTarjeta + totalProductosTarjeta
    : null;

  const pendientesRetiro = movimientos.filter(
    m => m.tipo === "RETIRO" && m.estado === "PENDIENTE"
  ).length;

  const productosStockBajo = todosProductos.filter(p => p.stockActual <= p.stockMinimo);
  const capitalDesajustado = !!cierreFinanciero && Math.abs(Number(cierreFinanciero.diferencia)) > 0.01;

  return {
    totalXbox,
    sesionesCount: sesionesXboxHoy.length,
    minutosXbox,
    totalServicios,
    cantidadServicios: serviciosHoy.length,
    totalProductos,
    totalProductosEfectivo,
    totalProductosTarjeta,
    cantidadVentas: ventasHoy.length,
    totalComisiones,
    // caja chica física: solo cuenta lo pagado en efectivo
    cajaChicaTotal: totalXbox + totalServicios + totalProductosEfectivo + totalComisiones,
    totalGastos,
    gananciaNeta: totalXbox + totalServicios + totalProductos + totalComisiones - totalGastos,
    pendientesRetiro,

    consolas: consolasActivas.map(c => ({
      id: c.id,
      nombre: c.nombre,
      numero: c.numero,
      sesionActiva: c.sesiones[0]
        ? {
            id: c.sesiones[0].id,
            inicio: c.sesiones[0].inicio.toISOString(),
            tiempoDefinidoMinutos: c.sesiones[0].tiempoDefinidoMinutos,
            pausadoEn: c.sesiones[0].pausadoEn?.toISOString() ?? null,
          }
        : null,
    })),

    capitalFinanciero: configFinanciero ? Number(configFinanciero.capitalTotal) : null,
    tieneAperturaFinanciero: !!aperturaFinanciero,
    tieneCierreFinanciero: !!cierreFinanciero,
    efectivoEmpleadaCalculado,
    saldoTarjetaCalculado,

    productosStockBajo: productosStockBajo.map(p => ({
      id: p.id,
      nombre: p.nombre,
      stockActual: p.stockActual,
      stockMinimo: p.stockMinimo,
    })),
    capitalDesajustado,

    tieneCierreDia: !!cierreDia,
    cierre: cierreDia
      ? {
          totalXbox: Number(cierreDia.totalXbox),
          totalServicios: Number(cierreDia.totalServicios),
          totalProductos: Number(cierreDia.totalProductos),
          totalProductosTarjeta: Number(cierreDia.totalProductosTarjeta),
          totalComisiones: Number(cierreDia.totalComisiones),
          totalGeneral: Number(cierreDia.totalGeneral),
          efectivoEsperado: Number(cierreDia.efectivoEsperado),
          efectivoReal: Number(cierreDia.efectivoReal),
          diferencia: Number(cierreDia.diferencia),
          // sobrante financiero (null si no hubo apertura ese día)
          sobranteEntregado: cierreFinanciero ? Number(cierreFinanciero.sobrante) : null,
          sobranteCalculado: cierreFinanciero ? Number(cierreFinanciero.efectivoFinal) : null,
          // tarjeta
          saldoTarjetaReportado: cierreFinanciero ? Number(cierreFinanciero.saldoTarjetaReal) : null,
          saldoTarjetaEsperado: cierreFinanciero ? Number(cierreFinanciero.saldoTarjetaEsperado) : null,
        }
      : null,
  };
}

export async function cerrarDiaCompleto({
  cajaChicaReal,
  sobranteFinanciero,
  saldoTarjetaReal,
}: {
  cajaChicaReal: number;
  sobranteFinanciero?: number;
  saldoTarjetaReal?: number;
}) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  if (!Number.isFinite(cajaChicaReal) || cajaChicaReal < 0)
    throw new Error("El efectivo en caja chica debe ser un número válido mayor o igual a 0");
  if (sobranteFinanciero !== undefined && (!Number.isFinite(sobranteFinanciero) || sobranteFinanciero < 0))
    throw new Error("El sobrante financiero debe ser un número válido mayor o igual a 0");
  if (saldoTarjetaReal !== undefined && (!Number.isFinite(saldoTarjetaReal) || saldoTarjetaReal < 0))
    throw new Error("El saldo de tarjeta debe ser un número válido mayor o igual a 0");

  const { fechaDate, inicio, fin } = getMexicoDia();

  if (await prisma.cierreDia.findFirst({ where: { fecha: fechaDate } })) {
    throw new Error("El día ya fue cerrado");
  }

  const [sesionesXbox, serviciosHoy, ventasHoy, movimientos, apertura, cierreFinExistente, efectivosExtraHoy] =
    await Promise.all([
      prisma.sesionXbox.findMany({ where: { inicio: { gte: inicio, lt: fin }, fin: { not: null } } }),
      prisma.servicio.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
      prisma.ventaProducto.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
      prisma.movimientoFinanciero.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
      prisma.aperturaFinanciero.findFirst({ where: { fecha: fechaDate } }),
      prisma.cierreFinanciero.findFirst({ where: { fecha: fechaDate } }),
      prisma.efectivoExtra.findMany({ where: { fecha: fechaDate } }),
    ]);

  const totalXbox = sesionesXbox.reduce((a, s) => a + Number(s.total), 0);
  const totalServicios = serviciosHoy.reduce((a, s) => a + Number(s.total), 0);
  const ventasEfectivo = ventasHoy.filter((v) => v.metodoPago !== "TARJETA");
  const ventasTarjeta = ventasHoy.filter((v) => v.metodoPago === "TARJETA");
  const totalProductos = ventasEfectivo.reduce((a, v) => a + Number(v.total), 0);
  const totalProductosTarjeta = ventasTarjeta.reduce((a, v) => a + Number(v.total), 0);

  // Filtrar ingresoDirecto para no afectar caja chica ni tarjeta
  const movimientosNormales = movimientos.filter((m) => !m.ingresoDirecto);
  const totalComisiones = movimientosNormales.reduce(
    (a, m) => a + cajaChicaEfecto(m.estado, Number(m.comision)), 0
  );
  // totalGeneral/efectivoEsperado: caja chica física, solo ventas en efectivo
  const totalGeneral = totalXbox + totalServicios + totalProductos + totalComisiones;
  const efectivoEsperado = totalGeneral;
  const diferencia = cajaChicaReal - efectivoEsperado;

  const empleadoId = await getEmpleadoId(session.rol);

  await prisma.cierreDia.create({
    data: {
      fecha: fechaDate,
      totalXbox,
      totalServicios,
      totalFinanciero: 0,
      totalProductos,
      totalProductosTarjeta,
      totalComisiones,
      totalGeneral,
      efectivoEsperado,
      efectivoReal: cajaChicaReal,
      diferencia,
      empleadoId,
    },
  });

  if (apertura && !cierreFinExistente) {
    const deltaEfectivo = movimientosNormales.reduce(
      (a, m) => a + efectivoEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision), Number(m.comisionTransferencia ?? 0)), 0
    );
    // Tarjeta incluye ingresoDirecto (baja tarjeta igual que un depósito normal)
    const deltaTarjeta = movimientos.reduce(
      (a, m) => a + tarjetaEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision), Number(m.comisionTransferencia ?? 0)), 0
    );
    const totalEfectivoExtraCierre = efectivosExtraHoy.reduce((a, e) => a + Number(e.monto), 0);
    const efectivoFinal = Number(apertura.efectivoEmpleada) + totalEfectivoExtraCierre + deltaEfectivo;
    // pagos de producto con tarjeta suman directo a la tarjeta, sin comisión
    const saldoTarjetaEsperado = Number(apertura.saldoTarjetaInicial) + deltaTarjeta + totalProductosTarjeta;
    const finalSaldoTarjetaReal = saldoTarjetaReal ?? saldoTarjetaEsperado;
    const diferenciaFinanciero = finalSaldoTarjetaReal - saldoTarjetaEsperado;
    const cajaChicaCalculada = totalXbox + totalServicios + totalProductos + totalComisiones;
    const diferenciaCajaChica = cajaChicaReal - cajaChicaCalculada;

    await prisma.cierreFinanciero.create({
      data: {
        fecha: fechaDate,
        sobrante: sobranteFinanciero ?? 0,
        efectivoFinal,
        cajaChicaCalculada,
        cajaChicaReal,
        diferenciaCajaChica,
        saldoTarjetaEsperado,
        saldoTarjetaReal: finalSaldoTarjetaReal,
        diferencia: diferenciaFinanciero,
        empleadoId,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/historial");
  revalidatePath("/dashboard/financiero");
  revalidatePath("/dashboard/xbox");
  revalidatePath("/dashboard/servicios");
  revalidatePath("/dashboard/productos");
}
