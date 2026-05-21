-- CreateTable
CREATE TABLE "efectivo_extra" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(12,2) NOT NULL,
    "notas" TEXT,
    "empleado_id" INTEGER NOT NULL,

    CONSTRAINT "efectivo_extra_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "efectivo_extra" ADD CONSTRAINT "efectivo_extra_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
