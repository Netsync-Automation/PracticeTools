'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import SidebarLayout from '../../../components/SidebarLayout';
import Breadcrumb from '../../../components/Breadcrumb';
import { useAuth } from '../../../hooks/useAuth';
import AccessCheck from '../../../components/AccessCheck';

export default function WebexMessagesPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [monitoredRooms, setMonitoredRooms] = useState([]);

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

  const filteredMessages = messages.filter(msg =>
    msg.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.person_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attachments</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredMessages.map((message) => (
                        <tr key={message.message_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedMessage(message)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(message.created).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {message.person_email}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-md truncate" title={message.text}>{message.text}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                                    <div key={idx} className="flex items-center gap-2">
                                      {att.status === 'available' ? (
                                        <a
                                          href={`/api/webexmessaging/download?key=${encodeURIComponent(att.s3Key)}`}
                                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                          download
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          {att.fileName}
                                        </a>
                                      ) : (
                                        <span className="text-gray-600">{att.fileName}</span>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
              <button onClick={() => setSelectedMessage(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
    </AccessCheck>
  );
}
