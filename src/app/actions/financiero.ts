"use server";

import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/db";
import {
  calcularComision,
  cajaChicaEfecto,
  efectivoEfecto,
  efectivoNecesarioRetiro,
  tarjetaEfecto,
} from "@/lib/financiero";
import { getMexicoDia } from "@/lib/fecha";
import { revalidatePath } from "next/cache";

async function getEmpleadoId(rol: string) {
  const u = await prisma.usuario.findFirst({
    where: { rol: rol as "DUENO" | "EMPLEADO", activo: true },
  });
  if (!u) throw new Error("Usuario no encontrado");
  return u.id;
}

// ─── Estado del día ───────────────────────────────────────────────────────────

export async function getEstadoFinanciero() {
  const { fechaDate, inicio, fin } = getMexicoDia();

  const [config, apertura, movimientos, cierre, efectivoExtraHoy] = await Promise.all([
    prisma.configFinanciero.findFirst(),
    prisma.aperturaFinanciero.findFirst({ where: { fecha: fechaDate } }),
    prisma.movimientoFinanciero.findMany({
      where: { hora: { gte: inicio, lt: fin } },
      orderBy: { hora: "desc" },
    }),
    prisma.cierreFinanciero.findFirst({ where: { fecha: fechaDate } }),
    prisma.efectivoExtra.findMany({
      where: { fecha: fechaDate },
      orderBy: { hora: "desc" },
    }),
  ]);

  const capital = config ? Number(config.capitalTotal) : null;
  const efectivoEmpleadaInicial = apertura ? Number(apertura.efectivoEmpleada) : null;
  const saldoTarjetaInicial = apertura ? Number(apertura.saldoTarjetaInicial) : null;

  // ingresoDirecto: no afecta el efectivo de la empleada, pero SÍ baja la tarjeta
  // (es un retiro de tarjeta que va directo a la bolsa azul).
  const movimientosNormales = movimientos.filter((m) => !m.ingresoDirecto);
  const deltaEfectivoNormal = movimientosNormales.reduce(
    (a, m) =>
      a + efectivoEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision), Number(m.comisionTransferencia ?? 0)),
    0
  );
  // Tarjeta: incluye todos los movimientos (ingresoDirecto baja la tarjeta igual que un depósito)
  const deltaTarjeta = movimientos.reduce(
    (a, m) =>
      a + tarjetaEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision), Number(m.comisionTransferencia ?? 0)),
    0
  );
  const cajaChicaTotal = movimientosNormales.reduce(
    (a, m) => a + cajaChicaEfecto(m.estado, Number(m.comision)),
    0
  );

  const totalIngresoDirecto = movimientos
    .filter((m) => m.ingresoDirecto && m.estado === "COMPLETADO")
    .reduce((a, m) => a + Number(m.monto), 0);

  const pendientes = movimientos.filter(
    (m) => m.tipo === "RETIRO" && m.estado === "PENDIENTE"
  ).length;

  const totalEfectivoExtra = efectivoExtraHoy.reduce((a, e) => a + Number(e.monto), 0);

  const efectivoEmpleada =
    efectivoEmpleadaInicial !== null
      ? efectivoEmpleadaInicial + deltaEfectivoNormal + totalEfectivoExtra + totalIngresoDirecto
      : null;

  // saldoTarjeta ya refleja la salida por ingresoDirecto; cajaAzul = capital − tarjeta
  const saldoTarjeta =
    saldoTarjetaInicial !== null ? saldoTarjetaInicial + deltaTarjeta : null;

  const cajaAzulTotal =
    capital !== null && saldoTarjeta !== null
      ? capital - saldoTarjeta
      : null;

  const sumaRetiros = movimientos
    .filter((m) => m.tipo === "RETIRO" && m.estado === "COMPLETADO")
    .reduce((a, m) => a + Number(m.monto), 0);
  const sumaDepositos = movimientos
    .filter((m) => m.tipo === "DEPOSITO" && m.estado === "COMPLETADO")
    .reduce((a, m) => a + Number(m.monto), 0);

  return {
    capital,
    efectivoEmpleadaInicial,
    saldoTarjetaInicial,
    efectivoEmpleada,
    saldoTarjeta,
    cajaAzulTotal,
    totalIngresoDirecto,
    cajaChicaTotal, // para Panel del Día; no se muestra en este módulo
    pendientes,
    sumaRetiros,
    sumaDepositos,
    tieneApertura: !!apertura,
    tieneCierre: !!cierre,
    cierre: cierre
      ? {
          sobrante: Number(cierre.sobrante),
          efectivoFinal: Number(cierre.efectivoFinal),
          cajaChicaCalculada: Number(cierre.cajaChicaCalculada),
          cajaChicaReal: Number(cierre.cajaChicaReal),
          diferenciaCajaChica: Number(cierre.diferenciaCajaChica),
          saldoTarjetaEsperado: Number(cierre.saldoTarjetaEsperado),
          saldoTarjetaReal: Number(cierre.saldoTarjetaReal),
          diferencia: Number(cierre.diferencia),
        }
      : null,
    movimientos: movimientos.map((m) => ({
      id: m.id,
      tipo: m.tipo as "RETIRO" | "DEPOSITO",
      estado: m.estado as "PENDIENTE" | "COMPLETADO" | "CANCELADO",
      tipoComision: m.tipoComision as "EFECTIVO" | "TRANSFERENCIA" | "DESCONTADA" | "MIXTA",
      monto: Number(m.monto),
      comision: Number(m.comision),
      comisionTransferencia: m.comisionTransferencia !== null ? Number(m.comisionTransferencia) : null,
      sinComision: m.sinComision,
      ingresoDirecto: m.ingresoDirecto,
      notas: m.notas,
      hora: m.hora.toISOString(),
      confirmadoEn: m.confirmadoEn?.toISOString() ?? null,
    })),
    efectivosExtra: efectivoExtraHoy.map((e) => ({
      id: e.id,
      hora: e.hora.toISOString(),
      monto: Number(e.monto),
      notas: e.notas,
    })),
  };
}

