import { useState } from 'react';
import { createPortal } from 'react-dom';

export default function AttachmentPreview({ attachment, children, position = 'left', view = 'detail' }) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [containerSize, setContainerSize] = useState(null);

  const isImage = (filename) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  };

  const isPdf = (filename) => {
    return /\.pdf$/i.test(filename);
  };

  const isText = (filename) => {
    return /\.(txt|md)$/i.test(filename);
  };

  const loadPreview = async () => {
    console.log('[AttachmentPreview] loadPreview called - loading:', loading, 'previewContent:', previewContent, 'filename:', attachment.filename);
    if (loading || previewContent) {
      console.log('[AttachmentPreview] Skipping load - already loading or content exists');
      return;
    }
    
    setLoading(true);
    try {
      console.log('[AttachmentPreview] Loading preview for:', attachment.filename);
      if (isImage(attachment.filename)) {
        console.log('Detected as image');
        setPreviewContent({
          type: 'image',
          url: `/api/files/${attachment.path}`
        });
      } else if (isPdf(attachment.filename)) {
        console.log('Detected as PDF');
        setPreviewContent({
          type: 'pdf',
          url: `/api/files/${attachment.path}`
        });
      } else if (isText(attachment.filename)) {
        console.log('Detected as text');
        const response = await fetch(`/api/files/${attachment.path}`);
        const text = await response.text();
        setPreviewContent({
          type: 'text',
          content: text.substring(0, 500) + (text.length > 500 ? '...' : '')
        });
      } else {
        console.log('Unsupported file type:', attachment.filename);
        setPreviewContent({
          type: 'unsupported',
          message: 'Preview not available for this file type'
        });
      }
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewContent({
        type: 'error',
        message: 'Failed to load preview'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = (e) => {
    console.log('[AttachmentPreview] Mouse enter - view:', view, 'filename:', attachment.filename);
    // Clear previous preview content to prevent stacking
    setPreviewContent(null);
    setLoading(false);
    setShowPreview(true);
    loadPreview();
    
    // Get container size for card view
    if (view === 'card') {
      const card = e.currentTarget.closest('.card');
      if (card) {
        const rect = card.getBoundingClientRect();
        setContainerSize({
          width: rect.width * 0.4, // 40% of container width
          height: rect.height * 0.6  // 60% of container height
        });
      }
    }
    
    // For menu view, get position of hovered element and menu container
    if (view === 'menu') {
      const hoveredItem = e.currentTarget;
      const menuContainer = hoveredItem.closest('div[class*="absolute bg-white"]');
      
      const hoveredRect = hoveredItem.getBoundingClientRect();
      const menuRect = menuContainer ? menuContainer.getBoundingClientRect() : hoveredRect;
      
      setContainerSize({
        top: menuRect.top,  // Top of the menu container (not hovered item)
        left: menuRect.right + 4  // Right of menu container + small padding
      });
      
      console.log('[AttachmentPreview] Menu container top:', menuRect.top, 'Menu container right:', menuRect.right, 'Final left:', menuRect.right + 4);
      e.stopPropagation();
    } else {
      // For non-menu views, get position of the hovered element
      const rect = e.currentTarget.getBoundingClientRect();
      setContainerSize({
        top: rect.top,
        left: rect.right + 8
      });
    }
  };

  const handleMouseLeave = (e) => {
    console.log('[AttachmentPreview] Mouse leave - view:', view, 'filename:', attachment.filename);
    setShowPreview(false);
    
    // For menu view, prevent event bubbling
    if (view === 'menu') {
      console.log('[AttachmentPreview] Menu view - stopping propagation on leave');
      e.stopPropagation();
    }
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {showPreview && view === 'menu' ? createPortal(
        <div 
          className="fixed bg-white border border-gray-300 rounded-lg shadow-xl p-2 z-[99999999]"
          style={{
            top: containerSize?.top || '0',
            left: containerSize?.left || '100%'
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8 px-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : previewContent ? (
            <div>
              {previewContent.type === 'image' && (
                <img 
                  src={previewContent.url} 
                  alt={attachment.filename}
                  className="object-contain rounded"
                  style={{ 
                    maxWidth: '1200px', 
                    maxHeight: '800px' 
                  }}
                />
              )}
              
              {previewContent.type === 'pdf' && (
                <div className="text-center py-16 px-24">
                  <div className="text-6xl mb-4">📄</div>
                  <div className="text-lg text-gray-600">PDF Document</div>
                </div>
              )}
              
              {previewContent.type === 'text' && (
                <div className="bg-gray-50 p-6 rounded text-sm font-mono overflow-y-auto" style={{ maxHeight: '320px', maxWidth: '640px' }}>
                  {previewContent.content}
                </div>
              )}
              
              {(previewContent.type === 'unsupported' || previewContent.type === 'error') && (
                <div className="text-center py-16 px-24 text-gray-500 text-lg">
                  {previewContent.message}
                </div>
              )}
            </div>
          ) : null}
        </div>,
        document.body
      ) : showPreview && createPortal(
        <div 
          className="fixed bg-white border border-gray-300 rounded-lg shadow-xl p-2 z-[99999999]"
          style={view === 'card' ? {
            top: '50%',
            right: '20%',
            transform: 'translateY(-50%)'
          } : view === 'detail' ? {
            top: '25%',
            left: '50%',
            transform: 'translateX(-50%)'
          } : view === 'comment' ? {
            top: '40%',
            left: '50%',
            transform: 'translateX(-50%)'
          } : {
            top: containerSize?.top || '0',
            left: containerSize?.left || '100%'
          }}>
          {loading ? (
            <div className="flex items-center justify-center py-8 px-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : previewContent ? (
            <div>
              {previewContent.type === 'image' && (
                <img 
                  src={previewContent.url} 
                  alt={attachment.filename}
                  className="object-contain rounded"
                  style={{ 
                    maxWidth: view === 'card' ? '400px' : view === 'comment' ? '213px' : '640px', 
                    maxHeight: view === 'card' ? '300px' : view === 'comment' ? '160px' : '480px' 
                  }}
                />
              )}
              
              {previewContent.type === 'pdf' && (
                <div className="text-center py-16 px-24">
                  <div className="text-6xl mb-4">📄</div>
                  <div className="text-lg text-gray-600">PDF Document</div>
                </div>
              )}
              
              {previewContent.type === 'text' && (
                <div className="bg-gray-50 p-6 rounded text-sm font-mono overflow-y-auto" style={{ maxHeight: '320px', maxWidth: '640px' }}>
                  {previewContent.content}
                </div>
              )}
              
              {(previewContent.type === 'unsupported' || previewContent.type === 'error') && (
                <div className="text-center py-16 px-24 text-gray-500 text-lg">
                  {previewContent.message}
                </div>
              )}
            </div>
          ) : null}
        </div>,
        document.body
      )}
    </div>
  );
}