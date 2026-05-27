-- CreateTable
CREATE TABLE "respaldos_reinicio" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empleado_id" INTEGER NOT NULL,
    "datos" JSONB NOT NULL,

    CONSTRAINT "respaldos_reinicio_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "respaldos_reinicio" ADD CONSTRAINT "respaldos_reinicio_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
