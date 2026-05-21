"use server";

import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/db";
import { cajaChicaEfecto, efectivoEfecto, tarjetaEfecto } from "@/lib/financiero";
import { revalidatePath } from "next/cache";

function hoyDate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function getEmpleadoId(rol: string) {
  const u = await prisma.usuario.findFirst({ where: { rol: rol as "DUENO" | "EMPLEADO", activo: true } });
  if (!u) throw new Error("Usuario no encontrado");
  return u.id;
}

export async function getPanelDia() {
  const hoy = hoyDate();
  const manana = new Date(hoy.getTime() + 86400000);

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
  ] = await Promise.all([
    prisma.sesionXbox.findMany({ where: { inicio: { gte: hoy, lt: manana }, fin: { not: null } } }),
    prisma.consola.findMany({
      where: { activa: true },
      orderBy: { numero: "asc" },
      include: { sesiones: { where: { fin: null }, take: 1 } },
    }),
    prisma.servicio.findMany({ where: { hora: { gte: hoy, lt: manana } } }),
    prisma.ventaProducto.findMany({ where: { hora: { gte: hoy, lt: manana } } }),
    prisma.movimientoFinanciero.findMany({ where: { hora: { gte: hoy, lt: manana } } }),
    prisma.aperturaFinanciero.findFirst({ where: { fecha: hoy } }),
    prisma.cierreFinanciero.findFirst({ where: { fecha: hoy } }),
    prisma.cierreDia.findFirst({ where: { fecha: hoy } }),
    prisma.producto.findMany({ where: { activo: true } }),
    prisma.gasto.findMany({ where: { fecha: { gte: hoy, lt: manana } } }),
    prisma.configFinanciero.findFirst(),
  ]);

  const totalXbox = sesionesXboxHoy.reduce((a, s) => a + Number(s.total), 0);
  const minutosXbox = sesionesXboxHoy.reduce((a, s) => a + (s.duracionMinutos ?? 0), 0);

  const totalServicios = serviciosHoy.reduce((a, s) => a + Number(s.total), 0);
  const totalProductos = ventasHoy.reduce((a, v) => a + Number(v.total), 0);
  const totalComisiones = movimientos.reduce(
    (a, m) => a + cajaChicaEfecto(m.estado, Number(m.comision)), 0
  );
  const totalGastos = gastosHoy.reduce((a, g) => a + Number(g.monto), 0);

  const deltaEfectivo = movimientos.reduce(
    (a, m) => a + efectivoEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision)), 0
  );
  const deltaTarjeta = movimientos.reduce(
    (a, m) => a + tarjetaEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision)), 0
  );

  const efectivoEmpleadaCalculado = aperturaFinanciero
    ? Number(aperturaFinanciero.efectivoEmpleada) + deltaEfectivo
    : null;
  const saldoTarjetaCalculado = aperturaFinanciero
    ? Number(aperturaFinanciero.saldoTarjetaInicial) + deltaTarjeta
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
    cantidadVentas: ventasHoy.length,
    totalComisiones,
    cajaChicaTotal: totalXbox + totalServicios + totalProductos + totalComisiones,
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

  const hoy = hoyDate();
  const manana = new Date(hoy.getTime() + 86400000);

  if (await prisma.cierreDia.findFirst({ where: { fecha: hoy } })) {
    throw new Error("El día ya fue cerrado");
  }

  const [sesionesXbox, serviciosHoy, ventasHoy, movimientos, apertura, cierreFinExistente] =
    await Promise.all([
      prisma.sesionXbox.findMany({ where: { inicio: { gte: hoy, lt: manana }, fin: { not: null } } }),
      prisma.servicio.findMany({ where: { hora: { gte: hoy, lt: manana } } }),
      prisma.ventaProducto.findMany({ where: { hora: { gte: hoy, lt: manana } } }),
      prisma.movimientoFinanciero.findMany({ where: { hora: { gte: hoy, lt: manana } } }),
      prisma.aperturaFinanciero.findFirst({ where: { fecha: hoy } }),
      prisma.cierreFinanciero.findFirst({ where: { fecha: hoy } }),
    ]);

  const totalXbox = sesionesXbox.reduce((a, s) => a + Number(s.total), 0);
  const totalServicios = serviciosHoy.reduce((a, s) => a + Number(s.total), 0);
  const totalProductos = ventasHoy.reduce((a, v) => a + Number(v.total), 0);
  const totalComisiones = movimientos.reduce(
    (a, m) => a + cajaChicaEfecto(m.estado, Number(m.comision)), 0
  );
  const totalGeneral = totalXbox + totalServicios + totalProductos + totalComisiones;
  const efectivoEsperado = totalGeneral;
  const diferencia = cajaChicaReal - efectivoEsperado;

  const empleadoId = await getEmpleadoId(session.rol);

  await prisma.cierreDia.create({
    data: {
      fecha: hoy,
      totalXbox,
      totalServicios,
      totalFinanciero: 0,
      totalProductos,
      totalComisiones,
      totalGeneral,
      efectivoEsperado,
      efectivoReal: cajaChicaReal,
      diferencia,
      empleadoId,
    },
  });

  if (apertura && !cierreFinExistente) {
    const deltaEfectivo = movimientos.reduce(
      (a, m) => a + efectivoEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision)), 0
    );
    const deltaTarjeta = movimientos.reduce(
      (a, m) => a + tarjetaEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision)), 0
    );
    const efectivoFinal = Number(apertura.efectivoEmpleada) + deltaEfectivo;
    const saldoTarjetaEsperado = Number(apertura.saldoTarjetaInicial) + deltaTarjeta;
    const finalSaldoTarjetaReal = saldoTarjetaReal ?? saldoTarjetaEsperado;
    const diferenciaFinanciero = finalSaldoTarjetaReal - saldoTarjetaEsperado;

    await prisma.cierreFinanciero.create({
      data: {
        fecha: hoy,
        sobrante: sobranteFinanciero ?? 0,
        efectivoFinal,
        cajaChicaCalculada: totalComisiones,
        cajaChicaReal,
        diferenciaCajaChica: diferencia,
        saldoTarjetaEsperado,
        saldoTarjetaReal: finalSaldoTarjetaReal,
        diferencia: diferenciaFinanciero,
        empleadoId,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/financiero");
  revalidatePath("/dashboard/xbox");
  revalidatePath("/dashboard/servicios");
  revalidatePath("/dashboard/productos");
}
