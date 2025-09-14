'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { MagnifyingGlassIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import Navbar from '../../../components/Navbar';
import SidebarLayout from '../../../components/SidebarLayout';
import AccessCheck from '../../../components/AccessCheck';
import Breadcrumb from '../../../components/Breadcrumb';
import Pagination from '../../../components/Pagination';
import AttachmentPreview from '../../../components/AttachmentPreview';
import MultiAttachmentPreview from '../../../components/MultiAttachmentPreview';
import UserSelector from '../../../components/UserSelector';
import PracticeSelector from '../../../components/PracticeSelector';
import MultiResourceSelector from '../../../components/MultiResourceSelector';
import { PRACTICE_OPTIONS } from '../../../constants/practices';
import { getEnvironment, getTableName } from '../../../lib/dynamodb';

// Utility function to extract friendly name from "Name <email>" format
const extractFriendlyName = (nameWithEmail) => {
  if (!nameWithEmail) return '';
  // Remove "To: " prefix if present
  let cleaned = nameWithEmail.replace(/^To:\s*/i, '');
  // Extract name before < if email format is present
  const match = cleaned.match(/^(.+?)\s*<[^>]+>/);
  if (match) {
    return match[1].trim();
  }
  // If it's just an email address, extract the username part
  const emailMatch = cleaned.match(/^([^@]+)@/);
  if (emailMatch) {
    // Convert email username to friendly name (e.g., tfain -> T. Fain)
    const username = emailMatch[1];
    if (username.length > 1) {
      return username.charAt(0).toUpperCase() + '. ' + username.slice(1).charAt(0).toUpperCase() + username.slice(2);
    }
  }
  return cleaned.trim();
};

