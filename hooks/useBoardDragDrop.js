import { useState, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';

export function useBoardDragDrop(columns, setColumns, saveBoardData, canEdit) {
  const [dragState, setDragState] = useState({
    activeId: null,
    activeType: null,
    originalData: null
  });

  const handleDragStart = useCallback((event) => {
    if (!canEdit) return;
    
    const { active } = event;
    const activeType = active.data.current?.type;
    

    
    setDragState({
      activeId: active.id,
      activeType,
      originalData: columns // Store original state for rollback
    });
  }, [canEdit, columns]);

  const handleDragOver = useCallback((event) => {
    const { active, over } = event;
    if (!over || !canEdit) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;



    // Handle card movement between columns during drag over
    if (activeType === 'card' && overType === 'column') {
      const activeColumnId = active.data.current.columnId;
      const overColumnId = over.id;

      // Skip if same column
      if (activeColumnId === overColumnId) return;

      setColumns(prevColumns => {
        const activeColumn = prevColumns.find(col => col.id === activeColumnId);
        const overColumn = prevColumns.find(col => col.id === overColumnId);
        
        if (!activeColumn || !overColumn) return prevColumns;

        const activeCard = activeColumn.cards.find(card => card.id === active.id);
        if (!activeCard) return prevColumns;

        // Check if card is already in the target column to prevent duplicates
        const cardAlreadyInTarget = overColumn.cards.some(card => card.id === active.id);
        if (cardAlreadyInTarget) return prevColumns;

        return prevColumns.map(col => {
          if (col.id === activeColumnId) {
            return {
              ...col,
              cards: col.cards.filter(card => card.id !== active.id)
            };
          }
          if (col.id === overColumnId) {
            return {
              ...col,
              cards: [...col.cards, activeCard]
            };
          }
          return col;
        });
      });
    }
  }, [canEdit, setColumns]);

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    
    if (!over || !canEdit) {
      setDragState({ activeId: null, activeType: null, originalData: null });
      return;
    }

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    try {
      let newColumns = [...columns];

      // Handle column reordering
      if (activeType === 'column') {
        const oldIndex = columns.findIndex(col => col.id === active.id);
        let newIndex;
        
        if (overType === 'column') {
          newIndex = columns.findIndex(col => col.id === over.id);
        } else {
          newIndex = oldIndex;
        }
        
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          newColumns = arrayMove(columns, oldIndex, newIndex);
          setColumns(newColumns);
        }
      }
      
      // Handle card movement between columns
      else if (activeType === 'card' && overType === 'column') {
        const activeColumnId = active.data.current.columnId;
        const overColumnId = over.id;
        

        
        // Only process if moving to a different column
        if (activeColumnId !== overColumnId) {
          const activeColumn = newColumns.find(col => col.id === activeColumnId);
          const overColumn = newColumns.find(col => col.id === overColumnId);
          
          if (activeColumn && overColumn) {
            const activeCard = activeColumn.cards.find(card => card.id === active.id);
            // Ensure card exists and isn't already in target column
            if (activeCard && !overColumn.cards.find(card => card.id === active.id)) {
              newColumns = newColumns.map(col => {
                if (col.id === activeColumnId) {
                  return {
                    ...col,
                    cards: col.cards.filter(card => card.id !== active.id)
                  };
                }
                if (col.id === overColumnId) {
                  return {
                    ...col,
                    cards: [...col.cards, activeCard]
                  };
                }
                return col;
              });
              setColumns(newColumns);

            }
          }
        }
      }
      
      // Handle card reordering within same column or moving between columns via card collision
      else if (activeType === 'card' && overType === 'card') {
        const activeColumnId = active.data.current.columnId;
        const overColumnId = over.data.current.columnId;
        

        
        if (activeColumnId === overColumnId) {
          // Reordering within same column
          const columnIndex = newColumns.findIndex(col => col.id === activeColumnId);
          const column = newColumns[columnIndex];
          
          const oldIndex = column.cards.findIndex(card => card.id === active.id);
          const newIndex = column.cards.findIndex(card => card.id === over.id);
          
          if (oldIndex !== newIndex) {
            const reorderedCards = arrayMove(column.cards, oldIndex, newIndex);
            newColumns[columnIndex] = { ...column, cards: reorderedCards };
            setColumns(newColumns);
          }
        } else {
          // Moving between columns via card collision
          const activeColumn = newColumns.find(col => col.id === activeColumnId);
          const overColumn = newColumns.find(col => col.id === overColumnId);
          
          if (activeColumn && overColumn) {
            const activeCard = activeColumn.cards.find(card => card.id === active.id);
            const overCardIndex = overColumn.cards.findIndex(card => card.id === over.id);
            
            if (activeCard && overCardIndex !== -1) {
              newColumns = newColumns.map(col => {
                if (col.id === activeColumnId) {
                  return {
                    ...col,
                    cards: col.cards.filter(card => card.id !== active.id)
                  };
                }
                if (col.id === overColumnId) {
                  const newCards = [...col.cards];
                  newCards.splice(overCardIndex, 0, activeCard);
                  return {
                    ...col,
                    cards: newCards
                  };
                }
                return col;
              });
              setColumns(newColumns);

            }
          }
        }
      }

      // Save to server with error handling
      if (JSON.stringify(newColumns) !== JSON.stringify(dragState.originalData)) {
        try {
          await saveBoardData(newColumns);
        } catch (saveError) {
          console.error('Failed to save drag operation:', saveError);
          // Rollback to original state
          if (dragState.originalData) {
            setColumns(dragState.originalData);
          }
          throw saveError;
        }
      }
    } catch (error) {
      console.error('Failed to save drag operation:', error);
      // Rollback to original state
      if (dragState.originalData) {
        setColumns(dragState.originalData);
      }
      // Show user feedback
      alert('Failed to save changes. Please try again.');
    } finally {
      setDragState({ activeId: null, activeType: null, originalData: null });
    }
  }, [canEdit, columns, dragState.originalData, saveBoardData, setColumns]);

  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragEnd
  };
}