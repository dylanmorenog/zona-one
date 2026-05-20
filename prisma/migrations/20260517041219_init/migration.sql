-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DUENO', 'EMPLEADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA');

-- CreateEnum
CREATE TYPE "CategoriaProducto" AS ENUM ('DULCES', 'FRITURAS', 'PAPELERIA', 'BEBIDAS', 'OTRO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'EMPLEADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_operacion_financiera" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "comision_porcentaje" DECIMAL(5,2),
    "comision_fija" DECIMAL(10,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_operacion_financiera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operaciones_financieras" (
    "id" SERIAL NOT NULL,
    "tipo_id" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "comision" DECIMAL(10,2) NOT NULL,
    "metodo_pago" "MetodoPago" NOT NULL,
    "notas" TEXT,
    "hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empleado_id" INTEGER NOT NULL,

    CONSTRAINT "operaciones_financieras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consolas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "consolas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_xbox" (
    "id" SERIAL NOT NULL,
    "consola_id" INTEGER NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3),
    "duracion_minutos" INTEGER,
    "controles_extra" INTEGER NOT NULL DEFAULT 0,
    "monto_controles" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monto_tiempo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "metodo_pago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "empleado_id" INTEGER NOT NULL,

    CONSTRAINT "sesiones_xbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_servicio" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio_base" DECIMAL(10,2) NOT NULL,
    "por_unidad" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios" (
    "id" SERIAL NOT NULL,
    "tipo_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "metodo_pago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "notas" TEXT,
    "hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empleado_id" INTEGER NOT NULL,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaProducto" NOT NULL DEFAULT 'OTRO',
    "precio_venta" DECIMAL(10,2) NOT NULL,
    "precio_costo" DECIMAL(10,2) NOT NULL,
    "stock_actual" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 5,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_productos" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "metodo_pago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empleado_id" INTEGER NOT NULL,

    CONSTRAINT "ventas_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierres_dia" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "total_xbox" DECIMAL(10,2) NOT NULL,
    "total_servicios" DECIMAL(10,2) NOT NULL,
    "total_financiero" DECIMAL(10,2) NOT NULL,
    "total_productos" DECIMAL(10,2) NOT NULL,
    "total_comisiones" DECIMAL(10,2) NOT NULL,
    "total_general" DECIMAL(10,2) NOT NULL,
    "efectivo_esperado" DECIMAL(10,2) NOT NULL,
    "efectivo_real" DECIMAL(10,2) NOT NULL,
    "diferencia" DECIMAL(10,2) NOT NULL,
    "notas" TEXT,
    "empleado_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierres_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_xbox" (
    "id" SERIAL NOT NULL,
    "precio_por_hora" DECIMAL(10,2) NOT NULL,
    "precio_por_media_hora" DECIMAL(10,2) NOT NULL,
    "precio_por_minuto" DECIMAL(10,2) NOT NULL,
    "precio_control_extra" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "configuracion_xbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_operacion_financiera_nombre_key" ON "tipos_operacion_financiera"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "consolas_numero_key" ON "consolas"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_servicio_nombre_key" ON "tipos_servicio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_dia_fecha_key" ON "cierres_dia"("fecha");

-- AddForeignKey
ALTER TABLE "operaciones_financieras" ADD CONSTRAINT "operaciones_financieras_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_operacion_financiera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operaciones_financieras" ADD CONSTRAINT "operaciones_financieras_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_xbox" ADD CONSTRAINT "sesiones_xbox_consola_id_fkey" FOREIGN KEY ("consola_id") REFERENCES "consolas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_xbox" ADD CONSTRAINT "sesiones_xbox_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_productos" ADD CONSTRAINT "ventas_productos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_productos" ADD CONSTRAINT "ventas_productos_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_dia" ADD CONSTRAINT "cierres_dia_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
