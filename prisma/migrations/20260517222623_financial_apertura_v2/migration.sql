/*
  Warnings:

  - You are about to drop the column `efectivo_inicial` on the `aperturas_financiero` table. All the data in the column will be lost.
  - Added the required column `efectivo_empleada` to the `aperturas_financiero` table without a default value. This is not possible if the table is not empty.
  - Added the required column `saldo_tarjeta_inicial` to the `aperturas_financiero` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sobrante` to the `cierres_financiero` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "aperturas_financiero" DROP COLUMN "efectivo_inicial",
ADD COLUMN     "efectivo_empleada" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "saldo_tarjeta_inicial" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "cierres_financiero" ADD COLUMN     "sobrante" DECIMAL(12,2) NOT NULL;
