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

export default function ResourceAssignmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
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
  const assignmentsPerPage = 20;

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('resourceAssignmentsFilters', JSON.stringify(filters));
    }
  }, [filters]);

  // Initialize filters based on user data and localStorage
  useEffect(() => {
    if (user && user.practices) {
      console.log('User practices from database:', user.practices);
      const saved = localStorage.getItem('resourceAssignmentsFilters');
      let shouldSetDefaults = false;
      
      if (saved) {
        try {
          const parsedFilters = JSON.parse(saved);
          console.log('Saved filters:', parsedFilters);
          // Check if we need to apply defaults
          const needsStatusDefault = !parsedFilters.status || parsedFilters.status.length === 0;
          const needsPracticeDefault = !parsedFilters.practice || parsedFilters.practice.length === 0;
          
          if (needsStatusDefault) {
            parsedFilters.status = ['Pending', 'Unassigned'];
          }
          if (needsPracticeDefault) {
            parsedFilters.practice = [...(user.practices || []), 'Pending'];
            console.log('Setting practice default to user practices + Pending:', [...(user.practices || []), 'Pending']);
          }
          
          setFilters(parsedFilters);
        } catch (error) {
          shouldSetDefaults = true;
        }
      } else {
        shouldSetDefaults = true;
      }
      
      if (shouldSetDefaults) {
        // No saved filters or parsing error, use defaults
        console.log('Setting default filters with user practices + Pending:', [...(user.practices || []), 'Pending']);
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
    fetchAssignments();
    
    // Setup SSE for real-time updates
    const eventSource = new EventSource('/api/events');
    
    eventSource.addEventListener('assignment_created', (event) => {
      const data = JSON.parse(event.data);
      console.log('New assignment created:', data);
      fetchAssignments(); // Refresh assignments list
    });
    
    eventSource.addEventListener('assignment_updated', (event) => {
      const data = JSON.parse(event.data);
      console.log('Assignment updated:', data);
      fetchAssignments(); // Refresh assignments list
    });
    
    return () => {
      eventSource.close();
    };
  }, [router]);

  const fetchAssignments = async () => {
    try {
      const response = await fetch('/api/assignments');
      const data = await response.json();
      if (data.success) {
        setAssignments(data.assignments || []);
      } else {
        console.error('Failed to fetch assignments:', data.error);
        setAssignments([]);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setAssignments([]);
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

  const allFilteredAssignments = assignments.filter(assignment => {
    const matchesStatus = !filters.status || filters.status.length === 0 || filters.status.includes(assignment.status);
    const matchesPractice = !filters.practice || filters.practice.length === 0 || filters.practice.includes(assignment.practice);
    const matchesRegion = !filters.region || assignment.region === filters.region;
    
    // Date range filtering
    let matchesDateRange = true;
    if (filters.dateFrom || filters.dateTo) {
      const assignmentDate = new Date(assignment.requestDate);
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        matchesDateRange = matchesDateRange && assignmentDate >= fromDate;
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999); // Include the entire end date
        matchesDateRange = matchesDateRange && assignmentDate <= toDate;
      }
    }
    
    const matchesSearch = !filters.search || 
      assignment.projectDescription.toLowerCase().includes(filters.search.toLowerCase()) ||
      assignment.resourceAssigned.toLowerCase().includes(filters.search.toLowerCase()) ||
      assignment.customerName.toLowerCase().includes(filters.search.toLowerCase()) ||
      assignment.projectNumber.toLowerCase().includes(filters.search.toLowerCase()) ||
      assignment.pm.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchesStatus && matchesPractice && matchesRegion && matchesDateRange && matchesSearch;
  }).sort((a, b) => {
    if (filters.sort === 'project') {
      return a.projectDescription.localeCompare(b.projectDescription);
    } else if (filters.sort === 'resource') {
      return a.resourceAssigned.localeCompare(b.resourceAssigned);
    } else if (filters.sort === 'customer') {
      return a.customerName.localeCompare(b.customerName);
    }
    return new Date(b.requestDate) - new Date(a.requestDate);
  });

  const totalPages = Math.ceil(allFilteredAssignments.length / assignmentsPerPage);
  const startIndex = (currentPage - 1) * assignmentsPerPage;
  const filteredAssignments = allFilteredAssignments.slice(startIndex, startIndex + assignmentsPerPage);

  // Reset to page 1 when filters change and fetch ETAs
  useEffect(() => {
    setCurrentPage(1);
    fetchPracticeETAs();
  }, [filters.status.length, filters.practice, filters.region, filters.dateFrom, filters.dateTo, filters.search, filters.sort]);

  // Calculate average ETAs from filtered practices and convert to days
  const calculateAverageETA = (etaType) => {
    const relevantETAs = Object.values(practiceETAs)
      .filter(eta => eta[etaType] > 0)
      .map(eta => eta[etaType]);
    
    if (relevantETAs.length === 0) return 0;
    const averageHours = relevantETAs.reduce((sum, hours) => sum + hours, 0) / relevantETAs.length;
    return Math.round(averageHours * 10) / 240; // Convert to days with 1 decimal place (hours/24, then round to 0.1)
  };

  const practiceAssignmentETA = calculateAverageETA('practice_assignment_eta_hours');
  const resourceAssignmentETA = calculateAverageETA('resource_assignment_eta_hours');

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
              { label: 'Resource Assignments' }
            ]} />
            
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-3">
                    Resource Assignments
                  </h1>
                  <p className="text-blue-600/80 text-lg">Manage project resource assignments and allocations</p>
                </div>
                <button
                  onClick={() => router.push('/projects/resource-assignments/new')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  New Assignment
                </button>
              </div>
            </div>

            {/* Stats Containers */}
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
                    <p className="text-2xl font-semibold text-gray-900">{allFilteredAssignments.length}</p>
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
                    <p className="text-2xl font-semibold text-gray-900">{allFilteredAssignments.filter(a => a.status === 'Pending').length}</p>
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
                    <p className="text-2xl font-semibold text-gray-900">{allFilteredAssignments.filter(a => a.status === 'Unassigned').length}</p>
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
                    <p className="text-2xl font-semibold text-gray-900">{allFilteredAssignments.filter(a => a.status === 'Assigned').length}</p>
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
                      {practiceAssignmentETA > 0 ? `${practiceAssignmentETA} days` : 'N/A'}
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
                    <p className="text-sm font-medium text-gray-500">Resource Assignment ETA</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {resourceAssignmentETA > 0 ? `${resourceAssignmentETA} days` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modern Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                  </svg>
                  Filter Assignments
                </h3>
                <button
                  onClick={() => {
                    const defaultFilters = { status: ['Pending', 'Unassigned'], practice: [...(user?.practices || []), 'Pending'], region: '', dateFrom: '', dateTo: '', search: '', sort: 'newest' };
                    localStorage.removeItem('resourceAssignmentsFilters');
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
              
              {/* Search Bar */}
              <div className="relative mb-6">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by project, customer, resource, PM, or project #..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
              
              {/* Filter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Status Filter */}
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
                
                {/* Practice Filter */}
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

                {/* Region Filter */}
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

                {/* Date From */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Date From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  />
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Date To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  />
                </div>

                {/* Sort By */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Sort By</label>
                  <select
                    value={filters.sort}
                    onChange={(e) => setFilters({...filters, sort: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    <option value="newest">📅 Newest First</option>
                    <option value="project">📁 Project Name</option>
                    <option value="customer">🏢 Customer Name</option>
                    <option value="resource">👤 Resource Name</option>
                  </select>
                </div>
              </div>
              
              {/* Active Filters Display */}
              {(filters.search || (filters.practice && filters.practice.length > 0) || (filters.status && filters.status.length > 0) || filters.region || filters.dateFrom || filters.dateTo) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-600">Active filters:</span>
                    {filters.search && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        Search: "{filters.search}"
                        <button onClick={() => setFilters({...filters, search: ''})} className="hover:bg-blue-200 rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {filters.status && filters.status.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                        Status: {filters.status.join(', ')}
                        <button onClick={() => setFilters({...filters, status: []})} className="hover:bg-indigo-200 rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {filters.practice && filters.practice.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Practices: {filters.practice.join(', ')}
                        <button onClick={() => setFilters({...filters, practice: []})} className="hover:bg-green-200 rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {filters.region && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                        Region: {filters.region}
                        <button onClick={() => setFilters({...filters, region: ''})} className="hover:bg-purple-200 rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {(filters.dateFrom || filters.dateTo) && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                        Date: {filters.dateFrom || 'Start'} - {filters.dateTo || 'End'}
                        <button onClick={() => setFilters({...filters, dateFrom: '', dateTo: ''})} className="hover:bg-orange-200 rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Results info */}
            <div className="text-sm text-gray-500 mb-4">
              {loading ? 'Loading...' : `${allFilteredAssignments.length} assignments, Page ${currentPage} of ${totalPages}`}
            </div>
            
            {/* Top Pagination */}
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
            
            {/* Assignments Table */}
            {allFilteredAssignments.length === 0 ? (
              <div className="card text-center py-12">
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📋</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
                  <p className="text-gray-500 mb-6">No resource assignments match your current filters.</p>
                </div>
                <button
                  onClick={() => router.push('/projects/resource-assignments/new')}
                  className="btn-primary"
                >
                  Create First Assignment
                </button>
              </div>
            ) : (
              <AssignmentsTable 
                assignments={filteredAssignments} 
                user={user} 
                onAssignmentUpdate={fetchAssignments}
                allAssignments={assignments}
              />
            )}
            
            {/* Bottom Pagination */}
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
            
            {/* Status Filter Modal */}
            {showStatusModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Select Statuses</h3>
                    
                    <div className="space-y-3 mb-6">
                      {[
                        'Pending',
                        'Unassigned',
                        'Assigned'
                      ].map(status => (
                        <label key={status} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={tempStatusSelection.includes(status)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTempStatusSelection([...tempStatusSelection, status]);
                              } else {
                                setTempStatusSelection(tempStatusSelection.filter(s => s !== status));
                              }
                            }}
                            className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">
                            {status === 'Pending' && '🔵 '}
                            {status === 'Unassigned' && '🟡 '}
                            {status === 'Assigned' && '🟢 '}
                            {status}
                          </span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => {
                          const allStatuses = ['Pending', 'Unassigned', 'Assigned'];
                          if (tempStatusSelection.length === allStatuses.length) {
                            setTempStatusSelection([]);
                          } else {
                            setTempStatusSelection(allStatuses);
                          }
                        }}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        {tempStatusSelection.length === 3 ? 'Unselect All' : 'Select All'}
                      </button>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowStatusModal(false)}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setFilters({...filters, status: tempStatusSelection});
                          setShowStatusModal(false);
                        }}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Practice Filter Modal */}
            {showPracticeModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Select Practices</h3>
                    
                    <div className="space-y-3 mb-6">
                      {PRACTICE_OPTIONS.sort().map(practice => (
                        <label key={practice} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={tempPracticeSelection.includes(practice)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTempPracticeSelection([...tempPracticeSelection, practice]);
                              } else {
                                setTempPracticeSelection(tempPracticeSelection.filter(p => p !== practice));
                              }
                            }}
                            className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{practice}</span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setTempPracticeSelection([...PRACTICE_OPTIONS])}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        All Practices
                      </button>
                      {user && user.practices && (
                        <button
                          onClick={() => setTempPracticeSelection([...user.practices])}
                          className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          My Practices
                        </button>
                      )}
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowPracticeModal(false)}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setFilters({...filters, practice: tempPracticeSelection});
                          setShowPracticeModal(false);
                        }}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Apply
                      </button>
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

function AssignmentsTable({ assignments, user, onAssignmentUpdate, allAssignments }) {
  const router = useRouter();
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [assignmentData, setAssignmentData] = useState({
    resourceAssigned: [],
    dateAssigned: new Date().toISOString().split('T')[0]
  });
  const [practiceData, setPracticeData] = useState({
    practice: [],
    am: '',
    targetStatus: '',
    resourceAssigned: [],
    dateAssigned: new Date().toISOString().split('T')[0]
  });
  const [practiceError, setPracticeError] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentAssignmentId, setCurrentAssignmentId] = useState(null);

  // Helper function to check if user can edit assignment
  const canEditAssignment = (assignment) => {
    if (user.isAdmin) return true;
    
    // For Unassigned or Assigned status, only practice managers/principals of the assigned practice can edit
    if (assignment.status === 'Unassigned' || assignment.status === 'Assigned') {
      return (user.role === 'practice_manager' || user.role === 'practice_principal') && 
             user.practices?.includes(assignment.practice);
    }
    
    // For Pending status, practice managers/principals can edit
    if (assignment.practice === 'Pending') {
      return user.role === 'practice_manager' || user.role === 'practice_principal';
    }
    
    // For other statuses, practice managers/principals of the practice can edit
    return (user.role === 'practice_manager' || user.role === 'practice_principal') && 
           user.practices?.includes(assignment.practice);
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
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Project #</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Region</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PM</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource Assigned</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Assigned</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assignments.map((assignment) => (
              <tr 
                key={assignment.id} 
                className={`hover:bg-gray-50 cursor-pointer ${
                  assignment.status === 'Pending' ? 'bg-yellow-50' : ''
                }`}
                onClick={() => router.push(`/projects/resource-assignments/${assignment.id}`)}
              >
                <td className="px-2 py-3">
                  <div className="text-sm font-mono text-blue-600">#{assignment.assignment_number}</div>
                </td>
                <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                  {canEditAssignment(assignment) ? (
                    <select
                      value={assignment.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        setCurrentAssignmentId(assignment.id);
                        
                        if (newStatus === 'Assigned') {
                          // If changing from Pending, show practice modal with assignment fields
                          if (assignment.status === 'Pending') {
                            setPracticeData({
                              practice: assignment.practice !== 'Pending' ? (assignment.practice ? assignment.practice.split(',').map(p => p.trim()) : []) : [],
                              am: assignment.am || '',
                              targetStatus: newStatus,
                              resourceAssigned: assignment.resourceAssigned || '',
                              dateAssigned: assignment.dateAssigned || new Date().toISOString().split('T')[0]
                            });
                            setPracticeError('');
                            setShowPracticeModal(true);
                          } else {
                            // Show regular assignment modal for non-pending assignments
                            setAssignmentData({
                              resourceAssigned: assignment.resourceAssigned || '',
                              dateAssigned: assignment.dateAssigned || new Date().toISOString().split('T')[0]
                            });
                            setShowAssignmentModal(true);
                          }
                          // Reset dropdown to current status
                          e.target.value = assignment.status;
                          return;
                        }
                        
                        // If changing from Pending to Unassigned, show practice modal
                        if (assignment.status === 'Pending' && newStatus === 'Unassigned') {
                          setPracticeData({
                            practice: assignment.practice !== 'Pending' ? (assignment.practice ? assignment.practice.split(',').map(p => p.trim()) : []) : [],
                            am: assignment.am || '',
                            targetStatus: newStatus
                          });
                          setPracticeError('');
                          setShowPracticeModal(true);
                          // Reset dropdown to current status
                          e.target.value = assignment.status;
                          return;
                        }
                        
                        // For other statuses, update immediately
                        try {
                          const response = await fetch(`/api/assignments/${assignment.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: newStatus })
                          });
                          if (response.ok) {
                            onAssignmentUpdate();
                          }
                        } catch (error) {
                          console.error('Error updating status:', error);
                        }
                      }}
                      className={`text-sm font-semibold px-3 py-1.5 rounded-full border-0 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-3 focus:ring-opacity-50 ${
                        assignment.status === 'Pending' ? 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-300' :
                        assignment.status === 'Unassigned' ? 'bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-300' :
                        assignment.status === 'Assigned' ? 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-300' :
                        'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-300'
                      }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Unassigned">Unassigned</option>
                      <option value="Assigned">Assigned</option>
                    </select>
                  ) : (
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-lg ${
                      assignment.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      assignment.status === 'Unassigned' ? 'bg-orange-100 text-orange-800' :
                      assignment.status === 'Assigned' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {assignment.status}
                    </span>
                  )}
                </td>
                <td className="px-2 py-3">
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {assignment.practice}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm font-mono text-blue-600">{assignment.projectNumber}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      {(() => {
                        const attachments = JSON.parse(assignment.attachments || '[]');
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
                      })()
                      }
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate mb-1" title={assignment.customerName}>
                      {assignment.customerName}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-1" title={assignment.projectDescription}>{assignment.projectDescription}</p>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{assignment.region}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">{assignment.pm}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">
                    {assignment.resourceAssigned ? (
                      assignment.resourceAssigned.includes(',') ? (
                        <div className="space-y-1">
                          {assignment.resourceAssigned.split(',').slice(0, 2).map((resource, index) => (
                            <div key={index} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full mr-1">
                              {resource.trim()}
                            </div>
                          ))}
                          {assignment.resourceAssigned.split(',').length > 2 && (
                            <div className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              +{assignment.resourceAssigned.split(',').length - 2} more
                            </div>
                          )}
                        </div>
                      ) : assignment.resourceAssigned
                    ) : ''}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">
                    {new Date(assignment.requestDate).toLocaleString('en-US', {
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
                  <div className="text-sm text-gray-900">{new Date(assignment.dateAssigned).toLocaleDateString()}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Render modals using portals to center them on the page */}
      {typeof window !== 'undefined' && showPracticeModal && createPortal(
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
                  : 'Please assign this request to a practice and account manager.'}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Practice *</label>
                  <PracticeSelector
                    value={practiceData.practice}
                    onChange={(practices) => {
                      setPracticeData(prev => ({...prev, practice: practices}));
                      
                      // Check if user can assign to these practices when going to Assigned or Unassigned status
                      if ((practiceData.targetStatus === 'Assigned' || practiceData.targetStatus === 'Unassigned') && practices.length > 0 && !user.isAdmin) {
                        const canAssignToAll = practices.every(practice => 
                          user.practices?.includes(practice) && 
                          (user.role === 'practice_manager' || user.role === 'practice_principal')
                        );
                        
                        if (!canAssignToAll) {
                          setPracticeError('Error: You are not a Practice Manager or Practice Principal of all selected practices');
                        } else {
                          setPracticeError('');
                        }
                      } else {
                        setPracticeError('');
                      }
                    }}
                    placeholder="Select practices..."
                    excludePending={true}
                    required
                    className={practiceError ? 'border-red-300 bg-red-50' : ''}
                  />
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
                    <MultiResourceSelector
                      value={practiceData.resourceAssigned}
                      onChange={(resources) => setPracticeData(prev => ({...prev, resourceAssigned: resources}))}
                      assignedPractices={Array.isArray(practiceData.practice) ? practiceData.practice : (practiceData.practice ? [practiceData.practice] : [])}
                      placeholder="Select or type a user name..."
                      required
                    />
                    
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
                    if (!practiceData.practice || practiceData.practice.length === 0) {
                      alert('Please select at least one practice');
                      return;
                    }
                    
                    if (practiceData.targetStatus === 'Assigned' && (!practiceData.resourceAssigned || practiceData.resourceAssigned.length === 0)) {
                      alert('Please assign at least one resource');
                      return;
                    }
                    
                    setSaving(true);
                    try {
                      const updateData = {
                        status: practiceData.targetStatus,
                        practice: Array.isArray(practiceData.practice) ? practiceData.practice.join(',') : practiceData.practice,
                        am: practiceData.am
                      };
                      
                      // Add assignment fields if target status is Assigned
                      if (practiceData.targetStatus === 'Assigned') {
                        updateData.resourceAssigned = Array.isArray(practiceData.resourceAssigned) ? practiceData.resourceAssigned.join(',') : practiceData.resourceAssigned;
                        updateData.dateAssigned = practiceData.dateAssigned;
                      }
                      
                      const response = await fetch(`/api/assignments/${currentAssignmentId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                      });
                      if (response.ok) {
                        onAssignmentUpdate();
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
                  disabled={saving || !practiceData.practice || practiceData.practice.length === 0 || practiceError || (practiceData.targetStatus === 'Assigned' && (!practiceData.resourceAssigned || practiceData.resourceAssigned.length === 0))}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Assigning...' : (practiceData.targetStatus === 'Assigned' ? 'Assign Resource' : 'Assign to Practice')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Assignment Modal */}
      {typeof window !== 'undefined' && showAssignmentModal && createPortal(
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
                  <MultiResourceSelector
                    value={assignmentData.resourceAssigned}
                    onChange={(resources) => setAssignmentData(prev => ({...prev, resourceAssigned: resources}))}
                    assignedPractices={allAssignments.find(a => a.id === currentAssignmentId)?.practice ? allAssignments.find(a => a.id === currentAssignmentId).practice.split(',').map(p => p.trim()) : []}
                    placeholder="Select or type a user name..."
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
                    if (!assignmentData.resourceAssigned || assignmentData.resourceAssigned.length === 0) {
                      alert('Please assign at least one resource');
                      return;
                    }
                    
                    setSaving(true);
                    try {
                      const response = await fetch(`/api/assignments/${currentAssignmentId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          status: 'Assigned',
                          resourceAssigned: Array.isArray(assignmentData.resourceAssigned) ? assignmentData.resourceAssigned.join(',') : assignmentData.resourceAssigned,
                          dateAssigned: assignmentData.dateAssigned
                        })
                      });
                      if (response.ok) {
                        onAssignmentUpdate();
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
                  disabled={saving || !assignmentData.resourceAssigned || assignmentData.resourceAssigned.length === 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Assigning...' : 'Assign Resource'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}