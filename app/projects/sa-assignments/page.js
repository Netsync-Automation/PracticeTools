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
import MultiAccountManagerSelector from '../../../components/MultiAccountManagerSelector';
import AssignResourceModal from '../../../components/AssignResourceModal';
import CompleteStatusModal from '../../../components/CompleteStatusModal';
import RegionSelector from '../../../components/RegionSelector';
import UserField from '../../../components/UserField';
import { PRACTICE_OPTIONS } from '../../../constants/practices';
import { getEnvironment, getTableName } from '../../../lib/dynamodb';
import StatBox from '../../../components/StatBox';

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

// Get default sort order for role
const getDefaultSortForRole = (role) => {
  switch (role) {
    case 'practice_member':
    case 'practice_manager':
    case 'practice_principal':
      return 'myAssignmentsPractice';
    case 'account_manager':
    case 'isr':
      return 'myAssignmentsOverall';
    default:
      return 'newest';
  }
};

// Check if assignment matches "My Assignments" criteria for user
const isMyAssignment = (saAssignment, user) => {
  if (!user || !saAssignment) return false;
  
  switch (user.role) {
    case 'practice_member':
      // Check if user is assigned to any practice in the assignment
      let isAssigned = false;
      if (saAssignment.practiceAssignments) {
        try {
          const practiceAssignments = JSON.parse(saAssignment.practiceAssignments);
          Object.values(practiceAssignments).forEach(saList => {
            if (Array.isArray(saList)) {
              saList.forEach(sa => {
                if (extractFriendlyName(sa).toLowerCase() === user.name?.toLowerCase()) {
                  isAssigned = true;
                }
              });
            }
          });
        } catch (e) {
          if (saAssignment.saAssigned) {
            isAssigned = saAssignment.saAssigned.toLowerCase().includes(user.name?.toLowerCase() || '');
          }
        }
      } else if (saAssignment.saAssigned) {
        isAssigned = saAssignment.saAssigned.toLowerCase().includes(user.name?.toLowerCase() || '');
      }
      
      // Also include unassigned assignments for user's practices
      if (!isAssigned && saAssignment.status === 'Unassigned' && user.practices) {
        isAssigned = user.practices.includes(saAssignment.practice);
      }
      
      return isAssigned;
      
    case 'account_manager':
      return extractFriendlyName(saAssignment.am).toLowerCase() === user.name?.toLowerCase();
      
    case 'isr':
      // Check if user is listed anywhere in the assignment
      const userName = user.name?.toLowerCase() || '';
      return (
        extractFriendlyName(saAssignment.isrSaRequested || '').toLowerCase().includes(userName) ||
        extractFriendlyName(saAssignment.submittedBy || '').toLowerCase().includes(userName) ||
        extractFriendlyName(saAssignment.am || '').toLowerCase().includes(userName) ||
        (saAssignment.saAssigned && saAssignment.saAssigned.toLowerCase().includes(userName))
      );
      
    case 'practice_manager':
    case 'practice_principal':
      // Check if assignment is for practices they manage
      if (user.practices && user.practices.includes(saAssignment.practice)) {
        return true;
      }
      // Also include pending/unassigned for their practices
      if ((saAssignment.status === 'Pending' || saAssignment.status === 'Unassigned') && user.practices) {
        return user.practices.includes(saAssignment.practice) || saAssignment.practice === 'Pending';
      }
      return false;
      
    default:
      return false;
  }
};

