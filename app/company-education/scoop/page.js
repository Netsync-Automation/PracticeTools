'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import SidebarLayout from '../../../components/SidebarLayout';
import Navbar from '../../../components/Navbar';
import Breadcrumb from '../../../components/Breadcrumb';
import AccessCheck from '../../../components/AccessCheck';

export default function ScoopPage() {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('approve-recordings');
  const [recordings, setRecordings] = useState([]);
  const [loadingRecordings, setLoadingRecordings] = useState(true);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  useEffect(() => {
    fetchRecordings();
    const cleanup = setupSSE();
    return cleanup;
  }, []);

  const fetchRecordings = async () => {
    try {
      const response = await fetch('/api/webexmeetings/recordings');
      if (response.ok) {
        const data = await response.json();
        setRecordings(data.recordings || []);
      }
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setLoadingRecordings(false);
    }
  };

  const setupSSE = () => {
    const eventSource = new EventSource('/api/sse/webex-meetings');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'webex_recordings_updated') {
          fetchRecordings();
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    return () => eventSource.close();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const handleDownload = (s3Url, filename) => {
    const link = document.createElement('a');
    link.href = s3Url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewTranscript = async (recordingId) => {
    try {
      const response = await fetch(`/api/webexmeetings/recordings/${recordingId}/transcript`);
      if (response.ok) {
        const data = await response.json();
        setSelectedTranscript(data);
        setShowTranscriptModal(true);
      }
    } catch (error) {
      console.error('Error fetching transcript:', error);
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
              { label: 'SCOOP' }
            ]} />
            
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">SCOOP</h1>
              
              {/* Tab Navigation */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('approve-recordings')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'approve-recordings'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Approve Recordings
                  </button>
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'approve-recordings' && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    WebEx Meeting Recordings
                  </h3>
                  
                  {loadingRecordings ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : recordings.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No recordings found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Meeting ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Host
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Start Date/Time
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Transcript
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Recording
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {recordings.map((recording) => (
                            <tr key={recording.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {recording.meetingId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {recording.hostEmail || recording.hostUserId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(recording.createTime)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {recording.transcriptStatus === 'available' ? (
                                  <button
                                    onClick={() => handleViewTranscript(recording.id)}
                                    className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer"
                                  >
                                    Available
                                  </button>
                                ) : (
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    recording.transcriptStatus === 'No Transcript'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {recording.transcriptStatus || 'pending'}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <button
                                  onClick={() => handleDownload(recording.downloadUrl || recording.s3Url, `${recording.topic || 'recording'}.mp4`)}
                                  className="text-blue-600 hover:text-blue-900 font-medium"
                                >
                                  Download MP4
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </SidebarLayout>
      </div>

      {showTranscriptModal && selectedTranscript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowTranscriptModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">{selectedTranscript.topic}</h3>
              <button
                onClick={() => setShowTranscriptModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">{selectedTranscript.transcript}</pre>
            </div>
          </div>
        </div>
      )}
    </AccessCheck>
  );
}