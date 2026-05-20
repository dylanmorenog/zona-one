export interface ConfigXbox {
  precioPorHora: number;
  precioPorMediaHora: number;
  precioPorMinuto: number;
  precioControlExtra: number;
}

export function calcularMontoXbox(
  duracionMinutos: number,
  controlesExtra: number,
  config: ConfigXbox
): { montoTiempo: number; montoControles: number; total: number } {
  let montoTiempo: number;

  if (duracionMinutos >= 60) {
    const horasCompletas = Math.floor(duracionMinutos / 60);
    const minutosRestantes = duracionMinutos % 60;
    const montoHoras = horasCompletas * config.precioPorHora;
    const montoResto =
      minutosRestantes >= 30
        ? config.precioPorMediaHora
        : Math.min(
            minutosRestantes * config.precioPorMinuto,
            config.precioPorMediaHora
          );
    montoTiempo = montoHoras + montoResto;
  } else if (duracionMinutos >= 30) {
    montoTiempo = config.precioPorMediaHora;
  } else {
    // Cobro por minuto pero sin superar el precio de media hora
    montoTiempo = Math.min(
      duracionMinutos * config.precioPorMinuto,
      config.precioPorMediaHora
    );
  }

  const montoControles = controlesExtra * config.precioControlExtra;
  return { montoTiempo, montoControles, total: montoTiempo + montoControles };
}

export function formatearTiempo(segundos: number): string {
  const absSegundos = Math.abs(segundos);
  const h = Math.floor(absSegundos / 3600);
  const m = Math.floor((absSegundos % 3600) / 60);
  const s = absSegundos % 60;
  const prefijo = segundos < 0 ? "-" : "";
  if (h > 0) {
    return `${prefijo}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${prefijo}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Presets de "Poner tiempo" — los precios se calculan con la config real
export const PRESETS_TIEMPO = [
  { label: "30 min", minutos: 30 },
  { label: "1 hora", minutos: 60 },
  { label: "2 horas", minutos: 120 },
] as const;