// ─── Apertura del día ─────────────────────────────────────────────────────────

export async function registrarApertura({
  efectivoEmpleada,
  saldoTarjetaInicial,
}: {
  efectivoEmpleada: number;
  saldoTarjetaInicial: number;
}) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const { fechaDate } = getMexicoDia();
  if (await prisma.aperturaFinanciero.findFirst({ where: { fecha: fechaDate } })) {
    throw new Error("Ya se registró la apertura de hoy");
  }

  const config = await prisma.configFinanciero.findFirst();
  if (!config) throw new Error("No está configurado el capital");

  const cajaAzul = Number(config.capitalTotal) - saldoTarjetaInicial;
  if (efectivoEmpleada > cajaAzul) {
    throw new Error(
      `El efectivo (${efectivoEmpleada.toLocaleString("es-MX")}) supera la caja azul (${cajaAzul.toLocaleString("es-MX")})`
    );
  }

  const empleadoId = await getEmpleadoId(session.rol);
  await prisma.aperturaFinanciero.create({
    data: { fecha: fechaDate, efectivoEmpleada, saldoTarjetaInicial, empleadoId },
  });

  revalidatePath("/dashboard/financiero");
}

// ─── Registrar movimiento ─────────────────────────────────────────────────────

export async function registrarMovimiento({
  tipo,
  tipoComision,
  pendiente = false,
  monto,
  notas,
  sinComision = false,
  ingresoDirecto = false,
  comisionTransferencia,
}: {
  tipo: "RETIRO" | "DEPOSITO";
  tipoComision: "EFECTIVO" | "TRANSFERENCIA" | "DESCONTADA" | "MIXTA";
  pendiente?: boolean;
  monto: number;
  notas?: string;
  sinComision?: boolean;
  ingresoDirecto?: boolean;
  comisionTransferencia?: number;
}) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const { fechaDate, inicio, fin } = getMexicoDia();

  const [apertura, cierre] = await Promise.all([
    prisma.aperturaFinanciero.findFirst({ where: { fecha: fechaDate } }),
    prisma.cierreFinanciero.findFirst({ where: { fecha: fechaDate } }),
  ]);

  if (cierre) throw new Error("El día está cerrado. Las operaciones se registrarán el siguiente turno.");
  if (!apertura) throw new Error("Primero registra la apertura del día");

  // ingresoDirecto implica sinComision; ambos resultan en comisión $0
  // PENDIENTE: comisión se define al confirmar la entrega
  const essinComision = sinComision || ingresoDirecto;
  const estado = tipo === "RETIRO" && pendiente ? "PENDIENTE" : "COMPLETADO";
  const comision = essinComision || estado === "PENDIENTE" ? 0 : calcularComision(monto);

  // Verificar efectivo para retiros inmediatos (ingresoDirecto es siempre DEPOSITO, no aplica)
  if (tipo === "RETIRO" && estado === "COMPLETADO") {
    const [movimientosHoy, efectivoExtraHoy] = await Promise.all([
      prisma.movimientoFinanciero.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
      prisma.efectivoExtra.findMany({ where: { fecha: fechaDate } }),
    ]);
    const totalEfectivoExtra = efectivoExtraHoy.reduce((a, e) => a + Number(e.monto), 0);
    const efectivoActual =
      Number(apertura.efectivoEmpleada) +
      totalEfectivoExtra +
      movimientosHoy
        .filter((m) => !m.ingresoDirecto)
        .reduce(
          (a, m) =>
            a + efectivoEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision), Number(m.comisionTransferencia ?? 0)),
          0
        );

    const necesario = efectivoNecesarioRetiro(tipoComision, monto, comision, comisionTransferencia ?? 0);
    if (necesario > efectivoActual) {
      throw new Error(
        `Sin efectivo suficiente. Disponible: $${efectivoActual.toLocaleString("es-MX")}`
      );
    }
  }

  const empleadoId = await getEmpleadoId(session.rol);
  await prisma.movimientoFinanciero.create({
    data: {
      tipo,
      estado,
      tipoComision,
      monto,
      comision,
      comisionTransferencia: tipoComision === "MIXTA" ? (comisionTransferencia ?? 0) : null,
      sinComision: essinComision,
      ingresoDirecto,
      notas: notas?.trim() || null,
      empleadoId,
    },
  });

  revalidatePath("/dashboard/financiero");
}

