'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CogIcon, MagnifyingGlassIcon, HandThumbUpIcon, EyeIcon } from '@heroicons/react/24/outline';
import AttachmentPreview from '../../components/AttachmentPreview';
import MultiAttachmentPreview from '../../components/MultiAttachmentPreview';
import Pagination from '../../components/Pagination';
import Navbar from '../../components/Navbar';
import SidebarLayout from '../../components/SidebarLayout';
import Breadcrumb from '../../components/Breadcrumb';
import AccessCheck from '../../components/AccessCheck';
import UserDisplay from '../../components/UserDisplay';
import { useAuth } from '../../hooks/useAuth';
import { useCsrf } from '../../hooks/useCsrf';
import { sanitizeText } from '../../lib/sanitize';

export default function PracticeIssuesLeadershipPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { getHeaders } = useCsrf();
  const [practiceOptions, setPracticeOptions] = useState([]);
  const [stats, setStats] = useState({
    totalIssues: 0,
    openIssues: 0,
    closedIssues: 0,
    totalUsers: 0
  });
  const [allIssues, setAllIssues] = useState([]);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [leaders, setLeaders] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [filters, setFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('practiceLeadershipFilters');
      if (saved) {
        const parsedFilters = JSON.parse(saved);
        // Clear assignedAdmin from saved filters to prevent defaulting to user email
        parsedFilters.assignedAdmin = '';
        return parsedFilters;
      }
    }
    return {
      type: '',
      status: '',
      search: '',
      sort: 'newest',
      practice: [],
      assignedAdmin: ''
    };
  });
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [tempPracticeSelection, setTempPracticeSelection] = useState([]);

  // Create a lookup map for leader names
  const leaderNameMap = useMemo(() => {
    const map = {};
    if (leaders && Array.isArray(leaders)) {
      leaders.forEach(leader => {
        if (leader.email && leader.name) {
          map[leader.email] = leader.name;
        }
      });
    }
    // Add current user to the map if they're not already included
    if (user && user.email && user.name && !map[user.email]) {
      map[user.email] = user.name;
    }
    return map;
  }, [leaders, user]);
  const [currentPage, setCurrentPage] = useState(1);
  const issuesPerPage = 20;

  useEffect(() => {
    if (user && !user.isAdmin && user.role !== 'practice_manager' && user.role !== 'practice_principal') {
      router.push('/');
      return;
    }
    
    if (user) {
      fetchStats();
      fetchAllIssues();
      fetchLeaders();
      fetchIssueTypes();
      fetchPracticeOptions();
      // Don't set default assigned admin - show all leaders by default
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
      // Error fetching stats - continue with defaults
    }
  };

  const fetchAllIssues = async () => {
    try {
      const response = await fetch('/api/issues');
      const data = await response.json();
      setAllIssues(data.issues || []);
    } catch (error) {
      // Error fetching issues - continue with empty array
    } finally {
      setLoadingIssues(false);
    }
  };

  const fetchLeaders = async () => {
    try {
      const response = await fetch('/api/practice-leaders');
      const data = await response.json();
      const practiceLeaders = data.leaders || [];
      setLeaders(practiceLeaders);
    } catch (error) {
      // Error fetching leaders - continue with empty array
    }
  };

  const fetchPracticeOptions = async () => {
    try {
      const response = await fetch('/api/practice-options');
      const data = await response.json();
      setPracticeOptions(data.practices || []);
    } catch (error) {
      // Fallback to constants until database is set up
      const { PRACTICE_OPTIONS } = await import('../../constants/practices');
      setPracticeOptions(PRACTICE_OPTIONS);
    }
  };

  const fetchIssueTypes = async () => {
    try {
      const response = await fetch('/api/issue-types');
      const data = await response.json();
      setIssueTypes(data.issueTypes || []);
    } catch (error) {
      // Error fetching issue types - continue with empty array
    }
  };

  const allFilteredIssues = allIssues.filter(issue => {
    const matchesType = !filters.type || issue.issue_type === filters.type;
    const matchesStatus = !filters.status || issue.status === filters.status;
    const matchesPractice = !filters.practice || filters.practice.length === 0 || filters.practice.includes(issue.practice);
    const matchesAssignedLeader = !filters.assignedAdmin || 
      issue.assigned_to === filters.assignedAdmin || 
      issue.assigned_to === leaders.find(l => l.email === filters.assignedAdmin)?.name;
    const matchesSearch = !filters.search || 
      issue.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      issue.description.toLowerCase().includes(filters.search.toLowerCase()) ||
      issue.issue_number.toString().includes(filters.search);
    
    return matchesType && matchesStatus && matchesPractice && matchesAssignedLeader && matchesSearch;
  }).sort((a, b) => {
    if (filters.sort === 'upvotes') {
      return (b.upvotes || 0) - (a.upvotes || 0);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const totalPages = Math.ceil(allFilteredIssues.length / issuesPerPage);
  const startIndex = (currentPage - 1) * issuesPerPage;
  const filteredIssues = allFilteredIssues.slice(startIndex, startIndex + issuesPerPage);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('practiceLeadershipFilters', JSON.stringify(filters));
    }
  }, [filters]);

  // Initialize practice filter based on user's practices and role
  useEffect(() => {
    if (user && user.practices && user.practices.length > 0) {
      const saved = localStorage.getItem('practiceLeadershipFilters');
      const savedFilters = saved ? JSON.parse(saved) : null;
      
      // Non-admin practice leaders can only see their assigned practices
      if (!user.isAdmin && (user.role === 'practice_manager' || user.role === 'practice_principal')) {
        setFilters(prev => ({
          ...prev,
          practice: user.practices
        }));
      } else if (!saved || !savedFilters.practice || savedFilters.practice.length === 0) {
        setFilters(prev => ({
          ...prev,
          practice: user.practices
        }));
      }
    }
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.type, filters.status, filters.search, filters.sort, filters.practice, filters.assignedAdmin]);

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
        
        <SidebarLayout user={user}>
          <div className="p-8">
            <Breadcrumb items={[{ label: 'Practice Leadership View' }]} />
            
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Practice Leadership View</h1>
              <p className="text-gray-600">Manage and oversee practice issues</p>
            </div>

            <div className="mb-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Total Issues</p>
                      <p className="text-2xl font-bold">{allFilteredIssues.length}</p>
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
                      <p className="text-2xl font-bold">{allFilteredIssues.filter(i => i.status === 'Open').length}</p>
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
                      <p className="text-2xl font-bold">{allFilteredIssues.filter(i => i.status === 'Closed').length}</p>
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
                      <p className="text-purple-100 text-sm font-medium">In Progress</p>
                      <p className="text-2xl font-bold">{allFilteredIssues.filter(i => i.status === 'In Progress').length}</p>
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-lg p-2">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="mb-6">
                <p className="text-gray-600">Issues that have been assigned to my practice for resolution</p>
              </div>

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
                      const defaultFilters = { type: '', status: '', search: '', sort: 'newest', practice: user?.practices || [], assignedAdmin: '' };
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
                    placeholder="Search by title, description, or issue number..."
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Practice</label>
                    {!user.isAdmin && (user.role === 'practice_manager' || user.role === 'practice_principal') ? (
                      <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-600">
                        {user.practices && user.practices.length === 1 ? user.practices[0] : 
                         user.practices && user.practices.length > 1 ? 'My Practices' : 'No Practices Assigned'}
                      </div>
                    ) : (
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
                    )}
                  </div>
                  
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
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Assigned Leader</label>
                    <select
                      value={filters.assignedAdmin}
                      onChange={(e) => setFilters({...filters, assignedAdmin: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                    >
                      <option value="">All Leaders</option>
                      {leaders
                        .filter(leader => {
                          // Always include leaders with matching practices
                          if (!filters.practice || filters.practice.length === 0) {
                            // If no practice filter, show all practice leaders
                            return true;
                          }
                          // Show leaders whose practices overlap with selected practices
                          return leader.practices && Array.isArray(leader.practices) && 
                                 leader.practices.some(p => filters.practice.includes(p));
                        })
                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                        .map((leader) => (
                          <option key={leader.email} value={leader.email}>
                            {leader.name || leader.email}
                          </option>
                        ))}
                      {/* Add current user if they're a practice leader but not in the leaders list */}
                      {user && (user.role === 'practice_manager' || user.role === 'practice_principal') && 
                       !leaders.find(l => l.email === user.email) && (
                        <option key={user.email} value={user.email}>
                          {user.name || user.email}
                        </option>
                      )}
                    </select>
                  </div>
                  
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
                {(filters.search || (filters.practice && filters.practice.length > 0) || filters.type || filters.status || filters.assignedAdmin) && (
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
                          {(user.isAdmin || (user.role !== 'practice_manager' && user.role !== 'practice_principal')) && (
                            <button onClick={() => setFilters({...filters, practice: []})} className="hover:bg-green-200 rounded-full p-0.5">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
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
                          Leader: {leaderNameMap[filters.assignedAdmin] || filters.assignedAdmin}
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

              <div className="text-sm text-gray-500 mb-4">
                {loadingIssues ? 'Loading...' : `${allFilteredIssues.length} practice issues, Page ${currentPage} of ${totalPages}`}
              </div>
              
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
              
              {loadingIssues ? (
                <div className="card text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : allFilteredIssues.length === 0 ? (
                <div className="card text-center py-12">
                  <div className="mb-4">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">📋</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No practice issues</h3>
                    <p className="text-gray-500">No issues found for the selected practices and filters.</p>
                  </div>
                </div>
              ) : (
                <AssignedIssuesTable issues={filteredIssues} user={user} router={router} issueTypes={issueTypes} />
              )}
              
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        </SidebarLayout>
        
        {/* Practice Filter Modal - Only show for admins */}
        {showPracticeModal && (user.isAdmin || (user.role !== 'practice_manager' && user.role !== 'practice_principal')) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Select Practices</h3>
                
                <div className="space-y-3 mb-6">
                  {practiceOptions.sort().map(practice => (
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
                    onClick={() => setTempPracticeSelection([...practiceOptions])}
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
    </AccessCheck>
  );
}

function FollowButton({ issueId, compact = false }) {
  const { getHeaders } = useCsrf();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkFollowStatus = async () => {
    try {
      const response = await fetch(`/api/issues/${issueId}/follow`);
      const data = await response.json();
      setFollowing(data.following);
    } catch (error) {
      // Error checking follow status - continue with default
    }
  };

  useEffect(() => {
    checkFollowStatus();
    
    const handleFollowUpdate = (event) => {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (event.detail.issueId === issueId && event.detail.userEmail === currentUser.email) {
        setFollowing(event.detail.following);
      }
    };
    
    window.addEventListener('followUpdated', handleFollowUpdate);
    
    return () => {
      window.removeEventListener('followUpdated', handleFollowUpdate);
    };
  }, [issueId]);

  const handleFollow = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`/api/issues/${issueId}/follow`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setFollowing(data.following);
        
        setTimeout(async () => {
          try {
            const refreshResponse = await fetch(`/api/issues/${issueId}/follow`);
            const refreshData = await refreshResponse.json();
            setFollowing(refreshData.following);
          } catch (error) {
            // Error refreshing follow status - continue with current state
          }
        }, 500);
      }
    } catch (error) {
      // Error following issue - continue with current state
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleFollow}
        disabled={loading}
        title={following ? 'Unfollow' : 'Follow'}
        className={`p-1 rounded transition-all duration-200 ${
          following 
            ? 'text-white bg-blue-600 hover:bg-blue-700 shadow-sm' 
            : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
        }`}
      >
        <EyeIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleFollow}
      disabled={loading}
      title={following ? 'Unfollow' : 'Follow'}
      className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-all duration-200 ${
        following 
          ? 'text-white bg-blue-600 hover:bg-blue-700 shadow-sm' 
          : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
      }`}
    >
      <EyeIcon className="h-3 w-3" />
      {loading ? '...' : following ? 'Following' : 'Follow'}
    </button>
  );
}

function AssignedIssuesTable({ issues, user, router, issueTypes }) {
  const { getHeaders } = useCsrf();
  
  const handleUpvote = async (issueId) => {
    try {
      const response = await fetch('/api/upvote', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ issue_id: issueId })
      });
      
      const data = await response.json();
      if (data.success) {
        try {
          fetch('/api/notify-upvote', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ issueId, upvotes: data.upvotes })
          });
        } catch (error) {
          // Failed to send upvote notification - continue
        }
      } else {
        alert(data.error || 'Failed to upvote');
      }
    } catch (error) {
      alert('Failed to upvote');
    }
  };

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
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Status</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Type</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Practice</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Created By</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Actions</th>

            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {issues.map((issue) => {
              let attachments = [];
              try {
                attachments = JSON.parse(issue.attachments || '[]');
              } catch (error) {
                attachments = [];
              }
              
              return (
                <tr 
                  key={issue.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={(e) => {
                    if (e.target.closest('button, select, input, a')) return;
                    router.push(`/issue/${issue.id}?from=leadership`);
                  }}
                >
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span className="text-xs text-blue-500 font-mono bg-blue-50 px-1 py-0.5 rounded">{issue.issue_number}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        {attachments.length > 0 && (
                          attachments.length === 1 ? (
                            <AttachmentPreview attachment={attachments[0]} position="right" view="table">
                              <span className="text-xs text-blue-600">
                                📎 {attachments.length}
                              </span>
                            </AttachmentPreview>
                          ) : (
                            <MultiAttachmentPreview attachments={attachments} position="right">
                              <span className="text-xs text-blue-600">
                                📎 {attachments.length}
                              </span>
                            </MultiAttachmentPreview>
                          )
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
                    <span className={`px-1 py-0.5 text-xs font-medium rounded ${getStatusColor(issue.status)}`}>
                      {issue.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span className="text-xs">{getTypeIcon(issue.issue_type)} {issue.issue_type}</span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {issue.practice || 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500">
                    <div className="mb-1">
                      <UserDisplay email={issue.email} />
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(issue.created_at).toLocaleDateString()} {new Date(issue.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ({new Date(issue.created_at).toLocaleDateString('en', {timeZoneName: 'short'}).split(', ')[1]})
                    </div>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpvote(issue.id);
                        }}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <HandThumbUpIcon className="h-4 w-4" />
                        {issue.upvotes || 0}
                      </button>
                      <FollowButton issueId={issue.id} compact={true} />
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