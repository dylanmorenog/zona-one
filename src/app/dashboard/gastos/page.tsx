import { redirect } from "next/navigation";
import { getSession } from "@/app/actions/auth";
import { getGastosDelDia, getResumenGastosDia } from "@/app/actions/gastos";
import { getCategoriasGasto } from "@/app/actions/configuracion";
import { GastosPanel } from "@/components/gastos/GastosPanel";

function fechaHoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  // Empleados siempre ven el día de hoy
  const fecha = session.rol === "EMPLEADO" ? fechaHoy() : (params.fecha ?? fechaHoy());

  const [gastos, resumen, categoriasRaw] = await Promise.all([
    getGastosDelDia(fecha),
    getResumenGastosDia(fecha),
    getCategoriasGasto(),
  ]);

  const categorias = categoriasRaw
    .filter(c => c.activa)
    .map(c => ({ id: c.id, nombre: c.nombre }));

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h1 className="text-xl font-bold text-white">Gastos</h1>
        <p className="text-sm text-gray-400">Registro de gastos del local</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <GastosPanel
          gastos={gastos}
          categorias={categorias}
          resumen={resumen}
          fecha={fecha}
          rol={session.rol}
        />
      </div>
    </div>
  );
}