// ─── Confirmar entrega de retiro pendiente ────────────────────────────────────

export async function confirmarRetiro(
  movimientoId: number,
  tipoComisionEntrega: "EFECTIVO" | "TRANSFERENCIA" = "EFECTIVO"
) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const { fechaDate, inicio, fin } = getMexicoDia();

  const mov = await prisma.movimientoFinanciero.findUnique({ where: { id: movimientoId } });
  if (!mov || mov.tipo !== "RETIRO" || mov.estado !== "PENDIENTE") {
    throw new Error("Solo se pueden confirmar retiros pendientes");
  }

  const apertura = await prisma.aperturaFinanciero.findFirst({ where: { fecha: fechaDate } });
  if (!apertura) throw new Error("Sin apertura del día");

  const comision = mov.sinComision ? 0 : calcularComision(Number(mov.monto));

  const [movimientosRestantes, efectivoExtraHoy] = await Promise.all([
    prisma.movimientoFinanciero.findMany({
      where: { hora: { gte: inicio, lt: fin }, id: { not: movimientoId } },
    }),
    prisma.efectivoExtra.findMany({ where: { fecha: fechaDate } }),
  ]);
  const totalEfectivoExtra = efectivoExtraHoy.reduce((a, e) => a + Number(e.monto), 0);
  const efectivoActual =
    Number(apertura.efectivoEmpleada) +
    totalEfectivoExtra +
    movimientosRestantes
      .filter((m) => !m.ingresoDirecto)
      .reduce(
        (a, m) =>
          a + efectivoEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision), Number(m.comisionTransferencia ?? 0)),
        0
      );

  const necesario = efectivoNecesarioRetiro(tipoComisionEntrega, Number(mov.monto), comision, Number(mov.comisionTransferencia ?? 0));
  if (necesario > efectivoActual) {
    throw new Error(
      `Sin efectivo suficiente para entregar. Disponible: $${efectivoActual.toLocaleString("es-MX")}`
    );
  }

  await prisma.movimientoFinanciero.update({
    where: { id: movimientoId },
    data: {
      estado: "COMPLETADO",
      tipoComision: tipoComisionEntrega,
      comision,
      confirmadoEn: new Date(),
    },
  });

  revalidatePath("/dashboard/financiero");
}

