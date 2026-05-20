-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "categoria_extra" TEXT;

-- CreateTable
CREATE TABLE "categorias_producto_config" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_producto_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_producto_config_nombre_key" ON "categorias_producto_config"("nombre");
