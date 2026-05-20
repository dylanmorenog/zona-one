"use server";

import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/db";
import { calcularMontoXbox } from "@/lib/xbox";
import { revalidatePath } from "next/cache";

export async function getConsolasConSesiones() {
  const [consolas, config] = await Promise.all([
    prisma.consola.findMany({
      where: { activa: true },
      orderBy: { numero: "asc" },
      include: {
        sesiones: {
          where: { fin: null },
          take: 1,
        },
      },
    }),
    prisma.configuracionXbox.findFirst(),
  ]);

  return {
    consolas: consolas.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      numero: c.numero,
      sesionActiva: c.sesiones[0]
        ? {
            id: c.sesiones[0].id,
            inicio: c.sesiones[0].inicio.toISOString(),
            tiempoDefinidoMinutos: c.sesiones[0].tiempoDefinidoMinutos,
            controlesExtra: c.sesiones[0].controlesExtra,
            pausadoEn: c.sesiones[0].pausadoEn?.toISOString() ?? null,
          }
        : null,
    })),
    config: config
      ? {
          precioPorHora: Number(config.precioPorHora),
          precioPorMediaHora: Number(config.precioPorMediaHora),
          precioPorMinuto: Number(config.precioPorMinuto),
          precioControlExtra: Number(config.precioControlExtra),
        }
      : null,
  };
}

async function getEmpleadoId(rol: string) {
  const usuario = await prisma.usuario.findFirst({ where: { rol: rol as "DUENO" | "EMPLEADO", activo: true } });
  if (!usuario) throw new Error("Usuario no encontrado en la base de datos");
  return usuario.id;
}

export async function iniciarSesionXbox(
  consolaId: number,
  tiempoDefinidoMinutos?: number
) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const hoy = new Date();
  const hoyInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (await prisma.cierreDia.findFirst({ where: { fecha: hoyInicio } })) {
    throw new Error("El día ya fue cerrado. Las operaciones reanudan mañana.");
  }

  const sesionActiva = await prisma.sesionXbox.findFirst({
    where: { consolaId, fin: null },
  });
  if (sesionActiva) throw new Error("La consola ya tiene una sesión activa");

  const empleadoId = await getEmpleadoId(session.rol);

  await prisma.sesionXbox.create({
    data: {
      consolaId,
      inicio: new Date(),
      empleadoId,
      tiempoDefinidoMinutos: tiempoDefinidoMinutos ?? null,
    },
  });

  revalidatePath("/dashboard/xbox");
}

export async function agregarControlXbox(sesionId: number) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const sesion = await prisma.sesionXbox.findUnique({ where: { id: sesionId } });
  if (!sesion || sesion.fin) throw new Error("Sesión no válida");
  if (sesion.controlesExtra >= 4) throw new Error("Máximo 4 controles extra");

  await prisma.sesionXbox.update({
    where: { id: sesionId },
    data: { controlesExtra: { increment: 1 } },
  });

  revalidatePath("/dashboard/xbox");
}

export async function agregarTiempoXbox(sesionId: number, minutosExtra: number) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  if (!Number.isInteger(minutosExtra) || minutosExtra < 1)
    throw new Error("Los minutos a agregar deben ser un número entero mayor o igual a 1");

  const sesion = await prisma.sesionXbox.findUnique({ where: { id: sesionId } });
  if (!sesion || sesion.fin) throw new Error("Sesión no válida");

  const minutosActuales = sesion.tiempoDefinidoMinutos;

  if (minutosActuales !== null) {
    // Tiempo definido: simplemente sumar los minutos
    await prisma.sesionXbox.update({
      where: { id: sesionId },
      data: { tiempoDefinidoMinutos: minutosActuales + minutosExtra },
    });
  } else {
    // Tiempo libre: convertir a tiempo definido desde el momento actual + extra
    const transcurridos = Math.ceil(
      (Date.now() - sesion.inicio.getTime()) / 60000
    );
    await prisma.sesionXbox.update({
      where: { id: sesionId },
      data: { tiempoDefinidoMinutos: transcurridos + minutosExtra },
    });
  }

  revalidatePath("/dashboard/xbox");
}

export async function editarSesionXbox(
  sesionId: number,
  nuevoTiempoMinutos: number | null
) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  if (nuevoTiempoMinutos !== null) {
    if (!Number.isInteger(nuevoTiempoMinutos) || nuevoTiempoMinutos < 1)
      throw new Error("El tiempo debe ser un número entero mayor a 0");
  }

  const sesion = await prisma.sesionXbox.findUnique({ where: { id: sesionId } });
  if (!sesion || sesion.fin) throw new Error("Sesión no válida");

  if (nuevoTiempoMinutos !== null) {
    const minutosElapsed = Math.floor(
      (Date.now() - sesion.inicio.getTime()) / 60000
    );
    if (nuevoTiempoMinutos <= minutosElapsed)
      throw new Error(
        `El tiempo debe ser mayor al ya transcurrido (${minutosElapsed} min)`
      );
  }

  await prisma.sesionXbox.update({
    where: { id: sesionId },
    data: { tiempoDefinidoMinutos: nuevoTiempoMinutos },
  });

  revalidatePath("/dashboard/xbox");
}

