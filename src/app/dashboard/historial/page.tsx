import { getSession } from "@/app/actions/auth";
import { HistorialPanel } from "@/components/historial/HistorialPanel";
import { redirect } from "next/navigation";

export default async function HistorialPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h1 className="text-xl font-bold text-white">Historial y Reportes</h1>
        <p className="text-sm text-gray-400">Resumen de operaciones por día</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <HistorialPanel rol={session.rol} />
      </div>
    </div>
  );
}
