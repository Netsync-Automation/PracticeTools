'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBoardDragDrop } from '../../hooks/useBoardDragDrop';
import SidebarLayout from '../../components/SidebarLayout';
import Navbar from '../../components/Navbar';
import Breadcrumb from '../../components/Breadcrumb';
import { DraggableColumn } from '../../components/DraggableColumn';
import { DraggableCard } from '../../components/DraggableCard';
import { DroppableArea } from '../../components/DroppableArea';
import { PlusIcon, XMarkIcon, EllipsisVerticalIcon, PencilIcon, TrashIcon, PaperClipIcon, ChatBubbleLeftIcon, DocumentIcon, PhotoIcon, CogIcon } from '@heroicons/react/24/outline';
import AttachmentPreview from '../../components/AttachmentPreview';
import MultiAttachmentPreview from '../../components/MultiAttachmentPreview';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  announcements,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

function FileDropZone({ onFilesSelected, files }) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const validTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/zip'
  ];

  const validateFiles = (fileList) => {
    const validFiles = Array.from(fileList).filter(file => {
      return file.size <= 5 * 1024 * 1024 && validTypes.includes(file.type);
    });
    return validFiles.slice(0, 5);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const validFiles = validateFiles(e.dataTransfer.files);
      onFilesSelected(validFiles);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const validFiles = validateFiles(e.target.files);
      const newFiles = [...files, ...validFiles].slice(0, 5);
      onFilesSelected(newFiles);
    }
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesSelected(newFiles);
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) {
      return <PhotoIcon className="h-5 w-5 text-blue-500" />;
    }
    return <DocumentIcon className="h-5 w-5 text-gray-500" />;
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <PaperClipIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleChange}
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.zip"
          className="hidden"
        />
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-blue-600 hover:text-blue-500 font-medium transition-all duration-150 hover:scale-105 active:scale-95"
          >
            Click to upload files
          </button>
          <span className="text-gray-500"> or drag and drop</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Max 5 files, 5MB each. Images, PDF, DOC, TXT, ZIP
        </p>
      </div>
      
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Selected files:</p>
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center space-x-3">
                {getFileIcon(file)}
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{Math.round(file.size / 1024)}KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-all duration-150 hover:scale-110 active:scale-95"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PracticeInformationPage() {
  const { user, loading, logout } = useAuth();
  const [columns, setColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewColumn, setShowNewColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [showNewCard, setShowNewCard] = useState({});
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDescription, setNewCardDescription] = useState('');
  const [editingCard, setEditingCard] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardComment, setCardComment] = useState('');
  const [cardFiles, setCardFiles] = useState([]);
  const [availableBoards, setAvailableBoards] = useState([]);
  const [currentPracticeId, setCurrentPracticeId] = useState('');
  const [currentBoardName, setCurrentBoardName] = useState('');
  const [currentBoardPractices, setCurrentBoardPractices] = useState([]);
  const [editingColumn, setEditingColumn] = useState(null);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [boardBackground, setBoardBackground] = useState('default');
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [currentTopic, setCurrentTopic] = useState('Main Topic');
  const [availableTopics, setAvailableTopics] = useState(['Main Topic']);

  // Topic preference management
  const getTopicPreferenceKey = (practiceId, userEmail) => {
    return `practice_topic_${practiceId}_${userEmail}`;
  };

  const saveTopicPreference = (practiceId, topic) => {
    if (user?.email && practiceId) {
      try {
        localStorage.setItem(getTopicPreferenceKey(practiceId, user.email), topic);
      } catch (error) {
        console.warn('Failed to save topic preference:', error);
      }
    }
  };

  const getTopicPreference = useCallback((practiceId) => {
    if (user?.email && practiceId) {
      try {
        return localStorage.getItem(getTopicPreferenceKey(practiceId, user.email));
      } catch (error) {
        console.warn('Failed to load topic preference:', error);
      }
    }
    return null;
  }, [user?.email]);
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [editingTopic, setEditingTopic] = useState(null);
  const inputRef = useRef(null);
  const backgroundInputRef = useRef(null);

  const predefinedBackgrounds = [
    { id: 'default', name: 'Default', style: { backgroundColor: '#f9fafb' } },
    { id: 'gradient1', name: 'Ocean Breeze', style: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } },
    { id: 'gradient2', name: 'Forest Dawn', style: { background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' } },
    { id: 'gradient3', name: 'Sunset Glow', style: { background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' } }
  ];

  const canEdit = user && (user.isAdmin || 
    (user.role === 'practice_manager' || user.role === 'practice_principal') && 
    currentBoardPractices.length > 0 && currentBoardPractices.some(practice => user.practices?.includes(practice)));
  
  const canComment = user && (user.isAdmin || 
    (currentBoardPractices.length > 0 && currentBoardPractices.some(practice => user.practices?.includes(practice))));

  useEffect(() => {
    if (user) {
      loadAvailableBoards();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (currentPracticeId) {
      loadBoardData();
    } else if (availableBoards.length === 0) {
      setIsLoading(false);
    }
  }, [currentPracticeId, currentTopic]);

  useEffect(() => {
    if (currentPracticeId) {
      const cleanup = setupSSE();
      return cleanup;
    }
  }, [currentPracticeId]);

  useEffect(() => {
    if (currentPracticeId) {
      loadBoardBackground();
    }
  }, [currentPracticeId]);





  const loadAvailableBoards = async () => {
    try {
      console.log('🔍 [FRONTEND] Starting loadAvailableBoards');
      const response = await fetch('/api/practice-boards/list');
      console.log('🔍 [FRONTEND] API response status:', response.status, response.statusText);
      const data = await response.json();
      console.log('🔍 [FRONTEND] API response data:', data);
      const boards = data.boards || [];
      console.log('🔍 [FRONTEND] Parsed boards:', boards);
      
      setAvailableBoards(boards);
      
      if (boards.length === 0) {
        setIsLoading(false);
      } else if (boards.length > 0 && !currentPracticeId) {
        let defaultBoard;
        
        if (user?.practices && user.practices.length > 0) {
          defaultBoard = boards.find(board => 
            board.practices?.some(practice => user.practices.includes(practice))
          );
        }
        
        if (!defaultBoard) {
          const sortedBoards = boards.sort((a, b) => 
            (a.practices?.[0] || '').localeCompare(b.practices?.[0] || '')
          );
          defaultBoard = sortedBoards[0];
        }
        
        if (defaultBoard) {
          setCurrentPracticeId(defaultBoard.practiceId);
          setCurrentBoardName(defaultBoard.practices?.join(', ') || '');
          setCurrentBoardPractices(defaultBoard.practices || []);
          
          // Load saved topic preference for the default board
          const savedTopic = getTopicPreference(defaultBoard.practiceId);
          if (savedTopic) {
            setCurrentTopic(savedTopic);
          }
        }
      }
    } catch (error) {
      console.error('🔍 [FRONTEND] Error loading available boards:', error);
    }
  };

  const setupSSE = useCallback(() => {
    if (!currentPracticeId) return;
    
    let eventSource;
    let reconnectTimer;
    let isConnected = false;
    
    const connectSSE = () => {
      eventSource = new EventSource(`/api/events?issueId=practice-board-${currentPracticeId}`);
      
      eventSource.onopen = () => {
        isConnected = true;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'board_updated') {
            setColumns(data.columns);
            setSelectedCard(prevCard => {
              if (prevCard) {
                const updatedCard = data.columns
                  .find(col => col.id === prevCard.columnId)
                  ?.cards.find(card => card.id === prevCard.id);
                return updatedCard ? { ...updatedCard, columnId: prevCard.columnId } : prevCard;
              }
              return prevCard;
            });
          }
        } catch (error) {
          console.error('SSE parsing error:', error);
        }
      };
      
      eventSource.onerror = () => {
        isConnected = false;
        if (eventSource.readyState === EventSource.CLOSED) {
          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              connectSSE();
            }, 2000);
          }
        }
      };
    };
    
    connectSSE();
    
    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [currentPracticeId]);

  const loadBoardBackground = useCallback(async () => {
    if (!currentPracticeId) {
      return;
    }
    
    const controller = new AbortController();
    
    try {
      const settingsResponse = await fetch(
        `/api/practice-boards/settings?practiceId=${currentPracticeId}`,
        { signal: controller.signal }
      );
      
      if (!settingsResponse.ok) {
        throw new Error(`HTTP ${settingsResponse.status}`);
      }
      
      const settingsData = await settingsResponse.json();
      const background = settingsData.settings?.background || 'default';
      
      setBoardBackground(prevBackground => {
        return prevBackground !== background ? background : prevBackground;
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading background:', error);
      }
    }
    
    return () => controller.abort();
  }, [currentPracticeId]);

  const loadBoardData = useCallback(async () => {
    if (!currentPracticeId) {
      setColumns([
        { id: '1', title: 'To Do', cards: [], createdBy: 'system', createdAt: new Date().toISOString() },
        { id: '2', title: 'In Progress', cards: [], createdBy: 'system', createdAt: new Date().toISOString() },
        { id: '3', title: 'Done', cards: [], createdBy: 'system', createdAt: new Date().toISOString() }
      ]);
      setIsLoading(false);
      return;
    }
    
    const controller = new AbortController();
    
    try {
      const [boardResponse, topicsResponse] = await Promise.all([
        fetch(
          `/api/practice-boards?practiceId=${currentPracticeId}&topic=${encodeURIComponent(currentTopic)}`,
          { signal: controller.signal }
        ),
        fetch(
          `/api/practice-boards/topics?practiceId=${currentPracticeId}`,
          { signal: controller.signal }
        )
      ]);
      
      if (!boardResponse.ok || !topicsResponse.ok) {
        throw new Error('Failed to fetch board data');
      }
      
      const [boardData, topicsData] = await Promise.all([
        boardResponse.json(),
        topicsResponse.json()
      ]);
      
      setColumns(boardData.columns || []);
      const topics = topicsData.topics || ['Main Topic'];
      setAvailableTopics(topics);
      
      // Load saved topic preference for this practice
      const savedTopic = getTopicPreference(currentPracticeId);
      if (savedTopic && topics.includes(savedTopic) && savedTopic !== currentTopic) {
        setCurrentTopic(savedTopic);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading board data:', error);
        setColumns([
          { id: '1', title: 'To Do', cards: [], createdBy: 'system', createdAt: new Date().toISOString() },
          { id: '2', title: 'In Progress', cards: [], createdBy: 'system', createdAt: new Date().toISOString() },
          { id: '3', title: 'Done', cards: [], createdBy: 'system', createdAt: new Date().toISOString() }
        ]);
        setAvailableTopics(['Main Topic']);
      }
    } finally {
      setIsLoading(false);
    }
    
    return () => controller.abort();
  }, [currentPracticeId, currentTopic, getTopicPreference]);

  const saveBoardData = async (newColumns) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch('/api/practice-boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: currentPracticeId, topic: currentTopic, columns: newColumns })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save board data');
      }
    } catch (error) {
      console.error('Error saving board data:', error);
      setSaveError('Failed to save changes. Please try again.');
      throw error; // Re-throw for hook to handle rollback
    } finally {
      setIsSaving(false);
    }
  };

  const addTopic = async () => {
    if (!newTopicName.trim()) return;
    if (availableTopics.includes(newTopicName.trim())) {
      alert('Topic already exists');
      return;
    }
    
    const topicName = newTopicName.trim();
    try {
      const response = await fetch('/api/practice-boards/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: currentPracticeId, topic: topicName })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableTopics(data.topics || [...availableTopics, topicName]);
        setCurrentTopic(topicName);
        saveTopicPreference(currentPracticeId, topicName);
        setNewTopicName('');
        setShowNewTopic(false);
      } else {
        const error = await response.json();
        alert('Failed to add topic: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding topic:', error);
      alert('Error adding topic');
    }
  };

  const updateTopicName = async (oldName, newName) => {
    if (!newName.trim() || newName === oldName) {
      setEditingTopic(null);
      return;
    }
    
    if (availableTopics.includes(newName.trim())) {
      alert('Topic name already exists');
      setEditingTopic(null);
      return;
    }
    
    try {
      const response = await fetch('/api/practice-boards/topics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: currentPracticeId, oldTopic: oldName, newTopic: newName.trim() })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableTopics(data.topics || availableTopics.map(topic => topic === oldName ? newName.trim() : topic));
        if (currentTopic === oldName) {
          const newTopicName = newName.trim();
          setCurrentTopic(newTopicName);
          saveTopicPreference(currentPracticeId, newTopicName);
        }
      } else {
        const error = await response.json();
        alert('Failed to update topic: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating topic name:', error);
      alert('Error updating topic name');
    }
    setEditingTopic(null);
  };

  const deleteTopic = async (topicName) => {
    if (topicName === 'Main Topic') {
      alert('Cannot delete Main Topic');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete the topic "${topicName}"? This will permanently delete all cards and columns in this topic.`)) {
      return;
    }
    
    try {
      const response = await fetch('/api/practice-boards/topics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: currentPracticeId, topic: topicName })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableTopics(data.topics || availableTopics.filter(topic => topic !== topicName));
        if (currentTopic === topicName) {
          setCurrentTopic('Main Topic');
          saveTopicPreference(currentPracticeId, 'Main Topic');
        }
      } else {
        const error = await response.json();
        alert('Failed to delete topic: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting topic:', error);
      alert('Error deleting topic');
    }
  };

  const saveBoardSettings = async (settings) => {
    try {
      console.log('🔧 [FRONTEND] Saving settings for practiceId:', currentPracticeId, 'settings:', settings);
      // Always save background settings at practice level (shared across all topics)
      const response = await fetch('/api/practice-boards/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId: currentPracticeId, settings })
      });
      const result = await response.json();
      console.log('🔧 [FRONTEND] Settings save result:', result);
      return result;
    } catch (error) {
      console.error('Error saving board settings:', error);
      throw error;
    }
  };

  const formatPracticeName = (practice) => {
    const practiceMap = {
      'audiovisual': 'Audio Visual',
      'collaboration': 'Collaboration', 
      'contactcenter': 'Contact Center',
      'iot': 'IoT',
      'physicalsecurity': 'Physical Security',
      'datacenter': 'Data Center'
    };
    return practiceMap[practice.toLowerCase()] || practice;
  };

  const formatBoardDisplayName = (board) => {
    if (board.practices && board.practices.length > 0) {
      return board.practices.map(practice => formatPracticeName(practice)).join(', ');
    }
    return board.practiceId || 'Unknown Board';
  };

  const getBackgroundStyle = () => {
    if (boardBackground === 'default') {
      return { backgroundColor: '#f9fafb' };
    }
    if (boardBackground && boardBackground.startsWith('url(')) {
      return { backgroundImage: boardBackground, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    const predefined = predefinedBackgrounds.find(bg => bg.id === boardBackground);
    return predefined ? predefined.style : { backgroundColor: '#f9fafb' };
  };

  const uploadCustomBackground = async (file) => {
    setUploadingBackground(true);
    setUploadSuccess(false);
    try {
      const formData = new FormData();
      formData.append('background', file);
      
      const response = await fetch('/api/files/upload-background', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        const customBg = `url(/api/files/${result.s3Key})`;
        await saveBoardSettings({ background: customBg });
        setBoardBackground(customBg);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        alert('Failed to upload background image');
      }
    } catch (error) {
      console.error('Error uploading background:', error);
      alert('Error uploading background image');
    } finally {
      setUploadingBackground(false);
    }
  };

  // All other functions remain the same...
  const addColumn = () => {
    if (newColumnTitle.trim()) {
      const newColumn = {
        id: Date.now().toString(),
        title: newColumnTitle.trim(),
        cards: [],
        createdBy: user?.email,
        createdAt: new Date().toISOString()
      };
      const newColumns = [...columns, newColumn];
      setColumns(newColumns);
      saveBoardData(newColumns);
      setNewColumnTitle('');
      setShowNewColumn(false);
    }
  };

  const deleteColumn = (columnId) => {
    if (window.confirm('Are you sure you want to delete this column and all its cards?')) {
      const newColumns = columns.filter(col => col.id !== columnId);
      setColumns(newColumns);
      saveBoardData(newColumns);
    }
  };

  const canDeleteColumn = (column) => {
    return user && (user.isAdmin || user.email === column.createdBy);
  };

  const updateColumnTitle = (columnId, newTitle) => {
    if (newTitle.trim()) {
      const newColumns = columns.map(col => 
        col.id === columnId ? { ...col, title: newTitle.trim() } : col
      );
      setColumns(newColumns);
      saveBoardData(newColumns);
    }
    setEditingColumn(null);
  };

  const canDeleteCard = (card) => {
    return user && (user.isAdmin || user.email === card.createdBy);
  };

  const addCard = (columnId) => {
    if (newCardTitle.trim()) {
      const newCard = {
        id: Date.now().toString(),
        title: newCardTitle.trim(),
        description: newCardDescription.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user?.email,
        comments: [],
        attachments: []
      };
      
      const newColumns = columns.map(col => 
        col.id === columnId 
          ? { ...col, cards: [...col.cards, newCard] }
          : col
      );
      
      setColumns(newColumns);
      saveBoardData(newColumns);
      setNewCardTitle('');
      setNewCardDescription('');
      setShowNewCard({});
    }
  };

  const deleteCard = (columnId, cardId) => {
    const newColumns = columns.map(col => 
      col.id === columnId 
        ? { ...col, cards: col.cards.filter(card => card.id !== cardId) }
        : col
    );
    setColumns(newColumns);
    saveBoardData(newColumns);
  };

  const updateCard = (columnId, cardId, updates) => {
    const newColumns = columns.map(col => 
      col.id === columnId 
        ? { 
            ...col, 
            cards: col.cards.map(card => 
              card.id === cardId ? { ...card, ...updates } : card
            )
          }
        : col
    );
    setColumns(newColumns);
    saveBoardData(newColumns);
    setEditingCard(null);
  };

  const addComment = (columnId, cardId) => {
    if (cardComment.trim()) {
      const comment = {
        id: Date.now().toString(),
        text: cardComment.trim(),
        author: user?.name || user?.email,
        createdAt: new Date().toISOString()
      };
      
      const newColumns = columns.map(col => 
        col.id === columnId 
          ? { 
              ...col, 
              cards: col.cards.map(card => 
                card.id === cardId 
                  ? { ...card, comments: [...(card.comments || []), comment] }
                  : card
              )
            }
          : col
      );
      
      setColumns(newColumns);
      saveBoardData(newColumns);
      
      setSelectedCard(prev => ({
        ...prev,
        comments: [...(prev.comments || []), comment]
      }));
      
      setCardComment('');
    }
  };

  const addAttachments = async (columnId, cardId, files) => {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('attachments', file);
      });
      
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        const attachments = result.attachments.map(att => ({
          id: att.id,
          filename: att.filename,
          size: att.size,
          path: att.s3Key,
          uploadedBy: user?.email,
          created_at: att.created_at
        }));
        
        const newColumns = columns.map(col => 
          col.id === columnId 
            ? { 
                ...col, 
                cards: col.cards.map(card => 
                  card.id === cardId 
                    ? { ...card, attachments: [...(card.attachments || []), ...attachments] }
                    : card
                )
              }
            : col
        );
        
        setColumns(newColumns);
        saveBoardData(newColumns);
        
        if (selectedCard && selectedCard.id === cardId) {
          setSelectedCard(prev => ({
            ...prev,
            attachments: [...(prev.attachments || []), ...attachments]
          }));
        }
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    }
    
    setCardFiles([]);
  };

  const removeAttachment = (columnId, cardId, attachmentId) => {
    const newColumns = columns.map(col => 
      col.id === columnId 
        ? { 
            ...col, 
            cards: col.cards.map(card => 
              card.id === cardId 
                ? { ...card, attachments: (card.attachments || []).filter(att => att.id !== attachmentId) }
                : card
            )
          }
        : col
    );
    
    setColumns(newColumns);
    saveBoardData(newColumns);
    
    if (selectedCard && selectedCard.id === cardId) {
      setSelectedCard(prev => ({
        ...prev,
        attachments: (prev.attachments || []).filter(att => att.id !== attachmentId)
      }));
    }
  };

  const openCardModal = (card, columnId) => {
    setSelectedCard({ ...card, columnId });
  };

  const closeCardModal = () => {
    setSelectedCard(null);
    setCardComment('');
    setCardFiles([]);
  };

  // Drag and drop setup
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { dragState, handleDragStart, handleDragOver, handleDragEnd } = useBoardDragDrop(
    columns,
    setColumns,
    saveBoardData,
    canEdit
  );

  // Accessibility announcements
  const dragAnnouncements = {
    onDragStart({ active }) {
      const activeType = active.data.current?.type;
      if (activeType === 'column') {
        const column = columns.find(col => col.id === active.id);
        return `Picked up column ${column?.title}`;
      } else if (activeType === 'card') {
        const columnId = active.data.current?.columnId;
        const column = columns.find(col => col.id === columnId);
        const card = column?.cards.find(card => card.id === active.id);
        return `Picked up card ${card?.title} from ${column?.title} column`;
      }
    },
    onDragOver({ active, over }) {
      if (!over) return;
      const activeType = active.data.current?.type;
      const overType = over.data.current?.type;
      
      if (activeType === 'column' && overType === 'column') {
        const overColumn = columns.find(col => col.id === over.id);
        return `Column moved over ${overColumn?.title}`;
      } else if (activeType === 'card' && overType === 'column') {
        const overColumn = columns.find(col => col.id === over.id);
        return `Card moved over ${overColumn?.title} column`;
      }
    },
    onDragEnd({ active, over }) {
      if (!over) return 'Item dropped';
      const activeType = active.data.current?.type;
      const overType = over.data.current?.type;
      
      if (activeType === 'column' && overType === 'column') {
        const overColumn = columns.find(col => col.id === over.id);
        return `Column dropped at ${overColumn?.title} position`;
      } else if (activeType === 'card') {
        const overColumn = columns.find(col => col.id === over.id || col.id === over.data.current?.columnId);
        return `Card dropped in ${overColumn?.title} column`;
      }
    },
  };

  if (loading || !user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const backgroundStyle = getBackgroundStyle();
  
  return (
    <div className="min-h-screen">
      <Navbar user={user} onLogout={logout} />
      
      <SidebarLayout user={user}>
        <div className="p-8">
          <Breadcrumb items={[{ label: 'Practice Information' }]} />
          
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Practice Information Board</h1>
                  <p className="text-gray-600 mt-2">Organize and track practice information using cards and columns</p>
                </div>
                {canEdit && availableBoards.length > 0 && (
                  <button
                    onClick={() => setShowBoardSettings(true)}
                    className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Board Settings"
                  >
                    <CogIcon className="h-6 w-6" />
                  </button>
                )}
              </div>
              {availableBoards.length > 0 && (
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Practice Board:</label>
                    <select
                      value={currentPracticeId}
                      onChange={(e) => {
                        if (e.target.value !== currentPracticeId) {
                          const selectedBoard = availableBoards.find(b => b.practiceId === e.target.value);
                          if (selectedBoard) {
                            setCurrentPracticeId(e.target.value);
                            setCurrentBoardName(selectedBoard.practices?.join(', ') || '');
                            setCurrentBoardPractices(selectedBoard.practices || []);
                            
                            // Load saved topic preference for the new practice board
                            const savedTopic = getTopicPreference(e.target.value);
                            setCurrentTopic(savedTopic || 'Main Topic');
                          }
                        }
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm min-w-64"
                    >
                      {availableBoards.map(board => (
                        <option key={board.practiceId} value={board.practiceId}>
                          {formatBoardDisplayName(board)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Topic:</label>
                    {editingTopic ? (
                      <input
                        type="text"
                        defaultValue={editingTopic}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm min-w-48"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateTopicName(editingTopic, e.target.value);
                          } else if (e.key === 'Escape') {
                            setEditingTopic(null);
                          }
                        }}
                        onBlur={(e) => updateTopicName(editingTopic, e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={currentTopic}
                          onChange={(e) => {
                            if (e.target.value !== currentTopic) {
                              const newTopic = e.target.value;
                              setCurrentTopic(newTopic);
                              saveTopicPreference(currentPracticeId, newTopic);
                            }
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm min-w-48"
                        >
                          {availableTopics.map(topic => (
                            <option key={topic} value={topic}>{topic}</option>
                          ))}
                        </select>
                        {canEdit && currentTopic !== 'Main Topic' && (
                          <button
                            onClick={() => setEditingTopic(currentTopic)}
                            className="text-gray-400 hover:text-blue-500 p-1 rounded"
                            title="Edit topic name"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => setShowNewTopic(true)}
                            className="text-gray-400 hover:text-green-500 p-1 rounded"
                            title="Add new topic"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                        )}
                        {canEdit && currentTopic !== 'Main Topic' && (
                          <button
                            onClick={() => deleteTopic(currentTopic)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded"
                            title="Delete topic"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {showNewTopic && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">New Topic Name:</label>
                <input
                  type="text"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm flex-1"
                  placeholder="Enter topic name..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTopic();
                    if (e.key === 'Escape') { setShowNewTopic(false); setNewTopicName(''); }
                  }}
                  autoFocus
                />
                <button
                  onClick={addTopic}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Add Topic
                </button>
                <button
                  onClick={() => { setShowNewTopic(false); setNewTopicName(''); }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div 
            className="min-h-96 p-6 rounded-lg"
            style={backgroundStyle}
            data-background={boardBackground}
          >
            {availableBoards.length === 0 && !isLoading && (
              <div className="text-center py-16">
                <div className="max-w-md mx-auto">
                  <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">No Practice Boards Exist</h3>
                  <p className="text-gray-600">
                    No practice boards have been created yet. Please speak to your system administrator to set up practice boards.
                  </p>
                </div>
              </div>
            )}

            {availableBoards.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                announcements={dragAnnouncements}
              >
                <div 
                  className="flex gap-6 overflow-x-auto pb-6"
                  role="application"
                  aria-label="Practice board with draggable columns and cards"
                >
                  <SortableContext items={columns.map(col => col.id)} strategy={horizontalListSortingStrategy}>
                    {columns.map((column) => (
                      <DraggableColumn
                        key={column.id}
                        column={column}
                        canEdit={canEdit}
                        canDeleteColumn={canDeleteColumn}
                        editingColumn={editingColumn}
                        setEditingColumn={setEditingColumn}
                        updateColumnTitle={updateColumnTitle}
                        deleteColumn={deleteColumn}
                      >
                        <DroppableArea 
                          id={column.id} 
                          items={column.cards.map(card => card.id)}
                          className="mb-4"
                        >
                          {column.cards.map((card) => (
                            <DraggableCard
                              key={card.id}
                              card={card}
                              columnId={column.id}
                              canEdit={canEdit}
                              canDeleteCard={canDeleteCard}
                              setEditingCard={setEditingCard}
                              deleteCard={deleteCard}
                              openCardModal={openCardModal}
                            />
                          ))}
                        </DroppableArea>

                        {canEdit && (
                          <div>
                            {showNewCard[column.id] ? (
                              <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
                                <input
                                  type="text"
                                  placeholder="Card title"
                                  value={newCardTitle}
                                  onChange={(e) => setNewCardTitle(e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded text-sm"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') addCard(column.id);
                                    if (e.key === 'Escape') setShowNewCard({});
                                  }}
                                  autoFocus
                                />
                                <textarea
                                  placeholder="Card description (optional)"
                                  value={newCardDescription}
                                  onChange={(e) => setNewCardDescription(e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded text-sm resize-none"
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => addCard(column.id)}
                                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                  >
                                    Add Card
                                  </button>
                                  <button
                                    onClick={() => setShowNewCard({})}
                                    className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowNewCard({ [column.id]: true })}
                                className="w-full p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
                              >
                                <PlusIcon className="h-4 w-4" />
                                Add a card
                              </button>
                            )}
                          </div>
                        )}
                      </DraggableColumn>
                    ))}
                  </SortableContext>

                {canEdit && (
                  <div className="min-w-80 max-w-80 flex-shrink-0">
                    {showNewColumn ? (
                      <div className="bg-gray-100 rounded-lg p-4">
                        <input
                          type="text"
                          placeholder="Column title"
                          value={newColumnTitle}
                          onChange={(e) => setNewColumnTitle(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded mb-3"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') addColumn();
                            if (e.key === 'Escape') setShowNewColumn(false);
                          }}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={addColumn}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Add Column
                          </button>
                          <button
                            onClick={() => setShowNewColumn(false)}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowNewColumn(true)}
                        className="w-full h-full min-h-32 bg-gray-200 hover:bg-gray-300 rounded-lg border-2 border-dashed border-gray-400 hover:border-gray-500 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-gray-700"
                      >
                        <PlusIcon className="h-5 w-5" />
                        Add another column
                      </button>
                    )}
                  </div>
                )}
                </div>
                
                <DragOverlay>
                  {dragState.activeId ? (
                    dragState.activeType === 'column' ? (
                      <div className="bg-gray-100 rounded-lg p-4 min-w-80 max-w-80 opacity-90 shadow-lg">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {columns.find(col => col.id === dragState.activeId)?.title}
                        </h3>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg p-4 shadow-lg border border-gray-200 opacity-90 min-w-64">
                        <h4 className="font-medium text-gray-900 text-sm">
                          {columns.flatMap(col => col.cards).find(card => card.id === dragState.activeId)?.title}
                        </h4>
                      </div>
                    )
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
          
          {/* Error notification */}
          {saveError && (
            <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50">
              <div className="flex items-center justify-between">
                <span>{saveError}</span>
                <button
                  onClick={() => setSaveError(null)}
                  className="ml-4 text-red-500 hover:text-red-700"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          
          {/* Saving indicator */}
          {isSaving && (
            <div className="fixed bottom-4 left-4 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded shadow-lg z-50">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Saving changes...
              </div>
            </div>
          )}
        </div>
      </SidebarLayout>
      
      {showBoardSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Board Settings</h2>
                <button
                  onClick={() => setShowBoardSettings(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Background</h3>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Choose a preset background:</label>
                  <div className="grid grid-cols-2 gap-3">
                    {predefinedBackgrounds.map(bg => (
                      <button
                        key={bg.id}
                        onClick={async () => {
                          try {
                            await saveBoardSettings({ background: bg.id });
                            setBoardBackground(bg.id);
                          } catch (error) {
                            console.error('Failed to save background:', error);
                          }
                        }}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          boardBackground === bg.id 
                            ? 'border-blue-500 ring-2 ring-blue-200' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="h-16 w-full rounded mb-2" style={bg.style}></div>
                        <p className="text-sm font-medium text-gray-900">{bg.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Upload custom background:</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      ref={backgroundInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert('File size must be less than 5MB');
                            return;
                          }
                          uploadCustomBackground(file);
                        }
                      }}
                      className="hidden"
                    />
                    <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <button
                      onClick={() => backgroundInputRef.current?.click()}
                      disabled={uploadingBackground}
                      className="text-blue-600 hover:text-blue-500 font-medium disabled:opacity-50"
                    >
                      {uploadingBackground ? 'Uploading...' : 'Choose Image'}
                    </button>
                    {uploadSuccess && (
                      <p className="text-sm text-green-600 mt-2 font-medium">
                        ✅ Background uploaded successfully!
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Supported: JPG, PNG, WebP • Max 5MB • Recommended: 1920x1080 or higher
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowBoardSettings(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <input
                    type="text"
                    value={selectedCard.title}
                    onChange={(e) => setSelectedCard({ ...selectedCard, title: e.target.value })}
                    className="text-xl font-semibold text-gray-900 bg-transparent border-none outline-none w-full"
                    onBlur={() => updateCard(selectedCard.columnId, selectedCard.id, { title: selectedCard.title })}
                  />
                </div>
                <button
                  onClick={closeCardModal}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={selectedCard.description}
                  onChange={(e) => setSelectedCard({ ...selectedCard, description: e.target.value })}
                  onBlur={() => updateCard(selectedCard.columnId, selectedCard.id, { description: selectedCard.description })}
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Add a description..."
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Attachments</label>
                
                {canComment && (
                  <div className="mb-4">
                    <FileDropZone onFilesSelected={setCardFiles} files={cardFiles} />
                    {cardFiles.length > 0 && (
                      <button
                        onClick={() => addAttachments(selectedCard.columnId, selectedCard.id, cardFiles)}
                        className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Upload {cardFiles.length} file{cardFiles.length > 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                )}
                
                {!canComment && (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600">
                      You can only add attachments to boards for practices you are assigned to.
                    </p>
                  </div>
                )}
                
                {selectedCard.attachments && selectedCard.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCard.attachments.map(attachment => (
                      <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center space-x-3">
                          {attachment.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <PhotoIcon className="h-5 w-5 text-blue-500" />
                          ) : (
                            <DocumentIcon className="h-5 w-5 text-gray-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{attachment.filename}</p>
                            <p className="text-xs text-gray-500">
                              {Math.round((attachment.size || 0) / 1024)}KB • {new Date(attachment.uploadedAt || attachment.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/files/${attachment.path}`}
                            download={attachment.filename}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Download
                          </a>
                          {canComment && (
                            <button
                              onClick={() => removeAttachment(selectedCard.columnId, selectedCard.id, attachment.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">No attachments</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Comments</label>
                
                {canComment && (
                  <div className="mb-4">
                    <div className="flex gap-3">
                      <textarea
                        value={cardComment}
                        onChange={(e) => setCardComment(e.target.value)}
                        className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={2}
                        placeholder="Add a comment..."
                      />
                      <button
                        onClick={() => addComment(selectedCard.columnId, selectedCard.id)}
                        disabled={!cardComment.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )}
                
                {!canComment && (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600">
                      You can only comment on boards for practices you are assigned to.
                    </p>
                  </div>
                )}

                {selectedCard.comments && selectedCard.comments.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedCard.comments.map(comment => (
                      <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">{comment.author}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">No comments yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}