// ─── Cancelar operación ───────────────────────────────────────────────────────

export async function cancelarMovimiento(movimientoId: number) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const { inicio, fin } = getMexicoDia();

  const mov = await prisma.movimientoFinanciero.findUnique({ where: { id: movimientoId } });
  if (!mov) throw new Error("Operación no encontrada");
  if (mov.estado === "CANCELADO") throw new Error("La operación ya está cancelada");

  const esDeHoy = mov.hora >= inicio && mov.hora < fin;
  if (!esDeHoy) throw new Error("Solo se pueden cancelar operaciones del día actual");

  if (mov.tipo === "RETIRO" && mov.estado === "COMPLETADO" && session.rol !== "DUENO") {
    throw new Error("Solo el dueño puede cancelar un retiro ya entregado");
  }

  await prisma.movimientoFinanciero.update({
    where: { id: movimientoId },
    data: { estado: "CANCELADO" },
  });

  revalidatePath("/dashboard/financiero");
}

// ─── Editar operación ─────────────────────────────────────────────────────────

export async function editarMovimiento(
  movimientoId: number,
  { monto, notas, tipoComision }: { monto: number; notas?: string; tipoComision?: "EFECTIVO" | "TRANSFERENCIA" | "DESCONTADA" | "MIXTA" }
) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const { inicio, fin } = getMexicoDia();

  const mov = await prisma.movimientoFinanciero.findUnique({ where: { id: movimientoId } });
  if (!mov) throw new Error("Operación no encontrada");
  if (mov.estado === "CANCELADO") throw new Error("No se puede editar una operación cancelada");

  const esDeHoy = mov.hora >= inicio && mov.hora < fin;
  if (!esDeHoy && session.rol !== "DUENO") {
    throw new Error("Solo se pueden editar operaciones del día actual");
  }

  // No recalcular comisión si el movimiento fue registrado sin comisión
  const nuevaComision = mov.sinComision ? 0 : calcularComision(monto);

  await prisma.movimientoFinanciero.update({
    where: { id: movimientoId },
    data: {
      monto,
      comision: nuevaComision,
      notas: notas?.trim() || null,
      ...(tipoComision && !mov.sinComision ? { tipoComision } : {}),
    },
  });

  revalidatePath("/dashboard/financiero");
}

// ─── Agregar efectivo extra a la empleada ─────────────────────────────────────

