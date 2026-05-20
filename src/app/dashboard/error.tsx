"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-900/30">
        <span className="text-2xl">⚠️</span>
      </div>
      <h2 className="mb-2 text-lg font-semibold text-white">
        Error al cargar la página
      </h2>
      <p className="mb-1 max-w-sm text-sm text-gray-400">
        {error.message || "Ocurrió un error inesperado."}
      </p>
      <p className="mb-6 text-xs text-gray-600">
        Verifica que la base de datos esté conectada y que el seed haya sido ejecutado.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-500"
      >
        Reintentar
      </button>
    </div>
  );
}
