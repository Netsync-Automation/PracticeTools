import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

export function DroppableArea({ id, children, items, className = "" }) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'column',
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'bg-blue-50 border-blue-300' : ''} transition-colors`}
      role="region"
      aria-label={`Drop zone for column ${id}`}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}