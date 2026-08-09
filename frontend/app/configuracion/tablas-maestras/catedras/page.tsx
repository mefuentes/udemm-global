import { TablaMaestraView } from '../_components/TablaMaestraView';

export default function CatedrasPage() {
  return (
    <TablaMaestraView
      tipo="catedras"
      titulo="Cátedras"
      descripcion="Tipos de cátedra disponibles para asignar a los docentes en cada asignatura."
    />
  );
}
