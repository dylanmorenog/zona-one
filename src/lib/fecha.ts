// Zona horaria del negocio (México CDT = UTC-5, CST = UTC-6)
const TZ = "America/Mexico_City";

function utcOffsetHoras(y: number, m: number, d: number): number {
  // Computa el offset UTC dinámicamente (maneja DST automáticamente)
  // Sondea a mediodía UTC del día dado y ve qué hora es en México
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
  const mxHour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(probe)
  );
  return 12 - mxHour; // 5 durante CDT (verano), 6 durante CST (invierno)
}

/**
 * Retorna límites del DÍA ACTUAL en zona horaria México.
 *
 * - fechaDate : Date en UTC midnight del día México → para campos @db.Date
 * - inicio    : DateTime UTC = medianoche México     → para campos TIMESTAMP (gte)
 * - fin       : DateTime UTC = medianoche México +1d → para campos TIMESTAMP (lt)
 * - mexStr    : "YYYY-MM-DD" en zona México
 */
export function getMexicoDia() {
  const ahora = new Date();
  const mexStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ahora);
  const [y, m, d] = mexStr.split("-").map(Number);
  const off = utcOffsetHoras(y, m, d);

  return {
    fechaDate: new Date(Date.UTC(y, m - 1, d)),
    inicio:    new Date(Date.UTC(y, m - 1, d,     off, 0, 0)),
    fin:       new Date(Date.UTC(y, m - 1, d + 1, off, 0, 0)),
    mexStr,
    y, m, d,
  };
}

/**
 * Retorna límites de un día ESPECÍFICO dado como "YYYY-MM-DD" (fecha México).
 * Úsalo para consultas históricas.
 */
export function getMexicoRango(fechaStr: string) {
  const [y, m, d] = fechaStr.split("-").map(Number);
  const off = utcOffsetHoras(y, m, d);

  return {
    fechaDate: new Date(Date.UTC(y, m - 1, d)),
    inicio:    new Date(Date.UTC(y, m - 1, d,     off, 0, 0)),
    fin:       new Date(Date.UTC(y, m - 1, d + 1, off, 0, 0)),
  };
}
