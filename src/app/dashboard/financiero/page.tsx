import { getEstadoFinanciero } from "@/app/actions/financiero";
import { getSession } from "@/app/actions/auth";
import { FinancieroPanel } from "@/components/financiero/FinancieroPanel";
import { redirect } from "next/navigation";

export default async function FinancieroPage() {
  const [estado, session] = await Promise.all([
    getEstadoFinanciero(),
    getSession(),
  ]);

  if (!session) redirect("/login");

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Retiros y Depósitos</h1>
          <p className="text-sm text-gray-400">Servicio financiero del local</p>
        </div>
        </div>
      <div className="flex-1 min-h-0">
        <FinancieroPanel {...estado} rol={session.rol} />
      </div>
    </div>
  );
}
