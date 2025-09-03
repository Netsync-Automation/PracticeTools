'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CogIcon, MagnifyingGlassIcon, HandThumbUpIcon, EyeIcon } from '@heroicons/react/24/outline';
import AttachmentPreview from '../../components/AttachmentPreview';
import Pagination from '../../components/Pagination';
import Navbar from '../../components/Navbar';
import Breadcrumb from '../../components/Breadcrumb';
import AccessCheck from '../../components/AccessCheck';
import UserDisplay from '../../components/UserDisplay';
import { useAuth } from '../../hooks/useAuth';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [showReports, setShowReports] = useState(false);
  const [stats, setStats] = useState({
    totalIssues: 0,
    openIssues: 0,
    closedIssues: 0,
    totalUsers: 0
  });
  const [assignedIssues, setAssignedIssues] = useState([]);
  const [loadingAssigned, setLoadingAssigned] = useState(true);
  const [admins, setAdmins] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
    sort: 'newest',
    system: '',
    assignedAdmin: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const issuesPerPage = 20;

  useEffect(() => {
    if (user && !user.isAdmin) {
      router.push('/');
      return;
    }
    
    if (user) {
      fetchStats();
      fetchAssignedIssues();
      fetchAdmins();
      fetchIssueTypes();
      // Set current admin as default filter
      setFilters(prev => ({...prev, assignedAdmin: user.email}));
    }
  }, [user, router]);

  const fetchStats = async () => {
    try {
      const [issuesRes, usersRes] = await Promise.all([
        fetch('/api/issues'),
        fetch('/api/users')
      ]);
      
      const issuesData = await issuesRes.json();
      const usersData = await usersRes.json();
      
      const issues = issuesData.issues || [];
      const users = usersData.users || [];
      
      setStats({
        totalIssues: issues.length,
        openIssues: issues.filter(i => i.status === 'Open').length,
        closedIssues: issues.filter(i => i.status === 'Closed').length,
        totalUsers: users.length
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAssignedIssues = async () => {
    try {
      const response = await fetch('/api/admin/assigned-issues');
      const data = await response.json();
      setAssignedIssues(data.issues || []);
    } catch (error) {
      console.error('Error fetching assigned issues:', error);
    } finally {
      setLoadingAssigned(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/admin/get-admins');
      const data = await response.json();
      setAdmins(data.admins || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const fetchIssueTypes = async () => {
    try {
      const response = await fetch('/api/issue-types');
      const data = await response.json();
      setIssueTypes(data.issueTypes || []);
    } catch (error) {
      console.error('Error fetching issue types:', error);
    }
  };

  const allFilteredIssues = assignedIssues.filter(issue => {
    const matchesType = !filters.type || issue.issue_type === filters.type;
    const matchesStatus = !filters.status || issue.status === filters.status;
    const matchesSystem = !filters.system || issue.system === filters.system;
    const matchesAssignedAdmin = !filters.assignedAdmin || 
      issue.assigned_to === filters.assignedAdmin || 
      issue.assigned_to === admins.find(a => a.email === filters.assignedAdmin)?.name;
    const matchesSearch = !filters.search || 
      issue.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      issue.description.toLowerCase().includes(filters.search.toLowerCase()) ||
      issue.issue_number.toString().includes(filters.search);
    
    return matchesType && matchesStatus && matchesSystem && matchesAssignedAdmin && matchesSearch;
  }).sort((a, b) => {
    if (filters.sort === 'upvotes') {
      return (b.upvotes || 0) - (a.upvotes || 0);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const totalPages = Math.ceil(allFilteredIssues.length / issuesPerPage);
  const startIndex = (currentPage - 1) * issuesPerPage;
  const filteredIssues = allFilteredIssues.slice(startIndex, startIndex + issuesPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.type, filters.status, filters.search, filters.sort, filters.system, filters.assignedAdmin]);



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
        <Navbar user={user} onLogout={logout} />
      
      <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8" style={{maxWidth: 'calc(100vw - 4rem)'}}>
        <Breadcrumb items={[{ label: 'Admin Dashboard' }]} />
        
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Manage users and system settings</p>
          </div>
        </div>

        {/* Header with Stats and Settings */}
        <div className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total Issues</p>
                  <p className="text-2xl font-bold">{stats.totalIssues}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm font-medium">Open Issues</p>
                  <p className="text-2xl font-bold">{stats.openIssues}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Closed Issues</p>
                  <p className="text-2xl font-bold">{stats.closedIssues}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Total Users</p>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                </div>
              </div>
            </div>
            
            {/* Settings Card */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">Settings</p>
                  <p className="text-sm font-bold leading-tight">Config Settings & Manage Users</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <button 
                onClick={() => router.push('/admin/settings')}
                className="w-full mt-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-medium py-2 px-3 rounded-lg transition-all duration-200 text-sm"
              >
                Open Settings
              </button>
            </div>
          </div>
        </div>

        {/* Assigned Issues Section */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">📋 Issues Assigned to Admins</h2>
            <p className="text-gray-600">Issues that have been assigned to administrators for resolution</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                </svg>
                Filter Issues
              </h3>
              <button
                onClick={() => {
                  setFilters({ type: '', status: '', search: '', sort: 'newest', system: '', assignedAdmin: user?.email || '' });
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
                placeholder="Search by title, description, or issue number..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
            
            {/* Filter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* System Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">System</label>
                <select
                  value={filters.system}
                  onChange={(e) => setFilters({...filters, system: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="">All Systems</option>
                  {[
                    'Issues Tracker',
                    'SCOOP'
                  ].sort().map(system => (
                    <option key={system} value={system}>{system}</option>
                  ))}
                </select>
              </div>
              
              {/* Type Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({...filters, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="">All Types</option>
                  {issueTypes.sort((a, b) => a.name.localeCompare(b.name)).map(type => (
                    <option key={type.name} value={type.name}>
                      {type.icon} {type.name}
                    </option>
                  ))}
                </select>
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
                  {[
                    { value: 'Backlog', label: '🟣 Backlog' },
                    { value: 'Closed', label: '🟢 Closed' },
                    { value: 'In Progress', label: '🟡 In Progress' },
                    { value: 'Open', label: '🔴 Open' },
                    { value: 'Pending Testing', label: '🔵 Pending Testing' },
                    { value: 'Rejected', label: '⚫ Rejected' }
                  ].sort((a, b) => a.value.localeCompare(b.value)).map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Admin Filter */}
              {admins && admins.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Assigned Admin</label>
                  <select
                    value={filters.assignedAdmin}
                    onChange={(e) => setFilters({...filters, assignedAdmin: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    <option value="">All Admins</option>
                    {admins.sort((a, b) => a.name.localeCompare(b.name)).map((admin) => (
                      <option key={admin.email} value={admin.email}>
                        {admin.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Sort Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Sort By</label>
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters({...filters, sort: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  {[
                    { value: 'upvotes', label: '👍 Most Upvotes' },
                    { value: 'newest', label: '📅 Newest First' }
                  ].sort((a, b) => a.label.localeCompare(b.label)).map(sort => (
                    <option key={sort.value} value={sort.value}>{sort.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Active Filters Display */}
            {(filters.search || filters.system || filters.type || filters.status || filters.assignedAdmin) && (
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
                  {filters.system && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      System: {filters.system}
                      <button onClick={() => setFilters({...filters, system: ''})} className="hover:bg-green-200 rounded-full p-0.5">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {filters.type && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                      Type: {filters.type}
                      <button onClick={() => setFilters({...filters, type: ''})} className="hover:bg-purple-200 rounded-full p-0.5">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {filters.status && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                      Status: {filters.status}
                      <button onClick={() => setFilters({...filters, status: ''})} className="hover:bg-orange-200 rounded-full p-0.5">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {filters.assignedAdmin && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                      Admin: {admins.find(a => a.email === filters.assignedAdmin)?.name || filters.assignedAdmin}
                      <button onClick={() => setFilters({...filters, assignedAdmin: ''})} className="hover:bg-indigo-200 rounded-full p-0.5">
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

          {/* Issues Count */}
          <div className="text-sm text-gray-500 mb-4">
            {loadingAssigned ? 'Loading...' : `${allFilteredIssues.length} assigned issues, Page ${currentPage} of ${totalPages}`}
          </div>
          
          {/* Pagination */}
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
          
          {/* Issues Table */}
          {loadingAssigned ? (
            <div className="card text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : allFilteredIssues.length === 0 ? (
            <div className="card text-center py-12">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📋</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No assigned issues</h3>
                <p className="text-gray-500">You don't have any issues assigned to you yet.</p>
              </div>
            </div>
          ) : (
            <AssignedIssuesTable issues={filteredIssues} user={user} router={router} />
          )}
          
          {/* Bottom Pagination */}
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
        </div>
      </div>
    </AccessCheck>
  );
}

function AssignedIssuesTable({ issues, user, router }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Open': return 'bg-red-100 text-red-800';
      case 'Closed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Pending Testing': return 'bg-blue-100 text-blue-800';
      case 'Backlog': return 'bg-purple-100 text-purple-800';
      case 'Rejected': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type) => {
    const issueType = issueTypes.find(it => it.name === type);
    return issueType ? issueType.icon : '📝';
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">ID</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Type</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Status</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">System</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Created</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Upvotes</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {issues.map((issue) => {
              const attachments = JSON.parse(issue.attachments || '[]');
              
              return (
                <tr 
                  key={issue.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={(e) => {
                    if (e.target.closest('button, select, input, a')) return;
                    router.push(`/issue/${issue.id}?from=admin`);
                  }}
                >
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span className="text-xs text-blue-500 font-mono bg-blue-50 px-1 py-0.5 rounded">{issue.issue_number}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        {attachments.length > 0 && (
                          <AttachmentPreview attachment={attachments[0]} position="right" view="table">
                            <span className="text-xs text-blue-600">
                              📎 {attachments.length}
                            </span>
                          </AttachmentPreview>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate mb-1" title={issue.title}>{issue.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-1" title={issue.description}>{issue.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        By <UserDisplay email={issue.email} />
                      </p>
                    </div>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span className="text-xs">{getTypeIcon(issue.issue_type)} {issue.issue_type}</span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span className={`px-1 py-0.5 text-xs font-medium rounded ${getStatusColor(issue.status)}`}>
                      {issue.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {issue.system || 'SCOOP'}
                    </span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500">
                    <div>{new Date(issue.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      👍 {issue.upvotes || 0}
                    </div>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/issue/${issue.id}?from=admin`);
                        }}
                        className="text-green-600 hover:text-green-800 text-xs px-2 py-1 bg-green-50 rounded flex-1 whitespace-nowrap"
                      >
                        👁️ View/Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/issue/${issue.id}?from=admin`);
                        }}
                        className="text-purple-600 hover:text-purple-800 text-xs px-2 py-1 bg-purple-50 rounded flex-1 whitespace-nowrap"
                      >
                        💬 Comment
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}