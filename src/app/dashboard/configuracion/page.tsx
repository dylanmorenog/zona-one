import { getSession } from "@/app/actions/auth";
import {
  getConfigXbox,
  getServicios,
  getProductos,
  getConfigFinanciero,
  getCategoriasGasto,
  getCategoriasProducto,
  getCategoriasDefaultDeshabilitadas,
  getRespaldosReinicio,
} from "@/app/actions/configuracion";
import { ConfiguracionPanel } from "@/components/configuracion/ConfiguracionPanel";
import { redirect } from "next/navigation";

export default async function ConfiguracionPage() {
  const session = await getSession();
  if (session?.rol !== "DUENO") redirect("/dashboard");

  const [{ config: configXbox, consolas }, servicios, productos, configFinanciero, categoriasGasto, categoriasProducto, categoriasDefaultDeshabilitadas, respaldosReinicio] =
    await Promise.all([
      getConfigXbox(),
      getServicios(),
      getProductos(),
      getConfigFinanciero(),
      getCategoriasGasto(),
      getCategoriasProducto(),
      getCategoriasDefaultDeshabilitadas(),
      getRespaldosReinicio(),
    ]);

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h1 className="text-xl font-bold text-white">Configuración</h1>
        <p className="text-sm text-gray-400">Precios, servicios, productos y ajustes del sistema</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ConfiguracionPanel
          configXbox={configXbox}
          consolas={consolas}
          servicios={servicios}
          productos={productos}
          configFinanciero={configFinanciero}
          categoriasGasto={categoriasGasto}
          categoriasProducto={categoriasProducto}
          categoriasDefaultDeshabilitadas={categoriasDefaultDeshabilitadas}
          respaldosReinicio={respaldosReinicio}
        />
      </div>
    </div>
  );
}
