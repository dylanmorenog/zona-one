import { getPanelDia } from "@/app/actions/panel";
import { getSession } from "@/app/actions/auth";
import { PanelDia } from "@/components/panel/PanelDia";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const [data, session] = await Promise.all([getPanelDia(), getSession()]);
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Panel del día</h1>
          <p className="text-sm text-gray-400">
            {(() => {
              const s = new Date().toLocaleDateString("es-MX", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });
              return s.charAt(0).toUpperCase() + s.slice(1);
            })()}
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <PanelDia data={data} rol={session.rol} />
      </div>
    </div>
  );
}
