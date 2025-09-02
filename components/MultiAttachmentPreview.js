import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AttachmentPreview from './AttachmentPreview';

export default function MultiAttachmentPreview({ attachments, children, position = 'right' }) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuTimeoutRef = useRef(null);
  const containerRef = useRef(null);
  
  useEffect(() => {
    return () => {
      if (menuTimeoutRef.current) {
        clearTimeout(menuTimeoutRef.current);
      }
    };
  }, []);

  const truncateFilename = (filename, maxLength = 25) => {
    if (filename.length <= maxLength) return filename;
    const ext = filename.split('.').pop();
    const name = filename.substring(0, filename.lastIndexOf('.'));
    const truncated = name.substring(0, maxLength - ext.length - 4) + '...';
    return `${truncated}.${ext}`;
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return '🖼️';
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'txt':
        return '📄';
      case 'zip':
        return '📦';
      default:
        return '📎';
    }
  };

  const handleMouseEnter = () => {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current);
      menuTimeoutRef.current = null;
    }
    
    // Calculate position for portal
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.top,
        left: position === 'right' ? rect.right + 8 : rect.left - 288
      });
    }
    
    setShowMenu(true);
  };

  const handleMouseLeave = () => {
    menuTimeoutRef.current = setTimeout(() => {
      setShowMenu(false);
    }, 100);
  };

  return (
    <div 
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {showMenu && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-[99999999] min-w-[320px]"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            zIndex: 99999999
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="text-xs font-medium text-gray-500 mb-2 px-1">
            {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
          </div>
          <div className="flex flex-col space-y-1">
            {attachments.map((attachment, index) => {
              console.log('[MultiAttachmentPreview] Rendering AttachmentPreview for:', attachment.filename, 'index:', index);
              return (
                <AttachmentPreview 
                  key={index} 
                  attachment={attachment} 
                  position="right"
                  view="menu"
                >
                <div 
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-sm">{getFileIcon(attachment.filename)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate" title={attachment.filename}>
                      {truncateFilename(attachment.filename)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(attachment.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <a
                    href={`/api/files/${attachment.path}`}
                    download={attachment.filename}
                    className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ↓
                  </a>
                </div>
                </AttachmentPreview>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}