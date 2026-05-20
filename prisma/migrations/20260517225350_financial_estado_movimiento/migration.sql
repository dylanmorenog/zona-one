/*
  Warnings:

  - You are about to drop the column `cuenta_destino` on the `movimientos_financiero` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('PENDIENTE', 'COMPLETADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "movimientos_financiero" DROP COLUMN "cuenta_destino",
ADD COLUMN     "confirmado_en" TIMESTAMP(3),
ADD COLUMN     "estado" "EstadoMovimiento" NOT NULL DEFAULT 'COMPLETADO';
