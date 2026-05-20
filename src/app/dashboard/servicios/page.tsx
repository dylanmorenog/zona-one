import { getDatosServicios } from "@/app/actions/servicios";
import { ServiciosPanel } from "@/components/servicios/ServiciosPanel";
import { EnConstruccion } from "@/components/EnConstruccion";

export default async function ServiciosPage() {
  try {
    const datos = await getDatosServicios();
    return (
      <div className="flex flex-col h-full gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Servicios</h1>
          <p className="text-sm text-gray-400">
            Impresiones, trámites y otros servicios del local
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <ServiciosPanel {...datos} />
        </div>
      </div>
    );
  } catch {
    return (
      <EnConstruccion
        titulo="Servicios"
        descripcion="No se pudo conectar con la base de datos."
      />
    );
  }
}
