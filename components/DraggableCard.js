import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PencilIcon, XMarkIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import MultiAttachmentPreview from './MultiAttachmentPreview';

export function DraggableCard({ 
  card, 
  columnId, 
  canEdit, 
  canDeleteCard, 
  setEditingCard, 
  deleteCard, 
  openCardModal 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      columnId,
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
      className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-pointer mb-3 ${
        canEdit ? 'hover:border-blue-300' : ''
      } ${isDragging ? 'z-50' : ''}`}
      onClick={() => openCardModal(card, columnId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openCardModal(card, columnId);
        }
      }}
      aria-label={`Card: ${card.title}. ${card.description ? `Description: ${card.description.substring(0, 100)}...` : ''} ${canEdit ? 'Press Enter to open or drag to move' : 'Press Enter to open'}`}
      {...(canEdit ? { ...attributes, ...listeners } : {})}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 text-sm">{card.title}</h4>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingCard(card.id);
              }}
              className="text-gray-400 hover:text-blue-500 p-1"
              title="Edit card"
              aria-label={`Edit ${card.title} card`}
            >
              <PencilIcon className="h-3 w-3" />
            </button>
          )}
          {canDeleteCard(card) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Are you sure you want to delete this card?')) {
                  deleteCard(columnId, card.id);
                }
              }}
              className="text-gray-400 hover:text-red-500 p-1"
              title="Delete card"
              aria-label={`Delete ${card.title} card`}
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {card.description && (
        <p className="text-gray-600 text-sm mb-3 whitespace-pre-wrap line-clamp-2">
          {card.description}
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{new Date(card.createdAt).toLocaleDateString()}</span>
        <div className="flex items-center gap-2">
          {card.attachments && card.attachments.length > 0 && (
            <div className="flex items-center gap-1 mb-1">
              <MultiAttachmentPreview attachments={card.attachments} position="right">
                <span className="text-xs text-blue-600" aria-label={`${card.attachments.length} attachments`}>
                  📎 {card.attachments.length}
                </span>
              </MultiAttachmentPreview>
            </div>
          )}
          {card.comments && card.comments.length > 0 && (
            <span className="flex items-center gap-1" aria-label={`${card.comments.length} comments`}>
              <ChatBubbleLeftIcon className="h-3 w-3" />
              {card.comments.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}