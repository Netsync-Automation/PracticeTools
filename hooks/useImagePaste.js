import { useCallback, useRef, useEffect } from 'react';

export const useImagePaste = (onImagePaste) => {
  const textareaRef = useRef(null);

  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await onImagePaste(file);
        }
        break;
      }
    }
  }, [onImagePaste]);

  const handleContextMenu = useCallback((e) => {
    // Context menu handling for contentEditable
  }, []);



  return {
    textareaRef,
    handlePaste,
    handleContextMenu
  };
};