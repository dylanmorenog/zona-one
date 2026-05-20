import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Usuarios por rol (auth es por PIN de entorno, passwordHash es placeholder)
  await prisma.usuario.upsert({
    where: { email: "dueno@zonaone.local" },
    update: {},
    create: {
      nombre: "Dueño",
      email: "dueno@zonaone.local",
      passwordHash: "pin-based-auth",
      rol: "DUENO",
    },
  });

  await prisma.usuario.upsert({
    where: { email: "empleado@zonaone.local" },
    update: {},
    create: {
      nombre: "Empleado",
      email: "empleado@zonaone.local",
      passwordHash: "pin-based-auth",
      rol: "EMPLEADO",
    },
  });


  // Configuración del servicio financiero
  await prisma.configFinanciero.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, capitalTotal: 128542 },
  });

  // Tipos de operación financiera
  const tiposFinancieros = [
    { nombre: "Envío de dinero", comisionPorcentaje: 3.0 },
    { nombre: "Recarga de celular", comisionPorcentaje: 4.0 },
    { nombre: "Pago de servicio (CFE, Telmex, etc.)", comisionFija: 10.0 },
    { nombre: "Recarga de transporte", comisionPorcentaje: 3.5 },
    { nombre: "Pago de crédito", comisionFija: 15.0 },
    { nombre: "Consulta de saldo", comisionFija: 5.0 },
  ];

  for (const t of tiposFinancieros) {
    await prisma.tipoOperacionFinanciera.upsert({
      where: { nombre: t.nombre },
      update: {},
      create: {
        nombre: t.nombre,
        comisionPorcentaje: t.comisionPorcentaje ?? null,
        comisionFija: t.comisionFija ?? null,
      },
    });
  }

  // Tipos de servicio
  const tiposServicio = [
    { nombre: "Impresión blanco y negro", precioBase: 2.0, porUnidad: true },
    { nombre: "Impresión a color", precioBase: 5.0, porUnidad: true },
    { nombre: "Copia", precioBase: 2.0, porUnidad: true },
    { nombre: "Escáner", precioBase: 5.0, porUnidad: false },
    { nombre: "CURP", precioBase: 10.0, porUnidad: false },
    { nombre: "RFC", precioBase: 10.0, porUnidad: false },
    { nombre: "Acta de nacimiento", precioBase: 50.0, porUnidad: false },
    { nombre: "Comprobante de domicilio", precioBase: 20.0, porUnidad: false },
    { nombre: "Llenado de formulario", precioBase: 30.0, porUnidad: false },
    { nombre: "SADER", precioBase: 30.0, porUnidad: false },
    { nombre: "Certificado", precioBase: 30.0, porUnidad: false },
    { nombre: "Seguro", precioBase: 20.0, porUnidad: false },
    { nombre: "Otro", precioBase: 0.0, porUnidad: false },
  ];

  for (const t of tiposServicio) {
    await prisma.tipoServicio.upsert({
      where: { nombre: t.nombre },
      update: {},
      create: t,
    });
  }

  // Productos iniciales (solo si no hay ninguno)
  const productoCount = await prisma.producto.count();
  if (productoCount === 0) {
    await prisma.producto.createMany({
      data: [
        { nombre: "Sabritas",   categoria: "FRITURAS",  precioVenta: 15, precioCosto: 10,   stockActual: 15,  stockMinimo: 5  },
        { nombre: "Doritos",    categoria: "FRITURAS",  precioVenta: 15, precioCosto: 10,   stockActual: 15,  stockMinimo: 5  },
        { nombre: "Takis",      categoria: "FRITURAS",  precioVenta: 15, precioCosto: 10,   stockActual: 15,  stockMinimo: 5  },
        { nombre: "Palomitas",  categoria: "DULCES",    precioVenta: 20, precioCosto: 12,   stockActual: 10,  stockMinimo: 5  },
        { nombre: "Refresco",   categoria: "BEBIDAS",   precioVenta: 20, precioCosto: 13,   stockActual: 12,  stockMinimo: 5  },
        { nombre: "Agua",       categoria: "BEBIDAS",   precioVenta: 10, precioCosto: 6,    stockActual: 12,  stockMinimo: 5  },
        { nombre: "Plumas",     categoria: "PAPELERIA", precioVenta: 5,  precioCosto: 2,    stockActual: 20,  stockMinimo: 10 },
        { nombre: "Hojas",      categoria: "PAPELERIA", precioVenta: 1,  precioCosto: 0.30, stockActual: 200, stockMinimo: 50 },
        { nombre: "Folder",     categoria: "PAPELERIA", precioVenta: 10, precioCosto: 5,    stockActual: 15,  stockMinimo: 5  },
      ],
    });
  }

  // Consolas Xbox
  for (let i = 1; i <= 4; i++) {
    await prisma.consola.upsert({
      where: { numero: i },
      update: {},
      create: { nombre: `Xbox ${i}`, numero: i },
    });
  }

  // Configuración Xbox — siempre actualiza a los precios actuales
  await prisma.configuracionXbox.deleteMany();
  await prisma.configuracionXbox.create({
    data: {
      precioPorHora: 20.0,
      precioPorMediaHora: 10.0,
      precioPorMinuto: 1.0,
      precioControlExtra: 5.0,
    },
  });

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
