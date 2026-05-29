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
  comision: number
): number {
  if (estado !== "COMPLETADO") return 0;
  if (tipo === "RETIRO") {
    // efectivo en efectivo: solo baja el monto dado (comisión viene del cliente aparte)
    // efectivo en transferencia: baja monto + comisión (da monto, extrae comisión a caja chica)
    return tipoComision === "EFECTIVO" ? -monto : -(monto + comision);
  }
  if (tipo === "DEPOSITO") {
    // efectivo en efectivo: sube solo el monto (comisión viene del cliente aparte)
    // descontada: sube monto pero extrae comisión a caja chica
    return tipoComision === "EFECTIVO" ? monto : monto - comision;
  }
  return 0;
}

export function tarjetaEfecto(
  tipo: string,
  estado: string,
  tipoComision: string,
  monto: number,
  comision: number
): number {
  if (estado === "CANCELADO") return 0;
  if (tipo === "RETIRO") {
    // PENDIENTE y COMPLETADO: el cliente ya transfirió
    return tipoComision === "TRANSFERENCIA" ? monto + comision : monto;
  }
  if (tipo === "DEPOSITO" && estado === "COMPLETADO") {
    // descontada: dueño transfiere monto-comision; efectivo: full monto
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
  comision: number
): number {
  return tipoComision === "TRANSFERENCIA" ? monto + comision : monto;
}
