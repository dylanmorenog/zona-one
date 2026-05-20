-- AlterTable
ALTER TABLE "cierres_financiero" ADD COLUMN     "caja_chica_calculada" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "caja_chica_real" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "diferencia_caja_chica" DECIMAL(12,2) NOT NULL DEFAULT 0;
