'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { PaperClipIcon, XMarkIcon, DocumentIcon, PhotoIcon, HandThumbUpIcon, EyeIcon } from '@heroicons/react/24/outline';
import AttachmentPreview from '../../../components/AttachmentPreview';
import MultiAttachmentPreview from '../../../components/MultiAttachmentPreview';
import Navbar from '../../../components/Navbar';
import SidebarLayout from '../../../components/SidebarLayout';
import Breadcrumb from '../../../components/Breadcrumb';
import AccessCheck from '../../../components/AccessCheck';
import TimestampDisplay from '../../../components/TimestampDisplay';
import UserDisplay from '../../../components/UserDisplay';
import { useAuth } from '../../../hooks/useAuth';
import { getLeadershipVisibilityText, fetchLeadershipVisibilityData } from '../../../lib/leadership-visibility';

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
      onFilesSelected(validFiles);
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

function ConversationForm({ issueId, issue, user, onCommentAdded, attachments, setAttachments, showEmojiPicker, setShowEmojiPicker }) {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pastedImages, setPastedImages] = useState([]);
  const textareaRef = useRef(null);

  const commonEmojis = ['😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🎉', '😢', '😡', '🔥', '💯', '🚀', '✅', '❌', '⚠️', '💡', '🎯', '📝', '🐛'];

  const handleEmojiClick = (emoji) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = newComment.slice(0, start) + emoji + newComment.slice(end);
      setNewComment(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          // Create a file with timestamp name
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const file = new File([blob], `pasted-image-${timestamp}.png`, { type: blob.type || 'image/png' });
          
          // Convert to data URL to bypass CSP restrictions
          const reader = new FileReader();
          reader.onload = (e) => {
            const previewUrl = e.target.result;
            setPastedImages(prev => [...prev, { file, previewUrl, id: Date.now() }]);
          };
          reader.readAsDataURL(blob);
        }
        break;
      }
    }
  };

  const removePastedImage = (id) => {
    setPastedImages(prev => prev.filter(img => img.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() && attachments.length === 0 && pastedImages.length === 0) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('message', newComment);
      
      // Add regular attachments
      attachments.forEach(file => {
        formData.append('attachments', file);
      });
      
      // Add pasted images
      pastedImages.forEach(img => {
        formData.append('attachments', img.file);
      });
      
      // Add file attachments
      attachments.forEach(attachment => {
        formData.append('attachments', attachment.file);
      });

      const response = await fetch(`/api/issues/${issueId}/comments`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setNewComment('');
        // Clean up pasted images
        setPastedImages([]);
        // Clean up attachment URLs
        attachments.forEach(att => att.previewUrl && URL.revokeObjectURL(att.previewUrl));
        setAttachments([]);
        onCommentAdded();
        // Scroll to bottom after user adds comment
        const scrollToBottom = () => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        };
        setTimeout(scrollToBottom, 200);
        setTimeout(scrollToBottom, 500);
        setTimeout(scrollToBottom, 1000);
        setTimeout(scrollToBottom, 2000);
        setTimeout(scrollToBottom, 3000);
        // Re-focus textarea after comment submission
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }, 300);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (issue?.status === 'Closed') {
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-gray-500">🔒</span>
          </div>
          <div>
            <h4 className="font-semibold text-gray-700">Comments Locked</h4>
            <p className="text-sm text-gray-600">This issue has been closed and comments are no longer allowed.</p>
          </div>
        </div>
      </div>
    );
  }

  const isFormDisabled = issue?.status === 'Closed';

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="mb-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="grid grid-cols-10 gap-2">
            {commonEmojis.map((emoji, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="text-xl hover:bg-gray-100 rounded p-1 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isFormDisabled) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder={isFormDisabled ? "Comments are locked - issue is closed" : "Add a comment... (Press Enter to submit, Shift+Enter for new line, Ctrl+V to paste images)"}
          rows={(pastedImages.length > 0 || attachments.length > 0) ? "6" : "3"}
          className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${
            isFormDisabled ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-300'
          }`}
          disabled={submitting || isFormDisabled}
          readOnly={isFormDisabled}
        />
        
        {/* Pasted Images and Attachments Preview Inside Textarea */}
        {(pastedImages.length > 0 || attachments.length > 0) && (
          <div key={`preview-${pastedImages.length}-${attachments.length}`} className="absolute bottom-3 left-3 right-3 bg-gray-50 border border-gray-200 rounded p-2">
            <div className="flex flex-wrap gap-2">
              {pastedImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.previewUrl}
                    alt="Pasted image preview"
                    className="w-16 h-16 object-cover rounded border border-gray-300"
                    onError={(e) => {
                      console.error('Image preview failed to load:', img.previewUrl);
                      e.target.style.display = 'none';
                    }}
                    onLoad={() => console.log('Image preview loaded successfully:', img.previewUrl)}
                  />
                  <button
                    type="button"
                    onClick={() => removePastedImage(img.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow-sm"
                  >
                    ×
                  </button>
                </div>
              ))}
              {attachments.map((attachment) => (
                <div key={attachment.id} className="relative group flex flex-col items-center">
                  <div className="relative">
                    {attachment.previewUrl ? (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.file.name}
                        className="w-16 h-16 object-cover rounded border border-gray-300"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                        <DocumentIcon className="h-8 w-8 text-gray-500" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter(a => a.id !== attachment.id))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow-sm"
                    >
                      ×
                    </button>
                  </div>
                  <span className="text-xs text-gray-600 mt-1 max-w-16 truncate" title={attachment.file.name}>
                    {attachment.file.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      

      
      <button
        type="submit"
        disabled={(!newComment.trim() && attachments.length === 0 && pastedImages.length === 0) || submitting || isFormDisabled}
        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isFormDisabled ? 'Comments Locked' : submitting ? 'Adding...' : 'Add Comment/Add Attachment'}
      </button>
    </form>
  );
}

function ConversationSection({ issueId, issue, user, onIssueUpdate }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastCommentTime, setLastCommentTime] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hoveredImage, setHoveredImage] = useState(null);
  const hoverTimeoutRef = useRef(null);
  const conversationContainerRef = useRef(null);

  // Debug logging for hover state changes
  useEffect(() => {
    console.log('🔍 ConversationSection: hoveredImage state changed:', hoveredImage);
    if (hoveredImage) {
      console.log('🖼️ Hovered image details:', {
        filename: hoveredImage.filename,
        path: hoveredImage.path,
        x: hoveredImage.x,
        y: hoveredImage.y,
        size: hoveredImage.size
      });
    }
  }, [hoveredImage]);

  const isImageFile = (filename) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  const isFormDisabled = issue?.status === 'Closed';

  const fetchComments = async () => {
    try {
      console.log(`Fetching comments for issue: ${issueId}`);
      const response = await fetch(`/api/issues/${issueId}/comments`);
      if (response.ok) {
        const data = await response.json();
        const newComments = data.comments || [];
        console.log(`Fetched ${newComments.length} comments`);
        
        // Only update if comments have changed
        if (newComments.length > 0) {
          const latestTime = newComments[newComments.length - 1].created_at;
          if (latestTime !== lastCommentTime) {
            console.log('Comments updated, refreshing UI');
            setComments(newComments);
            setLastCommentTime(latestTime);
            setTimeout(() => {
              if (conversationContainerRef.current) {
                conversationContainerRef.current.scrollTop = conversationContainerRef.current.scrollHeight;
              }
            }, 100);
          } else {
            console.log('No new comments since last fetch');
          }
        } else if (comments.length > 0) {
          setComments(newComments);
          setLastCommentTime(null);
        }
      } else {
        console.error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() && attachments.length === 0) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('message', newComment);
      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await fetch(`/api/issues/${issueId}/comments`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setNewComment('');
        setAttachments([]);
        fetchComments();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchComments();
    
    let eventSource;
    let reconnectTimer;
    let isConnected = false;
    
    const connectSSE = () => {
      console.log(`Connecting SSE for issue: ${issueId}`);
      eventSource = new EventSource(`/api/events?issueId=${issueId}`);
      
      eventSource.onopen = () => {
        console.log(`SSE connection opened for issue: ${issueId}`);
        isConnected = true;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };
      
      eventSource.onmessage = (event) => {
        console.log(`[SSE-${issueId}] Raw event data:`, event.data);
        try {
          const data = JSON.parse(event.data);
          console.log(`[SSE-${issueId}] Parsed message at ${new Date().toISOString()}:`, data);
          
          if (data.type === 'connected') {
            console.log(`[SSE-${issueId}] Client connected with ID: ${data.clientId}`);
          } else if (data.type === 'comment_added') {
            console.log(`[SSE-${issueId}] Comment notification received:`, {
              messageIssueId: data.issueId,
              commentId: data.commentId,
              timestamp: data.timestamp,
              currentPageIssueId: issueId,
              matches: data.issueId === issueId
            });
            if (data.issueId === issueId) {
              console.log(`[SSE-${issueId}] Comment is for current issue, fetching comments`);
              
              // Play pleasant boop sound for new comment notification
              try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
              } catch (error) {
                console.log('Audio notification not available:', error);
              }
              
              // Flash browser tab if not visible
              if (document.hidden) {
                const originalTitle = document.title;
                let flashCount = 0;
                const flashInterval = setInterval(() => {
                  document.title = flashCount % 2 === 0 ? '💬 New Comment!' : originalTitle;
                  flashCount++;
                  if (flashCount >= 10) {
                    clearInterval(flashInterval);
                    document.title = originalTitle;
                  }
                }, 500);
                
                // Stop flashing when user returns to tab
                const handleVisibilityChange = () => {
                  if (!document.hidden) {
                    clearInterval(flashInterval);
                    document.title = originalTitle;
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                  }
                };
                document.addEventListener('visibilitychange', handleVisibilityChange);
              }
              
              fetchComments();
              // Scroll to bottom after new comment
              const scrollToBottom = () => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              };
              setTimeout(scrollToBottom, 200);
              setTimeout(scrollToBottom, 500);
              setTimeout(scrollToBottom, 1000);
              setTimeout(scrollToBottom, 2000);
              setTimeout(scrollToBottom, 3000);
            } else {
              console.log(`[SSE-${issueId}] Comment is for different issue (${data.issueId}), ignoring`);
            }
          } else if (data.type === 'issue_updated') {
            console.log(`[SSE-${issueId}] Issue updated notification received`);
            if (data.issueId === issueId) {
              console.log(`[SSE-${issueId}] Issue update is for current issue, refreshing`);
              onIssueUpdate && onIssueUpdate();
            }
          } else if (data.type === 'follow_updated') {
            console.log(`[SSE-${issueId}] Follow status updated:`, data);
            // Update follow button for current user only
            if (data.issueId === issueId && data.userEmail === user?.email) {
              console.log('Follow status updated for current user on current issue');
              // Dispatch custom event for FollowButton component
              window.dispatchEvent(new CustomEvent('followUpdated', { detail: data }));
            }
          } else if (data.type === 'heartbeat') {
            console.log(`[SSE-${issueId}] Heartbeat received at ${new Date().toLocaleTimeString()}`);
          } else {
            console.log(`[SSE-${issueId}] Unknown message type: ${data.type}`, data);
          }
        } catch (error) {
          console.error(`[SSE-${issueId}] Error parsing SSE message:`, error, 'Raw data:', event.data);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error(`SSE connection error for ${issueId}:`, error);
        console.log('EventSource readyState:', eventSource.readyState);
        isConnected = false;
        
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('SSE connection closed, attempting reconnection...');
          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              connectSSE();
            }, 2000);
          }
        }
      };
    };
    
    connectSSE();
    
    // Global keydown listener for Enter key when attachments are present
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !isFormDisabled && attachments.length > 0) {
        e.preventDefault();
        document.querySelector('form')?.requestSubmit();
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [issueId, attachments.length, isFormDisabled]);

  useEffect(() => {
    // Auto-scroll conversation container to newest comment when comments change
    if (comments.length > 0 && conversationContainerRef.current) {
      setTimeout(() => {
        conversationContainerRef.current.scrollTop = conversationContainerRef.current.scrollHeight;
      }, 100);
    }
  }, [comments]);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Conversation</h3>
      
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-gray-500 text-sm">No comments yet. Start the conversation!</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => {
                const commentAttachments = JSON.parse(comment.attachments || '[]');
                const isAdminComment = comment.is_admin;
                return (
                  <div key={comment.id} className={`p-4 rounded-lg shadow border ${
                    isAdminComment ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${
                        isAdminComment ? 'text-orange-800' : 'text-gray-900'
                      }`}>
                        {comment.user_name}{isAdminComment ? ' (Admin)' : ''}
                      </span>
                      <TimestampDisplay timestamp={comment.created_at} className="text-xs text-gray-500" relative={true} />
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2 leading-relaxed">{comment.message}</p>
                    {commentAttachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {commentAttachments.map((attachment, index) => (
                          <div key={index}>
                            {isImageFile(attachment.filename) ? (
                              <div className="space-y-1 relative">
                                <img
                                  src={`/api/files/${attachment.path}`}
                                  alt={attachment.filename}
                                  className="max-w-xs max-h-48 rounded border border-gray-200 cursor-pointer"
                                  onMouseEnter={(e) => {
                                    if (hoverTimeoutRef.current) {
                                      clearTimeout(hoverTimeoutRef.current);
                                      hoverTimeoutRef.current = null;
                                    }
                                    setHoveredImage({...attachment, x: e.clientX, y: e.clientY});
                                  }}
                                  onMouseLeave={() => {
                                    hoverTimeoutRef.current = setTimeout(() => {
                                      setHoveredImage(null);
                                    }, 500);
                                  }}
                                />
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>📷</span>
                                  <span>{attachment.filename}</span>
                                  <span>({(attachment.size / 1024).toFixed(1)} KB)</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600">📎</span>
                                <AttachmentPreview attachment={attachment} view="comment">
                                  <a
                                    href={`/api/files/${attachment.path}`}
                                    download={attachment.filename}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    {attachment.filename}
                                  </a>
                                </AttachmentPreview>
                                <span className="text-gray-400">({(attachment.size / 1024).toFixed(1)} KB)</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Simple Attachment and Emoji Buttons */}
          {!isFormDisabled && (
            <div className="mt-4 flex justify-between items-center">
              <div className="flex gap-1">
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.zip"
                  className="hidden"
                  id="attachment-input"
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    files.forEach(file => {
                      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
                      setAttachments(prev => [...prev, { file, previewUrl, id: Date.now() + Math.random(), isFile: true }]);
                    });
                    e.target.value = '';
                  }}
                />
                <label
                  htmlFor="attachment-input"
                  className="cursor-pointer p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Add attachment"
                >
                  <PaperClipIcon className="h-5 w-5" />
                </label>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Add emoji"
                >
                  😀
                </button>
              </div>
              <div className="flex gap-4">
                <a
                  href="/"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Return Home
                </a>
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Jump to top ↑
                </button>
              </div>
            </div>
          )}
          
          {/* Comment Form or Locked Message */}
          <ConversationForm issueId={issueId} issue={issue} user={user} onCommentAdded={fetchComments} attachments={attachments} setAttachments={setAttachments} showEmojiPicker={showEmojiPicker} setShowEmojiPicker={setShowEmojiPicker} />
        </div>
      )}
      
      {/* Image Hover Preview Portal */}
      {hoveredImage && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed z-50 pointer-events-none"
          style={{
            left: Math.min(hoveredImage.x + 10, window.innerWidth - 320),
            top: Math.max(hoveredImage.y - 250, 10)
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl border border-gray-300 overflow-hidden pointer-events-auto max-w-2xl max-h-[48rem]"
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
              }
            }}
            onMouseLeave={() => setHoveredImage(null)}
          >
            <img
              src={`/api/files/${hoveredImage.path}`}
              alt={hoveredImage.filename}
              className="max-w-full max-h-[40rem] object-contain"
              style={{ minWidth: '400px', minHeight: '300px' }}
            />
            <div className="p-3">
              <p className="font-semibold text-gray-900 text-sm mb-1 truncate">
                {hoveredImage.filename}
              </p>
              <p className="text-xs text-gray-500 mb-2">
                {(hoveredImage.size / 1024).toFixed(1)} KB
              </p>
              <a
                href={`/api/files/${hoveredImage.path}`}
                download={hoveredImage.filename}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function FollowButton({ issueId }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkFollowStatus = async () => {
    try {
      const response = await fetch(`/api/issues/${issueId}/follow`);
      const data = await response.json();
      setFollowing(data.following);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  useEffect(() => {
    checkFollowStatus();
    
    // Listen for custom follow update events from the main SSE connection
    const handleFollowUpdate = (event) => {
      if (event.detail.issueId === issueId) {
        console.log('FollowButton: Received follow update:', event.detail);
        setFollowing(event.detail.following);
      }
    };
    
    window.addEventListener('followUpdated', handleFollowUpdate);
    
    return () => {
      window.removeEventListener('followUpdated', handleFollowUpdate);
    };
  }, [issueId]);

  const handleFollow = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/issues/${issueId}/follow`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        setFollowing(data.following);
      }
    } catch (error) {
      console.error('Error following issue:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleFollow}
      disabled={loading}
      title={following ? 'Unfollow this issue' : 'Follow this issue for notifications'}
      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 ${
        following 
          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
          : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
      }`}
    >
      <EyeIcon className="h-4 w-4" />
      {loading ? 'Loading...' : following ? 'Following' : 'Follow'}
    </button>
  );
}

export default function IssuePage({ params }) {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [searchParams, setSearchParams] = useState(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSearchParams(new URLSearchParams(window.location.search));
    }
  }, []);
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upvoting, setUpvoting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusHistory, setShowStatusHistory] = useState(false);
  const [statusHistory, setStatusHistory] = useState([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionComment, setResolutionComment] = useState('');
  const [pendingStatus, setPendingStatus] = useState('');
  const [admins, setAdmins] = useState([]);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [upvoters, setUpvoters] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [visibilityData, setVisibilityData] = useState(null);

  const fetchIssue = useCallback(async () => {
    try {
      const response = await fetch(`/api/issues/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setIssue(data.issue);
        await loadVisibilityData(data.issue);
      } else if (response.status === 404) {
        console.error('Issue not found:', params.id);
        setIssue(null);
      } else {
        console.error('Error fetching issue:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching issue:', error);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchStatusHistory = async () => {
    try {
      const response = await fetch(`/api/issues/${params.id}/status-history`);
      if (response.ok) {
        const data = await response.json();
        setStatusHistory(data.history);
      }
    } catch (error) {
      console.error('Error fetching status history:', error);
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/admin/get-leaders');
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.leaders);
      }
    } catch (error) {
      console.error('Error fetching leaders:', error);
    }
  };

  const fetchUpvoters = async () => {
    try {
      const response = await fetch(`/api/issues/${params.id}/upvoters`);
      if (response.ok) {
        const data = await response.json();
        setUpvoters(data.upvoters);
      }
    } catch (error) {
      console.error('Error fetching upvoters:', error);
    }
  };

  const loadVisibilityData = async (issue) => {
    if (issue?.issue_type === 'Leadership Question') {
      const data = await fetchLeadershipVisibilityData(issue);
      setVisibilityData(data);
    }
  };

  const handleAssignmentUpdate = async (assignedTo) => {
    setUpdatingAssignment(true);
    try {
      const response = await fetch(`/api/issues/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo })
      });
      
      if (response.ok) {
        const data = await response.json();
        setIssue(data.issue);
      } else {
        alert('Failed to update assignment.');
      }
    } catch (error) {
      console.error('Assignment update error:', error);
      alert('Failed to update assignment.');
    } finally {
      setUpdatingAssignment(false);
    }
  };

  const handleAssignmentAndStatusUpdate = async () => {
    if (!selectedAssignment) {
      alert('Please select an admin to assign this issue to.');
      return;
    }
    
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/issues/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          assignedTo: selectedAssignment,
          status: pendingStatusChange
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setIssue(data.issue);
        setShowAssignmentModal(false);
        setPendingStatusChange('');
        setSelectedAssignment('');
        setTimeout(() => {
          fetchIssue();
        }, 100);
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to update issue.');
      }
    } catch (error) {
      console.error('Assignment and status update error:', error);
      alert('Failed to update issue.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchIssue();
      fetchUpvoters();
      if (user.isAdmin) {
        fetchAdmins();
      }
    }
  }, [params.id, user, fetchIssue]);

  const handleUpvote = async () => {
    setUpvoting(true);
    try {
      const response = await fetch('/api/upvote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: params.id })
      });
      
      if (response.ok) {
        alert('Thank you for your upvote!');
      } else {
        alert('Failed to upvote. Please try again.');
      }
    } catch (error) {
      console.error('Upvote error:', error);
      alert('Failed to upvote. Please try again.');
    } finally {
      setUpvoting(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    // Check if assignment is required (moving from Open to any other status)
    if (issue.status === 'Open' && newStatus !== 'Open' && !issue.assigned_to) {
      setPendingStatusChange(newStatus);
      setSelectedAssignment('');
      setShowAssignmentModal(true);
      return;
    }
    
    if (newStatus === 'Closed' && issue.status !== 'Closed') {
      setPendingStatus(newStatus);
      setShowResolutionModal(true);
      return;
    }
    
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/issues/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        const data = await response.json();
        setIssue(data.issue);
        setTimeout(() => {
          fetchIssue();
        }, 100);
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to update status.');
      }
    } catch (error) {
      console.error('Status update error:', error);
      alert('Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleResolutionSubmit = async () => {
    if (!resolutionComment.trim()) {
      alert('Please enter a resolution comment.');
      return;
    }
    
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/issues/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: pendingStatus,
          resolutionComment: resolutionComment.trim()
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setIssue(data.issue);
        setShowResolutionModal(false);
        setResolutionComment('');
        setPendingStatus('');
        setTimeout(() => {
          fetchIssue();
        }, 100);
      } else {
        alert('Failed to update status.');
      }
    } catch (error) {
      console.error('Status update error:', error);
      alert('Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleTitleEdit = () => {
    setEditedTitle(issue.title);
    setEditingTitle(true);
  };

  const handleDescriptionEdit = () => {
    setEditedDescription(issue.description);
    setEditingDescription(true);
  };

  const handleTitleSave = async () => {
    if (!editedTitle.trim()) return;
    
    setUpdating(true);
    try {
      const response = await fetch(`/api/issues/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editedTitle })
      });
      
      if (response.ok) {
        const data = await response.json();
        setIssue(data.issue);
        setEditingTitle(false);
      } else {
        alert('Failed to update title.');
      }
    } catch (error) {
      console.error('Title update error:', error);
      alert('Failed to update title.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDescriptionSave = async () => {
    if (!editedDescription.trim()) return;
    
    setUpdating(true);
    try {
      const response = await fetch(`/api/issues/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editedDescription })
      });
      
      if (response.ok) {
        const data = await response.json();
        setIssue(data.issue);
        setEditingDescription(false);
      } else {
        alert('Failed to update description.');
      }
    } catch (error) {
      console.error('Description update error:', error);
      alert('Failed to update description.');
    } finally {
      setUpdating(false);
    }
  };

  const canEdit = user && (user.email === issue?.email || user.isAdmin);
  const canDelete = user && (user.email === issue?.email || user.isAdmin);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/issues/${params.id}/delete`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        router.push('/');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete issue');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete issue');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };



  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Issue Not Found</h1>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const attachments = JSON.parse(issue.attachments || '[]');

  return (
    <AccessCheck user={user}>
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={logout} />
        
        <SidebarLayout user={user}>
          <div className="p-8">
        <Breadcrumb items={[
          ...(searchParams?.get('from') === 'leadership' 
            ? [{ label: 'Practice Leadership View', href: '/practice-issues-leadership' }] 
            : [{ label: 'Practice Issues', href: '/practice-issues' }]),
          { label: `Issue #${issue?.issue_number || params.id}` }
        ]} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Main Content */}
          <div className="lg:col-span-2 flex">
            <div className="card flex-1">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {attachments.length > 0 && (
                      attachments.length === 1 ? (
                        <AttachmentPreview attachment={attachments[0]}>
                          <a
                            href={`/api/files/${attachments[0].path}`}
                            download={attachments[0].filename}
                            title={attachments[0].filename}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95"
                          >
                            <PaperClipIcon className="h-5 w-5" />
                          </a>
                        </AttachmentPreview>
                      ) : (
                        <MultiAttachmentPreview attachments={attachments}>
                          <div className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95">
                            <PaperClipIcon className="h-5 w-5" />
                            <span className="ml-1 text-xs">{attachments.length}</span>
                          </div>
                        </MultiAttachmentPreview>
                      )
                    )}
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">Issue Details - #{issue.issue_number}</h1>
                      {getLeadershipVisibilityText(issue, user, visibilityData) && (
                        <p className="text-sm text-orange-600 mt-1">
                          {getLeadershipVisibilityText(issue, user, visibilityData)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpvote}
                        disabled={upvoting || issue.email === user?.email}
                        title={issue.email === user?.email ? 'Cannot upvote your own issue' : 'I agree or I\'m having this same issue'}
                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-150 ${
                          issue.email === user?.email 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 hover:scale-105 active:scale-95'
                        }`}
                      >
                        <HandThumbUpIcon className="h-4 w-4" />
                        {upvoting ? 'Upvoting...' : (issue.upvotes || 0)}
                      </button>
                      <FollowButton issueId={params.id} />
                    </div>
                    <div className="flex items-center gap-2">
                      {user?.isAdmin ? (
                        <select
                          value={issue.status}
                          onChange={(e) => handleStatusUpdate(e.target.value)}
                          disabled={updatingStatus}
                          className={`px-3 py-1 rounded-full text-sm font-medium border-0 focus:ring-2 focus:ring-blue-500 ${
                            issue.status === 'Open' ? 'bg-red-100 text-red-800' :
                            issue.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          } disabled:opacity-50`}
                        >
                          {[
                            { value: 'Backlog', label: 'Backlog' },
                            { value: 'Closed', label: 'Closed' },
                            { value: 'In Progress', label: 'In Progress' },
                            { value: 'Open', label: 'Open' },
                            { value: 'Pending Testing', label: 'Pending Testing' },
                            { value: 'Rejected', label: 'Rejected' }
                          ].sort((a, b) => a.label.localeCompare(b.label)).map(status => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          issue.status === 'Open' ? 'bg-red-100 text-red-800' :
                          issue.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {issue.status}
                        </span>
                      )}
                      
                      {canDelete && (
                        <button
                          onClick={() => setShowDeleteModal(true)}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-all duration-150 hover:scale-105 active:scale-95"
                          title="Delete this issue permanently"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {issue.problem_link && (
                  <p className="text-gray-600">
                    Problem Link: <a 
                      href={issue.problem_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 break-all"
                    >
                      {issue.problem_link}
                    </a>
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">Title</h2>
                    {canEdit && !editingTitle && (
                      <button
                        onClick={handleTitleEdit}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded"
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                  {editingTitle ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={updating}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleTitleSave}
                          disabled={updating || !editedTitle.trim()}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {updating ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingTitle(false)}
                          disabled={updating}
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-base text-gray-700">{issue.title}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">Description</h2>
                    {canEdit && !editingDescription && (
                      <button
                        onClick={handleDescriptionEdit}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded"
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                  {editingDescription ? (
                    <div className="space-y-2">
                      <textarea
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        rows="4"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={updating}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleDescriptionSave}
                          disabled={updating || !editedDescription.trim()}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {updating ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingDescription(false)}
                          disabled={updating}
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{issue.description}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="card flex-1">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Issue Information</h3>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Type</dt>
                    <dd className="text-sm text-gray-900 font-medium">{issue.issue_type}</dd>
                  </div>
                  {issue.system && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">System</dt>
                      <dd className="text-sm text-gray-900 font-medium">{issue.system}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Practice</dt>
                    <dd className="text-sm text-gray-900 font-medium">{issue.practice || 'No Practice'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Submitted by</dt>
                    <dd className="text-sm text-gray-900">
                      <UserDisplay email={issue.email} />
                    </dd>
                  </div>
                  {upvoters.length > 0 && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Upvoted By</dt>
                      <dd className="text-sm text-gray-900">
                        <div className="space-y-1">
                          {upvoters.slice(0, 3).map((upvoter, index) => (
                            <div key={upvoter.user_email}>
                              <UserDisplay email={upvoter.user_email} />
                              {index < Math.min(upvoters.length, 3) - 1 && ', '}
                            </div>
                          ))}
                          {upvoters.length > 3 && (
                            <div className="text-xs text-gray-500">
                              and {upvoters.length - 3} more
                            </div>
                          )}
                        </div>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Created</dt>
                    <dd className="text-sm text-gray-900">
                      <TimestampDisplay timestamp={issue.created_at} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Last Updated</dt>
                    <dd className="text-sm text-gray-900">
                      <TimestampDisplay timestamp={issue.last_updated_at} relative={true} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Assigned to</dt>
                    {user?.isAdmin ? (
                      <select
                        value={issue.assigned_to || ''}
                        onChange={(e) => handleAssignmentUpdate(e.target.value)}
                        disabled={updatingAssignment}
                        className="text-sm bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="">Unassigned</option>
                        {(() => {
                          // Practice-specific leaders (practice_manager and practice_principal for this practice)
                          const practiceLeaders = admins.filter(leader => 
                            (leader.role === 'practice_manager' || leader.role === 'practice_principal') &&
                            leader.practices && leader.practices.includes(issue.practice)
                          ).sort((a, b) => {
                            // Sort by role first (practice_manager before practice_principal), then by name
                            if (a.role !== b.role) {
                              return a.role === 'practice_manager' ? -1 : 1;
                            }
                            return a.name.localeCompare(b.name);
                          });
                          
                          // All other leaders (other practice managers, practice principals, and admins)
                          const otherLeaders = admins.filter(leader => 
                            !practiceLeaders.some(pl => pl.email === leader.email)
                          ).sort((a, b) => a.name.localeCompare(b.name));
                          
                          return [
                            ...practiceLeaders.map(leader => (
                              <option key={leader.email} value={leader.name}>
                                {leader.name} ({leader.role.replace('_', ' ')} - {issue.practice})
                              </option>
                            )),
                            practiceLeaders.length > 0 && otherLeaders.length > 0 && (
                              <option key="separator" disabled>──────────</option>
                            ),
                            ...otherLeaders.map(leader => (
                              <option key={leader.email} value={leader.name}>
                                {leader.name} ({leader.isAdmin ? 'admin' : leader.role.replace('_', ' ')})
                              </option>
                            ))
                          ];
                        })()}
                      </select>
                    ) : (
                      <dd className="text-sm text-gray-900">{issue.assigned_to || 'Unassigned'}</dd>
                    )}
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        fetchStatusHistory();
                        setShowStatusHistory(true);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      View Status History
                    </button>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Conversation Section - Full Width */}
        <div className="mt-8">
          <div className="mb-4 text-right">
            <button
              onClick={() => {
                const scrollToBottom = () => {
                  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                };
                scrollToBottom();
                // Re-scroll after images load
                setTimeout(scrollToBottom, 500);
                setTimeout(scrollToBottom, 1000);
                setTimeout(scrollToBottom, 2000);
                setTimeout(scrollToBottom, 3000);
              }}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Jump to bottom of Conversation ↓
            </button>
          </div>
          <div className="card">
            <ConversationSection issueId={params.id} issue={issue} user={user} onIssueUpdate={fetchIssue} />
          </div>
        </div>

        {/* Assignment Required Modal */}
        {showAssignmentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Assignment Required</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Before changing the status from "Open" to "{pendingStatusChange}", this issue must be assigned to an admin.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign to Admin:
                    </label>
                    <select
                      value={selectedAssignment}
                      onChange={(e) => setSelectedAssignment(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a leader...</option>
                      {(() => {
                        // Practice-specific leaders (practice_manager and practice_principal for this practice)
                        const practiceLeaders = admins.filter(leader => 
                          (leader.role === 'practice_manager' || leader.role === 'practice_principal') &&
                          leader.practices && leader.practices.includes(issue.practice)
                        ).sort((a, b) => {
                          // Sort by role first (practice_manager before practice_principal), then by name
                          if (a.role !== b.role) {
                            return a.role === 'practice_manager' ? -1 : 1;
                          }
                          return a.name.localeCompare(b.name);
                        });
                        
                        // All other leaders (other practice managers, practice principals, and admins)
                        const otherLeaders = admins.filter(leader => 
                          !practiceLeaders.some(pl => pl.email === leader.email)
                        ).sort((a, b) => a.name.localeCompare(b.name));
                        
                        return [
                          ...practiceLeaders.map(leader => (
                            <option key={leader.email} value={leader.name}>
                              {leader.name} ({leader.role.replace('_', ' ')})
                            </option>
                          )),
                          practiceLeaders.length > 0 && otherLeaders.length > 0 && (
                            <option key="separator" disabled>──────────</option>
                          ),
                          ...otherLeaders.map(leader => (
                            <option key={leader.email} value={leader.name}>
                              {leader.name} ({leader.isAdmin ? 'admin' : leader.role.replace('_', ' ')})
                            </option>
                          ))
                        ].filter(Boolean);
                      })()}
                    </select>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAssignmentModal(false);
                      setPendingStatusChange('');
                      setSelectedAssignment('');
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignmentAndStatusUpdate}
                    disabled={!selectedAssignment || updatingStatus}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updatingStatus ? 'Updating...' : `Assign & Change Status`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resolution Comment Modal */}
        {showResolutionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Final Resolution Comment</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Please provide a final resolution comment before closing this issue.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <textarea
                      value={resolutionComment}
                      onChange={(e) => setResolutionComment(e.target.value)}
                      maxLength={1000}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Describe how this issue was resolved..."
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">Required</span>
                      <span className="text-xs text-gray-500">
                        {resolutionComment.length}/1000 characters
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowResolutionModal(false);
                      setResolutionComment('');
                      setPendingStatus('');
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResolutionSubmit}
                    disabled={!resolutionComment.trim() || updatingStatus}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updatingStatus ? 'Closing...' : 'Close Issue'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Delete Issue</h3>
                    <p className="text-sm text-gray-600">This action cannot be undone</p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <p className="text-sm text-gray-700 mb-3">
                    Are you sure you want to permanently delete this issue?
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 border">
                    <p className="text-sm font-medium text-gray-900 mb-1">Issue #{issue.issue_number}</p>
                    <p className="text-sm text-gray-600 truncate">{issue.title}</p>
                  </div>
                  <div className="mt-3 text-xs text-red-600">
                    <p>⚠️ This will permanently delete:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>The issue and all its data</li>
                      <li>All comments and attachments</li>
                      <li>All upvotes and follows</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Issue
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status History Modal */}
        {showStatusHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Status History - Issue #{issue.issue_number}</h3>
                  <button
                    onClick={() => setShowStatusHistory(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  {/* Issue Created */}
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <div className="w-0.5 h-8 bg-gray-200"></div>
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">Issue Created</span>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Open</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Created by <UserDisplay email={issue.email} />
                      </p>
                      <TimestampDisplay timestamp={issue.created_at} className="text-xs text-gray-500" />
                    </div>
                  </div>
                  
                  {/* Status Changes */}
                  {statusHistory.length === 0 ? (
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm text-gray-600 italic">
                          No status change history available. Status logging was implemented after this issue was created.
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Current status: <span className="font-medium">{issue.status}</span>
                        </p>
                      </div>
                    </div>
                  ) : statusHistory.map((change, index) => {
                    const isLast = index === statusHistory.length - 1;
                    const getStatusColor = (status) => {
                      switch (status) {
                        case 'Open': return 'bg-red-500';
                        case 'In Progress': return 'bg-yellow-500';
                        case 'Closed': return 'bg-green-500';
                        default: return 'bg-gray-500';
                      }
                    };
                    
                    return (
                      <div key={change.id} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(change.to_status)}`}></div>
                          {!isLast && <div className="w-0.5 h-8 bg-gray-200"></div>}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">Status Changed</span>
                            <span className="text-sm text-gray-600">
                              {change.from_status} → {change.to_status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">Changed by {change.changed_by}</p>
                          <TimestampDisplay timestamp={change.changed_at} className="text-xs text-gray-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          )}
          </div>
        </SidebarLayout>
      </div>
    </AccessCheck>
  );
}