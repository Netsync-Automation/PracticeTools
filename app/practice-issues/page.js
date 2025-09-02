'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { generatePresignedUrl } from '../../lib/s3';
import Navbar from '../../components/Navbar';
import SidebarLayout from '../../components/SidebarLayout';
import AccessCheck from '../../components/AccessCheck';
import { MagnifyingGlassIcon, FunnelIcon, HandThumbUpIcon, PencilIcon, EyeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import AttachmentViewer from '../../components/AttachmentViewer';
import AttachmentPreview from '../../components/AttachmentPreview';
import MultiAttachmentPreview from '../../components/MultiAttachmentPreview';
import Pagination from '../../components/Pagination';
import TimestampDisplay from '../../components/TimestampDisplay';
import UserDisplay from '../../components/UserDisplay';
import { getLeadershipVisibilityText, fetchLeadershipVisibilityData } from '../../lib/leadership-visibility';

function FollowButton({ issueId, compact = false }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkFollowStatus = async () => {
    try {
      console.log(`Checking initial follow status for issue: ${issueId}`);
      const response = await fetch(`/api/issues/${issueId}/follow`);
      const data = await response.json();
      console.log(`Initial follow status response:`, data);
      setFollowing(data.following);
      console.log(`Set following state to: ${data.following}`);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  useEffect(() => {
    checkFollowStatus();
    
    // Listen for custom follow update events from the main SSE connection
    const handleFollowUpdate = (event) => {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      // Only process events for current user and this issue
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
    console.log('Follow button clicked for issue:', issueId);
    setLoading(true);
    try {
      const response = await fetch(`/api/issues/${issueId}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('Follow response status:', response.status);
      const data = await response.json();
      console.log('Follow response data:', data);
      if (data.success) {
        setFollowing(data.following);
        console.log('Follow status updated to:', data.following);
        
        // Force refresh the follow status to ensure consistency
        setTimeout(async () => {
          try {
            const refreshResponse = await fetch(`/api/issues/${issueId}/follow`);
            const refreshData = await refreshResponse.json();
            console.log('Refreshed follow status:', refreshData.following);
            setFollowing(refreshData.following);
          } catch (error) {
            console.error('Error refreshing follow status:', error);
          }
        }, 500);
      } else {
        console.error('Follow failed:', data.error);
      }
    } catch (error) {
      console.error('Error following issue:', error);
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

export default function PracticeIssuesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('practiceIssuesFilters');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    return {
      type: '',
      status: '',
      search: '',
      sort: 'newest',
      userFilter: '',
      practice: []
    };
  });
  const [columnSort, setColumnSort] = useState({ column: null, direction: 'asc' });
  const [userFollows, setUserFollows] = useState([]);
  const [userUpvotes, setUserUpvotes] = useState([]);

  const [appName, setAppName] = useState('Issue Tracker');
  const [showUpvoteModal, setShowUpvoteModal] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const issuesPerPage = 50;
  const [issueTypes, setIssueTypes] = useState([]);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [tempPracticeSelection, setTempPracticeSelection] = useState([]);
  const [visibilityData, setVisibilityData] = useState({});

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('practiceIssuesFilters', JSON.stringify(filters));
    }
  }, [filters]);

  // Initialize practice filter based on user's practices
  useEffect(() => {
    if (user && user.practices && user.practices.length > 0) {
      // Only set default if no saved filters exist or practice array is empty
      const saved = localStorage.getItem('practiceIssuesFilters');
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
      // Check for session cookie first (works for both SAML and local)
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
      
      // Fallback to localStorage for client-side persistence
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
        return;
      }
      
      // No valid authentication found
      router.push('/login');
    };
    
    checkAuth();
    fetchIssues();
    fetchUserData();
    fetchIssueTypes();
    
    // Load app name
    const loadAppName = async () => {
      try {
        const response = await fetch('/api/settings/general');
        const data = await response.json();
        if (data.appName) {
          setAppName(data.appName);
        }
      } catch (error) {
        console.error('Error loading app name:', error);
      }
    };
    loadAppName();
    
    // Setup SSE connection for real-time issue updates
    let eventSource;
    let reconnectTimer;
    let isConnected = false;
    
    const connectHomepageSSE = () => {
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
          } else if (data.type === 'issue_created') {
            fetchIssues();
          } else if (data.type === 'issue_updated') {
            if (data.updates) {
              // Update specific issue in state instead of full refresh
              setIssues(prevIssues => 
                prevIssues.map(issue => 
                  issue.id === data.issueId 
                    ? { ...issue, ...data.updates }
                    : issue
                )
              );
            } else {
              fetchIssues();
            }
          } else if (data.type === 'issue_upvoted') {
            setIssues(prevIssues => 
              prevIssues.map(issue => 
                issue.id === data.issueId 
                  ? { ...issue, upvotes: data.upvotes }
                  : issue
              )
            );
          } else if (data.type === 'comment_added') {
            // Comments don't change homepage display
          } else if (data.type === 'follow_updated') {
            window.dispatchEvent(new CustomEvent('followUpdated', { detail: data }));
            if (user && data.userEmail === user.email) {
              debouncedFetchUserData();
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
              connectHomepageSSE();
            }, 2000);
          }
        }
      };
    };
    
    connectHomepageSSE();
    
    // Periodic connection check
    const connectionCheck = setInterval(() => {
      if (!isConnected && eventSource?.readyState !== EventSource.CONNECTING) {
        connectHomepageSSE();
      }
    }, 10000);
    
    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (connectionCheck) clearInterval(connectionCheck);
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [router]);

  const fetchIssues = async () => {
    try {
      const response = await fetch('/api/issues');
      const data = await response.json();
      const issuesList = data.issues || [];
      setIssues(issuesList);
      await loadVisibilityData(issuesList);
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = useCallback(async () => {
    try {
      const followsResponse = await fetch('/api/user/follows');
      if (followsResponse.ok) {
        const followsData = await followsResponse.json();
        setUserFollows(followsData.follows || []);
      }
      
      const upvotesResponse = await fetch('/api/user/upvotes');
      if (upvotesResponse.ok) {
        const upvotesData = await upvotesResponse.json();
        setUserUpvotes(upvotesData.upvotes || []);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, []);

  const debounceTimeoutRef = useRef(null);
  
  const debouncedFetchUserData = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(fetchUserData, 1000);
  }, [fetchUserData]);

  const fetchIssueTypes = async () => {
    try {
      const response = await fetch('/api/issue-types');
      const data = await response.json();
      setIssueTypes(data.issueTypes || []);
    } catch (error) {
      console.error('Error fetching issue types:', error);
    }
  };

  const loadVisibilityData = async (issues) => {
    const newVisibilityData = {};
    for (const issue of issues) {
      if (issue.issue_type === 'Leadership Question') {
        const data = await fetchLeadershipVisibilityData(issue);
        if (data) {
          newVisibilityData[issue.id] = data;
        }
      }
    }
    setVisibilityData(newVisibilityData);
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

  const handleColumnSort = (column) => {
    if (column === null) {
      setColumnSort({ column: null, direction: 'asc' });
      return;
    }
    const newDirection = columnSort.column === column && columnSort.direction === 'asc' ? 'desc' : 'asc';
    setColumnSort({ column, direction: newDirection });
  };

  const handleUpvote = async (issueId) => {
    try {
      const response = await fetch('/api/upvote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId })
      });
      
      const data = await response.json();
      if (data.success) {
        setShowUpvoteModal({ issueId, upvotes: data.upvotes });
        
        // Send SSE notification for upvote
        try {
          fetch('/api/notify-upvote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issueId, upvotes: data.upvotes })
          });
        } catch (error) {
          console.error('Failed to send upvote notification:', error);
        }
      } else {
        alert(data.error || 'Failed to upvote');
      }
    } catch (error) {
      console.error('Error upvoting:', error);
      alert('Failed to upvote');
    }
  };

  const allFilteredIssues = issues.filter(issue => {
    const matchesType = !filters.type || issue.issue_type === filters.type;
    const matchesStatus = !filters.status || issue.status === filters.status;
    const matchesPractice = !filters.practice || filters.practice.length === 0 || filters.practice.includes(issue.practice);
    
    // Handle user filter dropdown
    let matchesUserFilter = true;
    if (filters.userFilter === 'my-issues') {
      matchesUserFilter = issue.email === user?.email;
    } else if (filters.userFilter === 'my-follows') {
      matchesUserFilter = userFollows.some(follow => follow.issue_id === issue.id);

    } else if (filters.userFilter === 'my-upvotes') {
      matchesUserFilter = userUpvotes.some(upvote => upvote.issue_id === issue.id);

    }
    
    const matchesSearch = !filters.search || 
      issue.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      issue.description.toLowerCase().includes(filters.search.toLowerCase()) ||
      issue.email.toLowerCase().includes(filters.search.toLowerCase()) ||
      (issue.created_by && issue.created_by.toLowerCase().includes(filters.search.toLowerCase())) ||
      issue.issue_number.toString().includes(filters.search);
    
    return matchesType && matchesStatus && matchesPractice && matchesUserFilter && matchesSearch;
  }).sort((a, b) => {
    // Column sorting takes precedence
    if (columnSort.column) {
      let aVal, bVal;
      if (columnSort.column === 'id') {
        aVal = a.issue_number;
        bVal = b.issue_number;
      } else if (columnSort.column === 'type') {
        aVal = a.issue_type;
        bVal = b.issue_type;
      } else if (columnSort.column === 'status') {
        aVal = a.status;
        bVal = b.status;
      } else if (columnSort.column === 'system') {
        aVal = a.system || 'SCOOP';
        bVal = b.system || 'SCOOP';
      }
      
      if (typeof aVal === 'number') {
        return columnSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      } else {
        return columnSort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
    }
    
    // Default sorting
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
  }, [filters.type, filters.status, filters.search, filters.sort, filters.userFilter, filters.practice]);

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
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-3">
                Practice Issues
              </h1>
              <p className="text-blue-600/80 text-lg">View and track all submitted issues</p>
            </div>
            <button
              onClick={() => router.push('/new-issue')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Issue
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
                <p className="text-sm font-medium text-gray-500">Total Issues</p>
                <p className="text-2xl font-semibold text-gray-900">{allFilteredIssues.length}</p>
                {allFilteredIssues.length !== issues.length && (
                  <p className="text-xs text-gray-400">({issues.length} total)</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-semibold text-sm">🔴</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Open Issues</p>
                <p className="text-2xl font-semibold text-gray-900">{allFilteredIssues.filter(issue => issue.status === 'Open' || issue.status === 'In Progress').length}</p>
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
                <p className="text-sm font-medium text-gray-500">Closed Issues</p>
                <p className="text-2xl font-semibold text-gray-900">{allFilteredIssues.filter(issue => issue.status === 'Closed').length}</p>
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
                <p className="text-sm font-medium text-gray-500">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">{new Set(allFilteredIssues.map(issue => issue.email)).size}</p>
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
              Filter Issues
            </h3>
            <button
              onClick={() => {
                const defaultFilters = { type: '', status: '', search: '', sort: 'newest', userFilter: '', practice: user?.practices || [] };
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
              placeholder="Search by title, description, or issue number..."
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

            {/* User Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">User Filter</label>
              <select
                value={filters.userFilter}
                onChange={(e) => setFilters({...filters, userFilter: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
              >
                <option value="">All Issues</option>
                {[
                  { value: 'my-follows', label: '👁️ My Follows' },
                  { value: 'my-issues', label: '📝 My Issues' },
                  { value: 'my-upvotes', label: '👍 My Upvotes' }
                ].sort((a, b) => a.label.localeCompare(b.label)).map(filter => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
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
          {(filters.search || (filters.practice && filters.practice.length > 0) || filters.type || filters.status || filters.userFilter) && (
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
                {filters.userFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                    User: {filters.userFilter === 'my-issues' ? 'My Issues' : filters.userFilter === 'my-upvotes' ? 'My Upvotes' : 'My Follows'}
                    <button onClick={() => setFilters({...filters, userFilter: ''})} className="hover:bg-indigo-200 rounded-full p-0.5">
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

        {/* Debug info */}
        <div className="text-sm text-gray-500 mb-2">
          Total: {allFilteredIssues.length} issues, Page {currentPage} of {totalPages}
        </div>
        
        {/* Top Pagination */}
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
        
        {/* Issues */}
        {allFilteredIssues.length === 0 ? (
          <div className="card text-center py-12">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No issues yet</h3>
              <p className="text-gray-500 mb-6">You haven't submitted any issues. Create your first issue to get started.</p>
            </div>
            <a href="/new-issue" className="btn-primary">
              Create Your First Issue
            </a>
          </div>
        ) : (
          <>
            <IssueTable 
              issues={filteredIssues}
              user={user}
              visibilityData={visibilityData}
              onUpvote={handleUpvote}
              onUpdate={(updatedIssue) => {
                setIssues(issues.map(i => i.id === updatedIssue.id ? updatedIssue : i));
              }}
              columnSort={columnSort}
              onColumnSort={handleColumnSort}
            />
            
            {/* Bottom Pagination */}
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
        
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
        
        {/* Upvote Success Modal */}
        {showUpvoteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Thank you for your upvote!</h3>
                <p className="text-gray-600 mb-6">Would you like to join the conversation and add additional context about this issue?</p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIssues(issues.map(issue => 
                        issue.id === showUpvoteModal.issueId 
                          ? { ...issue, upvotes: showUpvoteModal.upvotes }
                          : issue
                      ));
                      setShowUpvoteModal(null);
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    No, thanks
                  </button>
                  <button
                    onClick={() => {
                      router.push(`/issue/${showUpvoteModal.issueId}`);
                      setShowUpvoteModal(null);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Join Conversation
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

function IssueTable({ issues, user, visibilityData, onUpvote, onUpdate, columnSort, onColumnSort }) {
  const router = useRouter();
  
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
              const attachments = JSON.parse(issue.attachments || '[]');
              
              return (
                <tr 
                  key={issue.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={(e) => {
                    if (e.target.closest('button, select, input, a')) return;
                    router.push(`/issue/${issue.id}`);
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
                      <p className="text-sm font-medium text-gray-900 truncate mb-1" title={issue.title}>
                        {issue.title}
                        {getLeadershipVisibilityText(issue, user, visibilityData[issue.id]) && (
                          <span className="ml-2 text-xs text-orange-600 font-normal">
                            {getLeadershipVisibilityText(issue, user, visibilityData[issue.id])}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-1" title={issue.description}>{issue.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        By <UserDisplay email={issue.email} />
                      </p>
                    </div>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span className={`px-1 py-0.5 text-xs font-medium rounded ${
                      issue.status === 'Open' ? 'bg-red-100 text-red-800' :
                      issue.status === 'Closed' ? 'bg-green-100 text-green-800' :
                      issue.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                      issue.status === 'Pending Testing' ? 'bg-blue-100 text-blue-800' :
                      issue.status === 'Backlog' ? 'bg-purple-100 text-purple-800' :
                      issue.status === 'Rejected' ? 'bg-gray-100 text-gray-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {issue.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap">
                    <span className="text-xs">{issue.issue_type}</span>
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
                          onUpvote(issue.id);
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


