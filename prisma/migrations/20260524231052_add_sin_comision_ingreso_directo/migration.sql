-- AlterTable
ALTER TABLE "movimientos_financiero" ADD COLUMN     "ingreso_directo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sin_comision" BOOLEAN NOT NULL DEFAULT false;
