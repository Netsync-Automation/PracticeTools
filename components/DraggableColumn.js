import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export function DraggableColumn({ 
  column, 
  canEdit, 
  canDeleteColumn, 
  editingColumn, 
  setEditingColumn, 
  updateColumnTitle, 
  deleteColumn, 
  children 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: 'column',
    },
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-100 rounded-lg p-4 min-w-80 max-w-80 flex-shrink-0 ${
        isDragging ? 'z-50' : ''
      }`}
      role="region"
      aria-label={`Column: ${column.title}`}
    >
      <div className="flex items-center justify-between mb-4">
        {editingColumn === column.id ? (
          <input
            type="text"
            defaultValue={column.title}
            className="font-semibold text-gray-900 text-lg bg-transparent border-b-2 border-blue-500 outline-none flex-1 mr-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateColumnTitle(column.id, e.target.value);
              } else if (e.key === 'Escape') {
                setEditingColumn(null);
              }
            }}
            onBlur={(e) => updateColumnTitle(column.id, e.target.value)}
            autoFocus
            aria-label="Edit column title"
          />
        ) : (
          <h3 
            className={`font-semibold text-gray-900 text-lg flex-1 ${
              canEdit ? 'cursor-pointer hover:text-blue-600' : ''
            }`}
            onClick={() => canEdit && setEditingColumn(column.id)}
            title={canEdit ? 'Click to edit column name' : ''}
            tabIndex={canEdit ? 0 : -1}
            onKeyDown={(e) => {
              if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setEditingColumn(column.id);
              }
            }}
            {...(canEdit ? { ...attributes, ...listeners } : {})}
            role="button"
            aria-label={`Column ${column.title}. ${canEdit ? 'Press Enter to edit or drag to reorder' : ''}`}
          >
            {column.title}
          </h3>
        )}
        <div className="flex items-center gap-2">
          <span 
            className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded-full"
            aria-label={`${column.cards.length} cards`}
          >
            {column.cards.length}
          </span>
          {canEdit && editingColumn !== column.id && (
            <button
              onClick={() => setEditingColumn(column.id)}
              className="text-gray-400 hover:text-blue-500 p-1 rounded"
              title="Edit column name"
              aria-label={`Edit ${column.title} column name`}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
          {canDeleteColumn(column) && (
            <button
              onClick={() => deleteColumn(column.id)}
              className="text-gray-400 hover:text-red-500 p-1 rounded"
              title="Delete column"
              aria-label={`Delete ${column.title} column`}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}