export default function SaAssignmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saAssignments, setSaAssignments] = useState([]);
  const [practiceETAs, setPracticeETAs] = useState({});
  const [filters, setFilters] = useState(() => {
    return {
      status: ['Pending', 'Unassigned'],
      practice: [],
      region: '',
      dateFrom: '',
      dateTo: '',
      search: '',
      sort: 'newest'
    };
  });
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [tempPracticeSelection, setTempPracticeSelection] = useState([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [tempStatusSelection, setTempStatusSelection] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const saAssignmentsPerPage = 20;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('saAssignmentsFilters', JSON.stringify(filters));
    }
  }, [filters]);

  useEffect(() => {
    if (user && user.practices) {
      const saved = localStorage.getItem('saAssignmentsFilters');
      let shouldSetDefaults = false;
      
      if (saved) {
        try {
          const parsedFilters = JSON.parse(saved);
          const needsStatusDefault = !parsedFilters.status || parsedFilters.status.length === 0;
          const needsPracticeDefault = !parsedFilters.practice || parsedFilters.practice.length === 0;
          
          if (needsStatusDefault) {
            parsedFilters.status = ['Pending', 'Unassigned'];
          }
          if (needsPracticeDefault) {
            parsedFilters.practice = [...(user.practices || []), 'Pending'];
          }
          
          setFilters(parsedFilters);
        } catch (error) {
          shouldSetDefaults = true;
        }
      } else {
        shouldSetDefaults = true;
      }
      
      if (shouldSetDefaults) {
        setFilters({
          status: ['Pending', 'Unassigned'],
          practice: [...(user.practices || []), 'Pending'],
          region: '',
          dateFrom: '',
          dateTo: '',
          search: '',
          sort: 'newest'
        });
      }
    }
  }, [user]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check-session');
        if (response.ok) {
          const sessionData = await response.json();
          if (sessionData.user) {
            setUser(sessionData.user);
            localStorage.setItem('user', JSON.stringify(sessionData.user));
            return;
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
      
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
        return;
      }
      
      router.push('/login');
    };
    
    checkAuth();
    fetchSaAssignments();
    
    let eventSource;
    let reconnectTimer;
    let isConnected = false;
    
    const connectSaAssignmentSSE = () => {
      eventSource = new EventSource('/api/events?issueId=all');
      
      eventSource.onopen = () => {
        isConnected = true;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            isConnected = true;
          } else if (data.type === 'sa_assignment_created') {
            fetchSaAssignments();
          } else if (data.type === 'sa_assignment_updated') {
            if (data.updates) {
              setSaAssignments(prevSaAssignments => 
                prevSaAssignments.map(saAssignment => 
                  saAssignment.id === data.saAssignmentId 
                    ? { ...saAssignment, ...data.updates }
                    : saAssignment
                )
              );
            } else {
              fetchSaAssignments();
            }
          } else if (data.type === 'heartbeat') {
            // Heartbeat received
          }
        } catch (error) {
          console.error('SSE parsing error:', error);
        }
      };
      
      eventSource.onerror = (error) => {
        isConnected = false;
        
        if (eventSource.readyState === EventSource.CLOSED) {
          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              connectSaAssignmentSSE();
            }, 2000);
          }
        }
      };
    };
    
    connectSaAssignmentSSE();
    
    const connectionCheck = setInterval(() => {
      if (!isConnected && eventSource?.readyState !== EventSource.CONNECTING) {
        connectSaAssignmentSSE();
      }
    }, 10000);
    
    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (connectionCheck) clearInterval(connectionCheck);
    };
  }, [router]);

  const fetchSaAssignments = async () => {
    try {
      const response = await fetch('/api/sa-assignments');
      const data = await response.json();
      if (data.success) {
        setSaAssignments(data.saAssignments || []);
      } else {
        console.error('Failed to fetch SA assignments:', data.error);
        setSaAssignments([]);
      }
    } catch (error) {
      console.error('Error fetching SA assignments:', error);
      setSaAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPracticeETAs = async () => {
    if (filters.practice && filters.practice.length > 0) {
      try {
        const practicesParam = filters.practice.join(',');
        const response = await fetch(`/api/practice-etas?practices=${encodeURIComponent(practicesParam)}`);
        const data = await response.json();
        if (data.success) {
          setPracticeETAs(data.etas);
        }
      } catch (error) {
        console.error('Error fetching practice ETAs:', error);
      }
    } else {
      setPracticeETAs({});
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('user');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('user');
      router.push('/login');
    }
  };

  const allFilteredSaAssignments = saAssignments.filter(saAssignment => {
    const matchesStatus = !filters.status || filters.status.length === 0 || filters.status.includes(saAssignment.status);
    const matchesPractice = !filters.practice || filters.practice.length === 0 || filters.practice.includes(saAssignment.practice);
    const matchesRegion = !filters.region || saAssignment.region === filters.region;
    
    let matchesDateRange = true;
    if (filters.dateFrom || filters.dateTo) {
      const saAssignmentDate = new Date(saAssignment.requestDate);
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        matchesDateRange = matchesDateRange && saAssignmentDate >= fromDate;
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDateRange = matchesDateRange && saAssignmentDate <= toDate;
      }
    }
    
    const matchesSearch = !filters.search || 
      saAssignment.opportunityName.toLowerCase().includes(filters.search.toLowerCase()) ||
      saAssignment.saAssigned.toLowerCase().includes(filters.search.toLowerCase()) ||
      saAssignment.customerName.toLowerCase().includes(filters.search.toLowerCase()) ||
      saAssignment.opportunityId.toLowerCase().includes(filters.search.toLowerCase()) ||
      saAssignment.am.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchesStatus && matchesPractice && matchesRegion && matchesDateRange && matchesSearch;
  }).sort((a, b) => {
    if (filters.sort === 'project') {
      return a.opportunityName.localeCompare(b.opportunityName);
    } else if (filters.sort === 'sa') {
      return a.saAssigned.localeCompare(b.saAssigned);
    } else if (filters.sort === 'customer') {
      return a.customerName.localeCompare(b.customerName);
    }
    return new Date(b.requestDate) - new Date(a.requestDate);
  });

  const totalPages = Math.ceil(allFilteredSaAssignments.length / saAssignmentsPerPage);
  const startIndex = (currentPage - 1) * saAssignmentsPerPage;
  const filteredSaAssignments = allFilteredSaAssignments.slice(startIndex, startIndex + saAssignmentsPerPage);

  useEffect(() => {
    setCurrentPage(1);
    fetchPracticeETAs();
  }, [filters.status.length, filters.practice, filters.region, filters.dateFrom, filters.dateTo, filters.search, filters.sort]);

  const calculateAverageETA = (etaType) => {
    const relevantETAs = Object.values(practiceETAs)
      .filter(eta => eta[etaType] > 0)
      .map(eta => eta[etaType]);
    
    if (relevantETAs.length === 0) return 0;
    const averageHours = relevantETAs.reduce((sum, hours) => sum + hours, 0) / relevantETAs.length;
    const days = averageHours / 24;
    return Math.round(days * 100) / 100;
  };

  const practiceAssignmentETA = calculateAverageETA('practice_assignment_eta_hours');
  const saAssignmentETA = calculateAverageETA('sa_assignment_eta_hours');

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AccessCheck user={user}>
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={handleLogout} />
        
        <SidebarLayout user={user}>
          <div className="p-8">
            <Breadcrumb items={[
              { label: 'Projects', href: '/projects' },
              { label: 'SA Assignments' }
            ]} />
            
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-3">
                    SA Assignments
                  </h1>
                  <p className="text-blue-600/80 text-lg">Manage project SA assignments and allocations</p>
                </div>
                <button
                  onClick={() => router.push('/projects/sa-assignments/new')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  New SA Assignment
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">📊</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Requests</p>
                    <p className="text-2xl font-semibold text-gray-900">{allFilteredSaAssignments.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-semibold text-sm">⏳</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Pending</p>
                    <p className="text-2xl font-semibold text-gray-900">{allFilteredSaAssignments.filter(a => a.status === 'Pending').length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 font-semibold text-sm">📁</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Unassigned</p>
                    <p className="text-2xl font-semibold text-gray-900">{allFilteredSaAssignments.filter(a => a.status === 'Unassigned').length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">✅</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Assigned</p>
                    <p className="text-2xl font-semibold text-gray-900">{allFilteredSaAssignments.filter(a => a.status === 'Assigned').length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 font-semibold text-sm">🏢</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Practice Assignment ETA</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {practiceAssignmentETA > 0 ? `${practiceAssignmentETA.toFixed(2)} days` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                      <span className="text-teal-600 font-semibold text-sm">👤</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">SA Assignment ETA</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {saAssignmentETA > 0 ? `${saAssignmentETA.toFixed(2)} days` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                  </svg>
                  Filter SA Assignments
                </h3>
                <button
                  onClick={() => {
                    const defaultFilters = { status: ['Pending', 'Unassigned'], practice: [...(user?.practices || []), 'Pending'], region: '', dateFrom: '', dateTo: '', search: '', sort: 'newest' };
                    localStorage.removeItem('saAssignmentsFilters');
                    setFilters(defaultFilters);
                    setCurrentPage(1);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </button>
              </div>
              
              <div className="relative mb-6">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by opportunity, customer, SA, AM, or opportunity ID..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <button
                    onClick={() => {
                      setTempStatusSelection(filters.status);
                      setShowStatusModal(true);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm text-left flex items-center justify-between"
                  >
                    <span>
                      {filters.status.length === 0 ? 'All Statuses' : 
                       filters.status.length === 1 ? filters.status[0] : 
                       'Multiple Statuses'}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Practice</label>
                  <button
                    onClick={() => {
                      setTempPracticeSelection(filters.practice);
                      setShowPracticeModal(true);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm text-left flex items-center justify-between"
                  >
                    <span>
                      {filters.practice.length === 0 ? 'All Practices' : 
                       filters.practice.length === 1 ? filters.practice[0] : 
                       'Multiple Practices'}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Region</label>
                  <select
                    value={filters.region}
                    onChange={(e) => setFilters({...filters, region: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    <option value="">All Regions</option>
                    <option value="CA-LAX">CA-LAX</option>
                    <option value="CA-SAN">CA-SAN</option>
                    <option value="CA-SFO">CA-SFO</option>
                    <option value="FL-MIA">FL-MIA</option>
                    <option value="FL-NORT">FL-NORT</option>
                    <option value="KY-KENT">KY-KENT</option>
                    <option value="LA-STATE">LA-STATE</option>
                    <option value="OK-OKC">OK-OKC</option>
                    <option value="OTHERS">OTHERS</option>
                    <option value="TN-TEN">TN-TEN</option>
                    <option value="TX-CEN">TX-CEN</option>
                    <option value="TX-DAL">TX-DAL</option>
                    <option value="TX-HOU">TX-HOU</option>
                    <option value="TX-SOUT">TX-SOUT</option>
                    <option value="US-FED">US-FED</option>
                    <option value="US-SP">US-SP</option>
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
                    <option value="newest">📅 Newest First</option>
                    <option value="project">📁 Opportunity Name</option>
                    <option value="customer">🏢 Customer Name</option>
                    <option value="sa">👤 SA Name</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500 mb-4">
              {loading ? 'Loading...' : `${allFilteredSaAssignments.length} SA assignments, Page ${currentPage} of ${totalPages}`}
            </div>
            
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
            
            {allFilteredSaAssignments.length === 0 ? (
              <div className="card text-center py-12">
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📋</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No SA assignments found</h3>
                  <p className="text-gray-500 mb-6">No SA assignments match your current filters.</p>
                </div>
                <button
                  onClick={() => router.push('/projects/sa-assignments/new')}
                  className="btn-primary"
                >
                  Create First SA Assignment
                </button>
              </div>
            ) : (
              <SaAssignmentsTable 
                saAssignments={filteredSaAssignments} 
                user={user} 
                onSaAssignmentUpdate={fetchSaAssignments}
                allSaAssignments={saAssignments}
              />
            )}
            
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </SidebarLayout>
      </div>
    </AccessCheck>
  );
}

function SaAssignmentsTable({ saAssignments, user, onSaAssignmentUpdate, allSaAssignments }) {
  const router = useRouter();
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [assignmentData, setAssignmentData] = useState({
    saAssigned: [],
    dateAssigned: new Date().toISOString().split('T')[0]
  });
  const [practiceData, setPracticeData] = useState({
    practice: [],
    am: '',
    targetStatus: '',
    saAssigned: [],
    dateAssigned: new Date().toISOString().split('T')[0]
  });
  const [practiceError, setPracticeError] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentSaAssignmentId, setCurrentSaAssignmentId] = useState(null);

  const canEditSaAssignment = (saAssignment) => {
    if (user.isAdmin) return true;
    
    if (saAssignment.status === 'Unassigned' || saAssignment.status === 'Assigned') {
      return (user.role === 'practice_manager' || user.role === 'practice_principal') && 
             user.practices?.includes(saAssignment.practice);
    }
    
    if (saAssignment.practice === 'Pending') {
      return user.role === 'practice_manager' || user.role === 'practice_principal';
    }
    
    return (user.role === 'practice_manager' || user.role === 'practice_principal') && 
           user.practices?.includes(saAssignment.practice);
  };
  
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Practice</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Opportunity ID</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Region</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AM</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SA Assigned</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Assigned</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {saAssignments.map((saAssignment) => (
              <tr 
                key={saAssignment.id} 
                className={`hover:bg-gray-50 cursor-pointer ${
                  saAssignment.status === 'Pending' ? 'bg-yellow-50' : ''
                }`}
                onClick={() => router.push(`/projects/sa-assignments/${saAssignment.id}`)}
              >
                <td className="px-2 py-3">
                  <div className="text-sm font-mono text-blue-600">#{saAssignment.sa_assignment_number}</div>
                </td>
                <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                  {canEditSaAssignment(saAssignment) ? (
                    <select
                      value={saAssignment.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        setCurrentSaAssignmentId(saAssignment.id);
                        
                        if (newStatus === 'Assigned') {
                          if (saAssignment.status === 'Pending') {
                            setPracticeData({
                              practice: saAssignment.practice !== 'Pending' ? (saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : []) : [],
                              am: saAssignment.am || '',
                              targetStatus: newStatus,
                              saAssigned: saAssignment.saAssigned || '',
                              dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0]
                            });
                            setPracticeError('');
                            setShowPracticeModal(true);
                          } else {
                            setAssignmentData({
                              saAssigned: saAssignment.saAssigned || '',
                              dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0]
                            });
                            setShowAssignmentModal(true);
                          }
                          e.target.value = saAssignment.status;
                          return;
                        }
                        
                        if ((saAssignment.status === 'Pending' && (newStatus === 'Unassigned' || newStatus === 'Assigned')) || (saAssignment.status === 'Unassigned' && newStatus === 'Assigned')) {
                          setPracticeData({
                            practice: saAssignment.status === 'Pending' ? [] : (saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : []),
                            am: extractFriendlyName(saAssignment.am) || '',
                            region: saAssignment.region || '',
                            targetStatus: newStatus,
                            saAssigned: Array.isArray(saAssignment.saAssigned) ? saAssignment.saAssigned : (saAssignment.saAssigned ? saAssignment.saAssigned.split(',').map(s => extractFriendlyName(s.trim())) : []),
                            dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0]
                          });
                          setPracticeError('');
                          setShowPracticeModal(true);
                          e.target.value = saAssignment.status;
                          return;
                        }
                        
                        try {
                          const response = await fetch(`/api/sa-assignments/${saAssignment.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: newStatus })
                          });
                          if (response.ok) {
                            onSaAssignmentUpdate();
                          }
                        } catch (error) {
                          console.error('Error updating status:', error);
                        }
                      }}
                      className={`text-sm font-semibold px-3 py-1.5 rounded-full border-0 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-3 focus:ring-opacity-50 ${
                        saAssignment.status === 'Pending' ? 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-300' :
                        saAssignment.status === 'Unassigned' ? 'bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-300' :
                        saAssignment.status === 'Assigned' ? 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-300' :
                        'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-300'
                      }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Unassigned">Unassigned</option>
                      <option value="Assigned">Assigned</option>
                    </select>
                  ) : (
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-lg ${
                      saAssignment.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      saAssignment.status === 'Unassigned' ? 'bg-orange-100 text-orange-800' :
                      saAssignment.status === 'Assigned' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {saAssignment.status}
                    </span>
                  )}
                </td>
                <td className="px-2 py-3">
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {saAssignment.practice}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm font-mono text-blue-600">{saAssignment.opportunityId}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      {(() => {
                        const attachments = JSON.parse(saAssignment.attachments || '[]');
                        if (attachments.length === 0) return null;
                        
                        return (
                          <div onClick={(e) => e.stopPropagation()}>
                            <MultiAttachmentPreview attachments={attachments} position="right">
                              <span className="text-xs text-blue-600">
                                📎 {attachments.length}
                              </span>
                            </MultiAttachmentPreview>
                          </div>
                        );
                      })()}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate mb-1" title={saAssignment.customerName}>
                      {saAssignment.customerName}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-1" title={saAssignment.opportunityName}>{saAssignment.opportunityName}</p>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{saAssignment.region}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">{extractFriendlyName(saAssignment.am)}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">
                    {saAssignment.saAssigned ? (
                      saAssignment.saAssigned.includes(',') ? (
                        <div className="space-y-1">
                          {saAssignment.saAssigned.split(',').slice(0, 2).map((sa, index) => (
                            <div key={index} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full mr-1">
                              {sa.trim()}
                            </div>
                          ))}
                          {saAssignment.saAssigned.split(',').length > 2 && (
                            <div className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              +{saAssignment.saAssigned.split(',').length - 2} more
                            </div>
                          )}
                        </div>
                      ) : saAssignment.saAssigned
                    ) : ''}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">
                    {new Date(saAssignment.requestDate).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZoneName: 'short'
                    })}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">{new Date(saAssignment.dateAssigned).toLocaleDateString()}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Practice Assignment Modal */}
      {showPracticeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {practiceData.targetStatus === 'Assigned' ? 'Assign Resource' : 'Assign to Practice'}
                </h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                {practiceData.targetStatus === 'Assigned' 
                  ? 'Please assign this request to a practice and resource.' 
                  : 'Please assign this request to one or more practices.'}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Practice *</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                    {PRACTICE_OPTIONS.filter(practice => practice !== 'Pending').map(practice => (
                      <label key={practice} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={Array.isArray(practiceData.practice) ? practiceData.practice.includes(practice) : practiceData.practice === practice}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const currentPractices = Array.isArray(practiceData.practice) ? practiceData.practice : (practiceData.practice ? [practiceData.practice] : []);
                              setPracticeData(prev => ({...prev, practice: [...currentPractices, practice]}));
                            } else {
                              const currentPractices = Array.isArray(practiceData.practice) ? practiceData.practice : (practiceData.practice ? [practiceData.practice] : []);
                              setPracticeData(prev => ({...prev, practice: currentPractices.filter(p => p !== practice)}));
                            }
                            setPracticeError('');
                          }}
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{practice}</span>
                      </label>
                    ))}
                  </div>
                  {practiceError && (
                    <p className="mt-1 text-sm text-red-600">{practiceError}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Manager</label>
                  <input
                    type="text"
                    value={practiceData.am}
                    onChange={(e) => setPracticeData(prev => ({...prev, am: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter account manager name (optional)"
                  />
                </div>
                
                {practiceData.targetStatus === 'Assigned' && (
                  <>
                    <div>
                      <MultiResourceSelector
                        value={practiceData.saAssigned || []}
                        onChange={(resources) => setPracticeData(prev => ({...prev, saAssigned: resources}))}
                        assignedPractices={Array.isArray(practiceData.practice) ? practiceData.practice : (practiceData.practice ? [practiceData.practice] : [])}
                        placeholder="Select or type SA names..."
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date Assigned *</label>
                      <input
                        type="date"
                        value={practiceData.dateAssigned}
                        onChange={(e) => setPracticeData(prev => ({...prev, dateAssigned: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPracticeModal(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const practices = Array.isArray(practiceData.practice) ? practiceData.practice : (practiceData.practice ? [practiceData.practice] : []);
                    if (practices.length === 0) {
                      alert('Please select at least one practice');
                      return;
                    }
                    
                    if (practiceData.targetStatus === 'Assigned' && (!practiceData.saAssigned || (Array.isArray(practiceData.saAssigned) && practiceData.saAssigned.length === 0))) {
                      alert('Please assign at least one SA');
                      return;
                    }
                    
                    setSaving(true);
                    try {
                      const updateData = {
                        status: practiceData.targetStatus,
                        practice: practices.join(','),
                        am: practiceData.am
                      };
                      
                      if (practiceData.targetStatus === 'Assigned') {
                        updateData.saAssigned = Array.isArray(practiceData.saAssigned) ? practiceData.saAssigned.join(',') : practiceData.saAssigned;
                        updateData.dateAssigned = practiceData.dateAssigned;
                      }
                      
                      const response = await fetch(`/api/sa-assignments/${currentSaAssignmentId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                      });
                      if (response.ok) {
                        onSaAssignmentUpdate();
                        setShowPracticeModal(false);
                      } else {
                        alert('Failed to assign to practice');
                      }
                    } catch (error) {
                      console.error('Error assigning to practice:', error);
                      alert('Failed to assign to practice');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving || (Array.isArray(practiceData.practice) ? practiceData.practice.length === 0 : !practiceData.practice) || (practiceData.targetStatus === 'Assigned' && (!practiceData.saAssigned || (Array.isArray(practiceData.saAssigned) && practiceData.saAssigned.length === 0)))}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Assigning...' : (practiceData.targetStatus === 'Assigned' ? 'Assign Resource' : 'Assign to Practice')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Assignment Modal */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Assign Resource</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Please provide the resource assignment details to mark this as assigned.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SA Assigned *</label>
                  <input
                    type="text"
                    value={assignmentData.saAssigned}
                    onChange={(e) => setAssignmentData(prev => ({...prev, saAssigned: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter SA name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Assigned *</label>
                  <input
                    type="date"
                    value={assignmentData.dateAssigned}
                    onChange={(e) => setAssignmentData(prev => ({...prev, dateAssigned: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAssignmentModal(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!assignmentData.saAssigned) {
                      alert('Please assign an SA');
                      return;
                    }
                    
                    setSaving(true);
                    try {
                      const response = await fetch(`/api/sa-assignments/${currentSaAssignmentId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          status: 'Assigned',
                          saAssigned: assignmentData.saAssigned,
                          dateAssigned: assignmentData.dateAssigned
                        })
                      });
                      if (response.ok) {
                        onSaAssignmentUpdate();
                        setShowAssignmentModal(false);
                      } else {
                        alert('Failed to assign resource');
                      }
                    } catch (error) {
                      console.error('Error assigning resource:', error);
                      alert('Failed to assign resource');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving || !assignmentData.saAssigned}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Assigning...' : 'Assign Resource'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}