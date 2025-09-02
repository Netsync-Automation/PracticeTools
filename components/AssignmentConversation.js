'use client';

import { useState, useEffect, useRef } from 'react';
import { PaperClipIcon, XMarkIcon, DocumentIcon, PhotoIcon } from '@heroicons/react/24/outline';
import TimestampDisplay from './TimestampDisplay';
import UserDisplay from './UserDisplay';
import AttachmentPreview from './AttachmentPreview';

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

function ConversationForm({ assignmentId, user, onCommentAdded, attachments, setAttachments, showEmojiPicker, setShowEmojiPicker }) {
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
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const file = new File([blob], `pasted-image-${timestamp}.png`, { type: blob.type || 'image/png' });
          
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
      
      attachments.forEach(file => {
        formData.append('attachments', file);
      });
      
      pastedImages.forEach(img => {
        formData.append('attachments', img.file);
      });

      const response = await fetch(`/api/assignments/${assignmentId}/comments`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setNewComment('');
        setPastedImages([]);
        attachments.forEach(att => att.previewUrl && URL.revokeObjectURL(att.previewUrl));
        setAttachments([]);
        onCommentAdded();
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

  return (
    <form onSubmit={handleSubmit} className="mt-4">
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
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Add a comment... (Press Enter to submit, Shift+Enter for new line, Ctrl+V to paste images)"
          rows={(pastedImages.length > 0 || attachments.length > 0) ? "6" : "3"}
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          disabled={submitting}
        />
        
        {(pastedImages.length > 0 || attachments.length > 0) && (
          <div className="absolute bottom-3 left-3 right-3 bg-gray-50 border border-gray-200 rounded p-2">
            <div className="flex flex-wrap gap-2">
              {pastedImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.previewUrl}
                    alt="Pasted image preview"
                    className="w-16 h-16 object-cover rounded border border-gray-300"
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
        disabled={(!newComment.trim() && attachments.length === 0 && pastedImages.length === 0) || submitting}
        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Adding...' : 'Add Comment/Add Attachment'}
      </button>
    </form>
  );
}

export default function AssignmentConversation({ assignmentId, user }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isImageFile = (filename) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
    
    let eventSource;
    let reconnectTimer;
    
    const connectSSE = () => {
      console.log(`Connecting SSE for assignment: ${assignmentId}`);
      eventSource = new EventSource(`/api/events?assignmentId=${assignmentId}`);
      
      eventSource.onopen = () => {
        console.log(`SSE connection opened for assignment: ${assignmentId}`);
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`[SSE-${assignmentId}] Message:`, data);
          
          if (data.type === 'assignment_comment_added') {
            if (data.assignmentId === assignmentId) {
              console.log(`New comment added to assignment ${assignmentId}`);
              fetchComments();
              
              // Play notification sound
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
                
                const handleVisibilityChange = () => {
                  if (!document.hidden) {
                    clearInterval(flashInterval);
                    document.title = originalTitle;
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                  }
                };
                document.addEventListener('visibilitychange', handleVisibilityChange);
              }
            }
          }
        } catch (error) {
          console.error(`[SSE-${assignmentId}] Error parsing message:`, error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error(`SSE connection error for assignment ${assignmentId}:`, error);
        
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
    
    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [assignmentId]);

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
          </div>
          
          <ConversationForm 
            assignmentId={assignmentId} 
            user={user} 
            onCommentAdded={fetchComments} 
            attachments={attachments} 
            setAttachments={setAttachments} 
            showEmojiPicker={showEmojiPicker} 
            setShowEmojiPicker={setShowEmojiPicker} 
          />
        </div>
      )}
    </div>
  );
}