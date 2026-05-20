"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/financiero";
import { createGasto, updateGasto, deleteGasto } from "@/app/actions/gastos";

type Gasto = {
  id: number;
  categoriaId: number | null;
  categoriaNombre: string | null;
  descripcion: string;
  monto: number;
  fecha: string;
};

type Categoria = { id: number; nombre: string };

type Resumen = {
  totalIngresos: number;
  totalGastos: number;
  gananciaNeta: number;
};

type FormData = {
  categoriaId: string;
  descripcion: string;
  monto: string;
  fecha: string;
};

function formVacio(fecha: string): FormData {
  return { categoriaId: "", descripcion: "", monto: "", fecha };
}

function ErrorMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="text-xs text-red-400 mt-1">{msg}</p>;
}

function ResumenCard({
  label,
  valor,
  color,
}: {
  label: string;
  valor: number;
  color: "gray" | "red" | "green" | "yellow";
}) {
  const colors = {
    gray: "text-white",
    red: "text-red-400",
    green: "text-emerald-400",
    yellow: "text-amber-400",
  };
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 flex-1 min-w-0">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${colors[color]}`}>${fmt(valor)}</p>
    </div>
  );
}

export function GastosPanel({
  gastos: initialGastos,
  categorias,
  resumen: initialResumen,
  fecha,
  rol,
}: {
  gastos: Gasto[];
  categorias: Categoria[];
  resumen: Resumen;
  fecha: string;
  rol: string;
}) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [gastos, setGastos] = useState(initialGastos);
  const [resumen, setResumen] = useState(initialResumen);
  const [mostrando, setMostrando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(formVacio(fecha));
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const totalGastosLocal = gastos.reduce((a, g) => a + g.monto, 0);
  const resumenLocal = {
    ...resumen,
    totalGastos: totalGastosLocal,
    gananciaNeta: resumen.totalIngresos - totalGastosLocal,
  };

  function abrirNuevo() {
    setEditandoId(null);
    setForm(formVacio(fecha));
    setError(null);
    setMostrando(true);
  }

  function abrirEditar(g: Gasto) {
    setEditandoId(g.id);
    setForm({
      categoriaId: g.categoriaId?.toString() ?? "",
      descripcion: g.descripcion,
      monto: g.monto.toString(),
      fecha: g.fecha,
    });
    setError(null);
    setMostrando(true);
  }

  function cerrarForm() {
    setMostrando(false);
    setEditandoId(null);
    setError(null);
  }

  function handleGuardar() {
    const montoNum = parseFloat(form.monto.replace(",", "."));
    if (!form.descripcion.trim()) { setError("Escribe una descripción"); return; }
    if (isNaN(montoNum) || montoNum <= 0) { setError("El monto debe ser mayor a cero"); return; }
    setError(null);

    const data = {
      categoriaId: form.categoriaId ? parseInt(form.categoriaId) : null,
      descripcion: form.descripcion.trim(),
      monto: montoNum,
      fecha: form.fecha,
    };

    startT(async () => {
      try {
        if (editandoId !== null) {
          await updateGasto(editandoId, data);
          setGastos(prev =>
            prev.map(g =>
              g.id === editandoId
                ? {
                    ...g,
                    ...data,
                    categoriaNombre:
                      categorias.find(c => c.id === data.categoriaId)?.nombre ?? null,
                  }
                : g
            )
          );
        } else {
          const nuevoGasto = await createGasto(data);
          setGastos(prev => [...prev, nuevoGasto]);
        }
        cerrarForm();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function handleEliminar(id: number) {
    startT(async () => {
      try {
        await deleteGasto(id);
        setGastos(prev => prev.filter(g => g.id !== id));
        setConfirmDeleteId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al eliminar");
      }
    });
  }

  function handleFechaChange(nuevaFecha: string) {
    router.push(`/dashboard/gastos?fecha=${nuevaFecha}`);
  }

  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex gap-3">
        <ResumenCard label="Ingresos del día" valor={resumenLocal.totalIngresos} color="gray" />
        <ResumenCard label="Gastos del día" valor={resumenLocal.totalGastos} color="red" />
        <ResumenCard
          label="Ganancia neta"
          valor={resumenLocal.gananciaNeta}
          color={resumenLocal.gananciaNeta >= 0 ? "green" : "yellow"}
        />
      </div>

      {/* Selector de fecha — solo dueño */}
      {rol === "DUENO" && (
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400 shrink-0">Fecha:</label>
          <input
            type="date"
            value={fecha}
            max={hoyStr}
            onChange={e => handleFechaChange(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
          />
          {fecha !== hoyStr && (
            <button
              onClick={() => handleFechaChange(hoyStr)}
              className="text-xs text-brand-400 hover:text-brand-300 transition"
            >
              Ir a hoy
            </button>
          )}
        </div>
      )}

      {/* Lista de gastos */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">
            Gastos del día
            {gastos.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({gastos.length})
              </span>
            )}
          </p>
        </div>

        {gastos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-600 text-center">
            Sin gastos registrados para este día
          </p>
        ) : (
          <div className="divide-y divide-gray-800">
            {gastos.map(g => (
              <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-gray-200">{g.descripcion}</p>
                    {g.categoriaNombre && (
                      <span className="text-xs bg-gray-800 text-gray-400 rounded px-1.5 py-0.5 shrink-0">
                        {g.categoriaNombre}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm font-semibold text-red-400 shrink-0">
                  −${fmt(g.monto)}
                </p>
                {fecha === hoyStr && (
                  <div className="flex items-center gap-1 shrink-0">
                    {rol === "DUENO" && (
                      <button
                        onClick={() => abrirEditar(g)}
                        disabled={pending}
                        className="text-xs text-gray-500 hover:text-gray-200 transition px-2 py-1 rounded hover:bg-gray-800"
                      >
                        Editar
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteId(g.id)}
                      disabled={pending}
                      className="text-xs text-gray-500 hover:text-red-400 transition px-2 py-1 rounded hover:bg-gray-800"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800/30">
              <p className="text-sm text-gray-400">Total gastos</p>
              <p className="text-sm font-bold text-red-400">
                −${fmt(totalGastosLocal)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Botón registrar + formulario */}
      {!mostrando ? (
        <button
          onClick={abrirNuevo}
          className="w-full rounded-lg border border-dashed border-gray-700 hover:border-brand-600 py-2.5 text-sm text-gray-500 hover:text-brand-400 transition"
        >
          + Registrar gasto
        </button>
      ) : (
        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 space-y-3">
          <p className="text-sm font-semibold text-white">
            {editandoId !== null ? "Editar gasto" : "Nuevo gasto"}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Categoría */}
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Categoría</label>
              <select
                value={form.categoriaId}
                onChange={e => setForm(f => ({ ...f, categoriaId: e.target.value }))}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            {/* Descripción */}
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Descripción</label>
              <input
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Pintura para paredes"
                autoFocus
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Monto */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Monto ($)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                max={hoyStr}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <ErrorMsg msg={error} />

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleGuardar}
              disabled={pending}
              className="flex-1 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition"
            >
              {pending ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={cerrarForm}
              disabled={pending}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {confirmDeleteId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}
        >
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-6 space-y-4">
            <p className="text-sm font-semibold text-white">¿Eliminar gasto?</p>
            <p className="text-sm text-gray-400">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleEliminar(confirmDeleteId)}
                disabled={pending}
                className="flex-1 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition"
              >
                {pending ? "Eliminando..." : "Sí, eliminar"}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
