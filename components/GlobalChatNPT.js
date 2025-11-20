'use client';

import { useState, useEffect } from 'react';
import ChatNPTWidget from './ChatNPTWidget';

export default function GlobalChatNPT({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDataSources, setShowDataSources] = useState(false);
  const [dataSources, setDataSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const chatWidget = ChatNPTWidget({ user });

  useEffect(() => {
    if (isOpen && chatWidget.messages.length > 0) {
      setTimeout(() => {
        chatWidget.messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen]);

  const fetchDataSources = async () => {
    setLoadingSources(true);
    try {
      const response = await fetch('/api/chatnpt/sources');
      if (response.ok) {
        const data = await response.json();
        setDataSources(data.sources || []);
      }
    } catch (error) {
      console.error('Error fetching data sources:', error);
    } finally {
      setLoadingSources(false);
    }
  };

  useEffect(() => {
    if (showDataSources && dataSources.length === 0) {
      fetchDataSources();
    }
  }, [showDataSources]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl + ` (Windows/Linux) or Cmd + ` (Mac) to toggle ChatNPT
      if ((event.ctrlKey || event.metaKey) && event.key === '`') {
        event.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Escape to close ChatNPT when open
      else if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!user) return null;

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
        title="Open ChatNPT"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">ChatNPT</h2>
                  <p className="text-sm text-blue-100">AI Assistant for Practice Tools</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const lastUserMessage = chatWidget.messages.filter(m => m.role === 'user').pop();
                    const lastAssistantMessage = chatWidget.messages.filter(m => m.role === 'assistant').pop();
                    
                    if (lastUserMessage && lastAssistantMessage) {
                      // Create a concise title that fits within 100 characters
                      const userInput = lastUserMessage.content.trim();
                      const maxQuestionLength = 60; // Leave room for "ChatNPT issue: " prefix
                      
                      let questionPreview = userInput;
                      if (userInput.length > maxQuestionLength) {
                        // Find the last complete word within the limit
                        questionPreview = userInput.substring(0, maxQuestionLength);
                        const lastSpace = questionPreview.lastIndexOf(' ');
                        if (lastSpace > 20) { // Ensure we have meaningful content
                          questionPreview = questionPreview.substring(0, lastSpace);
                        }
                        questionPreview += '...';
                      }
                      
                      const title = `ChatNPT issue: ${questionPreview}`;
                      const description = `Inputted: ${lastUserMessage.content}\n\nResponse: ${lastAssistantMessage.content}\n\n<Update additional context explaining what the response should have been>`;
                      
                      const params = new URLSearchParams({
                        issueType: 'Bug Report',
                        title: title,
                        description: description
                      });
                      
                      window.location.href = `/new-issue?${params.toString()}`;
                    } else {
                      alert('No conversation history to report on.');
                    }
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2"
                  title="Report an issue with ChatNPT response"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Report Issue
                </button>
                <button
                  onClick={() => setShowDataSources(true)}
                  className="px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                  Data Sources
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg text-white hover:bg-white/20 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Chat Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <div className="w-72 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
                <button
                  onClick={chatWidget.createNewChat}
                  className="w-full mb-3 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Chat
                </button>
                <button
                  onClick={() => chatWidget.setShowSearchModal(true)}
                  className="w-full mb-4 px-4 py-2.5 bg-white text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors flex items-center justify-center gap-2 shadow-sm border border-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </button>
                <div className="space-y-2">
                  {chatWidget.chats.map((chat) => (
                    <div key={chat.chatId} className="group relative">
                      {chatWidget.editingChatId === chat.chatId ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={chatWidget.editingTitle}
                            onChange={(e) => chatWidget.setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') chatWidget.renameChat(chat.chatId, chatWidget.editingTitle);
                              if (e.key === 'Escape') chatWidget.setEditingChatId(null);
                            }}
                            className="flex-1 px-2 py-1 text-sm border rounded"
                            autoFocus
                          />
                          <button onClick={() => chatWidget.renameChat(chat.chatId, chatWidget.editingTitle)} className="px-2 text-green-600 hover:text-green-800">
                            ✓
                          </button>
                          <button onClick={() => chatWidget.setEditingChatId(null)} className="px-2 text-red-600 hover:text-red-800">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => chatWidget.loadChat(chat)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                              chatWidget.currentChatId === chat.chatId
                                ? 'bg-blue-100 text-blue-900 font-medium shadow-sm'
                                : 'hover:bg-white text-gray-700'
                            }`}
                          >
                            <div className="truncate pr-12" title={chat.title}>{chat.title}</div>
                            <div className="text-xs text-gray-500 mt-1">{new Date(chat.created_at).toLocaleString()}</div>
                          </button>
                          <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                chatWidget.setEditingChatId(chat.chatId);
                                chatWidget.setEditingTitle(chat.title);
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
                                chatWidget.deleteChat(chat.chatId);
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

              {/* Main Chat Area */}
              <div className="flex-1 flex flex-col bg-white">
                <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">{chatWidget.currentChatTitle}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {chatWidget.messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center max-w-md">
                        <svg className="w-16 h-16 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a Conversation</h3>
                        <p className="text-gray-500">Ask me anything about approved WebEx recordings, messages, and documentation.</p>
                      </div>
                    </div>
                  ) : (
                    chatWidget.messages.map((msg, idx) => (
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
                                    • <span className="font-medium">({source.source})</span> <a 
                                        onClick={(e) => { e.preventDefault(); chatWidget.handleViewSource(source); }}
                                        href="#"
                                        className="text-blue-600 hover:text-blue-800 underline"
                                      >
                                        {source.topic}
                                      </a>{source.timestamp && ` at ${chatWidget.formatTimestamp(source.timestamp)}`} {source.text && <span className="text-gray-500" title={source.text}>("{source.text.substring(0, 50)}...")</span>}
                                  </div>
                                ))}
                                {msg.sources.length > 5 && (
                                  <button
                                    onClick={() => {
                                      chatWidget.setSelectedCitations(msg.sources);
                                      chatWidget.setShowCitationsModal(true);
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
                  {chatWidget.isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-lg px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                          <span className="text-gray-600">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatWidget.messagesEndRef} />
                </div>
                
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <form onSubmit={chatWidget.handleSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={chatWidget.input}
                      onChange={(e) => chatWidget.setInput(e.target.value)}
                      placeholder="Ask a question..."
                      disabled={chatWidget.isLoading}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      type="submit"
                      disabled={!chatWidget.input.trim() || chatWidget.isLoading}
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
      )}

      {/* Search Modal */}
      {chatWidget.showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => chatWidget.setShowSearchModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Search Chats</h3>
                <button onClick={() => chatWidget.setShowSearchModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                type="text"
                value={chatWidget.searchQuery}
                onChange={(e) => chatWidget.setSearchQuery(e.target.value)}
                placeholder="Search chat titles and messages..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {chatWidget.searchChats().length === 0 ? (
                <p className="text-center text-gray-500 py-8">No chats found</p>
              ) : (
                <div className="space-y-2">
                  {chatWidget.searchChats().map((chat) => (
                    <button
                      key={chat.chatId}
                      onClick={() => {
                        chatWidget.loadChat(chat);
                        chatWidget.setShowSearchModal(false);
                        chatWidget.setSearchQuery('');
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

      {/* Source Details Modal */}
      {chatWidget.selectedSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => chatWidget.setSelectedSource(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Source Details</h3>
              <button onClick={() => chatWidget.setSelectedSource(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Source Type</label>
                <p className="text-gray-900 mt-1">{chatWidget.selectedSource.source}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Topic</label>
                <p className="text-gray-900 mt-1">{chatWidget.selectedSource.topic}</p>
              </div>
              {chatWidget.selectedSource.timestamp && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Timestamp</label>
                  <p className="text-gray-900 mt-1">{chatWidget.formatTimestamp(chatWidget.selectedSource.timestamp)}</p>
                </div>
              )}
              {chatWidget.selectedSource.date && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Date</label>
                  <p className="text-gray-900 mt-1">{new Date(chatWidget.selectedSource.date).toLocaleString()}</p>
                </div>
              )}
              {chatWidget.selectedSource.personEmail && (
                <div>
                  <label className="text-sm font-medium text-gray-500">From</label>
                  <p className="text-gray-900 mt-1">{chatWidget.selectedSource.personEmail}</p>
                </div>
              )}
              {chatWidget.selectedSource.uploadedBy && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Uploaded By</label>
                  <p className="text-gray-900 mt-1">{chatWidget.selectedSource.uploadedBy}</p>
                </div>
              )}
              {chatWidget.selectedSource.fileName && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Document Name</label>
                  <p className="text-gray-900 mt-1">{chatWidget.selectedSource.fileName}</p>
                </div>
              )}
              {chatWidget.selectedSource.chunkIndex !== undefined && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Document Section</label>
                  <p className="text-gray-900 mt-1">Chunk {chatWidget.selectedSource.chunkIndex + 1}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Content</label>
                <div className="bg-gray-50 rounded-lg p-4 mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                  {chatWidget.selectedSource.text}
                </div>
              </div>
              {chatWidget.selectedSource.attachments && chatWidget.selectedSource.attachments.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Attachments</label>
                  <div className="space-y-2 mt-2">
                    {chatWidget.selectedSource.attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm text-gray-900 truncate">{att.fileName}</span>
                          {att.status === 'available' ? (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">Available</span>
                          ) : att.status === 'infected' ? (
                            <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full">Infected</span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">{att.status}</span>
                          )}
                        </div>
                        {att.status === 'available' && att.s3Key && (
                          <a
                            href={`/api/webexmessaging/download?key=${encodeURIComponent(att.s3Key)}`}
                            className="ml-2 inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                            download
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              {(() => {
                console.log('DEBUG: selectedSource data:', JSON.stringify(chatWidget.selectedSource, null, 2));
                if (!chatWidget.selectedSource) {
                  console.log('DEBUG: No selectedSource');
                  return null;
                }
                
                const isPracticeInfo = chatWidget.selectedSource.source === 'Practice Information';
                const hasBoardId = !!chatWidget.selectedSource.boardId;
                const hasUrl = !!chatWidget.selectedSource.url;
                
                console.log('DEBUG: isPracticeInfo:', isPracticeInfo, 'hasBoardId:', hasBoardId, 'hasUrl:', hasUrl);
                
                if (isPracticeInfo && hasBoardId) {
                  console.log('DEBUG: Practice Info button - boardId:', chatWidget.selectedSource.boardId);
                  console.log('DEBUG: Practice Info button - boardTopic:', chatWidget.selectedSource.boardTopic);
                  return (
                    <button
                      onClick={() => {
                        const boardId = chatWidget.selectedSource.boardId;
                        const boardTopic = chatWidget.selectedSource.boardTopic || 'Main Topic';
                        
                        console.log('DEBUG: Opening practice-information page with URL params');
                        console.log('DEBUG: Target boardId:', boardId);
                        console.log('DEBUG: Target boardTopic:', boardTopic);
                        
                        // Navigate to practice-information page with URL parameters
                        const url = new URL('/practice-information', window.location.origin);
                        url.searchParams.set('boardId', boardId);
                        url.searchParams.set('topic', boardTopic);
                        
                        console.log('DEBUG: Generated URL:', url.toString());
                        window.location.href = url.toString();
                      }}
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View in Practice Tools
                    </button>
                  );
                } else if (hasUrl) {
                  console.log('DEBUG: Showing URL button');
                  return (
                    <a
                      href={chatWidget.selectedSource.url}
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View in Practice Tools
                    </a>
                  );
                } else {
                  console.log('DEBUG: No button shown - missing required data');
                  return null;
                }
              })()}
              {(chatWidget.selectedSource.source === 'Documentation' && chatWidget.selectedSource.docId) && (
                <a
                  href={`/api/documentation/download?id=${chatWidget.selectedSource.docId}`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  download
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
              )}
              {(chatWidget.selectedSource.source === 'Documents' && chatWidget.selectedSource.documentId) && (
                <a
                  href={`/api/documentation/download?id=${chatWidget.selectedSource.documentId}`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  download
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Document
                </a>
              )}
              {chatWidget.selectedSource.source === 'Webex Recordings' && (
                <>
                  {chatWidget.selectedSource.recordingId && (
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/webexmeetings/recordings/${chatWidget.selectedSource.recordingId}/transcript`);
                          if (response.ok) {
                            const data = await response.json();
                            chatWidget.setSelectedTranscript(data);
                            chatWidget.setShowTranscriptModal(true);
                          }
                        } catch (error) {
                          console.error('Error fetching transcript:', error);
                        }
                      }}
                      className="inline-flex items-center px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View Transcript
                    </button>
                  )}
                  {chatWidget.selectedSource.downloadUrl && (
                    <a
                      href={chatWidget.selectedSource.downloadUrl}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      download
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download MP4
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Data Sources Modal */}
      {showDataSources && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => setShowDataSources(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Available Data Sources</h3>
                <p className="text-sm text-gray-500 mt-1">Information the AI assistant can access to answer your questions</p>
              </div>
              <button onClick={() => setShowDataSources(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-6 overflow-y-auto flex-1">
              {loadingSources ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : dataSources.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-gray-500">No data sources available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dataSources.map((source, idx) => (
                    <div 
                      key={idx} 
                      className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-100 hover:shadow-md transition-all cursor-pointer hover:scale-[1.02]"
                      onClick={() => {
                        if (source.url) {
                          setShowDataSources(false);
                          window.location.href = source.url;
                        }
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          {source.icon === 'video' && (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                          {source.icon === 'chat' && (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          )}
                          {source.icon === 'document' && (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">{source.name}</h4>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                                {source.count} {source.count === 1 ? 'item' : 'items'}
                              </span>
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </div>
                          </div>
                          <p className="text-gray-600 text-sm">{source.description}</p>
                          <p className="text-xs text-blue-600 mt-2 font-medium">Click to view in application</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                The AI assistant searches across all available sources to provide accurate answers to your questions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Citations Modal */}
      {chatWidget.showCitationsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => chatWidget.setShowCitationsModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">All Citations ({chatWidget.selectedCitations.length})</h3>
              <button
                onClick={() => chatWidget.setShowCitationsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {chatWidget.selectedCitations.map((source, idx) => (
                  <div key={idx} className="text-sm py-2 border-b border-gray-100 last:border-0">
                    {idx + 1}. <span className="font-medium">({source.source})</span> <a 
                      onClick={(e) => { e.preventDefault(); chatWidget.setShowCitationsModal(false); chatWidget.handleViewSource(source); }}
                      href="#"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {source.topic}
                    </a>{source.timestamp && ` at ${chatWidget.formatTimestamp(source.timestamp)}`} {source.text && <span className="text-gray-500" title={source.text}>("{source.text.substring(0, 50)}...")</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transcript Modal */}
      {chatWidget.showTranscriptModal && chatWidget.selectedTranscript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]" onClick={() => chatWidget.setShowTranscriptModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">{chatWidget.selectedTranscript.topic}</h3>
              <button
                onClick={() => chatWidget.setShowTranscriptModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">{chatWidget.selectedTranscript.transcript}</pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}