export async function agregarEfectivoEmpleada({
  monto,
  notas,
}: {
  monto: number;
  notas?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  if (!Number.isFinite(monto) || monto <= 0)
    throw new Error("El monto debe ser mayor a 0");

  const { fechaDate } = getMexicoDia();
  if (await prisma.cierreFinanciero.findFirst({ where: { fecha: fechaDate } })) {
    throw new Error("El día ya fue cerrado");
  }

  const empleadoId = await getEmpleadoId(session.rol);
  await prisma.efectivoExtra.create({
    data: { fecha: fechaDate, monto, notas: notas?.trim() || null, empleadoId },
  });

  revalidatePath("/dashboard/financiero");
}

// ─── Cierre del día ───────────────────────────────────────────────────────────

export async function cerrarDia({
  sobrante,
  cajaChicaReal,
  saldoTarjetaReal,
}: {
  sobrante: number;
  cajaChicaReal: number;
  saldoTarjetaReal: number;
}) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const { fechaDate, inicio, fin } = getMexicoDia();
  if (await prisma.cierreFinanciero.findFirst({ where: { fecha: fechaDate } })) {
    throw new Error("El día ya fue cerrado");
  }

  const [apertura, movimientos, efectivosExtra, sesionesXbox, serviciosHoy, ventasHoy] = await Promise.all([
    prisma.aperturaFinanciero.findFirst({ where: { fecha: fechaDate } }),
    prisma.movimientoFinanciero.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
    prisma.efectivoExtra.findMany({ where: { fecha: fechaDate } }),
    prisma.sesionXbox.findMany({ where: { inicio: { gte: inicio, lt: fin }, fin: { not: null } } }),
    prisma.servicio.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
    prisma.ventaProducto.findMany({ where: { hora: { gte: inicio, lt: fin } } }),
  ]);

  if (!apertura) throw new Error("No hay apertura registrada hoy");

  const movimientosNormales = movimientos.filter((m) => !m.ingresoDirecto);
  const deltaEfectivo = movimientosNormales.reduce(
    (a, m) => a + efectivoEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision), Number(m.comisionTransferencia ?? 0)),
    0
  );
  // Tarjeta incluye ingresoDirecto (baja tarjeta igual que un depósito normal)
  const deltaTarjeta = movimientos.reduce(
    (a, m) => a + tarjetaEfecto(m.tipo, m.estado, m.tipoComision, Number(m.monto), Number(m.comision), Number(m.comisionTransferencia ?? 0)),
    0
  );
  const totalXbox = sesionesXbox.reduce((a, s) => a + Number(s.total), 0);
  const totalServicios = serviciosHoy.reduce((a, s) => a + Number(s.total), 0);
  const totalProductos = ventasHoy.reduce((a, v) => a + Number(v.total), 0);
  const totalComisiones = movimientosNormales.reduce(
    (a, m) => a + cajaChicaEfecto(m.estado, Number(m.comision)), 0
  );
  const cajaChicaCalculada = totalXbox + totalServicios + totalProductos + totalComisiones;

  const totalEfectivoExtra = efectivosExtra.reduce((a, e) => a + Number(e.monto), 0);
  const totalIngresoDirecto = movimientos
    .filter((m) => m.ingresoDirecto && m.estado === "COMPLETADO")
    .reduce((a, m) => a + Number(m.monto), 0);
  const efectivoFinal = Number(apertura.efectivoEmpleada) + totalEfectivoExtra + totalIngresoDirecto + deltaEfectivo;
  const saldoTarjetaEsperado = Number(apertura.saldoTarjetaInicial) + deltaTarjeta;
  const diferencia = saldoTarjetaReal - saldoTarjetaEsperado;
  const diferenciaCajaChica = cajaChicaReal - cajaChicaCalculada;

  const empleadoId = await getEmpleadoId(session.rol);
  await prisma.cierreFinanciero.create({
    data: {
      fecha: fechaDate,
      sobrante,
      efectivoFinal,
      cajaChicaCalculada,
      cajaChicaReal,
      diferenciaCajaChica,
      saldoTarjetaEsperado,
      saldoTarjetaReal,
      diferencia,
      empleadoId,
    },
  });

  revalidatePath("/dashboard/financiero");
}

// ─── Resetear día (pruebas) ───────────────────────────────────────────────────

export async function resetearDia() {
  const session = await getSession();
  if (session?.rol !== "DUENO") throw new Error("Solo el dueño puede reiniciar el día");

  const { fechaDate, inicio, fin } = getMexicoDia();

  await prisma.cierreFinanciero.deleteMany({ where: { fecha: fechaDate } });
  await prisma.cierreDia.deleteMany({ where: { fecha: fechaDate } });
  await prisma.movimientoFinanciero.deleteMany({ where: { hora: { gte: inicio, lt: fin } } });
  await prisma.aperturaFinanciero.deleteMany({ where: { fecha: fechaDate } });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/financiero");
}

// ─── Actualizar capital ───────────────────────────────────────────────────────

export async function actualizarCapital(capitalTotal: number) {
  const session = await getSession();
  if (session?.rol !== "DUENO") throw new Error("Solo el dueño puede cambiar el capital");

  await prisma.configFinanciero.upsert({
    where: { id: 1 },
    update: { capitalTotal },
    create: { id: 1, capitalTotal },
  });

  revalidatePath("/dashboard/financiero");
}
