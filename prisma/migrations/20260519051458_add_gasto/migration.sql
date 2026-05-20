-- CreateTable
CREATE TABLE "gastos" (
    "id" SERIAL NOT NULL,
    "categoria_id" INTEGER,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empleado_id" INTEGER NOT NULL,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_gasto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
