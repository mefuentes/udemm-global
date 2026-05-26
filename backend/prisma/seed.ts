import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    { nombre: 'DOCENTE', descripcion: 'Rol de docente' },
    { nombre: 'ADMINISTRATIVO', descripcion: 'Rol administrativo' },
    { nombre: 'DIRECTOR_CARRERA', descripcion: 'Director de carrera' },
    { nombre: 'SECRETARIA_ACADEMICA', descripcion: 'Secretaría académica' },
    { nombre: 'ADMINISTRADOR_SISTEMA', descripcion: 'Administrador del sistema' }
  ];

  for (const rol of roles) {
    await prisma.rol.upsert({
      where: { nombre: rol.nombre },
      update: { descripcion: rol.descripcion },
      create: rol
    });
  }

  // Asegurar que el rol ADMINISTRADOR_SISTEMA exista y obtener su id
  const rolAdmin = await prisma.rol.findUnique({
    where: { nombre: 'ADMINISTRADOR_SISTEMA' }
  });

  if (!rolAdmin) {
    throw new Error('El rol ADMINISTRADOR_SISTEMA no se encontró al ejecutar seed.');
  }

  // Forzar actualización/creación del usuario administrador con contraseña conocida
  const contrasenaHash = await bcrypt.hash('Admin1234!', 10);

  await prisma.usuario.upsert({
    where: { correoElectronico: 'admin@udemm.edu.ar' },
    update: {
      nombre: 'Administrador',
      apellido: 'Sistema',
      contrasenaHash,
      activo: true,
      rolId: rolAdmin.id
    },
    create: {
      nombre: 'Administrador',
      apellido: 'Sistema',
      correoElectronico: 'admin@udemm.edu.ar',
      contrasenaHash,
      activo: true,
      rolId: rolAdmin.id
    }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
