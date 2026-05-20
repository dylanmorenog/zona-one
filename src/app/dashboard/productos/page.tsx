import { getDatosProductos } from "@/app/actions/productos";
import { getSession } from "@/app/actions/auth";
import { ProductosPanel } from "@/components/productos/ProductosPanel";
import { EnConstruccion } from "@/components/EnConstruccion";
import { redirect } from "next/navigation";

export default async function ProductosPage() {
  try {
    const [datos, session] = await Promise.all([getDatosProductos(), getSession()]);
    if (!session) redirect("/login");

    return (
      <div className="flex flex-col h-full gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Productos</h1>
          <p className="text-sm text-gray-400">
            Dulces, frituras, papelería y más
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <ProductosPanel {...datos} rol={session.rol} />
        </div>
      </div>
    );
  } catch {
    return (
      <EnConstruccion
        titulo="Productos"
        descripcion="No se pudo conectar con la base de datos."
      />
    );
  }
}
