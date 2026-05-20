-- CreateEnum
CREATE TYPE "TipoComision" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'DESCONTADA');

-- AlterTable
ALTER TABLE "movimientos_financiero" ADD COLUMN     "tipo_comision" "TipoComision" NOT NULL DEFAULT 'EFECTIVO';
