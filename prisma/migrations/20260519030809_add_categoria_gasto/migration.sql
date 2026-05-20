-- CreateTable
CREATE TABLE "categorias_gasto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "es_default" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_gasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_gasto_nombre_key" ON "categorias_gasto"("nombre");