// Suma tiempo extra al transcurrido hasta la pausa y reactiva la sesión.
// Usar cuando el tiempo expiró y el cliente quiere continuar.
export async function agregarTiempoYReanudar(sesionId: number, minutosExtra: number) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  if (!Number.isInteger(minutosExtra) || minutosExtra < 1)
    throw new Error("Los minutos a agregar deben ser un número entero mayor o igual a 1");

  const sesion = await prisma.sesionXbox.findUnique({ where: { id: sesionId } });
  if (!sesion || sesion.fin) throw new Error("Sesión no válida");
  if (!sesion.pausadoEn) throw new Error("La sesión no está pausada");

  // Usar tiempoDefinidoMinutos directamente — es el valor exacto ya guardado.
  // Recalcular desde timestamps introduce errores de redondeo por latencia de red.
  const minutosYaJugados = sesion.tiempoDefinidoMinutos ?? Math.ceil(
    (sesion.pausadoEn.getTime() - sesion.inicio.getTime()) / 60000
  );

  // Nuevo total = tiempo ya jugado + tiempo extra solicitado
  const nuevoTotal = minutosYaJugados + minutosExtra;

  // Fijar inicio para que el cronómetro cuente exactamente minutosExtra a partir de ahora.
  // nuevoInicio = ahora - minutosYaJugados → en el cliente: segundos ≈ minutosYaJugados * 60
  // → segundosRestantes = nuevoTotal*60 - minutosYaJugados*60 = minutosExtra*60
  const nuevoInicio = new Date(Date.now() - minutosYaJugados * 60 * 1000);

  await prisma.sesionXbox.update({
    where: { id: sesionId },
    data: {
      tiempoDefinidoMinutos: nuevoTotal,
      inicio: nuevoInicio,
      pausadoEn: null,
    },
  });

  revalidatePath("/dashboard/xbox");
}

export async function pausarSesion(sesionId: number) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const sesion = await prisma.sesionXbox.findUnique({ where: { id: sesionId } });
  if (!sesion || sesion.fin) throw new Error("Sesión no válida");
  if (sesion.pausadoEn) throw new Error("La sesión ya está pausada");

  await prisma.sesionXbox.update({
    where: { id: sesionId },
    data: { pausadoEn: new Date() },
  });

  revalidatePath("/dashboard/xbox");
}

export async function reanudarSesion(sesionId: number) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const sesion = await prisma.sesionXbox.findUnique({ where: { id: sesionId } });
  if (!sesion || sesion.fin || !sesion.pausadoEn) throw new Error("Sesión no válida o no pausada");

  // Desplazar inicio hacia adelante por el tiempo que estuvo pausada
  const pausaDuracion = Date.now() - sesion.pausadoEn.getTime();
  const nuevoInicio = new Date(sesion.inicio.getTime() + pausaDuracion);

  await prisma.sesionXbox.update({
    where: { id: sesionId },
    data: { inicio: nuevoInicio, pausadoEn: null },
  });

  revalidatePath("/dashboard/xbox");
}

export async function terminarSesionXbox({
  sesionId,
  metodoPago,
}: {
  sesionId: number;
  metodoPago: "EFECTIVO" | "TARJETA";
}) {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");

  const sesion = await prisma.sesionXbox.findUnique({ where: { id: sesionId } });
  if (!sesion || sesion.fin) throw new Error("Sesión no válida");

  const config = await prisma.configuracionXbox.findFirst();
  if (!config) throw new Error("Configuración Xbox no encontrada");

  const fin = new Date();
  // Si estaba pausada, usar el tiempo hasta la pausa; si no, tiempo real hasta ahora
  const referenciaFin = sesion.pausadoEn ?? fin;
  const duracionRealMinutos = Math.max(
    1,
    Math.ceil((referenciaFin.getTime() - sesion.inicio.getTime()) / 60000)
  );

  // Para tiempo definido, se cobra el tiempo pactado; para libre, el tiempo real
  const minutosParaCobro = sesion.tiempoDefinidoMinutos ?? duracionRealMinutos;

  const configNums = {
    precioPorHora: Number(config.precioPorHora),
    precioPorMediaHora: Number(config.precioPorMediaHora),
    precioPorMinuto: Number(config.precioPorMinuto),
    precioControlExtra: Number(config.precioControlExtra),
  };

  const { montoTiempo, montoControles, total } = calcularMontoXbox(
    minutosParaCobro,
    sesion.controlesExtra,
    configNums
  );

  await prisma.sesionXbox.update({
    where: { id: sesionId },
    data: {
      fin,
      duracionMinutos: duracionRealMinutos,
      montoTiempo,
      montoControles,
      total,
      metodoPago,
    },
  });

  revalidatePath("/dashboard/xbox");
}
