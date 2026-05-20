-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('RETIRO', 'DEPOSITO');

-- CreateTable
CREATE TABLE "config_financiero" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "capital_total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "config_financiero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aperturas_financiero" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "efectivo_inicial" DECIMAL(12,2) NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aperturas_financiero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_financiero" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "comision" DECIMAL(10,2) NOT NULL,
    "cuenta_destino" TEXT,
    "notas" TEXT,
    "hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empleado_id" INTEGER NOT NULL,

    CONSTRAINT "movimientos_financiero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierres_financiero" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "efectivo_final" DECIMAL(12,2) NOT NULL,
    "saldo_tarjeta_esperado" DECIMAL(12,2) NOT NULL,
    "saldo_tarjeta_real" DECIMAL(12,2) NOT NULL,
    "diferencia" DECIMAL(12,2) NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierres_financiero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aperturas_financiero_fecha_key" ON "aperturas_financiero"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_financiero_fecha_key" ON "cierres_financiero"("fecha");

-- AddForeignKey
ALTER TABLE "aperturas_financiero" ADD CONSTRAINT "aperturas_financiero_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financiero" ADD CONSTRAINT "movimientos_financiero_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_financiero" ADD CONSTRAINT "cierres_financiero_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
