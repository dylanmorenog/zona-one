// $20 de comisión por cada $1,000 iniciado
export function calcularComision(monto: number): number {
  return Math.ceil(monto / 1000) * 20;
}

export function fmt(monto: number): string {
  return monto.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Efectos por operación ────────────────────────────────────────────────────
//
// RETIRO + comisión en efectivo:
//   Cliente transfiere $1,000 → tarjeta +$1,000
//   Empleada da $1,000 cash   → efectivo -$1,000
//   Cliente paga $20 aparte   → caja_chica +$20
//
// RETIRO + comisión en transferencia:
//   Cliente transfiere $1,020 → tarjeta +$1,020
//   Empleada da $1,000 cash   → efectivo -$1,000
//   $20 de tarjeta pasan a caja chica (se descuentan del efectivo) → efectivo -$20, caja_chica +$20
//   Total efectivo: -$1,020
//
// DEPÓSITO + comisión en efectivo:
//   Cliente da $1,000 cash    → efectivo +$1,000
//   Dueño transfiere $1,000   → tarjeta -$1,000
//   Cliente paga $20 aparte   → caja_chica +$20  (no afecta efectivo operativo)
//
// DEPÓSITO + comisión descontada:
//   Cliente da $1,000 cash    → efectivo +$1,000
//   Dueño transfiere $980     → tarjeta -$980
//   $20 de diferencia pasan a caja chica → efectivo -$20, caja_chica +$20
//   Total efectivo: +$980

export function efectivoEfecto(
  tipo: string,
  estado: string,
  tipoComision: string,
  monto: number,
  comision: number,
  comisionTransferencia = 0
): number {
  if (estado !== "COMPLETADO") return 0;
  if (tipo === "RETIRO") {
    if (tipoComision === "EFECTIVO") return -monto;
    // MIXTA: baja monto + la parte de comisión que vino en transferencia
    if (tipoComision === "MIXTA") return -(monto + comisionTransferencia);
    // TRANSFERENCIA: baja monto + comisión completa
    return -(monto + comision);
  }
  if (tipo === "DEPOSITO") {
    return tipoComision === "EFECTIVO" ? monto : monto - comision;
  }
  return 0;
}

export function tarjetaEfecto(
  tipo: string,
  estado: string,
  tipoComision: string,
  monto: number,
  comision: number,
  comisionTransferencia = 0
): number {
  if (estado === "CANCELADO") return 0;
  if (tipo === "RETIRO") {
    if (tipoComision === "TRANSFERENCIA") return monto + comision;
    // MIXTA: cliente transfirió monto + solo la parte de comisión en transferencia
    if (tipoComision === "MIXTA") return monto + comisionTransferencia;
    return monto; // EFECTIVO
  }
  if (tipo === "DEPOSITO" && estado === "COMPLETADO") {
    return tipoComision === "DESCONTADA" ? -(monto - comision) : -monto;
  }
  return 0;
}

// Calcula retiro real y comisión a partir del total que transfirió el cliente.
// Busca el n tal que comision = n*20 y ceil(retiro/1000) = n.
export function calcularDesdeTotal(total: number): {
  retiro: number;
  comision: number;
} {
  for (let n = 1; n <= 50; n++) {
    const comision = n * 20;
    const retiro = total - comision;
    if (retiro <= 0) break;
    if (Math.ceil(retiro / 1000) === n) return { retiro, comision };
  }
  return { retiro: Math.max(0, total - 20), comision: 20 };
}

// La caja chica solo crece cuando la operación está COMPLETADA
export function cajaChicaEfecto(estado: string, comision: number): number {
  return estado === "COMPLETADO" ? comision : 0;
}

// Cuánto efectivo necesita salir de caja para registrar/confirmar un retiro
export function efectivoNecesarioRetiro(
  tipoComision: string,
  monto: number,
  comision: number,
  comisionTransferencia = 0
): number {
  if (tipoComision === "TRANSFERENCIA") return monto + comision;
  if (tipoComision === "MIXTA") return monto + comisionTransferencia;
  return monto; // EFECTIVO
}
