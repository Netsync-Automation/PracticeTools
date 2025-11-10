'use client';

import { useState, useRef, useEffect } from 'react';

export default function ChatNPTWidget({ user }) {
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
  const [currentChatTitle, setCurrentChatTitle] = useState('New Chat');
  const [selectedSource, setSelectedSource] = useState(null);
  const [loadingSource, setLoadingSource] = useState(false);
  const messagesEndRef = useRef(null);

  const handleViewSource = async (source) => {
    setLoadingSource(true);
    if (source.source === 'Webex Messages' && source.messageId) {
      try {
        const response = await fetch(`/api/webexmessaging/messages/${source.messageId}`);
        if (response.ok) {
          const data = await response.json();
          setSelectedSource({ ...source, attachments: data.message?.attachments });
        } else {
          setSelectedSource(source);
        }
      } catch (error) {
        setSelectedSource(source);
      }
    } else {
      setSelectedSource(source);
    }
    setLoadingSource(false);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp || typeof timestamp !== 'string') return '';
    const parts = timestamp.split(':');
    if (parts.length < 3) return timestamp;
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
      const timeoutId = setTimeout(() => {
        saveChatHistory();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, currentChatId]);

  const loadChatHistory = async (preserveCurrentChat = false) => {
    try {
      const response = await fetch(`/api/chatnpt/history?userEmail=${encodeURIComponent(user.email)}`);
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
        if (!preserveCurrentChat && data.chats && data.chats.length > 0) {
          const lastChat = data.chats[0];
          setCurrentChatId(lastChat.chatId);
          setMessages(lastChat.messages || []);
          setCurrentChatTitle(lastChat.title || 'Chat');
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveChatHistory = async (chatId = currentChatId, chatMessages = messages) => {
    if (!user?.email || !chatId) return;
    
    try {
      await fetch('/api/chatnpt/history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          chatId: chatId,
          messages: chatMessages
        })
      });
    } catch (error) {
      console.error('Error saving chat:', error);
    }
  };

  const createNewChat = async () => {
    setCurrentChatId(null);
    setMessages([]);
    setCurrentChatTitle('New Chat');
  };

  const loadChat = (chat) => {
    setCurrentChatId(chat.chatId);
    setMessages(chat.messages || []);
    setCurrentChatTitle(chat.title || 'Chat');
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
          await loadChatHistory(true);
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
        const updatedMessages = [...newMessages, assistantMessage];
        setMessages(updatedMessages);
        if (chatIdToUse) {
          await saveChatHistory(chatIdToUse, updatedMessages);
        }
      } else {
        const errorMessage = { 
          role: 'assistant', 
          content: data.error || 'Sorry, I encountered an error. Please try again.' 
        };
        const updatedMessages = [...newMessages, errorMessage];
        setMessages(updatedMessages);
        if (chatIdToUse) {
          await saveChatHistory(chatIdToUse, updatedMessages);
        }
      }
    } catch (error) {
      const errorMessage = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      };
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      if (chatIdToUse) {
        await saveChatHistory(chatIdToUse, updatedMessages);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { 
    chats, currentChatId, messages, input, isLoading, showCitationsModal, selectedCitations,
    editingChatId, editingTitle, showSearchModal, searchQuery, currentChatTitle, selectedSource,
    loadingSource, messagesEndRef, setInput, setShowCitationsModal, setSelectedCitations,
    setEditingChatId, setEditingTitle, setShowSearchModal, setSearchQuery, setSelectedSource,
    handleViewSource, formatTimestamp, createNewChat, loadChat, renameChat, deleteChat, 
    searchChats, handleSubmit
  };
}
