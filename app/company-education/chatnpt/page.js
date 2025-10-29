'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import SidebarLayout from '../../../components/SidebarLayout';
import Navbar from '../../../components/Navbar';
import Breadcrumb from '../../../components/Breadcrumb';
import AccessCheck from '../../../components/AccessCheck';

export default function ChatNPTPage() {
  const { user, loading, logout } = useAuth();
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCitationsModal, setShowCitationsModal] = useState(false);
  const [selectedCitations, setSelectedCitations] = useState([]);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  const formatTimestamp = (timestamp) => {
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseInt(parts[2]);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  };

  useEffect(() => {
    if (user?.email) {
      loadChatHistory();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentChatId && messages.length > 0) {
      saveChatHistory();
    }
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/chatnpt/history?userEmail=${encodeURIComponent(user.email)}`);
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
        if (data.chats && data.chats.length > 0) {
          const lastChat = data.chats[0];
          setCurrentChatId(lastChat.chatId);
          setMessages(lastChat.messages || []);
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveChatHistory = async () => {
    if (!user?.email || !currentChatId) return;
    
    try {
      await fetch('/api/chatnpt/history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          chatId: currentChatId,
          messages
        })
      });
    } catch (error) {
      console.error('Error saving chat:', error);
    }
  };

  const createNewChat = async () => {
    setCurrentChatId(null);
    setMessages([]);
  };

  const loadChat = (chat) => {
    setCurrentChatId(chat.chatId);
    setMessages(chat.messages || []);
  };

  const renameChat = async (chatId, newTitle) => {
    try {
      await fetch('/api/chatnpt/history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          chatId,
          title: newTitle
        })
      });
      setEditingChatId(null);
      await loadChatHistory();
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const deleteChat = async (chatId) => {
    if (!confirm('Delete this chat?')) return;
    
    try {
      await fetch(`/api/chatnpt/history?userEmail=${encodeURIComponent(user.email)}&chatId=${chatId}`, {
        method: 'DELETE'
      });
      
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([]);
      }
      
      await loadChatHistory();
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const searchChats = () => {
    if (!searchQuery.trim()) return chats;
    
    const query = searchQuery.toLowerCase();
    return chats.filter(chat => {
      if (chat.title.toLowerCase().includes(query)) return true;
      return chat.messages?.some(msg => 
        msg.content?.toLowerCase().includes(query)
      );
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let chatIdToUse = currentChatId;
    
    if (!currentChatId) {
      try {
        const response = await fetch('/api/chatnpt/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: user.email,
            messages: newMessages
          })
        });
        if (response.ok) {
          const data = await response.json();
          chatIdToUse = data.chatId;
          setCurrentChatId(data.chatId);
          await loadChatHistory();
        }
      } catch (error) {
        console.error('Error creating chat:', error);
      }
    }

    try {
      const response = await fetch('/api/chatnpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input })
      });

      const data = await response.json();
      
      if (response.ok) {
        const assistantMessage = { 
          role: 'assistant', 
          content: data.answer,
          sources: data.sources 
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = { 
          role: 'assistant', 
          content: data.error || 'Sorry, I encountered an error. Please try again.' 
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AccessCheck user={user}>
      <div className="min-h-screen">
        <Navbar user={user} onLogout={logout} />
        
        <SidebarLayout user={user}>
          <div className="p-8">
            <Breadcrumb items={[
              { label: 'Company Education' },
              { label: 'Chat with Netsync Practice Tools (ChatNPT)' }
            ]} />
            
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Chat with Netsync Practice Tools (ChatNPT)</h1>
              <p className="text-sm text-gray-500 mt-2">Ask questions about approved WebEx meeting recordings</p>
            </div>

            <div className="flex gap-4 h-[calc(100vh-16rem)]">
              <div className="w-64 border border-gray-200 bg-white rounded-lg shadow-sm p-4 overflow-y-auto">
                <button
                  onClick={createNewChat}
                  className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Chat
                </button>
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="w-full mb-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search Chats
                </button>
                <div className="space-y-2">
                  {chats.map((chat) => (
                    <div key={chat.chatId} className="group relative">
                      {editingChatId === chat.chatId ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameChat(chat.chatId, editingTitle);
                              if (e.key === 'Escape') setEditingChatId(null);
                            }}
                            className="flex-1 px-2 py-1 text-sm border rounded"
                            autoFocus
                          />
                          <button onClick={() => renameChat(chat.chatId, editingTitle)} className="px-2 text-green-600 hover:text-green-800">
                            ✓
                          </button>
                          <button onClick={() => setEditingChatId(null)} className="px-2 text-red-600 hover:text-red-800">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => loadChat(chat)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              currentChatId === chat.chatId
                                ? 'bg-blue-100 text-blue-900 font-medium'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            <div className="truncate pr-12" title={chat.title}>{chat.title}</div>
                            <div className="text-xs text-gray-500 mt-1">{new Date(chat.created_at).toLocaleString()}</div>
                          </button>
                          <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingChatId(chat.chatId);
                                setEditingTitle(chat.title);
                              }}
                              className="p-1 text-gray-500 hover:text-blue-600 rounded"
                              title="Rename"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteChat(chat.chatId);
                              }}
                              className="p-1 text-gray-500 hover:text-red-600 rounded"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 flex flex-col">
              <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-md">
                      <svg className="w-16 h-16 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a Conversation</h3>
                      <p className="text-gray-500">Ask me anything about the content in approved WebEx meeting recordings.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-3xl rounded-lg px-4 py-3 ${
                        msg.role === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-300">
                            <p className="text-xs font-semibold mb-2">Sources ({msg.sources.length} citations):</p>
                            <div className="space-y-1">
                              {msg.sources.slice(0, 5).map((source, sidx) => (
                                <div key={sidx} className="text-xs truncate">
                                  • <a 
                                      href={source.downloadUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline"
                                    >
                                      {source.topic}
                                    </a> at {formatTimestamp(source.timestamp)} {source.text && <span className="text-gray-500" title={source.text}>("{source.text.substring(0, 50)}...")</span>}
                                </div>
                              ))}
                              {msg.sources.length > 5 && (
                                <button
                                  onClick={() => {
                                    setSelectedCitations(msg.sources);
                                    setShowCitationsModal(true);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  View all {msg.sources.length} citations
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        <span className="text-gray-600">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="border-t border-gray-200 p-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question about the recordings..."
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send
                  </button>
                </form>
              </div>
              </div>
            </div>
            </div>
          </div>
        </SidebarLayout>
      </div>

      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowSearchModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Search Chats</h3>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chat titles and messages..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {searchChats().length === 0 ? (
                <p className="text-center text-gray-500 py-8">No chats found</p>
              ) : (
                <div className="space-y-2">
                  {searchChats().map((chat) => (
                    <button
                      key={chat.chatId}
                      onClick={() => {
                        loadChat(chat);
                        setShowSearchModal(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left p-3 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{chat.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{new Date(chat.created_at).toLocaleString()}</div>
                      <div className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {chat.messages?.[0]?.content?.substring(0, 100)}...
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCitationsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCitationsModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">All Citations ({selectedCitations.length})</h3>
              <button
                onClick={() => setShowCitationsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {selectedCitations.map((source, idx) => (
                  <div key={idx} className="text-sm py-2 border-b border-gray-100 last:border-0">
                    {idx + 1}. <a 
                      href={source.downloadUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {source.topic}
                    </a> at {formatTimestamp(source.timestamp)} {source.text && <span className="text-gray-500" title={source.text}>("{source.text.substring(0, 50)}...")</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AccessCheck>
  );
}
