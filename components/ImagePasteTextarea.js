import { useCallback, useRef, useEffect, useState } from 'react';
import { useImagePaste } from '../hooks/useImagePaste';

const ImagePasteTextarea = ({ 
  value, 
  onChange, 
  onBlur, 
  placeholder, 
  className, 
  rows = 8,
  autoFocus = false,
  disabled = false 
}) => {
  const editorRef = useRef(null);
  const containerRef = useRef(null);

  const uploadImage = async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/files/upload-image', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.imageUrl;
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    }
    return null;
  };

  const insertImageAtCursor = useCallback(async (file) => {
    const imageUrl = await uploadImage(file);
    if (!imageUrl) return;

    const selection = window.getSelection();
    let range;
    
    // Check if cursor is in the editor
    if (selection.rangeCount > 0 && editorRef.current.contains(selection.anchorNode)) {
      range = selection.getRangeAt(0);
    } else {
      // Insert at end if no cursor in editor
      range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
    }
    
    // Create image element
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = 'Uploaded image';
    img.style.cssText = 'max-width: 100%; height: auto; display: block; margin: 8px 0; border-radius: 4px;';
    
    // Insert image at cursor or end
    range.deleteContents();
    range.insertNode(img);
    
    // Move cursor after image
    range.setStartAfter(img);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Update value
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const { textareaRef, handlePaste, handleContextMenu } = useImagePaste(insertImageAtCursor);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback(async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          await insertImageAtCursor(file);
        }
      }
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [insertImageAtCursor]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle content changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Set initial content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  // Focus handling
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div ref={containerRef} className="relative">
      <div
        ref={(el) => {
          editorRef.current = el;
          textareaRef.current = el;
        }}
        contentEditable={!disabled}
        onInput={handleInput}
        onBlur={onBlur}
        onPaste={handlePaste}
        onContextMenu={handleContextMenu}
        className={`${className} prose prose-sm max-w-none`}
        style={{ 
          minHeight: `${rows * 1.5}rem`,
          padding: '12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          outline: 'none',
          backgroundColor: disabled ? '#f9fafb' : 'white'
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
      />
      
      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
          </svg>
          Paste images with Ctrl+V or upload below
        </div>
        
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={disabled || isUploading}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {isUploading ? 'Uploading...' : 'Upload Image'}
        </button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default ImagePasteTextarea;