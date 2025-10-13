import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PencilIcon, XMarkIcon, ChatBubbleLeftIcon, CogIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import MultiAttachmentPreview from './MultiAttachmentPreview';
import CardSettingsModal from './CardSettingsModal';

export function DraggableCard({ 
  card, 
  columnId, 
  canEdit, 
  canDeleteCard, 
  setEditingCard, 
  deleteCard, 
  openCardModal,
  availableLabels = [],
  toggleCardFollowing,
  user,
  onUpdateCard,
  getHeaders
}) {
  const [showSettings, setShowSettings] = useState(false);
  
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

  const primaryLabel = card.labels && card.labels.length > 0 
    ? availableLabels.find(label => label.id === card.labels[0])
    : null;

  const labelNames = card.labels 
    ? card.labels.map(labelId => availableLabels.find(l => l.id === labelId)?.name).filter(Boolean).join(', ')
    : '';

  const cardHeaderStyle = {
    backgroundColor: card.settings?.backgroundColor || '#ffffff',
    backgroundImage: card.settings?.backgroundImage ? `url(${card.settings.backgroundImage})` : 'none',
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  };

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-lg shadow-sm border hover:shadow-md transition-all cursor-pointer mb-3 overflow-hidden ${
        canEdit ? 'hover:border-blue-300' : ''
      } ${isDragging ? 'z-50' : ''}`}
      style={{
        ...style,
        borderTop: primaryLabel ? `4px solid ${primaryLabel.color}` : '1px solid #e5e7eb',
        borderLeft: '1px solid #e5e7eb',
        borderRight: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb'
      }}
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
      {/* Image Header - Only show if card has custom settings */}
      {(card.settings?.backgroundColor || card.settings?.backgroundImage) && (
        <div 
          className="min-h-[60px] flex items-center"
          style={cardHeaderStyle}
        />
      )}
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-gray-100 min-h-[60px] flex items-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 flex-1">
            {primaryLabel && (
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: primaryLabel.color }}
                title={labelNames}
              />
            )}
            <h4 className="font-medium text-gray-900 text-sm flex-1">
              {card.title}
            </h4>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCardFollowing && toggleCardFollowing(columnId, card.id);
              }}
              className={`p-1 rounded transition-colors ${
                card.followers?.includes(user?.email)
                  ? 'text-blue-600 hover:text-blue-700'
                  : 'text-gray-400 hover:text-blue-500'
              }`}
              title={card.followers?.includes(user?.email) ? 'Unfollow card' : 'Follow card'}
            >
              <svg className="h-3 w-3" fill={card.followers?.includes(user?.email) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(true);
              }}
              className="p-1 rounded transition-colors text-gray-400 hover:text-gray-600"
              title="Card settings"
            >
              <CogIcon className="h-3 w-3" />
            </button>
            {canDeleteCard(card) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to delete this card?')) {
                    deleteCard(columnId, card.id);
                  }
                }}
                className="text-gray-400 hover:text-red-500 p-1 rounded"
                title="Delete card"
                aria-label={`Delete ${card.title} card`}
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Card Content */}
      <div className="p-4">
        {card.description && (
          <div 
            className="text-gray-600 text-sm mb-3 prose prose-sm max-w-none line-clamp-2"
            dangerouslySetInnerHTML={{ __html: card.description }}
          />
        )}
        {card.labels && card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {card.labels.map(labelId => {
              const label = availableLabels.find(l => l.id === labelId);
              return label ? (
                <span 
                  key={labelId} 
                  className="px-2 py-1 text-xs rounded-full text-white"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              ) : null;
            })}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex flex-col">
            <span>{new Date(card.createdAt).toLocaleDateString()} {new Date(card.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            <span className="text-gray-500">{card.lastEditedBy ? `Edited by ${card.lastEditedBy}` : `Created by ${card.createdBy}`}</span>
          </div>
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
      
      {/* Settings Modal */}
      <CardSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        card={card}
        onUpdateCard={onUpdateCard}
        getHeaders={getHeaders}
      />
    </div>
  );
}