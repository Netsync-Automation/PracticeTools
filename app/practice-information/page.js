'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useBoardDragDrop } from '../../hooks/useBoardDragDrop';
import { useCsrf } from '../../hooks/useCsrf';
import { sanitizeText } from '../../lib/sanitize';
import { linkifyText } from '../../lib/url-utils';
import { uploadFilesWithProgress } from '../../lib/upload-with-progress';
import FileUploadProgress from '../../components/FileUploadProgress';
import SidebarLayout from '../../components/SidebarLayout';
import Navbar from '../../components/Navbar';
import Breadcrumb from '../../components/Breadcrumb';
import { DraggableColumn } from '../../components/DraggableColumn';
import { DraggableCard } from '../../components/DraggableCard';
import { DroppableArea } from '../../components/DroppableArea';
import BoardSearch from '../../components/BoardSearch';
import { PlusIcon, XMarkIcon, EllipsisVerticalIcon, PencilIcon, TrashIcon, PaperClipIcon, ChatBubbleLeftIcon, DocumentIcon, PhotoIcon, CogIcon } from '@heroicons/react/24/outline';
import AttachmentPreview from '../../components/AttachmentPreview';
import MultiAttachmentPreview from '../../components/MultiAttachmentPreview';
import BoardSettingsModal from '../../components/BoardSettingsModal';
import LabelManagementModal from '../../components/LabelManagementModal';
import CardSettingsModal from '../../components/CardSettingsModal';
import DateTimePicker from '../../components/DateTimePicker';
import ImagePasteTextarea from '../../components/ImagePasteTextarea';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  announcements,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
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
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'application/zip'
  ];

  const validateFiles = (fileList) => {
    const validFiles = Array.from(fileList);
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
          Max 5 files. All file types supported.
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

function PracticeInformationPageContent() {
  const { user, loading, logout } = useAuth();
  const { getHeaders } = useCsrf();
  const searchParams = useSearchParams();
  const [columns, setColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewColumn, setShowNewColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [showNewCard, setShowNewCard] = useState({});
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDescription, setNewCardDescription] = useState('');
  const [editingCard, setEditingCard] = useState(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showProjectNumberModal, setShowProjectNumberModal] = useState(false);
  const [projectNumber, setProjectNumber] = useState('');
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardComment, setCardComment] = useState('');
  const [cardFiles, setCardFiles] = useState([]);
  const [commentFiles, setCommentFiles] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
  const [sseConnected, setSseConnected] = useState(false);
  const [availableLabels, setAvailableLabels] = useState([]);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3B82F6');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showDatesModal, setShowDatesModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempDueDate, setTempDueDate] = useState('');
  const [tempDueTime, setTempDueTime] = useState('');
  const [reminderOption, setReminderOption] = useState('');
  const [customReminderDate, setCustomReminderDate] = useState('');
  const [customReminderTime, setCustomReminderTime] = useState('');
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [checklistItems, setChecklistItems] = useState([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [editingChecklistIndex, setEditingChecklistIndex] = useState(null);
  const [checklistName, setChecklistName] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  const [showChecklistDropdown, setShowChecklistDropdown] = useState(false);
  const [selectedChecklistItem, setSelectedChecklistItem] = useState(null);
  const [columnsExpanded, setColumnsExpanded] = useState(true);
  const [individualColumnStates, setIndividualColumnStates] = useState({});
  const [highlightedItem, setHighlightedItem] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [previewType, setPreviewType] = useState('comment'); // 'comment' or 'attachment'
  const [showLabelManagementModal, setShowLabelManagementModal] = useState(false);
  const [showCardSettings, setShowCardSettings] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null);
  const [editLabelName, setEditLabelName] = useState('');
  const [editLabelColor, setEditLabelColor] = useState('');
  const [uploadProgress, setUploadProgress] = useState([]);

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

  const isAdminLevel = user && (user.isAdmin || user.role === 'executive');
  
  // DSR: Normalize practice names for comparison (case-insensitive, remove spaces)
  const normalizePractice = (practice) => practice?.toLowerCase().replace(/\s+/g, '');
  
  const userPracticesNormalized = user?.practices?.map(p => normalizePractice(p)) || [];
  const boardPracticesNormalized = currentBoardPractices.map(p => normalizePractice(p));
  
  const hasPracticeMatch = boardPracticesNormalized.some(boardPractice => 
    userPracticesNormalized.includes(boardPractice)
  );
  
  const canEdit = user && (isAdminLevel || 
    ((user.role === 'practice_manager' || user.role === 'practice_principal') && 
    currentBoardPractices.length > 0 && hasPracticeMatch));
  
  const canAddCards = user && (isAdminLevel || 
    ((user.role === 'practice_manager' || user.role === 'practice_principal' || user.role === 'practice_member') && 
    currentBoardPractices.length > 0 && hasPracticeMatch));
  
  const canComment = user && (isAdminLevel || 
    (user.role === 'practice_manager' && currentBoardPractices.length > 0) ||
    (user.role === 'practice_principal' && currentBoardPractices.length > 0 && hasPracticeMatch) ||
    (user.role === 'practice_member' && currentBoardPractices.length > 0 && hasPracticeMatch) ||
    (currentBoardPractices.length > 0 && hasPracticeMatch));

  useEffect(() => {
    if (user) {
      loadAvailableBoards();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Handle URL parameters for direct navigation from ChatNPT
  useEffect(() => {
    if (availableBoards.length > 0 && searchParams) {
      const urlBoardId = searchParams.get('boardId');
      const urlTopic = searchParams.get('topic');
      
      if (urlBoardId) {
        console.log('🎯 [URL NAVIGATION] Processing boardId:', {
          urlBoardId,
          urlTopic,
          availableBoards: availableBoards.map(b => ({ id: b.practiceId, practices: b.practices }))
        });
        
        // Find board by matching practices string
        const targetBoard = availableBoards.find(board => {
          const boardPracticesString = board.practices?.join('-') || '';
          return boardPracticesString === urlBoardId;
        });
        
        if (targetBoard && targetBoard.practiceId !== currentPracticeId) {
          console.log('🎯 [URL NAVIGATION] Setting board from URL:', {
            targetBoard,
            urlTopic
          });
          
          setCurrentPracticeId(targetBoard.practiceId);
          setCurrentBoardName(targetBoard.practices?.join(', ') || '');
          setCurrentBoardPractices(targetBoard.practices || []);
          
          const targetTopic = urlTopic || 'Main Topic';
          setCurrentTopic(targetTopic);
          saveTopicPreference(targetBoard.practiceId, targetTopic);
        } else {
          console.log('🎯 [URL NAVIGATION] No matching board found for:', urlBoardId);
        }
      }
    }
  }, [availableBoards, searchParams, currentPracticeId]);

  useEffect(() => {
    if (currentPracticeId) {
      loadBoardData();
      loadLabels();
      loadUsers();
      loadChecklistTemplates();
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

  // Fallback polling when SSE is not connected
  useEffect(() => {
    if (!currentPracticeId || sseConnected) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/practice-boards?practiceId=${currentPracticeId}&topic=${encodeURIComponent(currentTopic)}`);
        if (response.ok) {
          const data = await response.json();
          // Ensure all cards have required fields for proper functionality
          const normalizedColumns = (data.columns || []).map(column => ({
            ...column,
            cards: (column.cards || []).map(card => ({
              ...card,
              followers: card.followers || [],
              comments: card.comments || [],
              attachments: card.attachments || []
            }))
          }));
          
          if (JSON.stringify(normalizedColumns) !== JSON.stringify(columns)) {
            setColumns(normalizedColumns);
            setLastUpdate(Date.now());
          }
        }
      } catch (error) {
        // Silent polling error
      }
    }, 10000); // Poll every 10 seconds when SSE is disconnected
    
    return () => clearInterval(pollInterval);
  }, [currentPracticeId, currentTopic, sseConnected, columns]);

  useEffect(() => {
    if (currentPracticeId) {
      loadBoardBackground();
    }
  }, [currentPracticeId]);





  const loadAvailableBoards = async () => {
    try {
      console.log('ðŸ” [FRONTEND] Starting loadAvailableBoards');
      console.log('ðŸ” [FRONTEND] Current user:', {
        email: user?.email,
        name: user?.name,
        role: user?.role,
        practices: user?.practices,
        isAdmin: user?.isAdmin,
        auth_method: user?.auth_method,
        created_from: user?.created_from
      });
      
      const response = await fetch('/api/practice-boards/list');
      console.log('ðŸ” [FRONTEND] API response status:', response.status, response.statusText);
      const data = await response.json();
      console.log('ðŸ” [FRONTEND] API response data:', data);
      const boards = data.boards || [];
      console.log('ðŸ” [FRONTEND] Parsed boards:', boards);
      
      setAvailableBoards(boards);
      
      if (boards.length === 0) {
        console.log('ðŸ” [FRONTEND] No boards available, setting loading to false');
        setIsLoading(false);
      } else if (boards.length > 0 && !currentPracticeId) {
        // Check if URL parameters should override default selection
        const urlBoardId = searchParams?.get('boardId');
        
        if (urlBoardId) {
          console.log('🔍 [FRONTEND] URL will override default board selection');
          return;
        }
        console.log('ðŸ” [FRONTEND] Finding default board for user');
        let defaultBoard;
        
        if (user?.practices && user.practices.length > 0) {
          console.log('ðŸ” [FRONTEND] User has practices, looking for matching board:', user.practices);
          defaultBoard = boards.find(board => {
            const hasMatch = board.practices?.some(practice => user.practices.includes(practice));
            console.log('ðŸ” [FRONTEND] Checking board:', board.practiceId, 'practices:', board.practices, 'hasMatch:', hasMatch);
            return hasMatch;
          });
          console.log('ðŸ” [FRONTEND] Found matching board:', defaultBoard);
        }
        
        if (!defaultBoard) {
          console.log('ðŸ” [FRONTEND] No matching board found, using first board alphabetically');
          const sortedBoards = boards.sort((a, b) => 
            (a.practices?.[0] || '').localeCompare(b.practices?.[0] || '')
          );
          defaultBoard = sortedBoards[0];
          console.log('ðŸ” [FRONTEND] Selected first board:', defaultBoard);
        }
        
        if (defaultBoard) {
          console.log('ðŸ” [FRONTEND] Setting default board:', {
            practiceId: defaultBoard.practiceId,
            practices: defaultBoard.practices,
            boardName: defaultBoard.practices?.join(', ') || ''
          });
          setCurrentPracticeId(defaultBoard.practiceId);
          setCurrentBoardName(defaultBoard.practices?.join(', ') || '');
          setCurrentBoardPractices(defaultBoard.practices || []);
          
          // Load saved topic preference for the default board, or find most active topic
          const savedTopic = getTopicPreference(defaultBoard.practiceId);
          console.log('ðŸ” [FRONTEND] Saved topic preference:', savedTopic);
          if (savedTopic) {
            setCurrentTopic(savedTopic);
          } else {
            // If no saved preference, find the topic with most recent activity
            try {
              const topicsResponse = await fetch(`/api/practice-boards/topics?practiceId=${defaultBoard.practiceId}`);
              if (topicsResponse.ok) {
                const topicsData = await topicsResponse.json();
                const topics = topicsData.topics || ['Main Topic'];
                
                // Check each topic for recent activity and pick the most active one
                let mostActiveTopic = 'Main Topic';
                let latestActivity = 0;
                
                for (const topic of topics) {
                  try {
                    const boardResponse = await fetch(`/api/practice-boards?practiceId=${defaultBoard.practiceId}&topic=${encodeURIComponent(topic)}`);
                    if (boardResponse.ok) {
                      const boardData = await boardResponse.json();
                      const columns = boardData.columns || [];
                      
                      // Find the most recent activity in this topic
                      let topicLatestActivity = 0;
                      columns.forEach(column => {
                        column.cards?.forEach(card => {
                          const cardTime = new Date(card.lastEditedAt || card.createdAt).getTime();
                          if (cardTime > topicLatestActivity) {
                            topicLatestActivity = cardTime;
                          }
                        });
                      });
                      
                      if (topicLatestActivity > latestActivity) {
                        latestActivity = topicLatestActivity;
                        mostActiveTopic = topic;
                      }
                    }
                  } catch (error) {
                    console.warn('Error checking topic activity:', topic, error);
                  }
                }
                
                console.log('ðŸ” [FRONTEND] Most active topic:', mostActiveTopic, 'with activity at:', new Date(latestActivity));
                setCurrentTopic(mostActiveTopic);
                saveTopicPreference(defaultBoard.practiceId, mostActiveTopic);
              }
            } catch (error) {
              console.warn('Error finding most active topic, using Main Topic:', error);
              setCurrentTopic('Main Topic');
            }
          }
        }
      }
    } catch (error) {
      console.error('ðŸ” [FRONTEND] Error loading available boards:', error);
    }
  };

  const setupSSE = useCallback(() => {
    if (!currentPracticeId) return;
    
    let eventSource;
    let reconnectTimer;
    let isConnected = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    const connectSSE = () => {
      try {
        eventSource = new EventSource(`/api/events?issueId=practice-board-${currentPracticeId}`);
        
        eventSource.onopen = () => {
          isConnected = true;
          setSseConnected(true);
          reconnectAttempts = 0;
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }
        };
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'board_updated') {
              // Ensure all cards have required fields for proper functionality
              const normalizedColumns = (data.columns || []).map(column => ({
                ...column,
                cards: (column.cards || []).map(card => ({
                  ...card,
                  followers: card.followers || [],
                  comments: card.comments || [],
                  attachments: card.attachments || []
                }))
              }));
              
              setColumns(normalizedColumns);
              setSelectedCard(prevCard => {
                if (prevCard) {
                  const updatedCard = normalizedColumns
                    .find(col => col.id === prevCard.columnId)
                    ?.cards.find(card => card.id === prevCard.id);
                  return updatedCard ? { ...updatedCard, columnId: prevCard.columnId } : prevCard;
                }
                return prevCard;
              });
            } else if (data.type === 'topic_added') {
              setAvailableTopics(data.topics);
            } else if (data.type === 'topic_renamed') {
              setAvailableTopics(data.topics);
              if (currentTopic === data.oldTopic) {
                setCurrentTopic(data.newTopic);
                saveTopicPreference(currentPracticeId, data.newTopic);
              }
            } else if (data.type === 'topic_deleted') {
              setAvailableTopics(data.topics);
              if (currentTopic === data.deletedTopic) {
                setCurrentTopic('Main Topic');
                saveTopicPreference(currentPracticeId, 'Main Topic');
              }
            } else if (data.type === 'settings_updated') {
              if (data.settings?.background) {
                setBoardBackground(data.settings.background);
              }
            }
          } catch (error) {
            console.error('SSE parsing error:', error);
          }
        };
        
        eventSource.onerror = (error) => {
          isConnected = false;
          setSseConnected(false);
          if (eventSource.readyState === EventSource.CLOSED && reconnectAttempts < maxReconnectAttempts) {
            if (!reconnectTimer) {
              reconnectAttempts++;
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
              reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connectSSE();
              }, delay);
            }
          }
        };
      } catch (error) {
        console.error('SSE connection error:', error);
      }
    };
    
    connectSSE();
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      setSseConnected(false);
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
      
      // Ensure all cards have required fields for proper functionality
      const normalizedColumns = (boardData.columns || []).map(column => ({
        ...column,
        cards: (column.cards || []).map(card => ({
          ...card,
          followers: card.followers || [],
          comments: card.comments || [],
          attachments: card.attachments || []
        }))
      }));
      
      setColumns(normalizedColumns);
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
        headers: getHeaders(),
        body: JSON.stringify({ practiceId: currentPracticeId, topic: currentTopic, columns: newColumns })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save board data');
      }
      
      // Clear cache to ensure fresh data on next load
      try {
        const { clearCache } = await import('../../lib/cache');
        clearCache(`practice_board_${currentPracticeId}`);
      } catch (cacheError) {
        // Cache clearing is optional
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
        headers: getHeaders(),
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
        headers: getHeaders(),
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
        headers: getHeaders(),
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
      console.log('ðŸ”§ [FRONTEND] Saving settings for practiceId:', currentPracticeId, 'settings:', settings);
      // Always save background settings at practice level (shared across all topics)
      const response = await fetch('/api/practice-boards/settings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ practiceId: currentPracticeId, settings })
      });
      const result = await response.json();
      console.log('ðŸ”§ [FRONTEND] Settings save result:', result);
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
    const sanitizedTitle = sanitizeText(newColumnTitle);
    if (sanitizedTitle) {
      const newColumn = {
        id: Date.now().toString(),
        title: sanitizedTitle,
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
    return user && (isAdminLevel || user.email === column.createdBy);
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
    return user && (isAdminLevel || user.email === card.createdBy || 
      (user.role === 'practice_member' && user.email === card.createdBy));
  };

  const addCard = (columnId) => {
    const sanitizedTitle = sanitizeText(newCardTitle);
    const sanitizedDescription = sanitizeText(newCardDescription);
    if (sanitizedTitle) {
      const newCard = {
        id: Date.now().toString(),
        title: sanitizedTitle,
        description: sanitizedDescription,
        createdAt: new Date().toISOString(),
        createdBy: user?.email,
        comments: [],
        attachments: [],
        followers: []
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

  const updateCard = async (columnId, cardId, updates) => {
    // First, get the current card to preserve existing data
    const currentCard = columns.find(col => col.id === columnId)?.cards.find(card => card.id === cardId);
    
    // Track changes for notification
    const changes = {};
    if (currentCard) {
      Object.keys(updates).forEach(key => {
        if (key !== 'lastEditedBy' && key !== 'lastEditedAt' && key !== 'followers') {
          const oldValue = currentCard[key];
          const newValue = updates[key];
          
          // Only track if values are actually different
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changes[key] = { from: oldValue, to: newValue };
          }
        }
      });
    }
    
    const newColumns = columns.map(col => 
      col.id === columnId 
        ? { 
            ...col, 
            cards: col.cards.map(card => 
              card.id === cardId ? { 
                ...card, 
                ...updates, 
                followers: updates.followers !== undefined ? updates.followers : (card.followers || []), // Preserve existing followers unless explicitly updating
                lastEditedBy: user?.email, 
                lastEditedAt: new Date().toISOString() 
              } : card
            )
          }
        : col
    );
    setColumns(newColumns);
    saveBoardData(newColumns);
    setEditingCard(null);
    
    // Send notification only if there are actual changes
    if (Object.keys(changes).length > 0) {
      const updatedCard = newColumns.find(col => col.id === columnId)?.cards.find(card => card.id === cardId);
      try {
        const response = await fetch('/api/notifications/card-follow', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            cardId,
            columnId,
            practiceId: currentPracticeId,
            topic: currentTopic,
            action: 'updated',
            user,
            cardData: updatedCard,
            changes
          })
        });
        
        const result = await response.json();
        console.log('ðŸ”” [NOTIFICATION DEBUG] API response:', {
          status: response.status,
          ok: response.ok,
          result,
          changes
        });
      } catch (error) {
        console.error('ðŸ”” [NOTIFICATION DEBUG] Failed to send follow notifications:', error);
      }
    }
  };

  const addComment = async (columnId, cardId) => {
    const sanitizedComment = sanitizeText(cardComment);
    if (sanitizedComment || commentFiles.length > 0) {
      let attachments = [];
      
      // Upload comment attachments if any
      if (commentFiles.length > 0) {
        try {
          // Initialize progress tracking
          const initialProgress = commentFiles.map((file, index) => ({
            id: `comment-${Date.now()}-${index}`,
            filename: file.name,
            size: file.size,
            progress: 0,
            error: null
          }));
          setUploadProgress(initialProgress);

          // Upload with progress tracking
          const results = await uploadFilesWithProgress(
            commentFiles,
            (fileId, progress, filename) => {
              setUploadProgress(prev => 
                prev.map(item => 
                  item.filename === filename ? { ...item, progress } : item
                )
              );
            },
            (fileId, result) => {
              // File completed
            },
            (fileId, error) => {
              setUploadProgress(prev => 
                prev.map(item => 
                  item.id === fileId ? { ...item, error } : item
                )
              );
            }
          );

          // Process all successful uploads
          attachments = results.flatMap(result => 
            result.attachments.map(att => ({
              id: att.id,
              filename: att.filename,
              size: att.size,
              path: att.s3Key,
              uploadedBy: user?.email,
              created_at: att.created_at
            }))
          );

          // Clear progress after 2 seconds
          setTimeout(() => setUploadProgress([]), 2000);
        } catch (error) {
          console.error('Error uploading comment files:', error);
        }
      }
      
      const comment = {
        id: Date.now().toString(),
        text: sanitizedComment || '',
        author: user?.name || user?.email,
        createdAt: new Date().toISOString(),
        attachments: attachments
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
      
      // Send follow notifications - let API handle database lookup
      const updatedCard = newColumns.find(col => col.id === columnId)?.cards.find(card => card.id === cardId);
      try {
        await fetch('/api/notifications/card-follow', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            cardId,
            columnId,
            practiceId: currentPracticeId,
            topic: currentTopic,
            action: 'commented',
            user,
            cardData: updatedCard,
            changes: { comment: { from: null, to: sanitizedComment || 'Added attachment(s)' } }
          })
        });
      } catch (error) {
        console.error('Failed to send follow notifications:', error);
      }
      
      setCardComment('');
      setCommentFiles([]);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/practice-boards/users');
      if (response.ok) {
        const data = await response.json();
        const users = data.users || [];
        
        // Sort users: current practice users first, then others
        const sortedUsers = users.sort((a, b) => {
          const aPractices = typeof a.practices === 'string' ? JSON.parse(a.practices || '[]') : (Array.isArray(a.practices) ? a.practices : []);
          const bPractices = typeof b.practices === 'string' ? JSON.parse(b.practices || '[]') : (Array.isArray(b.practices) ? b.practices : []);
          const aPracticeMatch = aPractices.some(practice => currentBoardPractices.includes(practice));
          const bPracticeMatch = bPractices.some(practice => currentBoardPractices.includes(practice));
          
          if (aPracticeMatch && !bPracticeMatch) return -1;
          if (!aPracticeMatch && bPracticeMatch) return 1;
          return (a.name || a.email).localeCompare(b.name || b.email);
        });
        
        setAvailableUsers(sortedUsers);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const toggleUserAssignment = async (userEmail) => {
    if (selectedChecklistItem) {
      // Handle checklist item assignment
      const { checklistIndex, itemIndex } = selectedChecklistItem;
      const currentItem = selectedCard.checklists[checklistIndex].items[itemIndex];
      const currentAssigned = currentItem.assignedTo || [];
      const isAssigned = currentAssigned.includes(userEmail);
      
      const newAssigned = isAssigned
        ? currentAssigned.filter(email => email !== userEmail)
        : [...currentAssigned, userEmail];
      
      const newChecklists = [...selectedCard.checklists];
      newChecklists[checklistIndex].items[itemIndex] = {
        ...currentItem,
        assignedTo: newAssigned
      };
      
      updateCard(selectedCard.columnId, selectedCard.id, { checklists: newChecklists });
      setSelectedCard(prev => ({ ...prev, checklists: newChecklists }));
    } else {
      // Handle card-level assignment
      const currentAssigned = selectedCard.assignedTo || [];
      const isAssigned = currentAssigned.includes(userEmail);
      
      const newAssigned = isAssigned
        ? currentAssigned.filter(email => email !== userEmail)
        : [...currentAssigned, userEmail];
      
      // Track assignment changes for notification
      const changes = {
        assignedTo: {
          from: currentAssigned,
          to: newAssigned
        }
      };
      
      const newColumns = columns.map(col => 
        col.id === selectedCard.columnId 
          ? { 
              ...col, 
              cards: col.cards.map(card => 
                card.id === selectedCard.id 
                  ? { ...card, assignedTo: newAssigned, lastEditedBy: user?.email, lastEditedAt: new Date().toISOString() }
                  : card
              )
            }
          : col
      );
      
      setColumns(newColumns);
      saveBoardData(newColumns);
      setSelectedCard(prev => ({ ...prev, assignedTo: newAssigned }));
      
      // Send notification for assignment change
      const updatedCard = newColumns.find(col => col.id === selectedCard.columnId)?.cards.find(card => card.id === selectedCard.id);
      try {
        await fetch('/api/notifications/card-follow', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            cardId: selectedCard.id,
            columnId: selectedCard.columnId,
            practiceId: currentPracticeId,
            topic: currentTopic,
            action: 'updated',
            user,
            cardData: updatedCard,
            changes
          })
        });
      } catch (error) {
        console.error('Failed to send assignment notification:', error);
      }
    }
  };

  const loadLabels = async () => {
    if (!currentPracticeId) return;
    try {
      const response = await fetch(`/api/practice-boards/labels?practiceId=${currentPracticeId}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableLabels(data.labels || []);
      }
    } catch (error) {
      console.error('Error loading labels:', error);
    }
  };

  const loadChecklistTemplates = useCallback(async () => {
    if (!currentPracticeId) return;
    try {
      const response = await fetch(`/api/practice-boards/checklist-templates?practiceId=${currentPracticeId}`);
      if (response.ok) {
        const data = await response.json();
        setChecklistTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error loading checklist templates:', error);
    }
  }, [currentPracticeId]);

  const addLabel = async () => {
    if (!newLabelName.trim()) return;
    try {
      const response = await fetch('/api/practice-boards/labels', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          practiceId: currentPracticeId, 
          name: newLabelName.trim(), 
          color: newLabelColor 
        })
      });
      if (response.ok) {
        const data = await response.json();
        const newLabel = data.labels[data.labels.length - 1];
        setAvailableLabels(data.labels);
        
        // Auto-apply the new label to the current card
        if (selectedCard && newLabel) {
          toggleCardLabel(selectedCard.columnId, selectedCard.id, newLabel.id);
        }
        
        setNewLabelName('');
        setNewLabelColor('#3B82F6');
        setShowNewLabel(false);
      }
    } catch (error) {
      console.error('Error adding label:', error);
    }
  };

  const updateLabel = async (labelId) => {
    if (!editLabelName.trim()) return;
    try {
      const response = await fetch('/api/practice-boards/labels', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ 
          practiceId: currentPracticeId, 
          labelId: labelId,
          name: editLabelName.trim(), 
          color: editLabelColor 
        })
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableLabels(data.labels);
        setEditingLabel(null);
      }
    } catch (error) {
      console.error('Error updating label:', error);
    }
  };

  const toggleCardFollowing = async (columnId, cardId) => {
    console.log('ðŸ”„ [FOLLOW DEBUG] toggleCardFollowing called', {
      columnId,
      cardId,
      userEmail: user?.email,
      timestamp: new Date().toISOString()
    });
    
    if (!user?.email) {
      console.error('ðŸ”„ [FOLLOW DEBUG] No user email available');
      return;
    }
    
    try {
      // Use industry standard API endpoint approach
      const practiceId = currentPracticeId;
      const response = await fetch(`/api/practice-boards/cards/${cardId}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          practiceId, 
          columnId 
        })
      });
      
      console.log('ðŸ”„ [FOLLOW DEBUG] API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('ðŸ”„ [FOLLOW DEBUG] API response data:', data);
        
        // Update local state to reflect the new follow status
        const newColumns = columns.map(col => 
          col.id === columnId 
            ? { 
                ...col, 
                cards: col.cards.map(card => 
                  card.id === cardId 
                    ? { 
                        ...card, 
                        followers: data.following
                          ? [...(card.followers || []).filter(email => email !== user?.email), user?.email]
                          : (card.followers || []).filter(email => email !== user?.email),
                        lastEditedBy: user?.email,
                        lastEditedAt: new Date().toISOString()
                      }
                    : card
                )
              }
            : col
        );
        
        setColumns(newColumns);
        
        // Update selected card if it's the one being followed
        if (selectedCard && selectedCard.id === cardId) {
          const updatedFollowers = data.following
            ? [...(selectedCard.followers || []).filter(email => email !== user?.email), user?.email]
            : (selectedCard.followers || []).filter(email => email !== user?.email);
          
          console.log('ðŸ”„ [FOLLOW DEBUG] Updating selected card', {
            updatedFollowers,
            following: data.following
          });
          
          setSelectedCard(prev => ({
            ...prev,
            followers: updatedFollowers,
            lastEditedBy: user?.email,
            lastEditedAt: new Date().toISOString()
          }));
        }
        
        console.log('ðŸ”„ [FOLLOW DEBUG] toggleCardFollowing completed successfully');
      } else {
        console.error('ðŸ”„ [FOLLOW DEBUG] API request failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('ðŸ”„ [FOLLOW DEBUG] Error in toggleCardFollowing:', error);
    }
  };

  const toggleCardLabel = async (columnId, cardId, labelId) => {
    const newColumns = columns.map(col => 
      col.id === columnId 
        ? { 
            ...col, 
            cards: col.cards.map(card => 
              card.id === cardId 
                ? { 
                    ...card, 
                    labels: card.labels?.includes(labelId) 
                      ? [] // Remove label if already selected
                      : [labelId], // Replace with single label
                    lastEditedBy: user?.email,
                    lastEditedAt: new Date().toISOString()
                  }
                : card
            )
          }
        : col
    );
    setColumns(newColumns);
    saveBoardData(newColumns);
    
    if (selectedCard && selectedCard.id === cardId) {
      const updatedLabels = selectedCard.labels?.includes(labelId) 
        ? []
        : [labelId];
      setSelectedCard(prev => ({
        ...prev,
        labels: updatedLabels,
        lastEditedBy: user?.email,
        lastEditedAt: new Date().toISOString()
      }));
      
      // Send notification for label change
      const changes = {
        labels: {
          from: selectedCard.labels || [],
          to: updatedLabels
        }
      };
      
      const updatedCard = newColumns.find(col => col.id === columnId)?.cards.find(card => card.id === cardId);
      try {
        await fetch('/api/notifications/card-follow', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            cardId,
            columnId,
            practiceId: currentPracticeId,
            topic: currentTopic,
            action: 'labeled',
            user,
            cardData: updatedCard,
            changes
          })
        });
      } catch (error) {
        console.error('Failed to send label notification:', error);
      }
    }
  };

  const addAttachments = async (columnId, cardId, files) => {
    try {
      // Initialize progress tracking for each file
      const initialProgress = files.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        filename: file.name,
        size: file.size,
        progress: 0,
        error: null
      }));
      setUploadProgress(initialProgress);

      // Upload with progress tracking
      const results = await uploadFilesWithProgress(
        files,
        (fileId, progress, filename) => {
          setUploadProgress(prev => 
            prev.map(item => 
              item.filename === filename ? { ...item, progress } : item
            )
          );
        },
        (fileId, result) => {
          // File completed
        },
        (fileId, error) => {
          setUploadProgress(prev => 
            prev.map(item => 
              item.id === fileId ? { ...item, error } : item
            )
          );
        }
      );

      // Process all successful uploads
      const allAttachments = results.flatMap(result => 
        result.attachments.map(att => ({
          id: att.id,
          filename: att.filename,
          size: att.size,
          path: att.s3Key,
          uploadedBy: user?.email,
          created_at: att.created_at
        }))
      );

      const newColumns = columns.map(col => 
        col.id === columnId 
          ? { 
              ...col, 
              cards: col.cards.map(card => 
                card.id === cardId 
                  ? { ...card, attachments: [...(card.attachments || []), ...allAttachments] }
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
          attachments: [...(prev.attachments || []), ...allAttachments]
        }));
      }

      // Clear progress after 2 seconds
      setTimeout(() => setUploadProgress([]), 2000);
    } catch (error) {
      console.error('Error uploading files:', error);
      // Keep progress visible to show error
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
    setSelectedCard({ 
      ...card, 
      columnId,
      followers: card.followers || [], // Ensure followers is always an array
      comments: card.comments || [],
      attachments: card.attachments || []
    });
  };

  const closeCardModal = () => {
    setSelectedCard(null);
    setCardComment('');
    setCardFiles([]);
    setCommentFiles([]);
    setShowEmojiPicker(false);
    setShowLabelDropdown(false);
    setShowNewLabel(false);
    setShowAssignModal(false);
    setUserSearchTerm('');
    setShowUserDropdown(false);
    setShowDatesModal(false);
    setTempStartDate('');
    setTempDueDate('');
    setTempDueTime('');
    setReminderOption('');
    setCustomReminderDate('');
    setCustomReminderTime('');
    setShowChecklistModal(false);
    setChecklistItems([]);
    setNewChecklistItem('');
    setEditingChecklistIndex(null);
    setChecklistName('');
    setSaveAsTemplate(false);
    setShowChecklistDropdown(false);
    setSelectedChecklistItem(null);
    setEditingDescription(false);
    setEditingTitle(false);
    setShowAddMenu(false);
    setShowProjectNumberModal(false);
    setProjectNumber('');
    setShowProjectMenu(false);
    setShowCardSettings(false);
  };

  // Handle search result navigation
  const handleSearchResultClick = (result) => {
    if (result.type === 'column') {
      // Highlight column and scroll to it
      setHighlightedItem({ type: 'column', id: result.id });
      setTimeout(() => setHighlightedItem(null), 5000);
      
      const columnElement = document.querySelector(`[data-column-id="${result.id}"]`);
      if (columnElement) {
        columnElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (result.type === 'card') {
      // Open card modal
      const column = columns.find(col => col.id === result.columnId);
      const card = column?.cards.find(c => c.id === result.id);
      if (card) {
        openCardModal(card, result.columnId);
      }
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showLabelDropdown && !event.target.closest('.label-dropdown')) {
        setShowLabelDropdown(false);
      }
      if (showUserDropdown && !event.target.closest('.user-search-dropdown')) {
        setShowUserDropdown(false);
      }
      if (showChecklistDropdown && !event.target.closest('.checklist-dropdown')) {
        setShowChecklistDropdown(false);
      }
      if (showAddMenu && !event.target.closest('.relative')) {
        setShowAddMenu(false);
      }
      if (showProjectMenu && !event.target.closest('.relative')) {
        setShowProjectMenu(false);
      }
      if (showEmojiPicker && !event.target.closest('.relative')) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLabelDropdown, showUserDropdown, showChecklistDropdown, showAddMenu, showProjectMenu, showEmojiPicker]);

  // Drag and drop setup
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
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

  // Custom collision detection that filters based on drag type
  const customCollisionDetection = useCallback((args) => {
    const { active, droppableContainers } = args;
    const activeType = active.data.current?.type;
    
    // For column dragging, only allow collision with other columns
    if (activeType === 'column') {
      const columnCollisions = droppableContainers.filter(container => 
        container.data.current?.type === 'column'
      );
      return closestCenter({
        ...args,
        droppableContainers: columnCollisions
      });
    }
    
    // For card dragging, allow collision with both cards and columns
    return closestCenter(args);
  }, []);

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
            {/* Main Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 shadow-sm">
              <div className="flex items-center justify-between">
                {/* Left: Title & Description */}
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900">Practice Information Board</h1>
                  <p className="text-sm text-gray-600 mt-1">Organize and track practice information using cards and columns</p>
                </div>
                
                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                  {canEdit && availableBoards.length > 0 && (isAdminLevel || user.role !== 'practice_member') && (
                    <button
                      onClick={() => setShowBoardSettings(true)}
                      className="p-3 text-gray-500 hover:text-blue-600 hover:bg-white rounded-xl border border-transparent hover:border-blue-200 transition-all duration-200 shadow-sm hover:shadow-md"
                      title="Board Settings"
                    >
                      <CogIcon className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/debug/user-analysis?email=${encodeURIComponent(user?.email || '')}`);
                        const analysis = await response.json();
                        console.log('ðŸ” [DEBUG] User Analysis:', analysis);
                        
                        // Calculate current board permissions (matching actual UI logic)
                        const currentBoardPermissions = {
                          canEdit: user && (user.isAdmin || 
                            ((user.role === 'practice_manager' || user.role === 'practice_principal') && 
                            currentBoardPractices.length > 0 && currentBoardPractices.some(practice => user.practices?.includes(practice)))),
                          canAddTopics: user && (user.isAdmin || 
                            ((user.role === 'practice_manager' || user.role === 'practice_principal') && 
                            currentBoardPractices.length > 0 && currentBoardPractices.some(practice => user.practices?.includes(practice)))),
                          canComment: user && (user.isAdmin || 
                            (currentBoardPractices.length > 0 && currentBoardPractices.some(practice => user.practices?.includes(practice))))
                        };
                        
                        let message = `DEBUG ANALYSIS\n\n`;
                        message += `User: ${analysis.user.name} (${analysis.user.email})\n`;
                        message += `Role: ${analysis.user.role}\n`;
                        message += `Practices: ${analysis.user.practices.join(', ')}\n`;
                        message += `Auth Method: ${analysis.user.auth_method}\n\n`;
                        
                        message += `CURRENT BOARD CONTEXT:\n`;
                        message += `- Current Board ID: ${currentPracticeId}\n`;
                        message += `- Current Board Name: ${currentBoardName}\n`;
                        message += `- Current Board Practices: [${currentBoardPractices.join(', ')}]\n`;
                        message += `- Current Topic: ${currentTopic}\n\n`;
                        
                        message += `CURRENT BOARD PERMISSIONS (UI Logic):\n`;
                        message += `- Can Edit Board: ${currentBoardPermissions.canEdit}\n`;
                        message += `- Can Add Topics: ${currentBoardPermissions.canAddTopics} (matches add topic button visibility)\n`;
                        message += `- Can Comment: ${currentBoardPermissions.canComment}\n\n`;
                        
                        message += `BOARD ANALYSIS:\n`;
                        message += `- Total Boards: ${analysis.summary.totalBoards}\n`;
                        message += `- Editable Boards: ${analysis.summary.editableBoards}\n\n`;
                        
                        message += `USER PRACTICE OVERLAP:\n`;
                        const userPractices = analysis.user.practices || [];
                        const hasOverlap = currentBoardPractices.some(practice => userPractices.includes(practice));
                        message += `- User Practices: [${userPractices.join(', ')}]\n`;
                        message += `- Board Practices: [${currentBoardPractices.join(', ')}]\n`;
                        message += `- Has Practice Overlap: ${hasOverlap}\n\n`;
                        
                        message += `Board ID Generation:\n`;
                        message += `- Input: [${analysis.debugging.boardIdGeneration.input.join(', ')}]\n`;
                        message += `- Result: "${analysis.debugging.boardIdGeneration.cleaned}"\n\n`;
                        
                        message += `All Available Boards:\n`;
                        analysis.practiceBoards.all.forEach(board => {
                          const isCurrent = board.id === currentPracticeId;
                          message += `${isCurrent ? 'â†’ ' : '  '}${board.id}: [${board.practices.join(', ')}]${isCurrent ? ' (CURRENT)' : ''}\n`;
                        });
                        
                        alert(message);
                      } catch (error) {
                        console.error('Debug analysis failed:', error);
                        alert('Debug analysis failed. Check console for details.');
                      }
                    }}
                    className="p-3 text-gray-500 hover:text-blue-600 hover:bg-white rounded-xl border border-transparent hover:border-blue-200 transition-all duration-200 shadow-sm hover:shadow-md"
                    title="Debug User Analysis"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            

            
            {/* Controls Bar */}
            {availableBoards.length > 0 && (
              <div className="mt-6 bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between gap-6">
                  {/* Left: Board & Topic Selectors */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold text-gray-700 min-w-fit">Practice Board</label>
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
                        className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm font-medium min-w-64 shadow-sm"
                      >
                        {availableBoards.map(board => (
                          <option key={board.practiceId} value={board.practiceId}>
                            {formatBoardDisplayName(board)}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold text-gray-700 min-w-fit">
                        Topic
                        {availableTopics.length > 1 && (
                          <span className="ml-1 text-xs text-blue-600">({availableTopics.length} available)</span>
                        )}
                      </label>
                      {editingTopic ? (
                        <input
                          type="text"
                          defaultValue={editingTopic}
                          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm font-medium min-w-48 shadow-sm"
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
                            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm font-medium min-w-48 shadow-sm"
                          >
                            {availableTopics.map(topic => (
                              <option key={topic} value={topic}>{topic}</option>
                            ))}
                          </select>
                          {canEdit && currentTopic !== 'Main Topic' && (isAdminLevel || user.role !== 'practice_member') && (
                            <button
                              onClick={() => setEditingTopic(currentTopic)}
                              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all duration-200"
                              title="Edit topic name"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          )}
                          {canEdit && (isAdminLevel || user.role !== 'practice_member') && (
                            <button
                              onClick={() => setShowNewTopic(true)}
                              className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all duration-200"
                              title="Add new topic"
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                          )}
                          {canEdit && currentTopic !== 'Main Topic' && (isAdminLevel || user.role !== 'practice_member') && (
                            <button
                              onClick={() => deleteTopic(currentTopic)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                              title="Delete topic"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Right: Collapse/Expand Button */}
                  {columns.length > 0 && (
                    <button
                      onClick={() => {
                        const newState = !columnsExpanded;
                        setColumnsExpanded(newState);
                        // Reset individual states when using global control
                        setIndividualColumnStates({});
                      }}
                      className="flex items-center gap-3 px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md min-w-fit"
                      title={columnsExpanded ? 'Collapse all columns' : 'Expand all columns'}
                    >
                      {columnsExpanded ? (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                          Collapse All
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                          Expand All
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Search Bar */}
            {availableBoards.length > 0 && columns.length > 0 && (
              <div className="mt-4">
                <BoardSearch 
                  columns={columns} 
                  onResultClick={handleSearchResultClick}
                />
              </div>
            )}
          </div>

          {showNewTopic && (isAdminLevel || user.role !== 'practice_member') && (
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
                collisionDetection={customCollisionDetection}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                announcements={dragAnnouncements}
              >
                <div 
                  className="flex flex-wrap gap-6 pb-6"
                  role="application"
                  aria-label="Practice board with draggable columns and cards"
                >
                  <SortableContext items={columns.map(col => col.id)} strategy={horizontalListSortingStrategy}>
                    {columns.map((column) => {
                      const isColumnExpanded = individualColumnStates[column.id] !== undefined 
                        ? individualColumnStates[column.id] 
                        : columnsExpanded;
                      

                      
                      return (
                        <DraggableColumn
                          key={column.id}
                          column={column}
                          canEdit={canEdit}
                          canDeleteColumn={canDeleteColumn}
                          editingColumn={editingColumn}
                          setEditingColumn={setEditingColumn}
                          updateColumnTitle={updateColumnTitle}
                          deleteColumn={deleteColumn}
                          isHighlighted={highlightedItem?.type === 'column' && highlightedItem?.id === column.id}
                          isExpanded={isColumnExpanded}
                          extraHeaderButton={
                            <button
                              onClick={() => {
                                setIndividualColumnStates(prev => ({
                                  ...prev,
                                  [column.id]: !isColumnExpanded
                                }));
                              }}
                              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition-colors"
                              title={isColumnExpanded ? 'Collapse column' : 'Expand column'}
                            >
                              {isColumnExpanded ? (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                              )}
                            </button>
                          }
                        >
                          {isColumnExpanded && (
                            <>
                              <DroppableArea 
                                id={column.id} 
                                items={column.cards.map(card => card.id)}
                                className="mb-4"
                              >
                                <div 
                                  className="space-y-3"
                                  style={{
                                    maxHeight: column.cards.length > 3 ? '400px' : 'auto',
                                    overflowY: column.cards.length > 3 ? 'auto' : 'visible'
                                  }}
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
                                      availableLabels={availableLabels}
                                      toggleCardFollowing={toggleCardFollowing}
                                      user={user}
                                      onUpdateCard={(updatedCard) => updateCard(column.id, card.id, updatedCard)}
                                      getHeaders={getHeaders}
                                    />
                                  ))}
                                </div>
                              </DroppableArea>

                              {canAddCards && (
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
                            </>
                          )}
                        </DraggableColumn>
                      );
                    })}
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
                      <div className="bg-gray-100 rounded-lg p-4 w-80 opacity-90 shadow-lg">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {columns.find(col => col.id === dragState.activeId)?.title}
                        </h3>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg p-4 shadow-lg border border-gray-200 opacity-90 w-64">
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
        <BoardSettingsModal 
          onClose={() => setShowBoardSettings(false)}
          currentPracticeId={currentPracticeId}
          boardBackground={boardBackground}
          setBoardBackground={setBoardBackground}
          predefinedBackgrounds={predefinedBackgrounds}
          uploadCustomBackground={uploadCustomBackground}
          uploadingBackground={uploadingBackground}
          uploadSuccess={uploadSuccess}
          backgroundInputRef={backgroundInputRef}
          saveBoardSettings={saveBoardSettings}
          checklistTemplates={checklistTemplates}
          loadChecklistTemplates={loadChecklistTemplates}
          getHeaders={getHeaders}
        />
      )}

      {showLabelManagementModal && (
        <LabelManagementModal
          isOpen={showLabelManagementModal}
          onClose={() => setShowLabelManagementModal(false)}
          currentPracticeId={currentPracticeId}
          availableLabels={availableLabels}
          onLabelsUpdated={setAvailableLabels}
          getHeaders={getHeaders}
        />
      )}

      {selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[85vw] max-w-7xl max-h-[95vh] overflow-hidden">
            {/* Image Header - Only show if card has custom settings */}
            {(selectedCard.settings?.backgroundColor || selectedCard.settings?.backgroundImage) && (
              <div 
                className="min-h-[80px] flex items-center"
                style={{
                  backgroundColor: selectedCard.settings?.backgroundColor || '#ffffff',
                  backgroundImage: selectedCard.settings?.backgroundImage ? `url(${selectedCard.settings.backgroundImage})` : 'none',
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              />
            )}
            {/* Header */}
            <div 
              className="px-8 py-6 border-b border-gray-200 min-h-[80px] flex items-center"
              style={{
                borderTop: (() => {
                  const primaryLabel = selectedCard.labels && selectedCard.labels.length > 0 
                    ? availableLabels.find(label => label.id === selectedCard.labels[0])
                    : null;
                  return primaryLabel ? `4px solid ${primaryLabel.color}` : '4px solid #e2e8f0';
                })()
              }}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex-1 mr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-blue-600">
                      {columns.find(col => col.id === selectedCard.columnId)?.title || 'Unknown Column'}
                    </span>
                    {(() => {
                      const primaryLabel = selectedCard.labels && selectedCard.labels.length > 0 
                        ? availableLabels.find(label => label.id === selectedCard.labels[0])
                        : null;
                      const labelNames = selectedCard.labels 
                        ? selectedCard.labels.map(labelId => availableLabels.find(l => l.id === labelId)?.name).filter(Boolean).join(', ')
                        : '';
                      return primaryLabel ? (
                        <div className="flex items-center gap-1">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: primaryLabel.color }}
                          />
                          <span className="text-xs text-gray-600" title={labelNames}>
                            {labelNames}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  {editingTitle ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={selectedCard.title}
                        onChange={(e) => setSelectedCard({ ...selectedCard, title: e.target.value })}
                        className="text-2xl font-bold text-gray-900 border-2 border-blue-500 rounded-lg px-3 py-1 w-full placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        onBlur={() => {
                          updateCard(selectedCard.columnId, selectedCard.id, { title: selectedCard.title });
                          setEditingTitle(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateCard(selectedCard.columnId, selectedCard.id, { title: selectedCard.title });
                            setEditingTitle(false);
                          }
                          if (e.key === 'Escape') {
                            setEditingTitle(false);
                          }
                        }}
                        placeholder="Card title..."
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-gray-900 flex-1">{selectedCard.title}</h2>
                      {canComment && (
                        <button
                          onClick={() => setEditingTitle(true)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          title="Rename card"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>Created {new Date(selectedCard.createdAt).toLocaleDateString()} at {new Date(selectedCard.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span>•</span>
                    <span>By {selectedCard.createdBy}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (canComment) {
                        await toggleCardFollowing(selectedCard.columnId, selectedCard.id);
                      }
                    }}
                    disabled={!canComment}
                    className={`p-2 rounded-full transition-all duration-200 ${
                      selectedCard.followers?.includes(user?.email)
                        ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                        : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                    } ${!canComment ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    title={selectedCard.followers?.includes(user?.email) ? 'Unfollow card' : 'Follow card'}
                  >
                    <svg className="h-5 w-5" fill={selectedCard.followers?.includes(user?.email) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowCardSettings(true)}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-2 rounded-full transition-all duration-200"
                    title="Card settings"
                  >
                    <CogIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={closeCardModal}
                    className="text-gray-400 hover:text-gray-600 hover:bg-white hover:shadow-md p-2 rounded-full transition-all duration-200"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(95vh-140px)]">
              <div className="p-8">
                {/* Two Column Layout */}
                <div className="grid grid-cols-5 gap-8 h-full">
                  {/* Left Column - 60% (3/5) */}
                  <div className="col-span-3 space-y-6">
                    {/* Description */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <label className="block text-lg font-semibold text-gray-800">Description</label>
                      </div>
                      <div className="space-y-4">
                        {editingDescription ? (
                          <div className="space-y-3">
                            <ImagePasteTextarea
                              value={selectedCard.description || ''}
                              onChange={(value) => setSelectedCard({ ...selectedCard, description: value })}
                              className="w-full p-4 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base leading-relaxed shadow-sm transition-all duration-200"
                              rows={8}
                              placeholder="Add a detailed description..."
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const linkedDescription = linkifyText(selectedCard.description);
                                  updateCard(selectedCard.columnId, selectedCard.id, { description: linkedDescription });
                                  setSelectedCard(prev => ({ ...prev, description: linkedDescription }));
                                  setEditingDescription(false);
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingDescription(false)}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {selectedCard.projectUrl && (
                              <div className="mb-4 relative group">
                                <div className="flex items-center gap-2">
                                  <a
                                    href={selectedCard.projectUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M7 7l10 10M17 7v4" />
                                    </svg>
                                    View Project
                                  </a>
                                  {canComment && (
                                    <div className="relative">
                                      <button
                                        onClick={() => setShowProjectMenu(!showProjectMenu)}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                                        title="Project options"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                      </button>
                                      {showProjectMenu && (
                                        <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-10 overflow-hidden">
                                          <div className="p-1">
                                            <button
                                              onClick={() => {
                                                setProjectNumber(selectedCard.projectUrl.match(/jobNo=([^&]+)/)?.[1] || '');
                                                setShowProjectNumberModal(true);
                                                setShowProjectMenu(false);
                                              }}
                                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
                                            >
                                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                              </svg>
                                              Edit Project
                                            </button>
                                            <button
                                              onClick={() => {
                                                if (window.confirm('Remove project link from this card?')) {
                                                  updateCard(selectedCard.columnId, selectedCard.id, { projectUrl: null });
                                                  setSelectedCard(prev => ({ ...prev, projectUrl: null }));
                                                }
                                                setShowProjectMenu(false);
                                              }}
                                              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                              Remove Project
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="w-full p-4 border border-gray-200 rounded-xl bg-gray-50 text-base leading-relaxed min-h-32">
                              {selectedCard.description ? (
                                <div 
                                  className="text-gray-900 prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ __html: selectedCard.description }}
                                  style={{
                                    wordBreak: 'break-word'
                                  }}
                                />
                              ) : (
                                <span className="text-gray-500 italic">No description provided</span>
                              )}
                            </div>
                            {canComment && (
                              <div className="flex justify-between items-center">
                                <button
                                  onClick={() => setEditingDescription(true)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                >
                                  Edit
                                </button>
                                <div className="relative">
                                  <button
                                    onClick={() => setShowAddMenu(!showAddMenu)}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                                  >
                                    <PlusIcon className="h-4 w-4" />
                                    Add
                                  </button>
                                  {showAddMenu && (
                                    <div className="absolute right-0 bottom-full mb-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-10 overflow-hidden">
                                      <div className="p-2">
                                        <button
                                          onClick={() => {
                                            setShowProjectNumberModal(true);
                                            setShowAddMenu(false);
                                          }}
                                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all duration-200 group"
                                        >
                                          <div className="w-8 h-8 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center transition-colors">
                                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                          </div>
                                          <div className="text-left">
                                            <div className="font-semibold">Project Number</div>
                                            <div className="text-xs text-gray-500">Link to Savant project</div>
                                          </div>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Interactive Checklists */}
                        {selectedCard.checklists && selectedCard.checklists.length > 0 && (
                          <div className="space-y-4">
                            {selectedCard.checklists.map((checklist, checklistIndex) => (
                              <div key={checklistIndex} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-md font-semibold text-gray-800">{checklist.name || 'Checklist'}</h4>
                                  {canComment && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          setEditingChecklistIndex(checklistIndex);
                                          setChecklistItems(checklist.items.map(item => item.text));
                                          setChecklistName(checklist.name || 'Checklist');
                                          setNewChecklistItem('');
                                          setShowChecklistModal(true);
                                        }}
                                        className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-100 transition-colors"
                                        title="Edit checklist"
                                      >
                                        <PencilIcon className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          const newChecklists = selectedCard.checklists.filter((_, i) => i !== checklistIndex);
                                          updateCard(selectedCard.columnId, selectedCard.id, { checklists: newChecklists });
                                          setSelectedCard(prev => ({ ...prev, checklists: newChecklists }));
                                        }}
                                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100 transition-colors"
                                        title="Remove checklist"
                                      >
                                        <XMarkIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {checklist.items.map((item, itemIndex) => (
                                    <div key={itemIndex} className="group bg-white rounded-lg border hover:shadow-sm transition-all">
                                      <div className="flex items-center gap-3 p-3">
                                        <input
                                          type="checkbox"
                                          checked={item.completed || false}
                                          onChange={(e) => {
                                            if (canComment) {
                                              const newChecklists = [...selectedCard.checklists];
                                              newChecklists[checklistIndex].items[itemIndex].completed = e.target.checked;
                                              updateCard(selectedCard.columnId, selectedCard.id, { checklists: newChecklists });
                                              setSelectedCard(prev => ({ ...prev, checklists: newChecklists }));
                                            }
                                          }}
                                          disabled={!canComment}
                                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer disabled:cursor-not-allowed"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <span className={`block text-sm transition-all ${
                                            item.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                                          }`}>
                                            {item.text}
                                          </span>
                                          {(item.assignedTo?.length > 0 || item.dueDate) && (
                                            <div className="flex items-center gap-3 mt-1 text-xs">
                                              {item.assignedTo?.length > 0 && (
                                                <div className="flex items-center gap-1">
                                                  <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                  </svg>
                                                  <span className="text-blue-600">{item.assignedTo.length} assigned</span>
                                                </div>
                                              )}
                                              {item.dueDate && (
                                                <div className="flex items-center gap-1">
                                                  <svg className="w-3 h-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                  </svg>
                                                  <span className={`${
                                                    new Date(item.dueDate) < new Date() ? 'text-red-600' : 'text-orange-600'
                                                  }`}>
                                                    Due {new Date(item.dueDate).toLocaleDateString()}
                                                    {item.dueTime && ` at ${item.dueTime}`}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        {canComment && (
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                              onClick={() => {
                                                // Open assign users modal for this checklist item
                                                setShowAssignModal(true);
                                                setSelectedChecklistItem({ checklistIndex, itemIndex });
                                              }}
                                              className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
                                              title="Assign users"
                                            >
                                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                              </svg>
                                            </button>
                                            <button
                                              onClick={() => {
                                                // Open dates modal for this checklist item
                                                setSelectedChecklistItem({ checklistIndex, itemIndex });
                                                setTempDueDate(item.dueDate || '');
                                                setTempDueTime(item.dueTime || '');
                                                setReminderOption('');
                                                setCustomReminderDate('');
                                                setCustomReminderTime('');
                                                setShowDatesModal(true);
                                              }}
                                              className="text-orange-500 hover:text-orange-700 p-1 rounded hover:bg-orange-50 transition-colors"
                                              title="Set due date"
                                            >
                                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                              </svg>
                                            </button>
                                            <button
                                              onClick={() => {
                                                const newChecklists = [...selectedCard.checklists];
                                                newChecklists[checklistIndex].items = newChecklists[checklistIndex].items.filter((_, i) => i !== itemIndex);
                                                updateCard(selectedCard.columnId, selectedCard.id, { checklists: newChecklists });
                                                setSelectedCard(prev => ({ ...prev, checklists: newChecklists }));
                                              }}
                                              className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                              title="Remove item"
                                            >
                                              <XMarkIcon className="h-3 w-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                                  {checklist.items.filter(item => item.completed).length} of {checklist.items.length} completed
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Control Row */}
                    <div className="grid grid-cols-4 gap-4">
                      {/* Labels Control */}
                      <div className="relative label-dropdown">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
                      <div className="relative">
                        <button
                          onClick={() => canComment && setShowLabelDropdown(!showLabelDropdown)}
                          disabled={!canComment}
                          className={`w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                            !canComment ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {(() => {
                              const currentLabel = selectedCard.labels?.[0] 
                                ? availableLabels.find(l => l.id === selectedCard.labels[0])
                                : null;
                              return currentLabel ? (
                                <>
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: currentLabel.color }}
                                  />
                                  <span className="text-gray-900">{currentLabel.name}</span>
                                </>
                              ) : (
                                <span className="text-gray-500">Select a label...</span>
                              );
                            })()}
                          </div>
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {showLabelDropdown && canComment && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-1">
                              {selectedCard.labels?.[0] && (
                                <button
                                  onClick={() => {
                                    toggleCardLabel(selectedCard.columnId, selectedCard.id, selectedCard.labels[0]);
                                    setShowLabelDropdown(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                                  <span>Remove label</span>
                                </button>
                              )}
                              {availableLabels.map(label => {
                                const isSelected = selectedCard.labels?.includes(label.id);
                                return (
                                  <button
                                    key={label.id}
                                    onClick={() => {
                                      toggleCardLabel(selectedCard.columnId, selectedCard.id, label.id);
                                      setShowLabelDropdown(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                                      isSelected 
                                        ? 'bg-blue-50 text-blue-700' 
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                  >
                                    <div 
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: label.color }}
                                    />
                                    <span>{label.name}</span>
                                    {isSelected && <span className="ml-auto text-blue-600">âœ“</span>}
                                  </button>
                                );
                              })}
                              <hr className="my-1" />
                              <button
                                onClick={() => {
                                  setShowLabelManagementModal(true);
                                  setShowLabelDropdown(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors whitespace-nowrap"
                                title="Create/Edit Labels"
                              >
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="truncate">Create/Edit Labels</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {showNewLabel && (
                        <div className="mt-3 p-4 bg-gray-50 rounded-lg border">
                          <div className="flex gap-3 items-end">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Label Name</label>
                              <input
                                type="text"
                                value={newLabelName}
                                onChange={(e) => setNewLabelName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter label name..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') addLabel();
                                  if (e.key === 'Escape') { setShowNewLabel(false); setNewLabelName(''); }
                                }}
                                autoFocus
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                              <input
                                type="color"
                                value={newLabelColor}
                                onChange={(e) => setNewLabelColor(e.target.value)}
                                className="w-12 h-9 border border-gray-300 rounded cursor-pointer"
                              />
                            </div>
                            <button
                              onClick={addLabel}
                              disabled={!newLabelName.trim()}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => { setShowNewLabel(false); setNewLabelName(''); }}
                              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      </div>
                      
                      {/* Assigned To Control */}
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
                        <button
                          onClick={() => {
                            if (canComment) {
                              setShowAssignModal(true);
                              // Always reload users to get fresh data for practice members
                              loadUsers();
                            }
                          }}
                          disabled={!canComment}
                          className={`w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                            !canComment ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {selectedCard.assignedTo && selectedCard.assignedTo.length > 0 ? (
                              <>
                                <div className="flex -space-x-1">
                                  {selectedCard.assignedTo.slice(0, 2).map((email, index) => (
                                    <div key={email} className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white font-medium border border-white">
                                      {email.charAt(0).toUpperCase()}
                                    </div>
                                  ))}
                                  {selectedCard.assignedTo.length > 2 && (
                                    <div className="w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center text-xs text-white font-medium border border-white">
                                      +{selectedCard.assignedTo.length - 2}
                                    </div>
                                  )}
                                </div>
                                <span className="text-gray-700 truncate">{selectedCard.assignedTo.length} assigned</span>
                              </>
                            ) : (
                              <span className="text-gray-500">Assign users...</span>
                            )}
                          </div>
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Dates Control */}
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Dates</label>
                        <button
                          onClick={() => {
                            if (canComment) {
                              setTempStartDate(selectedCard.startDate || '');
                              setTempDueDate(selectedCard.dueDate || '');
                              setTempDueTime(selectedCard.dueTime || '');
                              setReminderOption('');
                              setCustomReminderDate('');
                              setCustomReminderTime('');
                              setShowDatesModal(true);
                            }
                          }}
                          disabled={!canComment}
                          className={`w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                            !canComment ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {selectedCard.startDate || selectedCard.dueDate ? (
                              <>
                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-gray-700 truncate">
                                  {selectedCard.startDate && `Start: ${new Date(selectedCard.startDate).toLocaleDateString()}`}
                                  {selectedCard.startDate && selectedCard.dueDate && ' | '}
                                  {selectedCard.dueDate && `Due: ${new Date(selectedCard.dueDate).toLocaleDateString()}`}
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-500">Set dates...</span>
                            )}
                          </div>
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Checklist Control */}
                      <div className="relative checklist-dropdown">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Checklist</label>
                        <div className="relative">
                          <button
                            onClick={() => canComment && setShowChecklistDropdown(!showChecklistDropdown)}
                            disabled={!canComment}
                            className={`w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                              !canComment ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-gray-400'
                            }`}
                          >
                            <span className="text-gray-500">Add checklist...</span>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {showChecklistDropdown && canComment && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              <div className="p-1">
                                <button
                                  onClick={() => {
                                    setChecklistItems([]);
                                    setNewChecklistItem('');
                                    setChecklistName('');
                                    setSaveAsTemplate(false);
                                    setShowChecklistModal(true);
                                    setShowChecklistDropdown(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  <span>Add new</span>
                                </button>
                                {checklistTemplates.length > 0 && (
                                  <>
                                    <hr className="my-1" />
                                    {checklistTemplates.map(template => (
                                      <button
                                        key={template.id}
                                        onClick={() => {
                                          const newChecklist = {
                                            id: Date.now().toString(),
                                            name: template.name,
                                            items: template.items.map(item => ({ text: item, completed: false }))
                                          };
                                          
                                          const currentChecklists = selectedCard.checklists || [];
                                          const newChecklists = [...currentChecklists, newChecklist];
                                          
                                          updateCard(selectedCard.columnId, selectedCard.id, {
                                            checklists: newChecklists
                                          });
                                          setSelectedCard(prev => ({
                                            ...prev,
                                            checklists: newChecklists
                                          }));
                                          
                                          setShowChecklistDropdown(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-left"
                                      >
                                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        <div>
                                          <div className="font-medium">{template.name}</div>
                                          <div className="text-xs text-gray-500">{template.items.length} items</div>
                                        </div>
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Attachments */}
                    <div>
                      <label className="block text-lg font-semibold text-gray-800 mb-4">Attachments</label>
                      
                      {canComment && (
                        <div className="mb-4">
                          <div 
                            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors"
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                              const files = Array.from(e.dataTransfer.files || []);
                              if (files.length > 0) {
                                addAttachments(selectedCard.columnId, selectedCard.id, files);
                              }
                            }}
                          >
                            <PaperClipIcon className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                            <input
                              type="file"
                              multiple
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length > 0) {
                                  addAttachments(selectedCard.columnId, selectedCard.id, files);
                                }
                              }}
                              className="hidden"
                              id="attachment-upload"
                            />
                            <label
                              htmlFor="attachment-upload"
                              className="text-blue-600 hover:text-blue-500 font-medium cursor-pointer"
                            >
                              Click to upload files
                            </label>
                            <p className="text-xs text-gray-500 mt-1">or drag and drop • All file types supported</p>
                          </div>
                        </div>
                      )}
                      
                      {!canComment && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-amber-700">
                            View-only access - cannot add attachments
                          </p>
                        </div>
                      )}
                      
                      {selectedCard.attachments && selectedCard.attachments.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedCard.attachments.map(attachment => (
                            <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                              <div className="flex items-center space-x-2 min-w-0">
                                {attachment.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                  <div 
                                    className="w-8 h-8 rounded border overflow-hidden flex-shrink-0 cursor-pointer"
                                    onMouseEnter={(e) => {
                                      setPreviewType('attachment');
                                      setPreviewPosition({
                                        x: window.innerWidth / 2,
                                        y: window.innerHeight / 2
                                      });
                                      setPreviewFile({
                                        filename: attachment.filename,
                                        path: attachment.path,
                                        size: attachment.size
                                      });
                                    }}
                                    onMouseLeave={() => setPreviewFile(null)}
                                  >
                                    <img 
                                      src={`/api/files/${attachment.path}`}
                                      alt={attachment.filename}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <DocumentIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <button
                                    onClick={() => {
                                      const iframe = document.createElement('iframe');
                                      iframe.style.display = 'none';
                                      iframe.src = `/api/files/${attachment.path}`;
                                      document.body.appendChild(iframe);
                                      setTimeout(() => {
                                        document.body.removeChild(iframe);
                                      }, 1000);
                                    }}
                                    className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 cursor-pointer text-left"
                                  >
                                    {attachment.filename}
                                  </button>
                                  <p className="text-xs text-gray-500">
                                    {Math.round((attachment.size || 0) / 1024)}KB
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => {
                                    const iframe = document.createElement('iframe');
                                    iframe.style.display = 'none';
                                    iframe.src = `/api/files/${attachment.path}`;
                                    document.body.appendChild(iframe);
                                    setTimeout(() => {
                                      document.body.removeChild(iframe);
                                    }, 1000);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded hover:bg-blue-50"
                                >
                                  Download
                                </button>
                                {canComment && (
                                  <button
                                    onClick={() => removeAttachment(selectedCard.columnId, selectedCard.id, attachment.id)}
                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                  >
                                    <XMarkIcon className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400">
                          <DocumentIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No attachments</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - 40% (2/5) */}
                  <div className="col-span-2">
                    <label className="block text-lg font-semibold text-gray-800 mb-4">Comments</label>
                    
                    {canComment && (
                      <div className="mb-4">
                        <div className="space-y-3">
                          <div className="relative">
                            <textarea
                              value={cardComment}
                              onChange={(e) => setCardComment(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  addComment(selectedCard.columnId, selectedCard.id);
                                }
                              }}
                              className="w-full p-3 pr-20 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              rows={3}
                              placeholder="Add a comment... (Press Enter to submit, Shift+Enter for new line)"
                            />
                            <div className="absolute bottom-2 right-2 flex items-center gap-2">
                              <div className="relative">
                                <button
                                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                  className="p-1.5 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded transition-colors"
                                  title="Add emoji"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                    <circle cx="9" cy="9" r="1.5" />
                                    <circle cx="15" cy="9" r="1.5" />
                                    <path d="M8.5 14.5c0-1.38 1.12-2.5 2.5-2.5h2c1.38 0 2.5 1.12 2.5 2.5" stroke="currentColor" strokeWidth="1" fill="none" />
                                  </svg>
                                </button>
                                {showEmojiPicker && (
                                  <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-1 z-10">
                                    {['ðŸ˜€', 'ðŸ˜ƒ', 'ðŸ˜„', 'ðŸ˜', 'ðŸ˜Š', 'ðŸ˜', 'ðŸ¤”', 'ðŸ˜¢', 'ðŸ˜‚', 'ðŸ‘', 'ðŸ‘Ž', 'â¤ï¸', 'ðŸŽ‰', 'ðŸ”¥', 'ðŸ’¯', 'âœ…', 'âŒ', 'âš ï¸'].map(emoji => (
                                      <button
                                        key={emoji}
                                        onClick={() => {
                                          setCardComment(prev => prev + emoji);
                                          setShowEmojiPicker(false);
                                        }}
                                        className="p-1 hover:bg-gray-100 rounded text-lg"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <input
                                type="file"
                                multiple
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  setCommentFiles(prev => [...prev, ...files].slice(0, 3));
                                }}
                                className="hidden"
                                id="comment-attachment-upload"
                              />
                              <label
                                htmlFor="comment-attachment-upload"
                                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                                title="Attach files"
                              >
                                <PaperClipIcon className="w-4 h-4" />
                              </label>
                            </div>
                          </div>
                          {commentFiles.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-600">Attachments:</p>
                              {commentFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border text-xs">
                                  <span className="truncate">{file.name} ({Math.round(file.size / 1024)}KB)</span>
                                  <button
                                    onClick={() => setCommentFiles(prev => prev.filter((_, i) => i !== index))}
                                    className="text-red-500 hover:text-red-700 ml-2"
                                  >
                                    <XMarkIcon className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => addComment(selectedCard.columnId, selectedCard.id)}
                            disabled={!cardComment.trim() && commentFiles.length === 0}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                          >
                            Post Comment
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {!canComment && (
                      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-700">
                          View-only access - cannot add comments
                        </p>
                      </div>
                    )}

                    {selectedCard.comments && selectedCard.comments.length > 0 ? (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {selectedCard.comments.map(comment => (
                          <div key={comment.id} className="bg-gray-50 rounded-lg p-4 border hover:bg-gray-100 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-900">{comment.author}</span>
                              <span className="text-xs text-gray-500">
                                {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            {comment.text && (
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mb-2">{comment.text}</p>
                            )}
                            {comment.attachments && comment.attachments.length > 0 && (
                              <div className="space-y-1 mt-2">
                                {comment.attachments.map(attachment => (
                                  <div key={attachment.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                                    {attachment.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                      <div 
                                        className="w-6 h-6 rounded border overflow-hidden flex-shrink-0 cursor-pointer"
                                        onMouseEnter={(e) => {
                                          setPreviewType('comment');
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setPreviewPosition({
                                            x: rect.left,
                                            y: rect.top + rect.height / 2
                                          });
                                          setPreviewFile({
                                            filename: attachment.filename,
                                            path: attachment.path,
                                            size: attachment.size
                                          });
                                        }}
                                        onMouseLeave={() => setPreviewFile(null)}
                                      >
                                        <img 
                                          src={`/api/files/${attachment.path}`}
                                          alt={attachment.filename}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <DocumentIcon className="h-3 w-3 text-gray-500" />
                                    )}
                                    <button
                                      onClick={(e) => {
                                        console.log('ðŸ”¥ File click triggered:', attachment.filename);
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('ðŸ”¥ Opening download URL:', `/api/files/${attachment.path}`);
                                        
                                        // Create hidden iframe to force download
                                        const iframe = document.createElement('iframe');
                                        iframe.style.display = 'none';
                                        iframe.src = `/api/files/${attachment.path}`;
                                        document.body.appendChild(iframe);
                                        
                                        // Remove iframe after download starts
                                        setTimeout(() => {
                                          document.body.removeChild(iframe);
                                        }, 1000);
                                        
                                        console.log('ðŸ”¥ Download initiated via iframe');
                                      }}
                                      onMouseEnter={(e) => {
                                        setPreviewType('comment');
                                        console.log('ðŸ”¥ Mouse enter on file:', attachment.filename);
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        console.log('ðŸ”¥ Button rect:', rect);
                                        setPreviewPosition({
                                          x: rect.left,
                                          y: rect.top + rect.height / 2
                                        });
                                        setPreviewFile({
                                          filename: attachment.filename,
                                          path: attachment.path,
                                          size: attachment.size
                                        });
                                      }}
                                      onMouseLeave={() => {
                                        console.log('ðŸ”¥ Mouse leave');
                                        setPreviewFile(null);
                                      }}
                                      className="text-xs text-blue-600 hover:text-blue-800 truncate flex-1 text-left cursor-pointer hover:underline"
                                    >
                                      {attachment.filename}
                                    </button>
                                    <button
                                      onClick={() => {
                                        const iframe = document.createElement('iframe');
                                        iframe.style.display = 'none';
                                        iframe.src = `/api/files/${attachment.path}`;
                                        document.body.appendChild(iframe);
                                        setTimeout(() => {
                                          document.body.removeChild(iframe);
                                        }, 1000);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 text-xs px-1 py-0.5 rounded hover:bg-blue-50 ml-2"
                                    >
                                      Download
                                    </button>
                                    <span className="text-xs text-gray-500 ml-2">{Math.round((attachment.size || 0) / 1024)}KB</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-400">
                        <ChatBubbleLeftIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No comments yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Card Settings Modal */}
      {/* Upload Progress Indicator */}
      <FileUploadProgress uploads={uploadProgress} />

      {showCardSettings && selectedCard && (
        <CardSettingsModal
          isOpen={showCardSettings}
          onClose={() => setShowCardSettings(false)}
          card={selectedCard}
          onUpdateCard={(updates) => {
            updateCard(selectedCard.columnId, selectedCard.id, updates);
            setSelectedCard(prev => ({ ...prev, ...updates }));
          }}
          getHeaders={getHeaders}
        />
      )}
      
      {/* Project Number Modal */}
      {showProjectNumberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100">
            <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Add Project Link</h3>
                    <p className="text-sm text-gray-600">Connect to Savant project details</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowProjectNumberModal(false);
                    setProjectNumber('');
                  }}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-white hover:shadow-md transition-all duration-200"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">Project Number</label>
                  <input
                    type="text"
                    value={projectNumber}
                    onChange={(e) => setProjectNumber(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg font-medium"
                    placeholder="e.g., 12345"
                    autoFocus
                  />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">{selectedCard?.projectUrl ? 'This will update the existing project link:' : 'This will create a link to:'}</p>
                      <p className="font-mono text-xs bg-white px-2 py-1 rounded border">savant.netsync.com/v2/pmo/projects/details</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-8 py-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowProjectNumberModal(false);
                    setProjectNumber('');
                  }}
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (projectNumber.trim()) {
                      const projectUrl = `https://savant.netsync.com/v2/pmo/projects/details?jobNo=${projectNumber.trim()}&isPmo=true`;
                      
                      updateCard(selectedCard.columnId, selectedCard.id, { projectUrl });
                      setSelectedCard(prev => ({ ...prev, projectUrl }));
                      
                      setShowProjectNumberModal(false);
                      setProjectNumber('');
                    }
                  }}
                  disabled={!projectNumber.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none"
                >
                  Add Project Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Assignment Modal */}
      {showAssignModal && selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Assign Users</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedChecklistItem ? 'Assign users to this checklist item' : 'Search and assign users to this card'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setUserSearchTerm('');
                    setShowUserDropdown(false);
                    setSelectedChecklistItem(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white hover:shadow-md transition-all duration-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Search Dropdown */}
              <div className="mb-6 relative user-search-dropdown">
                <label className="block text-sm font-medium text-gray-700 mb-2">Add Users</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    onFocus={() => setShowUserDropdown(true)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
                  />
                  
                  {/* Dropdown */}
                  {showUserDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {(() => {
                        const currentAssigned = selectedChecklistItem 
                          ? selectedCard.checklists[selectedChecklistItem.checklistIndex].items[selectedChecklistItem.itemIndex].assignedTo || []
                          : selectedCard.assignedTo || [];
                        
                        const filteredUsers = availableUsers.filter(user => {
                          const matchesSearch = !userSearchTerm || 
                            (user.name || user.email).toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                            user.email.toLowerCase().includes(userSearchTerm.toLowerCase());
                          const notAssigned = !currentAssigned.includes(user.email);
                          return matchesSearch && notAssigned;
                        });
                        
                        // Sort users: current user first, then current practice board users, then others
                        const sortedUsers = filteredUsers.sort((a, b) => {
                          const aIsCurrentUser = a.email === user?.email;
                          const bIsCurrentUser = b.email === user?.email;
                          const aPractices = typeof a.practices === 'string' ? JSON.parse(a.practices || '[]') : (Array.isArray(a.practices) ? a.practices : []);
                          const bPractices = typeof b.practices === 'string' ? JSON.parse(b.practices || '[]') : (Array.isArray(b.practices) ? b.practices : []);
                          const aIsCurrentBoardUser = aPractices.some(practice => currentBoardPractices.includes(practice));
                          const bIsCurrentBoardUser = bPractices.some(practice => currentBoardPractices.includes(practice));
                          
                          // Current user always first
                          if (aIsCurrentUser && !bIsCurrentUser) return -1;
                          if (!aIsCurrentUser && bIsCurrentUser) return 1;
                          
                          // Then users from current practice board
                          if (aIsCurrentBoardUser && !bIsCurrentBoardUser) return -1;
                          if (!aIsCurrentBoardUser && bIsCurrentBoardUser) return 1;
                          
                          // Finally alphabetical by name
                          return (a.name || a.email).localeCompare(b.name || b.email);
                        });
                        
                        if (sortedUsers.length === 0) {
                          return (
                            <div className="p-4 text-center text-gray-500">
                              <p className="text-sm">{userSearchTerm ? 'No users found' : 'Start typing to search users...'}</p>
                            </div>
                          );
                        }
                        
                        return sortedUsers.map(availableUser => {
                          const isCurrentUser = availableUser.email === user?.email;
                          const userPractices = typeof availableUser.practices === 'string' ? JSON.parse(availableUser.practices || '[]') : (Array.isArray(availableUser.practices) ? availableUser.practices : []);
                          const isCurrentBoardUser = userPractices.some(practice => currentBoardPractices.includes(practice));
                          
                          return (
                            <button
                              key={availableUser.email}
                              onClick={() => {
                                toggleUserAssignment(availableUser.email);
                                setShowUserDropdown(false);
                                setUserSearchTerm('');
                              }}
                              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm text-white font-medium ${
                                isCurrentUser ? 'bg-green-500' : isCurrentBoardUser ? 'bg-blue-500' : 'bg-gray-400'
                              }`}>
                                {(availableUser.name || availableUser.email).charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {availableUser.name || availableUser.email}
                                  {isCurrentUser && <span className="text-green-600 ml-1">(You)</span>}
                                </div>
                                {availableUser.name && <div className="text-xs text-gray-500 truncate">{availableUser.email}</div>}
                                <div className="flex items-center gap-2 mt-1">
                                  {isCurrentUser && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Current User</span>}
                                  {isCurrentBoardUser && !isCurrentUser && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Practice Member</span>}
                                  {!isCurrentBoardUser && !isCurrentUser && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Other User</span>}
                                </div>
                              </div>
                              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          );
                        });
                      })()
                    }
                    </div>
                  )}
                </div>
              </div>
              
              {/* Assigned Users */}
              <div>
                {(() => {
                  const currentAssigned = selectedChecklistItem 
                    ? selectedCard.checklists[selectedChecklistItem.checklistIndex].items[selectedChecklistItem.itemIndex].assignedTo || []
                    : selectedCard.assignedTo || [];
                  
                  return (
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-800">
                        Assigned Users ({currentAssigned.length})
                      </label>
                      {currentAssigned.length > 0 && (
                        <button
                          onClick={() => {
                            if (selectedChecklistItem) {
                              const { checklistIndex, itemIndex } = selectedChecklistItem;
                              const newChecklists = [...selectedCard.checklists];
                              newChecklists[checklistIndex].items[itemIndex] = {
                                ...newChecklists[checklistIndex].items[itemIndex],
                                assignedTo: []
                              };
                              updateCard(selectedCard.columnId, selectedCard.id, { checklists: newChecklists });
                              setSelectedCard(prev => ({ ...prev, checklists: newChecklists }));
                            } else {
                              const newColumns = columns.map(col => 
                                col.id === selectedCard.columnId 
                                  ? { 
                                      ...col, 
                                      cards: col.cards.map(card => 
                                        card.id === selectedCard.id 
                                          ? { ...card, assignedTo: [], lastEditedBy: user?.email, lastEditedAt: new Date().toISOString() }
                                          : card
                                      )
                                    }
                                  : col
                              );
                              setColumns(newColumns);
                              saveBoardData(newColumns);
                              setSelectedCard(prev => ({ ...prev, assignedTo: [] }));
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  );
                })()}
                
                {(() => {
                  const currentAssigned = selectedChecklistItem 
                    ? selectedCard.checklists[selectedChecklistItem.checklistIndex].items[selectedChecklistItem.itemIndex].assignedTo || []
                    : selectedCard.assignedTo || [];
                  
                  return currentAssigned.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                      {currentAssigned.map(email => {
                      const assignedUser = availableUsers.find(u => u.email === email);
                      const isCurrentUser = email === user?.email;
                      return (
                        <div key={email} className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 bg-white hover:shadow-sm ${
                          isCurrentUser ? 'border-green-200' : 'border-gray-200'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm text-white font-medium ${
                              isCurrentUser ? 'bg-green-500' : 'bg-blue-500'
                            }`}>
                              {(assignedUser?.name || email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {assignedUser?.name || email}
                                {isCurrentUser && <span className="text-green-600 ml-1">(You)</span>}
                              </div>
                              {assignedUser?.name && <div className="text-xs text-gray-500">{email}</div>}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleUserAssignment(email)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-100 transition-all duration-200 hover:scale-110"
                            title="Remove assignment"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 border border-gray-200 rounded-lg bg-gray-50">
                    <svg className="h-8 w-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-sm">No users assigned</p>
                    <p className="text-xs text-gray-500 mt-1">Use the search box above to add users</p>
                  </div>
                );
                })()}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {(() => {
                    const currentAssigned = selectedChecklistItem 
                      ? selectedCard.checklists[selectedChecklistItem.checklistIndex].items[selectedChecklistItem.itemIndex].assignedTo || []
                      : selectedCard.assignedTo || [];
                    return `${currentAssigned.length} user${currentAssigned.length !== 1 ? 's' : ''} assigned`;
                  })()}
                </div>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setUserSearchTerm('');
                    setShowUserDropdown(false);
                    setSelectedChecklistItem(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Dates Modal */}
      <DateTimePicker
        isOpen={showDatesModal}
        onClose={() => {
          setShowDatesModal(false);
          setSelectedChecklistItem(null);
        }}
        onSave={async (data) => {
          if (selectedChecklistItem) {
            // Handle checklist item dates
            const { checklistIndex, itemIndex } = selectedChecklistItem;
            const newChecklists = [...selectedCard.checklists];
            newChecklists[checklistIndex].items[itemIndex] = {
              ...newChecklists[checklistIndex].items[itemIndex],
              dueDate: data.dueDate,
              dueTime: data.dueTime,
              reminderOption: data.reminderOption,
              customReminderDate: data.customReminderDate,
              customReminderTime: data.customReminderTime
            };
            
            updateCard(selectedCard.columnId, selectedCard.id, { checklists: newChecklists });
            setSelectedCard(prev => ({ ...prev, checklists: newChecklists }));
            
            // Schedule checklist item reminder if due date and reminder are set
            if (data.dueDate && data.reminderOption && newChecklists[checklistIndex].items[itemIndex].assignedTo?.includes(user.email)) {
              try {
                await fetch('/api/notifications/checklist-reminder', {
                  method: 'POST',
                  headers: getHeaders(),
                  body: JSON.stringify({
                    cardId: selectedCard.id,
                    columnId: selectedCard.columnId,
                    practiceId: currentPracticeId,
                    checklistIndex,
                    itemIndex,
                    checklistItem: newChecklists[checklistIndex].items[itemIndex],
                    cardData: selectedCard,
                    currentUserEmail: user.email
                  })
                });
              } catch (error) {
                console.error('Failed to schedule checklist reminder:', error);
              }
            }
          } else {
            // Handle card-level dates
            const cardUpdates = {
              startDate: data.startDate,
              dueDate: data.dueDate,
              dueTime: data.dueTime
            };
            
            updateCard(selectedCard.columnId, selectedCard.id, cardUpdates);
            setSelectedCard(prev => ({ ...prev, ...cardUpdates }));
            
            // Schedule card reminder if due date and reminder are set
            if (data.dueDate && data.reminderOption) {
              try {
                await fetch('/api/notifications/card-reminder', {
                  method: 'POST',
                  headers: getHeaders(),
                  body: JSON.stringify({
                    cardId: selectedCard.id,
                    columnId: selectedCard.columnId,
                    practiceId: currentPracticeId,
                    cardData: {
                      ...selectedCard,
                      ...cardUpdates,
                      reminderOption: data.reminderOption,
                      customReminderDate: data.customReminderDate,
                      customReminderTime: data.customReminderTime
                    }
                  })
                });
              } catch (error) {
                console.error('Error saving card reminder preferences:', error);
              }
            }
          }
          
          setShowDatesModal(false);
          setSelectedChecklistItem(null);
        }}
        title={selectedChecklistItem ? "Set Checklist Item Dates" : "Set Card Dates & Reminders"}
        subtitle={selectedChecklistItem ? "Configure dates for this checklist item" : "Configure dates and notifications for this card"}
        initialData={{
          startDate: selectedChecklistItem ? '' : (selectedCard?.startDate || tempStartDate),
          dueDate: selectedChecklistItem 
            ? selectedCard?.checklists?.[selectedChecklistItem.checklistIndex]?.items?.[selectedChecklistItem.itemIndex]?.dueDate || tempDueDate
            : (selectedCard?.dueDate || tempDueDate),
          dueTime: selectedChecklistItem 
            ? selectedCard?.checklists?.[selectedChecklistItem.checklistIndex]?.items?.[selectedChecklistItem.itemIndex]?.dueTime || tempDueTime
            : (selectedCard?.dueTime || tempDueTime),
          reminderOption: selectedChecklistItem 
            ? selectedCard?.checklists?.[selectedChecklistItem.checklistIndex]?.items?.[selectedChecklistItem.itemIndex]?.reminderOption || ''
            : (selectedCard?.reminderOption || reminderOption),
          customReminderDate: selectedChecklistItem 
            ? selectedCard?.checklists?.[selectedChecklistItem.checklistIndex]?.items?.[selectedChecklistItem.itemIndex]?.customReminderDate || ''
            : (selectedCard?.customReminderDate || customReminderDate),
          customReminderTime: selectedChecklistItem 
            ? selectedCard?.checklists?.[selectedChecklistItem.checklistIndex]?.items?.[selectedChecklistItem.itemIndex]?.customReminderTime || ''
            : (selectedCard?.customReminderTime || customReminderTime),
          assignedUsers: selectedChecklistItem 
            ? selectedCard?.checklists?.[selectedChecklistItem.checklistIndex]?.items?.[selectedChecklistItem.itemIndex]?.assignedTo || []
            : (selectedCard?.assignedTo || [])
        }}
        showStartDate={!selectedChecklistItem}
        showReminders={true}
        context={selectedChecklistItem ? "checklist" : "card"}
      />
      
      {/* Checklist Modal */}
      {showChecklistModal && selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Checklist</h3>
                  <p className="text-sm text-gray-600 mt-1">Add items to create a checklist</p>
                </div>
                <button
                  onClick={() => {
                    setShowChecklistModal(false);
                    setChecklistItems([]);
                    setNewChecklistItem('');
                    setChecklistName('');
                    setSaveAsTemplate(false);
                    setEditingChecklistIndex(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white hover:shadow-md transition-all duration-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Checklist Name</label>
                  <input
                    type="text"
                    value={checklistName}
                    onChange={(e) => setChecklistName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter checklist name..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                  <div className="space-y-2">
                    {checklistItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                        <span className="flex-1">{item}</span>
                        <button
                          onClick={() => setChecklistItems(prev => prev.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newChecklistItem.trim()) {
                            setChecklistItems(prev => [...prev, newChecklistItem.trim()]);
                            setNewChecklistItem('');
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Add checklist item..."
                      />
                      <button
                        onClick={() => {
                          if (newChecklistItem.trim()) {
                            setChecklistItems(prev => [...prev, newChecklistItem.trim()]);
                            setNewChecklistItem('');
                          }
                        }}
                        disabled={!newChecklistItem.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="saveAsTemplate"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label htmlFor="saveAsTemplate" className="text-sm text-gray-700">
                    Save as template for future use
                  </label>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {checklistItems.length} item{checklistItems.length !== 1 ? 's' : ''}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowChecklistModal(false);
                      setChecklistItems([]);
                      setNewChecklistItem('');
                      setChecklistName('');
                      setSaveAsTemplate(false);
                      setEditingChecklistIndex(null);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (checklistItems.length > 0) {
                        const newChecklist = {
                          id: Date.now().toString(),
                          name: checklistName || 'Checklist',
                          items: checklistItems.map(item => ({ text: item, completed: false }))
                        };
                        
                        let currentChecklists;
                        if (editingChecklistIndex !== null) {
                          // Editing existing checklist
                          currentChecklists = [...selectedCard.checklists];
                          currentChecklists[editingChecklistIndex] = newChecklist;
                        } else {
                          // Adding new checklist
                          currentChecklists = [...(selectedCard.checklists || []), newChecklist];
                        }
                        
                        updateCard(selectedCard.columnId, selectedCard.id, {
                          checklists: currentChecklists
                        });
                        setSelectedCard(prev => ({
                          ...prev,
                          checklists: currentChecklists
                        }));
                        
                        // Save as template if requested
                        if (saveAsTemplate && checklistName) {
                          try {
                            await fetch('/api/practice-boards/checklist-templates', {
                              method: 'POST',
                              headers: getHeaders(),
                              body: JSON.stringify({
                                practiceId: currentPracticeId,
                                name: checklistName,
                                items: checklistItems
                              })
                            });
                            loadChecklistTemplates();
                          } catch (error) {
                            console.error('Failed to save checklist template:', error);
                          }
                        }
                        
                        setShowChecklistModal(false);
                        setChecklistItems([]);
                        setNewChecklistItem('');
                        setChecklistName('');
                        setSaveAsTemplate(false);
                        setEditingChecklistIndex(null);
                      }
                    }}
                    disabled={checklistItems.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {editingChecklistIndex !== null ? 'Update Checklist' : 'Add Checklist'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PracticeInformationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <PracticeInformationPageContent />
    </Suspense>
  );
}