'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import Navbar from '../../../components/Navbar';
import SidebarLayout from '../../../components/SidebarLayout';
import AccessCheck from '../../../components/AccessCheck';
import Breadcrumb from '../../../components/Breadcrumb';
import Pagination from '../../../components/Pagination';
import AttachmentPreview from '../../../components/AttachmentPreview';
import MultiAttachmentPreview from '../../../components/MultiAttachmentPreview';

export default function ResourceAssignmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [filters, setFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('resourceAssignmentsFilters');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    return {
      project: '',
      resource: '',
      status: '',
      search: '',
      sort: 'newest',
      practice: []
    };
  });
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [tempPracticeSelection, setTempPracticeSelection] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const assignmentsPerPage = 20;

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('resourceAssignmentsFilters', JSON.stringify(filters));
    }
  }, [filters]);

  // Initialize practice filter based on user's practices
  useEffect(() => {
    if (user && user.practices && user.practices.length > 0) {
      const saved = localStorage.getItem('resourceAssignmentsFilters');
      const savedFilters = saved ? JSON.parse(saved) : null;
      if (!saved || !savedFilters.practice || savedFilters.practice.length === 0) {
        setFilters(prev => ({
          ...prev,
          practice: user.practices
        }));
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
    const matchesProject = !filters.project || assignment.projectDescription.toLowerCase().includes(filters.project.toLowerCase()) || assignment.projectNumber.toLowerCase().includes(filters.project.toLowerCase());
    const matchesResource = !filters.resource || assignment.resourceAssigned.toLowerCase().includes(filters.resource.toLowerCase());
    const matchesStatus = !filters.status || assignment.status === filters.status;
    const matchesPractice = !filters.practice || filters.practice.length === 0 || filters.practice.includes(assignment.practice);
    const matchesSearch = !filters.search || 
      assignment.projectDescription.toLowerCase().includes(filters.search.toLowerCase()) ||
      assignment.resourceAssigned.toLowerCase().includes(filters.search.toLowerCase()) ||
      assignment.customerName.toLowerCase().includes(filters.search.toLowerCase()) ||
      assignment.projectNumber.toLowerCase().includes(filters.search.toLowerCase()) ||
      assignment.am.toLowerCase().includes(filters.search.toLowerCase()) ||
      assignment.pm.toLowerCase().includes(filters.search.toLowerCase());
    
    return matchesProject && matchesResource && matchesStatus && matchesPractice && matchesSearch;
  }).sort((a, b) => {
    if (filters.sort === 'project') {
      return a.projectDescription.localeCompare(b.projectDescription);
    } else if (filters.sort === 'resource') {
      return a.resourceAssigned.localeCompare(b.resourceAssigned);
    }
    return new Date(b.requestDate) - new Date(a.requestDate);
  });

  const totalPages = Math.ceil(allFilteredAssignments.length / assignmentsPerPage);
  const startIndex = (currentPage - 1) * assignmentsPerPage;
  const filteredAssignments = allFilteredAssignments.slice(startIndex, startIndex + assignmentsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.project, filters.resource, filters.status, filters.search, filters.sort, filters.practice]);

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">📊</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Assignments</p>
                    <p className="text-2xl font-semibold text-gray-900">{allFilteredAssignments.length}</p>
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
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-semibold text-sm">👥</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Unique Resources</p>
                    <p className="text-2xl font-semibold text-gray-900">{new Set(allFilteredAssignments.map(a => a.resourceAssigned)).size}</p>
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
                    <p className="text-sm font-medium text-gray-500">Assigned Projects</p>
                    <p className="text-2xl font-semibold text-gray-900">{new Set(allFilteredAssignments.filter(a => a.status === 'Assigned').map(a => a.projectNumber)).size}</p>
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
                    const defaultFilters = { project: '', resource: '', status: '', search: '', sort: 'newest', practice: user?.practices || [] };
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
                  placeholder="Search by project, customer, resource, AM, PM, or project #..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
              
              {/* Filter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
                
                {/* Project Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Project</label>
                  <input
                    type="text"
                    placeholder="Filter by project"
                    value={filters.project}
                    onChange={(e) => setFilters({...filters, project: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  />
                </div>

                {/* Resource Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Resource</label>
                  <input
                    type="text"
                    placeholder="Filter by resource"
                    value={filters.resource}
                    onChange={(e) => setFilters({...filters, resource: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  />
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="Unassigned">🟡 Unassigned</option>
                    <option value="Assigned">🟢 Assigned</option>
                  </select>
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
                    <option value="resource">👤 Resource Name</option>
                  </select>
                </div>
              </div>
              
              {/* Active Filters Display */}
              {(filters.search || (filters.practice && filters.practice.length > 0) || filters.project || filters.resource || filters.status) && (
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
                    {filters.project && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                        Project: {filters.project}
                        <button onClick={() => setFilters({...filters, project: ''})} className="hover:bg-purple-200 rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {filters.resource && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                        Resource: {filters.resource}
                        <button onClick={() => setFilters({...filters, resource: ''})} className="hover:bg-orange-200 rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {filters.status && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                        Status: {filters.status}
                        <button onClick={() => setFilters({...filters, status: ''})} className="hover:bg-indigo-200 rounded-full p-0.5">
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
              <AssignmentsTable assignments={filteredAssignments} />
            )}
            
            {/* Bottom Pagination */}
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
            
            {/* Practice Filter Modal */}
            {showPracticeModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Select Practices</h3>
                    
                    <div className="space-y-3 mb-6">
                      {[
                        'Audio/Visual',
                        'Collaboration',
                        'Contact Center',
                        'CX',
                        'Cyber Security',
                        'Data Center',
                        'Enterprise Networking',
                        'IoT',
                        'Physical Security',
                        'Project Management',
                        'WAN/Optical',
                        'Wireless'
                      ].sort().map(practice => (
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
                        onClick={() => setTempPracticeSelection([
                          'Audio/Visual', 'Collaboration', 'Contact Center', 'CX', 'Cyber Security',
                          'Data Center', 'Enterprise Networking', 'IoT', 'Physical Security',
                          'Project Management', 'WAN/Optical', 'Wireless'
                        ])}
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

function AssignmentsTable({ assignments }) {
  const router = useRouter();
  
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment ID</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Practice</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attachments</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project #</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Description</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AM</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PM</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource Assigned</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ETA</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request Date</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Assigned</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assignments.map((assignment) => (
              <tr 
                key={assignment.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/projects/resource-assignments/${assignment.id}`)}
              >
                <td className="px-2 py-3">
                  <div className="text-sm font-mono text-blue-600">#{assignment.assignment_number}</div>
                </td>
                <td className="px-2 py-3">
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {assignment.practice}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    assignment.status === 'Assigned' ? 'bg-green-100 text-green-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {assignment.status}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <div className="flex justify-center">
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
                    })()}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm font-mono text-blue-600">{assignment.projectNumber}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">{assignment.customerName}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900 max-w-xs truncate" title={assignment.projectDescription}>{assignment.projectDescription}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">{assignment.region}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">{assignment.am}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">{assignment.pm}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">{assignment.resourceAssigned}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">{new Date(assignment.eta).toLocaleDateString()}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">{new Date(assignment.requestDate).toLocaleDateString()}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">{new Date(assignment.dateAssigned).toLocaleDateString()}</div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900 max-w-xs truncate" title={assignment.notes}>{assignment.notes}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}