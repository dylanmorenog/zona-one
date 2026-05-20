"use client";

import { useState } from "react";
import { getDatosExportacion, type DatosExportacion } from "@/app/actions/exportar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fechaRango(dias: number) {
  const fin = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - dias + 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: fmt(inicio), fin: fmt(fin) };
}

function primerDiaMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ─── Generador de xlsx en cliente ─────────────────────────────────────────────

async function generarExcel(datos: DatosExportacion, nombreArchivo: string) {
  const XLSX = await import("xlsx");

  const moneda = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

  // Hoja Resumen
  const filaResumen = [
    ["Concepto", "Monto"],
    ["Renta Xbox", moneda(datos.resumen.xbox)],
    ["Servicios", moneda(datos.resumen.servicios)],
    ["Productos", moneda(datos.resumen.productos)],
    ["Comisiones financiero", moneda(datos.resumen.comisiones)],
    ["Caja chica total", moneda(datos.resumen.cajaChica)],
    ...(datos.resumen.sobranteFinanciero !== null
      ? [["Sobrante financiero entregado", moneda(datos.resumen.sobranteFinanciero)]]
      : []),
    ...(datos.resumen.saldoTarjeta !== null
      ? [["Saldo en tarjeta reportado", moneda(datos.resumen.saldoTarjeta)]]
      : []),
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(filaResumen);
  const wsXbox = XLSX.utils.json_to_sheet(datos.xbox);
  const wsServicios = XLSX.utils.json_to_sheet(datos.servicios);
  const wsProductos = XLSX.utils.json_to_sheet(datos.productos);
  const wsFinanciero = XLSX.utils.json_to_sheet(datos.financiero);

  // Ancho de columnas automático por contenido
  function autoWidth(ws: ReturnType<typeof XLSX.utils.aoa_to_sheet>) {
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    const cols = (data[0] as string[])?.length ?? 0;
    ws["!cols"] = Array.from({ length: cols }, (_, i) => ({
      wch: Math.max(
        10,
        ...data.map(row => String((row as string[])[i] ?? "").length)
      ),
    }));
  }
  [wsResumen, wsXbox, wsServicios, wsProductos, wsFinanciero].forEach(autoWidth);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
  XLSX.utils.book_append_sheet(wb, wsXbox, "Xbox");
  XLSX.utils.book_append_sheet(wb, wsServicios, "Servicios");
  XLSX.utils.book_append_sheet(wb, wsProductos, "Productos");
  XLSX.utils.book_append_sheet(wb, wsFinanciero, "Financiero");

  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

// ─── Componente modal ─────────────────────────────────────────────────────────

type Modo = "dia" | "semana" | "mes" | "personalizado";

export function ExportarExcel() {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<Modo>("dia");
  const [diaElegido, setDiaElegido] = useState(todayStr());
  const [rangoInicio, setRangoInicio] = useState(primerDiaMes());
  const [rangoFin, setRangoFin] = useState(todayStr());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function obtenerRango(): { inicio: string; fin: string } {
    if (modo === "dia") return { inicio: diaElegido, fin: diaElegido };
    if (modo === "semana") return fechaRango(7);
    if (modo === "mes") return { inicio: primerDiaMes(), fin: todayStr() };
    return { inicio: rangoInicio, fin: rangoFin };
  }

  function nombreArchivo(inicio: string, fin: string) {
    return inicio === fin
      ? `ZonaOne_${inicio}`
      : `ZonaOne_${inicio}_al_${fin}`;
  }

  async function handleExportar() {
    setError(null);
    setCargando(true);
    try {
      const { inicio, fin } = obtenerRango();
      if (inicio > fin) {
        setError("La fecha de inicio no puede ser mayor a la fecha final.");
        return;
      }
      const datos = await getDatosExportacion(inicio, fin);
      await generarExcel(datos, nombreArchivo(inicio, fin));
      setAbierto(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al exportar");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:text-white hover:border-gray-500 transition"
      >
        Exportar Excel ↓
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setAbierto(false); }}
        >
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">Exportar a Excel</h2>
              <button
                onClick={() => setAbierto(false)}
                className="text-gray-600 hover:text-gray-300 transition text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Selector de modo */}
              <div className="grid grid-cols-2 gap-2">
                {(["dia", "semana", "mes", "personalizado"] as Modo[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setModo(m)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                      modo === m
                        ? "bg-brand-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {m === "dia" ? "Un día" : m === "semana" ? "Últimos 7 días" : m === "mes" ? "Este mes" : "Personalizado"}
                  </button>
                ))}
              </div>

              {/* Campos según modo */}
              {modo === "dia" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={diaElegido}
                    max={todayStr()}
                    onChange={e => e.target.value && setDiaElegido(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              )}

              {modo === "personalizado" && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Desde</label>
                    <input
                      type="date"
                      value={rangoInicio}
                      max={rangoFin}
                      onChange={e => e.target.value && setRangoInicio(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                    <input
                      type="date"
                      value={rangoFin}
                      min={rangoInicio}
                      max={todayStr()}
                      onChange={e => e.target.value && setRangoFin(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Preview nombre de archivo */}
              <div className="rounded-lg bg-gray-800/60 px-3 py-2">
                <p className="text-xs text-gray-600 mb-0.5">Nombre del archivo</p>
                <p className="text-xs font-mono text-gray-400">
                  {(() => {
                    const { inicio, fin } = obtenerRango();
                    return `${nombreArchivo(inicio, fin)}.xlsx`;
                  })()}
                </p>
              </div>

              {/* Info hojas */}
              <div className="rounded-lg bg-gray-800/40 px-3 py-2.5 space-y-1">
                <p className="text-xs text-gray-600 font-medium mb-1.5">Hojas incluidas</p>
                {["Resumen", "Xbox", "Servicios", "Productos", "Financiero"].map(h => (
                  <div key={h} className="flex items-center gap-1.5">
                    <span className="text-gray-700 text-xs">•</span>
                    <span className="text-xs text-gray-500">{h}</span>
                  </div>
                ))}
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5">
              <button
                onClick={handleExportar}
                disabled={cargando}
                className="w-full rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition"
              >
                {cargando ? "Generando..." : "Descargar Excel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
