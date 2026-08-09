import { TablaMaestraView } from '../_components/TablaMaestraView';

export default function CargosPage() {
  return (
    <TablaMaestraView
      tipo="cargos"
      titulo="Cargos"
      descripcion="Cargos docentes disponibles: Titular, Asociado, Adjunto, JTP, Ayudantes y otros."
    />
  );
}
