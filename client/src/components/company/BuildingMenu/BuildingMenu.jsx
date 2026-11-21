// Menú «···» de un edificio en «Mis edificios» (wireframe 12c), sobre ActionMenu.
// Opciones: «Editar edificio» (al formulario de EMP004), «Ver ficha pública» (solo si está publicado),
// «Despublicar» o «Publicar» según su estado y «Eliminar edificio» (separada y en rojo).
// Las acciones las decide la página: `onTogglePublish` y `onDelete` reciben el edificio.
import ActionMenu from '@/components/ui/ActionMenu/ActionMenu.jsx';

export default function BuildingMenu({ building, onTogglePublish, onDelete }) {
  const items = [
    { label: 'Editar edificio', to: `/company/buildings/${building.id}/edit` },
    ...(building.publicado
      ? [{ label: 'Ver ficha pública', to: `/buildings/${building.id}` }]
      : []),
    {
      label: building.publicado ? 'Despublicar' : 'Publicar',
      onSelect: () => onTogglePublish(building),
    },
    {
      label: 'Eliminar edificio',
      danger: true,
      separated: true,
      onSelect: () => onDelete(building),
    },
  ];

  return <ActionMenu label={`Acciones de ${building.nombre}`} items={items} />;
}
