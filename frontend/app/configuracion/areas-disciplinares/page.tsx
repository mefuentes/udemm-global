'use client';

import { TablaMaestraView } from '../tablas-maestras/_components/TablaMaestraView';

export default function AreasDisciplinaresPage() {
  return (
    <TablaMaestraView
      tipo="areas-disciplinares"
      titulo="Áreas Disciplinares"
      descripcion="Administrá las áreas disciplinares disponibles para la clasificación de docentes."
    />
  );
}
