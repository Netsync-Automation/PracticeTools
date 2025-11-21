'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import SidebarLayout from '../../../components/SidebarLayout';
import Breadcrumb from '../../../components/Breadcrumb';
import { useAuth } from '../../../hooks/useAuth';
import { useCsrf } from '../../../hooks/useCsrf';
import AccessCheck from '../../../components/AccessCheck';

export default function WebexMessagesPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { getHeaders } = useCsrf();
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [monitoredRooms, setMonitoredRooms] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const messagesPerPage = 15;

  useEffect(() => {
    if (user) {
      loadMessages();
      loadMonitoredRooms();
    }
  }, [user]);

  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const messageId = params.get('id');
      if (messageId) {
        const message = messages.find(m => m.message_id === messageId);
        if (message) {
          setSelectedMessage(message);
          window.history.replaceState({}, '', '/company-education/webex-messages');
        }
      }
    }
  }, [messages, loadingMessages]);

  useEffect(() => {
    const eventSource = new EventSource('/api/sse/webex-messages');
    
    eventSource.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'webex_messages_updated') {
        loadMessages();
      }
    });

    return () => eventSource.close();
  }, []);

  const loadMessages = async () => {
    try {
      const response = await fetch('/api/webexmessaging/messages');
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadMonitoredRooms = async () => {
    try {
      const response = await fetch('/api/webexmessaging/monitored-rooms?siteUrl=netsync.practicetools.link');
      const data = await response.json();
      setMonitoredRooms(data.rooms || []);
    } catch (error) {
      console.error('Error loading monitored rooms:', error);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await fetch(`/api/webexmessaging/messages/${messageId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      
      if (response.ok) {
        setMessages(messages.filter(m => m.message_id !== messageId));
        setDeleteConfirm(null);
        setSelectedMessage(null);
      } else {
        alert('Failed to delete message');
      }
    } catch (error) {
      alert('Error deleting message');
    }
  };

  const filteredMessages = messages.filter(msg =>
    msg.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.person_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredMessages.length / messagesPerPage);
  const startIndex = (currentPage - 1) * messagesPerPage;
  const paginatedMessages = filteredMessages.slice(startIndex, startIndex + messagesPerPage);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AccessCheck requiredModule="company-education">
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={logout} />
        
        <SidebarLayout user={user}>
          <div className="p-8">
            <Breadcrumb items={[
              { label: 'Company Education', href: '/company-education' },
              { label: 'Webex Messages' }
            ]} />
            
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Webex Messages</h1>
              <p className="text-gray-600">View messages from monitored Webex rooms</p>
              {monitoredRooms.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-700">Monitored Rooms:</span>
                  {monitoredRooms.map((room, idx) => (
                    <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {room.title}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {loadingMessages ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No messages found</h3>
                  <p className="text-gray-600">Messages will appear here when posted to monitored rooms</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-44">Date/Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-52">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Attachments</th>
                        {user?.isAdmin && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedMessages.map((message) => (
                        <tr key={message.message_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedMessage(message)}>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="truncate" title={new Date(message.created).toLocaleString()}>
                              {new Date(message.created).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="truncate" title={message.person_email}>
                              {message.person_email}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="truncate" title={message.text}>{message.text}</div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {message.attachments && message.attachments.length > 0 ? (
                              <div className="space-y-1">
                                {message.attachments.map((att, idx) => {
                                  const getStatusBadge = (status) => {
                                    switch(status) {
                                      case 'available':
                                        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">Available</span>;
                                      case 'pending_scan':
                                        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Pending Scan</span>;
                                      case 'infected':
                                        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800" title="Malware/Virus scan detected an infection in this file and it cannot be downloaded">File Infected</span>;
                                      case 'scan_blocked':
                                        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800" title="File scan blocked by organizational policy">Scan Blocked</span>;
                                      case 'failed':
                                        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">Failed</span>;
                                      default:
                                        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>;
                                    }
                                  };
                                  
                                  return (
                                    <div key={idx} className="flex items-center gap-2 min-w-0">
                                      {att.status === 'available' ? (
                                        <a
                                          href={`/api/webexmessaging/download?key=${encodeURIComponent(att.s3Key)}`}
                                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 truncate min-w-0"
                                          download
                                          title={att.fileName}
                                        >
                                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          <span className="truncate">{att.fileName}</span>
                                        </a>
                                      ) : (
                                        <span className="text-gray-600 truncate" title={att.fileName}>{att.fileName}</span>
                                      )}
                                      {getStatusBadge(att.status)}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-gray-400">None</span>
                            )}
                          </td>
                          {user?.isAdmin && (
                            <td className="px-6 py-4 text-sm">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm(message.message_id);
                                }}
                                className="text-red-600 hover:text-red-800 transition-colors"
                                title="Delete message"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                      <div className="text-sm text-gray-700">
                        Showing {startIndex + 1} to {Math.min(startIndex + messagesPerPage, filteredMessages.length)} of {filteredMessages.length} messages
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 border rounded-md text-sm font-medium ${
                              currentPage === page
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SidebarLayout>
      </div>

      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMessage(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Message Details</h2>
              <div className="flex items-center gap-2">
                {user?.isAdmin && (
                  <button
                    onClick={() => setDeleteConfirm(selectedMessage.message_id)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete message"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <button onClick={() => setSelectedMessage(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Sender</label>
                  <p className="text-gray-900">{selectedMessage.person_email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Date & Time</label>
                  <p className="text-gray-900">{new Date(selectedMessage.created).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Message</label>
                <div className="bg-gray-50 rounded-lg p-4 text-gray-900 whitespace-pre-wrap break-words">
                  {selectedMessage.text}
                </div>
              </div>

              {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">Attachments</label>
                  <div className="space-y-3">
                    {selectedMessage.attachments.map((att, idx) => {
                      const getStatusBadge = (status) => {
                        switch(status) {
                          case 'available':
                            return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Available</span>;
                          case 'pending_scan':
                            return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending Scan</span>;
                          case 'infected':
                            return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800" title="Malware/Virus scan detected an infection in this file and it cannot be downloaded">File Infected</span>;
                          case 'scan_blocked':
                            return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800" title="File scan blocked by organizational policy">Scan Blocked</span>;
                          case 'failed':
                            return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Failed</span>;
                          default:
                            return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>;
                        }
                      };
                      
                      return (
                        <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <svg className="w-8 h-8 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{att.fileName}</p>
                              <p className="text-xs text-gray-500 mt-1">{getStatusBadge(att.status)}</p>
                            </div>
                          </div>
                          {att.status === 'available' && (
                            <a
                              href={`/api/webexmessaging/download?key=${encodeURIComponent(att.s3Key)}`}
                              className="ml-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                              download
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Message ID</label>
                  <p className="text-xs text-gray-600 font-mono break-all">{selectedMessage.message_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Room ID</label>
                  <p className="text-xs text-gray-600 font-mono break-all">{selectedMessage.room_id}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Message</h3>
                <p className="text-sm text-gray-600 mt-1">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to permanently delete this message? It will be removed from the database and ChatNPT/Bedrock will no longer have access to it.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMessage(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AccessCheck>
  );
}
