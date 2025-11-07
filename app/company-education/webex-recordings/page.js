'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import SidebarLayout from '../../../components/SidebarLayout';
import Navbar from '../../../components/Navbar';
import Breadcrumb from '../../../components/Breadcrumb';
import AccessCheck from '../../../components/AccessCheck';

export default function WebExRecordingsPage() {
  const { user, loading, logout } = useAuth();
  const [recordings, setRecordings] = useState([]);
  const [loadingRecordings, setLoadingRecordings] = useState(true);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [showHostDropdown, setShowHostDropdown] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const hostDropdownRef = useRef(null);
  const [selectedRecordings, setSelectedRecordings] = useState([]);
  const [approvingRecordings, setApprovingRecordings] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    host: '',
    transcriptStatus: '',
    dateFrom: '',
    dateTo: '',
    sort: 'newest',
    showDenied: false
  });

  const isAdmin = user?.isAdmin || user?.role === 'executive';
  const userEmail = user?.email?.toLowerCase();
  
  const unapprovedRecordings = recordings.filter(r => {
    if (r.approved) return false;
    if (!filters.showDenied && r.denied) return false;
    if (isAdmin) return true;
    return r.hostEmail?.toLowerCase() === userEmail;
  });
  
  const canApprove = unapprovedRecordings.length > 0;
  const [activeTab, setActiveTab] = useState('publicly-available');

  useEffect(() => {
    fetchRecordings();
    const cleanup = setupSSE();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!loadingRecordings && recordings.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const recordingId = params.get('id');
      if (recordingId) {
        const recording = recordings.find(r => r.id === recordingId);
        if (recording) {
          setSelectedRecording(recording);
          window.history.replaceState({}, '', '/company-education/webex-recordings');
        }
      }
    }
  }, [recordings, loadingRecordings]);
  
  useEffect(() => {
    if (canApprove && activeTab === 'publicly-available') {
      setActiveTab('approve-recordings');
    }
  }, [canApprove]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (hostDropdownRef.current && !hostDropdownRef.current.contains(event.target)) {
        setShowHostDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const uniqueHosts = [...new Set(recordings.map(r => r.hostEmail).filter(Boolean))].sort();
  
  const approvedRecordings = recordings.filter(r => r.approved);
  
  const currentRecordings = activeTab === 'approve-recordings' ? unapprovedRecordings : approvedRecordings;
  
  const filteredRecordings = currentRecordings.filter(recording => {
    const matchesSearch = !filters.search || 
      recording.topic?.toLowerCase().includes(filters.search.toLowerCase()) ||
      recording.hostEmail?.toLowerCase().includes(filters.search.toLowerCase()) ||
      recording.meetingId?.toLowerCase().includes(filters.search.toLowerCase());
    
    const matchesHost = !filters.host ||
      recording.hostEmail?.toLowerCase().includes(filters.host.toLowerCase());
    
    const matchesTranscript = !filters.transcriptStatus ||
      recording.transcriptStatus === filters.transcriptStatus;
    
    let matchesDateRange = true;
    if (filters.dateFrom || filters.dateTo) {
      const recordingDate = new Date(recording.createTime);
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        matchesDateRange = matchesDateRange && recordingDate >= fromDate;
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDateRange = matchesDateRange && recordingDate <= toDate;
      }
    }
    
    return matchesSearch && matchesHost && matchesTranscript && matchesDateRange;
  }).sort((a, b) => {
    if (filters.sort === 'topic') {
      return a.topic.localeCompare(b.topic);
    } else if (filters.sort === 'host') {
      return a.hostEmail.localeCompare(b.hostEmail);
    }
    return new Date(b.createTime) - new Date(a.createTime);
  });

  const handleSelectAll = () => {
    const approvableRecordings = filteredRecordings.filter(r => r.transcriptStatus === 'available');
    if (selectedRecordings.length === approvableRecordings.length) {
      setSelectedRecordings([]);
    } else {
      setSelectedRecordings(approvableRecordings.map(r => r.id));
    }
  };

  const handleSelectRecording = (id) => {
    const recording = recordings.find(r => r.id === id);
    if (recording?.transcriptStatus !== 'available') return;
    setSelectedRecordings(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  };

  const handleApprove = async (recordingIds) => {
    setApprovingRecordings(true);
    try {
      const response = await fetch('/api/webexmeetings/recordings/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingIds })
      });
      
      if (response.ok) {
        setSelectedRecordings([]);
        await fetchRecordings();
      }
    } catch (error) {
      console.error('Error approving recordings:', error);
    } finally {
      setApprovingRecordings(false);
    }
  };

  const handleDeny = async (recordingIds) => {
    console.log('handleDeny called with:', recordingIds);
    setApprovingRecordings(true);
    try {
      console.log('Sending deny request...');
      const response = await fetch('/api/webexmeetings/recordings/deny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingIds })
      });
      
      console.log('Deny response status:', response.status);
      const data = await response.json();
      console.log('Deny response data:', data);
      
      if (response.ok) {
        setSelectedRecordings([]);
        await fetchRecordings();
      } else {
        console.error('Deny failed:', data);
      }
    } catch (error) {
      console.error('Error denying recordings:', error);
    } finally {
      setApprovingRecordings(false);
    }
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
              { label: 'WebEx Recordings' }
            ]} />
            
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">WebEx Recordings</h1>
              
              {/* Tab Navigation */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {canApprove && (
                    <button
                      onClick={() => {
                        setActiveTab('approve-recordings');
                        setSelectedRecordings([]);
                      }}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'approve-recordings'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Approve Recordings ({unapprovedRecordings.length})
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveTab('publicly-available');
                      setSelectedRecordings([]);
                    }}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'publicly-available'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Publicly Available Recordings ({approvedRecordings.length})
                  </button>
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            <>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                    </svg>
                    Filter Recordings
                  </h3>
                  <button
                    onClick={() => {
                      setFilters({
                        search: '',
                        host: '',
                        transcriptStatus: '',
                        dateFrom: '',
                        dateTo: '',
                        sort: 'newest'
                      });
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset
                  </button>
                </div>
                
                {/* Search Bar */}
                <div className="relative mb-6">
                  <svg className="h-5 w-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by topic, host, or meeting ID..."
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2" ref={hostDropdownRef}>
                    <label className="block text-sm font-medium text-gray-700">Host</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowHostDropdown(!showHostDropdown)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <span className={filters.host ? 'text-gray-900' : 'text-gray-500'}>
                          {filters.host || 'All Hosts'}
                        </span>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${showHostDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showHostDropdown && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                          <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                            <input
                              type="text"
                              placeholder="Search hosts..."
                              value={filters.host}
                              onChange={(e) => setFilters({...filters, host: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setFilters({...filters, host: ''});
                                setShowHostDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
                            >
                              <span className="text-gray-500">All Hosts</span>
                            </button>
                            {uniqueHosts
                              .filter(host => !filters.host || host.toLowerCase().includes(filters.host.toLowerCase()))
                              .map((host) => (
                                <button
                                  key={host}
                                  onClick={() => {
                                    setFilters({...filters, host});
                                    setShowHostDropdown(false);
                                  }}
                                  className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between ${
                                    filters.host === host ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                                  }`}
                                >
                                  <span>{host}</span>
                                  {filters.host === host && (
                                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Transcript Status</label>
                    <select
                      value={filters.transcriptStatus}
                      onChange={(e) => setFilters({...filters, transcriptStatus: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                    >
                      <option value="">All Statuses</option>
                      <option value="available">Available</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Date From</label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Date To</label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                    />
                  </div>
                  
  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Sort By</label>
                    <select
                      value={filters.sort}
                      onChange={(e) => setFilters({...filters, sort: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                    >
                      <option value="newest">Newest First</option>
                      <option value="topic">Topic</option>
                      <option value="host">Host</option>
                    </select>
                  </div>
                  
                  {activeTab === 'approve-recordings' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Show Denied</label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.showDenied}
                          onChange={(e) => setFilters({...filters, showDenied: e.target.checked})}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Include denied recordings</span>
                      </label>
                    </div>
                  )}
                </div>
                

              </div>

              <div className="text-sm text-gray-500 mb-4">
                {loadingRecordings ? 'Loading...' : `${filteredRecordings.length} of ${currentRecordings.length} recordings`}
              </div>
              
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  {activeTab === 'approve-recordings' && selectedRecordings.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
                      <button
                        onClick={() => handleApprove(selectedRecordings)}
                        disabled={approvingRecordings}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
                      >
                        {approvingRecordings ? 'Approving...' : 'Approve Selected'}
                      </button>
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-blue-900">
                          {selectedRecordings.length} recording(s) selected
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {activeTab === 'approve-recordings' ? 'Recordings Pending Approval' : 'Approved Recordings'}
                    </h3>
                    {activeTab === 'approve-recordings' && filteredRecordings.filter(r => r.transcriptStatus === 'available').length > 0 && (
                      <button
                        onClick={handleSelectAll}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {selectedRecordings.length === filteredRecordings.filter(r => r.transcriptStatus === 'available').length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  
                  {loadingRecordings ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : filteredRecordings.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">
                        {recordings.length === 0 ? 'No recordings found' : 'No recordings match your filters'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {activeTab === 'approve-recordings' && (
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                                <input
                                  type="checkbox"
                                  checked={selectedRecordings.length > 0 && selectedRecordings.length === filteredRecordings.filter(r => r.transcriptStatus === 'available').length}
                                  onChange={handleSelectAll}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                              </th>
                            )}
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredRecordings.map((recording) => (
                            <tr key={recording.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedRecording(recording)}>
                              {activeTab === 'approve-recordings' && (
                                <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                  <div title={recording.transcriptStatus !== 'available' ? 'Transcript must be available before approval' : ''}>
                                    <input
                                      type="checkbox"
                                      checked={selectedRecordings.includes(recording.id)}
                                      onChange={() => handleSelectRecording(recording.id)}
                                      disabled={recording.transcriptStatus !== 'available'}
                                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {recording.meetingId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {recording.hostEmail || recording.hostUserId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(recording.createTime)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                {recording.transcriptStatus === 'available' ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleViewTranscript(recording.id); }}
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownload(recording.downloadUrl || recording.s3Url, `${recording.topic || 'recording'}.mp4`); }}
                                  className="text-blue-600 hover:text-blue-900 font-medium"
                                >
                                  Download MP4
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                                {activeTab === 'approve-recordings' ? (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleApprove([recording.id]); }}
                                      disabled={approvingRecordings || recording.transcriptStatus !== 'available'}
                                      title={recording.transcriptStatus !== 'available' ? 'Transcript must be available before approval' : ''}
                                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                                    >
                                      Approve
                                    </button>
                                    {!recording.denied && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDeny([recording.id]); }}
                                        disabled={approvingRecordings}
                                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                                      >
                                        Deny
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  (isAdmin || recording.hostEmail?.toLowerCase() === userEmail) && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeny([recording.id]); }}
                                      disabled={approvingRecordings}
                                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                                    >
                                      Deny
                                    </button>
                                  )
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
            </>
          </div>
        </SidebarLayout>
      </div>

      {selectedRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedRecording(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Recording Details</h3>
              <button onClick={() => setSelectedRecording(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Topic</label>
                <p className="text-gray-900 mt-1">{selectedRecording.topic || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Meeting ID</label>
                <p className="text-gray-900 mt-1">{selectedRecording.meetingId}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Host</label>
                <p className="text-gray-900 mt-1">{selectedRecording.hostEmail || selectedRecording.hostUserId}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Start Date/Time</label>
                <p className="text-gray-900 mt-1">{formatDate(selectedRecording.createTime)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Duration</label>
                <p className="text-gray-900 mt-1">{selectedRecording.durationSeconds ? `${Math.floor(selectedRecording.durationSeconds / 60)} minutes` : 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Transcript Status</label>
                <p className="text-gray-900 mt-1 capitalize">{selectedRecording.transcriptStatus || 'Pending'}</p>
              </div>
              {selectedRecording.approved && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p className="text-green-600 mt-1 font-medium">Approved</p>
                </div>
              )}
              {selectedRecording.denied && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p className="text-red-600 mt-1 font-medium">Denied</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              {selectedRecording.transcriptStatus === 'available' && (
                <button
                  onClick={() => {
                    setSelectedRecording(null);
                    handleViewTranscript(selectedRecording.id);
                  }}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Transcript
                </button>
              )}
              <button
                onClick={() => {
                  handleDownload(selectedRecording.downloadUrl || selectedRecording.s3Url, `${selectedRecording.topic || 'recording'}.mp4`);
                }}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download MP4
              </button>
              {activeTab === 'approve-recordings' && (
                <>
                  <button
                    onClick={() => {
                      setSelectedRecording(null);
                      handleApprove([selectedRecording.id]);
                    }}
                    disabled={approvingRecordings || selectedRecording.transcriptStatus !== 'available'}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Approve
                  </button>
                  {!selectedRecording.denied && (
                    <button
                      onClick={() => {
                        setSelectedRecording(null);
                        handleDeny([selectedRecording.id]);
                      }}
                      disabled={approvingRecordings}
                      className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Deny
                    </button>
                  )}
                </>
              )}
              {activeTab === 'publicly-available' && (isAdmin || selectedRecording.hostEmail?.toLowerCase() === userEmail) && (
                <button
                  onClick={() => {
                    setSelectedRecording(null);
                    handleDeny([selectedRecording.id]);
                  }}
                  disabled={approvingRecordings}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Deny
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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