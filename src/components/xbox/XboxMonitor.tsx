"use client";

import { getConsolasConSesiones, pausarSesion } from "@/app/actions/xbox";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function XboxMonitor() {
  const toast = useToast();
  const router = useRouter();

  // IDs de sesiones que ya fueron pausadas por este monitor (evita llamadas duplicadas)
  const pausadasRef = useRef<Set<number>>(new Set());
  // Timers activos por sesionId
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  async function handleExpirada(sesionId: number, consolaNombre: string) {
    if (pausadasRef.current.has(sesionId)) return;
    pausadasRef.current.add(sesionId);

    try {
      await pausarSesion(sesionId);
      router.refresh();
      toast.warning(`Tiempo agotado — ${consolaNombre}. Sesión pausada automáticamente.`);
    } catch {
      // La sesión ya fue pausada manualmente o cerrada — no hacer nada
    }
  }

  async function verificarSesiones() {
    try {
      const { consolas } = await getConsolasConSesiones();

      // IDs de sesiones activas actualmente
      const sesionesActivas = new Set<number>();

      for (const consola of consolas) {
        const sesion = consola.sesionActiva;
        if (!sesion || sesion.tiempoDefinidoMinutos == null || sesion.pausadoEn) continue;

        sesionesActivas.add(sesion.id);

        // Si ya tiene timer programado, no hacer nada
        if (timersRef.current.has(sesion.id)) continue;

        const expiraEn =
          new Date(sesion.inicio).getTime() + sesion.tiempoDefinidoMinutos * 60 * 1000;
        const restanMs = expiraEn - Date.now();

        if (restanMs <= 0) {
          // Ya expiró — pausar de inmediato
          handleExpirada(sesion.id, consola.nombre);
        } else {
          // Programar pausa al momento exacto de expiración
          const timer = setTimeout(
            () => handleExpirada(sesion.id, consola.nombre),
            restanMs
          );
          timersRef.current.set(sesion.id, timer);
        }
      }

      // Limpiar timers de sesiones que ya no existen (cerradas manualmente)
      for (const [id, timer] of timersRef.current) {
        if (!sesionesActivas.has(id)) {
          clearTimeout(timer);
          timersRef.current.delete(id);
        }
      }
    } catch {
      // Silencioso — no interrumpir la navegación si falla
    }
  }

  useEffect(() => {
    verificarSesiones();
    // Re-verificar cada 30s para detectar sesiones nuevas iniciadas en otras páginas
    const interval = setInterval(verificarSesiones, 30_000);
    return () => {
      clearInterval(interval);
      timersRef.current.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
