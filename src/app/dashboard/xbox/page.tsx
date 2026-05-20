import { getConsolasConSesiones } from "@/app/actions/xbox";
import { XboxGrid } from "@/components/xbox/XboxGrid";
import { EnConstruccion } from "@/components/EnConstruccion";

export default async function XboxPage() {
  try {
    const { consolas, config } = await getConsolasConSesiones();

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Xbox y cobros</h1>
          <p className="mt-1 text-sm text-gray-400">
            Control de sesiones activas por consola
          </p>
        </div>

        <XboxGrid consolas={consolas} config={config} />
      </div>
    );
  } catch {
    return (
      <EnConstruccion
        titulo="Xbox y cobros"
        descripcion="No se pudo conectar con la base de datos. Verifica la conexión y que el seed haya sido ejecutado."
      />
    );
  }
}