export default function SaAssignmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saAssignments, setSaAssignments] = useState([]);
  const [practiceETAs, setPracticeETAs] = useState([]);
  const [filters, setFilters] = useState(() => {
    return {
      status: [],
      individualSAStatus: [],
      practice: [],
      region: '',
      dateFrom: '',
      dateTo: '',
      search: '',
      sort: 'newest',
      myWorkCompleted: false,
      myWorkInProgress: true,
      myAssignments: false
    };
  });
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [tempPracticeSelection, setTempPracticeSelection] = useState([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [tempStatusSelection, setTempStatusSelection] = useState([]);
  const [showIndividualSAStatusModal, setShowIndividualSAStatusModal] = useState(false);
  const [tempIndividualSAStatusSelection, setTempIndividualSAStatusSelection] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [saStatuses, setSaStatuses] = useState(['Pending', 'Unassigned', 'Assigned', 'Pending Approval', 'Complete']);
  const saAssignmentsPerPage = 20;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('saAssignmentsFilters', JSON.stringify(filters));
    }
  }, [filters]);

  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem('saAssignmentsFilters');
      let shouldSetDefaults = false;
      
      if (saved) {
        try {
          const parsedFilters = JSON.parse(saved);
          
          // Apply role-based defaults if not already set
          const rolesWithMyAssignments = ['practice_member', 'account_manager', 'isr', 'practice_manager', 'practice_principal'];
          const managementRoles = ['admin', 'practice_manager', 'practice_principal'];
          
          // DSR: Set management role defaults
          if (managementRoles.includes(user.role)) {
            if (!parsedFilters.status || parsedFilters.status.length === 0) {
              parsedFilters.status = ['Pending', 'Unassigned'];
            }
            if ((user.role === 'practice_manager' || user.role === 'practice_principal') && user.practices && (!parsedFilters.practice || parsedFilters.practice.length === 0)) {
              parsedFilters.practice = [...user.practices, 'Pending'];
            }
            if (parsedFilters.myAssignments === undefined) {
              parsedFilters.myAssignments = false;
            }
          } else if (rolesWithMyAssignments.includes(user.role) && parsedFilters.myAssignments === undefined) {
            parsedFilters.myAssignments = true;
            parsedFilters.sort = getDefaultSortForRole(user.role);
          }
          
          // Set defaults for my work filters if not present
          if (parsedFilters.myWorkCompleted === undefined) {
            parsedFilters.myWorkCompleted = false;
          }
          if (parsedFilters.myWorkInProgress === undefined) {
            parsedFilters.myWorkInProgress = true;
          }
          
          setFilters(parsedFilters);
        } catch (error) {
          shouldSetDefaults = true;
        }
      } else {
        shouldSetDefaults = true;
      }
      
      if (shouldSetDefaults) {
        const rolesWithMyAssignments = ['practice_member', 'account_manager', 'isr'];
        const managementRoles = ['admin', 'practice_manager', 'practice_principal'];
        
        // DSR: Default filters for management roles
        if (managementRoles.includes(user.role)) {
          setFilters({
            status: ['Pending', 'Unassigned'],
            individualSAStatus: [],
            practice: (user.role === 'practice_manager' || user.role === 'practice_principal') && user.practices 
              ? [...user.practices, 'Pending'] : [],
            region: '',
            dateFrom: '',
            dateTo: '',
            search: '',
            sort: 'newest',
            myWorkCompleted: false,
            myWorkInProgress: true,
            myAssignments: false
          });
        } else {
          setFilters({
            status: [],
            individualSAStatus: [],
            practice: [],
            region: '',
            dateFrom: '',
            dateTo: '',
            search: '',
            sort: rolesWithMyAssignments.includes(user.role) ? getDefaultSortForRole(user.role) : 'newest',
            myWorkCompleted: false,
            myWorkInProgress: true,
            myAssignments: rolesWithMyAssignments.includes(user.role)
          });
        }
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
    fetchSaStatuses();
    
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

  const fetchSaStatuses = async () => {
    try {
      const response = await fetch('/api/sa-assignment-statuses');
      const data = await response.json();
      if (data.success) {
        setSaStatuses(data.statuses || ['Pending', 'Unassigned', 'Assigned', 'Pending Approval', 'Approved', 'Complete']);
      }
    } catch (error) {
      console.error('Error fetching SA statuses:', error);
    }
  };

  const fetchPracticeETAs = async () => {
    try {
      const response = await fetch('/api/practice-etas');
      const data = await response.json();
      if (data.success) {
        setPracticeETAs(data.etas || []);
      }
    } catch (error) {
      console.error('Error fetching practice ETAs:', error);
      setPracticeETAs([]);
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
    
    // Individual SA Status filter
    let matchesIndividualSAStatus = true;
    if (filters.individualSAStatus && filters.individualSAStatus.length > 0) {
      const saCompletions = JSON.parse(saAssignment.saCompletions || '{}');
      const individualStatuses = new Set();
      
      Object.values(saCompletions).forEach(completion => {
        if (completion && completion.status) {
          individualStatuses.add(completion.status);
        } else if (completion && completion.completedAt) {
          individualStatuses.add('Approved/Complete');
        }
      });
      
      // If no individual statuses found, consider as "In Progress"
      if (individualStatuses.size === 0) {
        individualStatuses.add('In Progress');
      }
      
      matchesIndividualSAStatus = filters.individualSAStatus.some(filterStatus => 
        individualStatuses.has(filterStatus)
      );
    }
    
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
    
    // Extract SAs for search functionality
    let searchableSAs = '';
    if (saAssignment.practiceAssignments) {
      try {
        const practiceAssignments = JSON.parse(saAssignment.practiceAssignments);
        const allSAs = new Set();
        Object.values(practiceAssignments).forEach(saList => {
          if (Array.isArray(saList)) {
            saList.forEach(sa => allSAs.add(extractFriendlyName(sa)));
          }
        });
        searchableSAs = Array.from(allSAs).join(' ');
      } catch (e) {
        searchableSAs = saAssignment.saAssigned || '';
      }
    } else {
      searchableSAs = saAssignment.saAssigned || '';
    }
    
    const matchesSearch = !filters.search || 
      saAssignment.opportunityName.toLowerCase().includes(filters.search.toLowerCase()) ||
      searchableSAs.toLowerCase().includes(filters.search.toLowerCase()) ||
      saAssignment.customerName.toLowerCase().includes(filters.search.toLowerCase()) ||
      saAssignment.opportunityId.toLowerCase().includes(filters.search.toLowerCase()) ||
      saAssignment.am.toLowerCase().includes(filters.search.toLowerCase());
    
    // Filter for 'My Assignments'
    let matchesMyAssignments = true;
    if (filters.myAssignments) {
      matchesMyAssignments = isMyAssignment(saAssignment, user);
      
      // For practice members, apply work completion filters
      if (matchesMyAssignments && user.role === 'practice_member') {
        const saCompletions = JSON.parse(saAssignment.saCompletions || '{}');
        const userComplete = !!saCompletions[user.name];
        
        const showCompleted = filters.myWorkCompleted;
        const showInProgress = filters.myWorkInProgress;
        
        if (!showCompleted && userComplete) {
          matchesMyAssignments = false;
        }
        if (!showInProgress && !userComplete) {
          matchesMyAssignments = false;
        }
      }
    }
    
    return matchesStatus && matchesIndividualSAStatus && matchesPractice && matchesRegion && matchesDateRange && matchesSearch && matchesMyAssignments;
  }).sort((a, b) => {
    if (filters.sort === 'project') {
      return a.opportunityName.localeCompare(b.opportunityName);
    } else if (filters.sort === 'customer') {
      return a.customerName.localeCompare(b.customerName);
    } else if (filters.sort === 'myAssignmentsPractice') {
      // Practice-based sorting: Unassigned → In Progress → Pending Approval → Complete
      const getIndividualSAStatus = (assignment) => {
        const saCompletions = JSON.parse(assignment.saCompletions || '{}');
        const hasCompletions = Object.keys(saCompletions).length > 0;
        const hasApprovals = Object.values(saCompletions).some(c => c && c.status === 'Pending Approval');
        const hasCompleted = Object.values(saCompletions).some(c => c && (c.completedAt || c.status === 'Complete'));
        
        if (assignment.status === 'Unassigned') return 0;
        if (!hasCompletions) return 1; // In Progress
        if (hasApprovals) return 2; // Pending Approval
        if (hasCompleted) return 3; // Complete
        return 1; // Default to In Progress
      };
      
      const statusA = getIndividualSAStatus(a);
      const statusB = getIndividualSAStatus(b);
      
      if (statusA !== statusB) return statusA - statusB;
      return new Date(b.requestDate) - new Date(a.requestDate);
    } else if (filters.sort === 'myAssignmentsOverall') {
      // Overall status sorting: Pending → Unassigned → Assigned → Pending Approval → Complete
      const statusOrder = { 'Pending': 0, 'Unassigned': 1, 'Assigned': 2, 'Pending Approval': 3, 'Approved': 4, 'Complete': 5 };
      const statusA = statusOrder[a.status] ?? 999;
      const statusB = statusOrder[b.status] ?? 999;
      
      if (statusA !== statusB) return statusA - statusB;
      return new Date(b.requestDate) - new Date(a.requestDate);
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

  const calculateFilteredETA = (transitionType) => {
    if (!practiceETAs || !Array.isArray(practiceETAs) || practiceETAs.length === 0) return 0;
    
    try {
      let relevantETAs = practiceETAs.filter(eta => eta && eta.statusTransition === transitionType);
      
      // Apply practice filter if set
      if (filters.practice && filters.practice.length > 0) {
        relevantETAs = relevantETAs.filter(eta => 
          filters.practice.includes(eta.practice)
        );
      }
      
      if (relevantETAs.length === 0) return 0;
      
      const averageHours = relevantETAs.reduce((sum, eta) => sum + eta.avgDurationHours, 0) / relevantETAs.length;
      return Math.round((averageHours / 24) * 100) / 100;
    } catch (error) {
      console.error('Error filtering ETAs:', error);
      return 0;
    }
  };
  
  const calculateSACompletionETA = () => {
    if (!practiceETAs || !Array.isArray(practiceETAs) || practiceETAs.length === 0) return 0;
    
    try {
      // Get all individual SAs from filtered assignments using new practiceAssignments structure
      const allIndividualSAs = [];
      
      allFilteredSaAssignments
        .filter(a => a.status === 'Assigned')
        .forEach(assignment => {
          if (assignment.practiceAssignments) {
            try {
              const practiceAssignments = JSON.parse(assignment.practiceAssignments);
              Object.values(practiceAssignments).forEach(saList => {
                if (Array.isArray(saList)) {
                  saList.forEach(sa => {
                    const friendlyName = sa.replace(/<[^>]+>/g, '').trim();
                    allIndividualSAs.push(friendlyName);
                  });
                }
              });
            } catch (e) {
              // Fallback to legacy saAssigned field
              if (assignment.saAssigned) {
                assignment.saAssigned.split(',').forEach(sa => {
                  const friendlyName = sa.replace(/<[^>]+>/g, '').trim();
                  allIndividualSAs.push(friendlyName);
                });
              }
            }
          } else if (assignment.saAssigned) {
            // Fallback to legacy saAssigned field
            assignment.saAssigned.split(',').forEach(sa => {
              const friendlyName = sa.replace(/<[^>]+>/g, '').trim();
              allIndividualSAs.push(friendlyName);
            });
          }
        });
      
      if (allIndividualSAs.length === 0) return 0;
      
      // Find ETAs for these specific SAs
      const saETAs = practiceETAs.filter(eta => 
        eta.statusTransition === 'assigned_to_completed' && 
        eta.saName && 
        allIndividualSAs.includes(eta.saName)
      );
      
      if (saETAs.length === 0) return 0;
      
      const averageHours = saETAs.reduce((sum, eta) => sum + eta.avgDurationHours, 0) / saETAs.length;
      return Math.round((averageHours / 24) * 100) / 100;
    } catch (error) {
      console.error('Error calculating SA completion ETA:', error);
      return 0;
    }
  };

  const pendingToUnassignedETA = calculateFilteredETA('pending_to_unassigned');
  const toAssignedETA = calculateFilteredETA('to_assigned');
  const saCompletionETA = calculateSACompletionETA();

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

            {/* Statistics Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Assignment Status Overview */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-100 rounded-lg p-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Assignment Status</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📊</span>
                      <span className="font-medium text-gray-700">Total</span>
                    </div>
                    <span className="text-xl font-bold text-blue-600">{allFilteredSaAssignments.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                      <div className="flex items-center gap-1">
                        <span className="text-sm">⏳</span>
                        <span className="text-xs font-medium text-yellow-700">Pending</span>
                      </div>
                      <span className="text-sm font-bold text-yellow-600">{allFilteredSaAssignments.filter(a => a.status === 'Pending').length}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-1">
                        <span className="text-sm">📁</span>
                        <span className="text-xs font-medium text-orange-700">Unassigned</span>
                      </div>
                      <span className="text-sm font-bold text-orange-600">{allFilteredSaAssignments.filter(a => a.status === 'Unassigned').length}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-1">
                        <span className="text-sm">✅</span>
                        <span className="text-xs font-medium text-green-700">Assigned</span>
                      </div>
                      <span className="text-sm font-bold text-green-600">{allFilteredSaAssignments.filter(a => a.status === 'Assigned').length}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-1">
                        <span className="text-sm">🏁</span>
                        <span className="text-xs font-medium text-blue-700">Complete</span>
                      </div>
                      <span className="text-sm font-bold text-blue-600">{allFilteredSaAssignments.filter(a => a.status === 'Complete').length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval Pipeline */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-amber-100 rounded-lg p-2">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Approval Pipeline</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⏳</span>
                      <span className="font-medium text-amber-700">Pending Approval</span>
                    </div>
                    <span className="text-xl font-bold text-amber-600">{allFilteredSaAssignments.filter(a => a.status === 'Pending Approval').length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">✅</span>
                      <span className="font-medium text-emerald-700">Approved</span>
                    </div>
                    <span className="text-xl font-bold text-emerald-600">{allFilteredSaAssignments.filter(a => a.status === 'Approved').length}</span>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-indigo-100 rounded-lg p-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Average ETAs</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-indigo-50 rounded-lg">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">⏱️</span>
                      <span className="text-xs font-medium text-indigo-700">Practice Assignment</span>
                    </div>
                    <span className="text-sm font-bold text-indigo-600">{pendingToUnassignedETA > 0 ? `${pendingToUnassignedETA}d` : 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-teal-50 rounded-lg">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">🎯</span>
                      <span className="text-xs font-medium text-teal-700">Resource Assignment</span>
                    </div>
                    <span className="text-sm font-bold text-teal-600">{toAssignedETA > 0 ? `${toAssignedETA}d` : 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">🚀</span>
                      <span className="text-xs font-medium text-emerald-700">SA Completion</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">{saCompletionETA > 0 ? `${saCompletionETA}d` : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                </div>
                <button
                  onClick={() => {
                    const rolesWithMyAssignments = ['practice_member', 'account_manager', 'isr'];
                    const managementRoles = ['admin', 'practice_manager', 'practice_principal'];
                    
                    let defaultFilters;
                    
                    // DSR: Default filters for management roles
                    if (managementRoles.includes(user?.role)) {
                      defaultFilters = {
                        status: ['Pending', 'Unassigned'],
                        individualSAStatus: [],
                        practice: (user?.role === 'practice_manager' || user?.role === 'practice_principal') && user?.practices 
                          ? [...user.practices, 'Pending'] : [],
                        region: '',
                        dateFrom: '',
                        dateTo: '',
                        search: '',
                        sort: 'newest',
                        myWorkCompleted: false,
                        myWorkInProgress: true,
                        myAssignments: false
                      };
                    } else {
                      defaultFilters = {
                        status: [],
                        individualSAStatus: [],
                        practice: [],
                        region: '',
                        dateFrom: '',
                        dateTo: '',
                        search: '',
                        sort: rolesWithMyAssignments.includes(user?.role) ? getDefaultSortForRole(user.role) : 'newest',
                        myWorkCompleted: false,
                        myWorkInProgress: true,
                        myAssignments: rolesWithMyAssignments.includes(user?.role)
                      };
                    }
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
              
              {/* Search Bar */}
              <div className="px-6 py-4 bg-gray-50">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search assignments..."
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm transition-colors"
                  />
                </div>
              </div>
              
              {/* Filter Controls */}
              <div className="px-6 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Status Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Status:</span>
                    <button
                      onClick={() => {
                        setTempStatusSelection(filters.status);
                        setShowStatusModal(true);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                    >
                      <span className="text-gray-900">
                        {filters.status.length === 0 ? 'All' : 
                         filters.status.length === 1 ? filters.status[0] : 
                         `${filters.status.length} selected`}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Individual SA Status Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">SA Status:</span>
                    <button
                      onClick={() => {
                        setTempIndividualSAStatusSelection(filters.individualSAStatus);
                        setShowIndividualSAStatusModal(true);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                    >
                      <span className="text-gray-900">
                        {filters.individualSAStatus.length === 0 ? 'All' : 
                         filters.individualSAStatus.length === 1 ? filters.individualSAStatus[0] : 
                         `${filters.individualSAStatus.length} selected`}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Practice Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Practice:</span>
                    <button
                      onClick={() => {
                        setTempPracticeSelection(filters.practice);
                        setShowPracticeModal(true);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm transition-colors"
                    >
                      <span className="text-gray-900">
                        {filters.practice.length === 0 ? 'All' : 
                         filters.practice.length === 1 ? filters.practice[0] : 
                         `${filters.practice.length} selected`}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Region Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Region:</span>
                    <select
                      value={filters.region}
                      onChange={(e) => setFilters({...filters, region: e.target.value})}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="">All</option>
                      <option value="TX-DAL">TX-DAL</option>
                      <option value="TX-HOU">TX-HOU</option>
                      <option value="TX-AUS">TX-AUS</option>
                      <option value="TX-SA">TX-SA</option>
                      <option value="OK-OKC">OK-OKC</option>
                      <option value="OK-TUL">OK-TUL</option>
                      <option value="AR-LR">AR-LR</option>
                      <option value="LA-NO">LA-NO</option>
                      <option value="LA-BR">LA-BR</option>
                      <option value="LA-SHV">LA-SHV</option>
                    </select>
                  </div>

                  {/* Date Range */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Date:</span>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* My Assignments Toggle */}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.myAssignments}
                        onChange={(e) => {
                          const newMyAssignments = e.target.checked;
                          setFilters({
                            ...filters, 
                            myAssignments: newMyAssignments,
                            sort: newMyAssignments ? getDefaultSortForRole(user?.role) : 'newest'
                          });
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">My Assignments</span>
                    </label>
                  </div>

                  {/* Sort */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Sort:</span>
                    <select
                      value={filters.sort}
                      onChange={(e) => setFilters({...filters, sort: e.target.value})}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="newest">Newest</option>
                      <option value="project">Opportunity</option>
                      <option value="customer">Customer</option>
                      <option value="myAssignmentsPractice">My Assignments (Practice)</option>
                      <option value="myAssignmentsOverall">My Assignments (Overall)</option>
                    </select>
                  </div>
                </div>
                
                {/* My Work Sub-filters */}
                {filters.myAssignments && user?.role === 'practice_member' && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-blue-700">My Work:</span>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={filters.myWorkInProgress}
                          onChange={(e) => setFilters({...filters, myWorkInProgress: e.target.checked})}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-blue-700">In Progress</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={filters.myWorkCompleted}
                          onChange={(e) => setFilters({...filters, myWorkCompleted: e.target.checked})}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-blue-700">Completed</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Active Filters Display */}
              {(filters.status.length > 0 || filters.individualSAStatus.length > 0 || filters.practice.length > 0 || filters.region || filters.dateFrom || filters.dateTo || filters.search) && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-gray-700">Active Filters:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* Status Filters */}
                    {filters.status.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        Status: {filters.status.join(', ')}
                        <button
                          onClick={() => setFilters({...filters, status: []})}
                          className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    
                    {/* Individual SA Status Filters */}
                    {filters.individualSAStatus.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-800 text-sm rounded-full">
                        SA Status: {filters.individualSAStatus.join(', ')}
                        <button
                          onClick={() => setFilters({...filters, individualSAStatus: []})}
                          className="ml-1 hover:bg-indigo-200 rounded-full p-0.5"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    
                    {/* Practice Filters */}
                    {filters.practice.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                        Practice: {filters.practice.join(', ')}
                        <button
                          onClick={() => setFilters({...filters, practice: []})}
                          className="ml-1 hover:bg-green-200 rounded-full p-0.5"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    
                    {/* Region Filter */}
                    {filters.region && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                        Region: {filters.region}
                        <button
                          onClick={() => setFilters({...filters, region: ''})}
                          className="ml-1 hover:bg-purple-200 rounded-full p-0.5"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    
                    {/* Date Range Filters */}
                    {filters.dateFrom && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full">
                        From: {new Date(filters.dateFrom).toLocaleDateString()}
                        <button
                          onClick={() => setFilters({...filters, dateFrom: ''})}
                          className="ml-1 hover:bg-orange-200 rounded-full p-0.5"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    
                    {filters.dateTo && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full">
                        To: {new Date(filters.dateTo).toLocaleDateString()}
                        <button
                          onClick={() => setFilters({...filters, dateTo: ''})}
                          className="ml-1 hover:bg-orange-200 rounded-full p-0.5"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    
                    {/* Search Filter */}
                    {filters.search && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                        Search: "{filters.search}"
                        <button
                          onClick={() => setFilters({...filters, search: ''})}
                          className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                        >
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
        
        {/* Status Filter Modal */}
        {showStatusModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Status Filters</h3>
                <div className="space-y-2 mb-6">
                  {saStatuses.map(status => (
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
                      <span className="text-sm text-gray-700">{status}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setTempStatusSelection([...saStatuses])}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setTempStatusSelection([])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Unselect All
                  </button>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowStatusModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setFilters({...filters, status: tempStatusSelection});
                      setShowStatusModal(false);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Individual SA Status Filter Modal */}
        {showIndividualSAStatusModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Individual SA Status Filters</h3>
                <div className="space-y-2 mb-6">
                  {['In Progress', 'Pending Approval', 'Approved/Complete'].map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={tempIndividualSAStatusSelection.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTempIndividualSAStatusSelection([...tempIndividualSAStatusSelection, status]);
                          } else {
                            setTempIndividualSAStatusSelection(tempIndividualSAStatusSelection.filter(s => s !== status));
                          }
                        }}
                        className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{status}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setTempIndividualSAStatusSelection(['In Progress', 'Pending Approval', 'Approved/Complete'])}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setTempIndividualSAStatusSelection([])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Unselect All
                  </button>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowIndividualSAStatusModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setFilters({...filters, individualSAStatus: tempIndividualSAStatusSelection});
                      setShowIndividualSAStatusModal(false);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Practice Filters</h3>
                <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                  {PRACTICE_OPTIONS.map(practice => (
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
                <div className="flex gap-2 mb-4 flex-wrap">
                  <button
                    onClick={() => setTempPracticeSelection(PRACTICE_OPTIONS)}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setTempPracticeSelection([])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Unselect All
                  </button>
                  {user?.practices && (
                    <button
                      onClick={() => setTempPracticeSelection([...user.practices, 'Pending'])}
                      className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      My Practices
                    </button>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowPracticeModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setFilters({...filters, practice: tempPracticeSelection});
                      setShowPracticeModal(false);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

function SaAssignmentsTable({ saAssignments, user, onSaAssignmentUpdate, allSaAssignments }) {
  const router = useRouter();
  const [showAssignResourceModal, setShowAssignResourceModal] = useState(false);
  const [assignResourceData, setAssignResourceData] = useState({});
  const [assignResourceTargetStatus, setAssignResourceTargetStatus] = useState('Assigned');
  const [saving, setSaving] = useState(false);
  const [currentSaAssignmentId, setCurrentSaAssignmentId] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [currentSaAssignment, setCurrentSaAssignment] = useState(null);
  const [saStatuses, setSaStatuses] = useState(['Pending', 'Unassigned', 'Assigned', 'Pending Approval', 'Approved', 'Complete']);

  useEffect(() => {
    const fetchSaStatuses = async () => {
      try {
        const response = await fetch('/api/sa-assignment-statuses');
        const data = await response.json();
        if (data.success) {
          setSaStatuses(data.statuses || ['Pending', 'Unassigned', 'Assigned', 'Pending Approval', 'Approved', 'Complete']);
        }
      } catch (error) {
        console.error('Error fetching SA statuses:', error);
      }
    };
    fetchSaStatuses();
    
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/admin/users');
        if (response.ok) {
          const data = await response.json();
          setAllUsers(data.users || []);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    fetchUsers();
  }, []);

  const canEditSaAssignment = (saAssignment) => {
    if (user.isAdmin || user.role === 'executive') return true;
    
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
  
  const canMarkComplete = (saAssignment) => {
    if (!user || !saAssignment) return false;
    
    // Admins and executives can always mark complete
    if (user.isAdmin || user.role === 'executive') return true;
    
    // Assigned SAs can mark their own work complete
    if (saAssignment.saAssigned) {
      const assignedSAs = saAssignment.saAssigned.split(',').map(s => s.trim());
      return assignedSAs.some(sa => sa.toLowerCase() === user.name.toLowerCase());
    }
    
    return false;
  };
  
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Opportunity ID</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Practice</th>
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
                        
                        if (newStatus === 'Complete') {
                          if (canMarkComplete(saAssignment)) {
                            setCurrentSaAssignment(saAssignment);
                            setShowCompleteModal(true);
                            e.target.value = saAssignment.status;
                            return;
                          } else {
                            alert('You do not have permission to mark this assignment as complete.');
                            e.target.value = saAssignment.status;
                            return;
                          }
                        }
                        
                        if (newStatus === 'Assigned') {
                          const amNames = saAssignment.am ? saAssignment.am.split(',').map(a => extractFriendlyName(a.trim())) : [];
                          setAssignResourceData({
                            practice: saAssignment.practice && saAssignment.practice !== 'Pending' ? saAssignment.practice.split(',').map(p => p.trim()) : [],
                            am: amNames,
                            region: saAssignment.region || '',
                            saAssigned: Array.isArray(saAssignment.saAssigned) ? saAssignment.saAssigned : (saAssignment.saAssigned ? saAssignment.saAssigned.split(',').map(s => extractFriendlyName(s.trim())) : []),
                            dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0]
                          });
                          setAssignResourceTargetStatus('Assigned');
                          setShowAssignResourceModal(true);
                          e.target.value = saAssignment.status;
                          return;
                        }
                        
                        if ((saAssignment.status === 'Pending' && (newStatus === 'Unassigned' || newStatus === 'Assigned')) || (saAssignment.status === 'Unassigned' && newStatus === 'Assigned')) {
                          const amNames = saAssignment.am ? saAssignment.am.split(',').map(a => extractFriendlyName(a.trim())) : [];
                          setAssignResourceData({
                            practice: saAssignment.status === 'Pending' ? [] : (saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : []),
                            am: amNames,
                            region: saAssignment.region || user?.region || '',
                            saAssigned: Array.isArray(saAssignment.saAssigned) ? saAssignment.saAssigned : (saAssignment.saAssigned ? saAssignment.saAssigned.split(',').map(s => extractFriendlyName(s.trim())) : []),
                            dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0]
                          });
                          setAssignResourceTargetStatus(newStatus);
                          setShowAssignResourceModal(true);
                          e.target.value = saAssignment.status;
                          return;
                        }
                        
                        try {
                          const userCookie = document.cookie.split(';').find(c => c.trim().startsWith('user-session='));
                          if (!userCookie) {
                            alert('Session expired. Please log in again.');
                            return;
                          }
                          
                          const response = await fetch(`/api/sa-assignments/${saAssignment.id}`, {
                            method: 'PUT',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Cookie': userCookie
                            },
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
                        saAssignment.status === 'Pending Approval' ? 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-300' :
                        saAssignment.status === 'Approved' ? 'bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-300' :
                        saAssignment.status === 'Complete' ? 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-300' :
                        'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-300'
                      }`}
                    >
                      {saStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}

                    </select>
                  ) : (
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-lg ${
                      saAssignment.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      saAssignment.status === 'Unassigned' ? 'bg-orange-100 text-orange-800' :
                      saAssignment.status === 'Assigned' ? 'bg-green-100 text-green-800' :
                      saAssignment.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800' :
                      saAssignment.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                      saAssignment.status === 'Complete' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {saAssignment.status}
                    </span>
                  )}
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm font-mono text-blue-600">{saAssignment.opportunityId}</div>
                </td>
                <td className="px-2 py-3">
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {saAssignment.practice}
                  </span>
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
                  <UserField 
                    userField={saAssignment.am}
                    assignmentId={saAssignment.id}
                    fieldType="am"
                    assignmentType="sa-assignment"
                    assignment={saAssignment}
                    className="text-sm text-gray-900"
                  />
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">
                    {(() => {
                      // Extract SAs from new practiceAssignments structure
                      let assignedSAs = [];
                      if (saAssignment.practiceAssignments) {
                        try {
                          const practiceAssignments = JSON.parse(saAssignment.practiceAssignments);
                          const allSAs = new Set();
                          Object.values(practiceAssignments).forEach(saList => {
                            if (Array.isArray(saList)) {
                              saList.forEach(sa => allSAs.add(sa));
                            }
                          });
                          assignedSAs = Array.from(allSAs);
                        } catch (e) {
                          // Fallback to legacy saAssigned field
                          assignedSAs = saAssignment.saAssigned ? saAssignment.saAssigned.split(',').map(s => s.trim()) : [];
                        }
                      } else if (saAssignment.saAssigned) {
                        // Fallback to legacy saAssigned field
                        assignedSAs = saAssignment.saAssigned.split(',').map(s => s.trim());
                      }
                      
                      // Extract friendly names only (remove emails for DSR compliance)
                      const friendlyNames = assignedSAs.map(sa => extractFriendlyName(sa));
                      
                      if (friendlyNames.length === 0) return '';
                      
                      if (friendlyNames.length === 1) {
                        return friendlyNames[0];
                      }
                      
                      return (
                        <div className="space-y-1">
                          {friendlyNames.slice(0, 2).map((name, index) => (
                            <div key={index} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full mr-1" title={name}>
                              {name}
                            </div>
                          ))}
                          {friendlyNames.length > 2 && (
                            <div 
                              className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full cursor-help"
                              title={friendlyNames.slice(2).join(', ')}
                            >
                              +{friendlyNames.length - 2} more
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">
                    {(() => {
                      const date = new Date(saAssignment.requestDate + 'T00:00:00');
                      return date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    })()}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="text-sm text-gray-900">
                    {(() => {
                      const date = new Date(saAssignment.dateAssigned + 'T00:00:00');
                      return date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    })()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Assign Resource Modal */}
      <AssignResourceModal
        isOpen={showAssignResourceModal}
        onClose={() => {
          setShowAssignResourceModal(false);
          setAssignResourceData({});
        }}
        onSave={async (updateData) => {
          setSaving(true);
          try {
            const response = await fetch(`/api/sa-assignments/${currentSaAssignmentId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updateData)
            });
            if (response.ok) {
              onSaAssignmentUpdate();
              setShowAssignResourceModal(false);
              setAssignResourceData({});
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
        initialData={assignResourceData}
        targetStatus={assignResourceTargetStatus}
        saving={saving}
        allUsers={allUsers}
      />
      
      {/* Complete Status Modal */}
      <CompleteStatusModal
        isOpen={showCompleteModal}
        onClose={() => {
          setShowCompleteModal(false);
          setCurrentSaAssignment(null);
        }}
        saAssignment={currentSaAssignment}
        user={user}
        onComplete={async (targetSA) => {
          try {
            const response = await fetch(`/api/sa-assignments/${currentSaAssignment.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                markSAComplete: true,
                targetSA: targetSA
              })
            });
            
            if (response.ok) {
              onSaAssignmentUpdate();
            } else {
              throw new Error('Failed to mark SA as complete');
            }
          } catch (error) {
            console.error('Error marking SA complete:', error);
            throw error;
          }
        }}
      />

    </div>
  );
}