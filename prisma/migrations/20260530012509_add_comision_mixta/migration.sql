-- AlterEnum
ALTER TYPE "TipoComision" ADD VALUE 'MIXTA';

-- AlterTable
ALTER TABLE "movimientos_financiero" ADD COLUMN     "comision_transferencia" DECIMAL(10,2);
