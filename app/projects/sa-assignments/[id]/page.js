'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import AccessCheck from '../../../../components/AccessCheck';
import Breadcrumb from '../../../../components/Breadcrumb';
import MultiAttachmentPreview from '../../../../components/MultiAttachmentPreview';
import MultiResourceSelector from '../../../../components/MultiResourceSelector';
import MultiAccountManagerSelector from '../../../../components/MultiAccountManagerSelector';
import AssignResourceModal from '../../../../components/AssignResourceModal';
import CompleteStatusModal from '../../../../components/CompleteStatusModal';
import UserField from '../../../../components/UserField';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';


// Color palette for practice-SA pairings
const COLOR_PALETTE = [
  { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  { bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-200' },
  { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
  { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' }
];

// Component to display practices with their assigned SAs grouped by practice
function PracticeDisplay({ practice, saAssigned, saAssignment, user, onStatusUpdate }) {
  const [practiceGroups, setPracticeGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const canEditSAStatus = (saName) => {
    if (user.isAdmin) return true;
    if (user.name.toLowerCase() === saName.toLowerCase()) return true;
    if ((user.role === 'practice_manager' || user.role === 'practice_principal') && user.practices) {
      const assignedPractices = practice ? practice.split(',').map(p => p.trim()) : [];
      return assignedPractices.some(p => user.practices.includes(p));
    }
    return false;
  };
  
  const handleSAStatusChange = async (saName, newStatus, practiceName) => {
    try {
      const response = await fetch(`/api/sa-assignments/${saAssignment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          updateSAStatus: true,
          targetSA: saName,
          saStatus: newStatus,
          targetPractice: practiceName
        })
      });
      
      if (response.ok) {
        onStatusUpdate();
      } else {
        throw new Error('Failed to update SA status');
      }
    } catch (error) {
      console.error('Error updating SA status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  useEffect(() => {
    const loadPracticeGroups = async () => {
      if (!practice) {
        setLoading(false);
        return;
      }

      try {
        const practiceList = practice.split(',').map(p => p.trim());
        const saCompletions = JSON.parse(saAssignment?.saCompletions || '{}');
        
        let practiceAssignmentsData = {};
        if (saAssignment?.practiceAssignments) {
          try {
            practiceAssignmentsData = JSON.parse(saAssignment.practiceAssignments);
          } catch (e) {
            console.error('Error parsing practiceAssignments:', e);
          }
        }
        
        const groups = practiceList.map((practiceName, index) => {
          const colors = COLOR_PALETTE[index % COLOR_PALETTE.length];
          const assignedSAs = practiceAssignmentsData[practiceName] || [];
          
          // Calculate practice status
          let practiceStatus = 'In Progress';
          if (assignedSAs.length > 0) {
            const allApprovedComplete = assignedSAs.every(saEntry => {
              const practiceKey = `${saEntry}::${practiceName}`;
              const completion = saCompletions[practiceKey] || saCompletions[saEntry];
              return completion && (completion.status === 'Approved' || completion.status === 'Complete' || completion.completedAt);
            });
            const allPendingApproval = assignedSAs.every(saEntry => {
              const practiceKey = `${saEntry}::${practiceName}`;
              const completion = saCompletions[practiceKey] || saCompletions[saEntry];
              return completion && completion.status === 'Pending Approval';
            });
            
            if (allApprovedComplete) {
              practiceStatus = 'Approved/Complete';
            } else if (allPendingApproval) {
              practiceStatus = 'Pending Approval';
            }
          }
          
          // Process SAs for this practice
          const saDetails = assignedSAs.map(saEntry => {
            const saName = extractFriendlyName(saEntry);
            const practiceKey = `${saEntry}::${practiceName}`;
            const completion = saCompletions[practiceKey] || saCompletions[saEntry];
            
            let currentStatus = 'In Progress';
            if (completion?.status === 'Approved' || completion?.status === 'Complete') currentStatus = 'Approved/Complete';
            else if (completion?.status) currentStatus = completion.status;
            else if (completion?.completedAt) currentStatus = 'Approved/Complete';
            
            return {
              name: saName,
              entry: saEntry,
              status: currentStatus,
              revisionNumber: completion?.revisionNumber
            };
          });
          
          return {
            practice: practiceName,
            colors,
            status: practiceStatus,
            sas: saDetails
          };
        });
        
        setPracticeGroups(groups);
      } catch (error) {
        console.error('Error loading practice groups:', error);
        const practiceList = practice.split(',').map(p => p.trim());
        const groups = practiceList.map((p, index) => ({
          practice: p,
          colors: COLOR_PALETTE[index % COLOR_PALETTE.length],
          status: 'In Progress',
          sas: []
        }));
        setPracticeGroups(groups);
      } finally {
        setLoading(false);
      }
    };

    loadPracticeGroups();
  }, [practice, saAssignment?.practiceAssignments, saAssignment?.saCompletions]);

  if (!practice) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center border-2 border-dashed border-gray-200">
        <div className="bg-gray-100 rounded-full p-3 w-10 h-10 mx-auto mb-3">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium text-sm">No practices specified</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-500 font-medium text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {practiceGroups.map((group, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Practice Header - Compact */}
          <div className={`${group.colors.bg} px-4 py-3 border-b border-white/20`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${group.colors.text.replace('text-', 'bg-')}`}></div>
                <h3 className={`font-semibold ${group.colors.text}`}>{group.practice}</h3>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                group.status === 'Approved/Complete' ? 'bg-emerald-500 text-white' :
                group.status === 'Pending Approval' ? 'bg-amber-500 text-white' :
                'bg-orange-500 text-white'
              }`}>
                {group.status === 'Approved/Complete' ? '✅ Complete' :
                 group.status === 'Pending Approval' ? '⏳ Pending Approval' :
                 '🔄 In Progress'}
              </div>
            </div>
          </div>
          
          {/* SAs for this practice - Compact grid */}
          <div className="p-4">
            {group.sas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.sas.map((sa, saIndex) => (
                  <div key={saIndex} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="flex items-center justify-between gap-3">
                      {/* SA Info - Compact */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="bg-gray-200 rounded-full p-1">
                          <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 text-sm truncate">{sa.name}</p>
                          {sa.status === 'Pending Approval' && sa.revisionNumber && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded border border-amber-200 mt-1">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Rev: {sa.revisionNumber}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Control - Compact */}
                      <div className="flex-shrink-0">
                        {canEditSAStatus(sa.name) ? (
                          <select
                            value={sa.status}
                            onChange={(e) => handleSAStatusChange(sa.entry, e.target.value, group.practice)}
                            className={`text-xs font-semibold px-2 py-1 rounded border-0 cursor-pointer min-w-[120px] ${
                              sa.status === 'In Progress' ? 'bg-orange-500 text-white' :
                              sa.status === 'Pending Approval' ? 'bg-amber-500 text-white' :
                              'bg-emerald-500 text-white'
                            }`}
                          >
                            <option value="In Progress">🔄 In Progress</option>
                            <option value="Pending Approval">⏳ Pending Approval</option>
                            <option value="Approved/Complete">✅ Complete</option>
                          </select>
                        ) : (
                          <div className={`text-xs font-semibold px-2 py-1 rounded text-center min-w-[120px] ${
                            sa.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            sa.status === 'Approved/Complete' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            'bg-orange-100 text-orange-800 border border-orange-200'
                          }`}>
                            {sa.status === 'Pending Approval' ? '⏳ Pending Approval' :
                             sa.status === 'Approved/Complete' ? '✅ Complete' :
                             '🔄 In Progress'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-center border-2 border-dashed border-gray-200">
                <div className="bg-gray-100 rounded-full p-2 w-8 h-8 mx-auto mb-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium text-sm">No SAs assigned</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// This component is no longer needed since practices and SAs are shown together
// Keeping for backward compatibility but not using it

// Removed useColorMapping hook - functionality moved to PracticeDisplay component

// Function to validate if all practices have assigned SAs using user practices
const validatePracticeCoverage = async (practices, assignedSas) => {
  if (!practices || !assignedSas) return { valid: false, uncoveredPractices: [] };
  
  try {
    const response = await fetch('/api/users/practices');
    
    const data = await response.json();
    
    if (!data.users) return { valid: false, uncoveredPractices: [] };
    
    const practiceList = practices.split(',').map(p => p.trim());
    const saList = assignedSas.split(',').map(s => s.trim());
    const coveredPractices = new Set();
    
    saList.forEach(saEntry => {
      // Extract email from "Name <email>" format or use as-is if it's just email
      let userEmail = null;
      const emailMatch = saEntry.match(/<([^>]+)>/);
      if (emailMatch) {
        userEmail = emailMatch[1].trim();
      } else if (saEntry.includes('@')) {
        userEmail = saEntry.trim();
      }
      
      // Find user by email (primary identifier) or fallback to name matching
      const user = data.users.find(u => {
        if (userEmail && u.email === userEmail) return true;
        // Fallback: try name matching for cases without email
        const cleanName = saEntry.replace(/<[^>]+>/g, '').trim();
        return u.name === cleanName || u.name === saEntry;
      });
      
      if (user && user.practices && Array.isArray(user.practices)) {
        // Check if user has ANY of the requested practices (not exact match)
        user.practices.forEach(userPractice => {
          practiceList.forEach(requestedPractice => {
            if (userPractice === requestedPractice) {
              coveredPractices.add(requestedPractice);
            }
          });
        });
      }
    });
    
    const uncoveredPractices = practiceList.filter(p => !coveredPractices.has(p));
    return { valid: uncoveredPractices.length === 0, uncoveredPractices };
  } catch (error) {
    console.error('Error validating practice coverage:', error);
    return { valid: false, uncoveredPractices: [] };
  }
};

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

export default function SaAssignmentDetailPage({ params }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saAssignment, setSaAssignment] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [tempPracticeSelection, setTempPracticeSelection] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAssignResourceModal, setShowAssignResourceModal] = useState(false);
  const [assignResourceData, setAssignResourceData] = useState({});
  const [assignResourceTargetStatus, setAssignResourceTargetStatus] = useState('Assigned');
  const [allUsers, setAllUsers] = useState([]);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [saStatuses, setSaStatuses] = useState(['Pending', 'Unassigned', 'Assigned', 'Pending Approval', 'Complete']);

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
    fetchSaAssignment();
    fetchSaStatuses();
    // Delay user fetching slightly to ensure auth is established
    setTimeout(fetchUsers, 100);
  }, [params.id, router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users/practices', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.users && Array.isArray(data.users)) {
          setAllUsers(data.users);
          if (typeof window !== 'undefined') {
            window.cachedUsers = data.users; // Cache for PracticeDisplay component
          }
        } else {
          console.warn('Invalid users data received:', data);
          setAllUsers([]);
        }
      } else {
        console.error('Failed to fetch users:', response.status, response.statusText);
        setAllUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setAllUsers([]);
    }
  };

  // Global refresh function for user list updates
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.refreshUsers = (newUsers) => {
        if (newUsers && Array.isArray(newUsers)) {
          setAllUsers(newUsers);
          window.cachedUsers = newUsers;
        }
      };
    }
  }, []);



  const fetchSaAssignment = async () => {
    try {
      const response = await fetch(`/api/sa-assignments/${params.id}`);
      const data = await response.json();
      if (data.success) {
        setSaAssignment(data.saAssignment);
      } else {
        console.error('Failed to fetch SA assignment:', data.error);
      }
    } catch (error) {
      console.error('Error fetching SA assignment:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSaStatuses = async () => {
    try {
      const response = await fetch('/api/sa-assignment-statuses');
      const data = await response.json();
      if (data.success) {
        setSaStatuses(data.statuses || ['Pending', 'Unassigned', 'Assigned', 'Pending Approval', 'Complete']);
      }
    } catch (error) {
      console.error('Error fetching SA statuses:', error);
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

  const canDeleteSaAssignment = (saAssignment) => {
    return user.isAdmin;
  };

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
  
  const canMarkComplete = (saAssignment) => {
    if (!user || !saAssignment) return false;
    
    // Admins can always mark complete
    if (user.isAdmin) return true;
    
    // Assigned SAs can mark their own work complete
    if (saAssignment.saAssigned) {
      const assignedSAs = saAssignment.saAssigned.split(',').map(s => s.trim());
      return assignedSAs.some(sa => sa.toLowerCase() === user.name.toLowerCase());
    }
    
    return false;
  };

  const updateSaAssignment = async (updates) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/sa-assignments/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        setSaAssignment(prev => ({ ...prev, ...updates }));
      }
    } catch (error) {
      console.error('Error updating SA assignment:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/sa-assignments/${params.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        router.push('/projects/sa-assignments');
      } else {
        console.error('Failed to delete SA assignment');
      }
    } catch (error) {
      console.error('Error deleting SA assignment:', error);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!saAssignment) {
    return (
      <AccessCheck user={user}>
        <div className="min-h-screen bg-gray-50">
          <Navbar user={user} onLogout={handleLogout} />
          <SidebarLayout user={user}>
            <div className="p-8">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">SA Assignment Not Found</h1>
                <button
                  onClick={() => router.push('/projects/sa-assignments')}
                  className="btn-primary"
                >
                  Back to SA Assignments
                </button>
              </div>
            </div>
          </SidebarLayout>
        </div>
      </AccessCheck>
    );
  }

  const attachments = JSON.parse(saAssignment.attachments || '[]');

  return (
    <AccessCheck user={user}>
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={handleLogout} />
        
        <SidebarLayout user={user}>
          <div className="p-8">
            <Breadcrumb items={[
              { label: 'Projects', href: '/projects' },
              { label: 'SA Assignments', href: '/projects/sa-assignments' },
              { label: `SA Assignment #${saAssignment.sa_assignment_number}` }
            ]} />

            <div className="max-w-7xl mx-auto space-y-8">
              {/* Header Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 rounded-lg p-3">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-white">SA Assignment #{saAssignment.sa_assignment_number}</h1>
                        <p className="text-blue-100 mt-1">{saAssignment.customerName} • {saAssignment.opportunityName}</p>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    {(canEditSaAssignment(saAssignment) || canDeleteSaAssignment(saAssignment)) && (
                      <div className="flex items-center gap-3">
                        {canEditSaAssignment(saAssignment) && saAssignment.am && saAssignment.practice && saAssignment.status !== 'Assigned' && (
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch('/api/sa-assignments/auto-assign', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ saAssignmentId: params.id })
                                });
                                const result = await response.json();
                                if (result.success) {
                                  alert(`Auto-assignment successful: ${result.message}`);
                                  fetchSaAssignment();
                                } else {
                                  alert(`Auto-assignment: ${result.message}`);
                                }
                              } catch (error) {
                                console.error('Auto-assignment error:', error);
                                alert('Auto-assignment failed. Please try again.');
                              }
                            }}
                            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Auto-Assign
                          </button>
                        )}
                        {canEditSaAssignment(saAssignment) && (
                          <button
                            onClick={() => {
                              const amNames = saAssignment.am ? saAssignment.am.split(',').map(a => extractFriendlyName(a.trim())) : [];
                              let allAssignedSAs = [];
                              if (saAssignment.practiceAssignments) {
                                try {
                                  const practiceAssignments = JSON.parse(saAssignment.practiceAssignments);
                                  const saSet = new Set();
                                  Object.values(practiceAssignments).forEach(saList => {
                                    if (Array.isArray(saList)) {
                                      saList.forEach(sa => {
                                        const friendlyName = extractFriendlyName(sa);
                                        saSet.add(friendlyName);
                                      });
                                    }
                                  });
                                  allAssignedSAs = Array.from(saSet);
                                } catch (e) {
                                  console.error('Error parsing practiceAssignments for edit modal:', e);
                                }
                              }
                              const formData = {
                                practice: saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : [],
                                am: amNames,
                                region: saAssignment.region || '',
                                saAssigned: allAssignedSAs,
                                dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0]
                              };
                              setAssignResourceData(formData);
                              setAssignResourceTargetStatus('Assigned');
                              setShowAssignResourceModal(true);
                            }}
                            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                        )}
                        {canDeleteSaAssignment(saAssignment) && (
                          <button
                            onClick={() => setShowDeleteModal(true)}
                            className="bg-red-500/20 hover:bg-red-500/30 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Opportunity & Assignment Info */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Opportunity Information */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-blue-100 rounded-lg p-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900">Opportunity Details</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-2">Opportunity ID</label>
                          <div className="bg-gray-50 rounded-lg px-4 py-3">
                            <p className="text-sm font-mono text-gray-900">{saAssignment.opportunityId}</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-2">Customer Name</label>
                          <div className="bg-gray-50 rounded-lg px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900">{saAssignment.customerName}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-2">Region</label>
                          <div className="bg-gray-50 rounded-lg px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900">{saAssignment.region || 'Not specified'}</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-2">Requested Date</label>
                          <div className="bg-gray-50 rounded-lg px-4 py-3">
                            <p className="text-sm text-gray-900">
                              {saAssignment.requestDate ? 
                                new Date(saAssignment.requestDate).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                }) : 'Not set'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-500 mb-2">Opportunity Name</label>
                      <div className="bg-gray-50 rounded-lg px-4 py-3">
                        <p className="text-sm text-gray-900 leading-relaxed">{saAssignment.opportunityName}</p>
                      </div>
                    </div>
                    
                    {saAssignment.scoopUrl && (
                      <div className="mt-6">
                        <a
                          href={saAssignment.scoopUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          View in SCOOP
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Practice & SA Assignment Status - Enhanced Section */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 px-8 py-6 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 rounded-lg p-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Practice & SA Assignment Status</h2>
                      </div>
                    </div>
                    
                    <div className="p-8">
                      <PracticeDisplay 
                        practice={saAssignment.practice} 
                        saAssigned={saAssignment.saAssigned} 
                        saAssignment={saAssignment}
                        user={user}
                        onStatusUpdate={fetchSaAssignment}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column - Assignment Status & Team */}
                <div className="space-y-8">
                  {/* Assignment Status */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-purple-100 rounded-lg p-2">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Assignment Status</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-2">Current Status</label>
                        {canEditSaAssignment(saAssignment) ? (
                          <select
                            value={saAssignment.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              if (newStatus === 'Complete') {
                                if (canMarkComplete(saAssignment)) {
                                  setShowCompleteModal(true);
                                  return;
                                } else {
                                  alert('You do not have permission to mark this assignment as complete.');
                                  return;
                                }
                              }
                              if (newStatus === 'Assigned') {
                                const amNames = saAssignment.am ? saAssignment.am.split(',').map(a => extractFriendlyName(a.trim())) : [];
                                let allAssignedSAs = [];
                                if (saAssignment.practiceAssignments) {
                                  try {
                                    const practiceAssignments = JSON.parse(saAssignment.practiceAssignments);
                                    const saSet = new Set();
                                    Object.values(practiceAssignments).forEach(saList => {
                                      if (Array.isArray(saList)) {
                                        saList.forEach(sa => {
                                          const friendlyName = extractFriendlyName(sa);
                                          saSet.add(friendlyName);
                                        });
                                      }
                                    });
                                    allAssignedSAs = Array.from(saSet);
                                  } catch (e) {
                                    console.error('Error parsing practiceAssignments for status change modal:', e);
                                  }
                                }
                                const formData = {
                                  practice: saAssignment.practice && saAssignment.practice !== 'Pending' ? saAssignment.practice.split(',').map(p => p.trim()) : [],
                                  am: amNames,
                                  region: saAssignment.region || '',
                                  saAssigned: allAssignedSAs,
                                  dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0]
                                };
                                setAssignResourceData(formData);
                                setAssignResourceTargetStatus(newStatus);
                                setShowAssignResourceModal(true);
                                return;
                              }
                              if (newStatus === 'Unassigned' && saAssignment.status === 'Pending') {
                                const amNames = saAssignment.am ? saAssignment.am.split(',').map(a => extractFriendlyName(a.trim())) : [];
                                const formData = {
                                  practice: [],
                                  am: amNames,
                                  region: saAssignment.region || '',
                                  saAssigned: [],
                                  dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0]
                                };
                                setAssignResourceData(formData);
                                setAssignResourceTargetStatus(newStatus);
                                setShowAssignResourceModal(true);
                                return;
                              }
                              try {
                                await updateSaAssignment({ status: newStatus });
                              } catch (error) {
                                console.error('Status update failed', error);
                              }
                            }}
                            className={`w-full text-sm font-semibold px-4 py-3 rounded-lg border-0 cursor-pointer transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                              saAssignment.status === 'Pending' ? 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-300' :
                              saAssignment.status === 'Unassigned' ? 'bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-300' :
                              saAssignment.status === 'Assigned' ? 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-300' :
                              saAssignment.status === 'Pending Approval' ? 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-300' :
                              saAssignment.status === 'Complete' ? 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-300' :
                              'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-300'
                            }`}
                          >
                            {saStatuses.map(status => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        ) : (
                          <div className={`w-full px-4 py-3 text-sm font-semibold rounded-lg text-center ${
                            saAssignment.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            saAssignment.status === 'Unassigned' ? 'bg-orange-100 text-orange-800' :
                            saAssignment.status === 'Assigned' ? 'bg-green-100 text-green-800' :
                            saAssignment.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800' :
                            saAssignment.status === 'Complete' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {saAssignment.status}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-2">Date Assigned</label>
                        <div className="bg-gray-50 rounded-lg px-4 py-3">
                          <p className="text-sm text-gray-900">
                            {saAssignment.dateAssigned ? new Date(saAssignment.dateAssigned).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : 'Not set'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Team Information */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-indigo-100 rounded-lg p-2">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Team</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-2">Account Manager</label>
                        <div className="bg-gray-50 rounded-lg px-4 py-3">
                          <UserField 
                            userField={saAssignment.am}
                            assignmentId={saAssignment.id}
                            fieldType="am"
                            assignmentType="sa-assignment"
                            assignment={saAssignment}
                            className="text-sm font-medium text-gray-900"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-2">ISR/SA Requested</label>
                        <div className="bg-gray-50 rounded-lg px-4 py-3">
                          <UserField 
                            userField={saAssignment.isr}
                            assignmentId={saAssignment.id}
                            fieldType="isr"
                            assignmentType="sa-assignment"
                            assignment={saAssignment}
                            className="text-sm font-medium text-gray-900"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-2">Submitted By</label>
                        <div className="bg-gray-50 rounded-lg px-4 py-3">
                          <UserField 
                            userField={saAssignment.submittedBy}
                            assignmentId={saAssignment.id}
                            fieldType="submittedBy"
                            assignmentType="sa-assignment"
                            assignment={saAssignment}
                            className="text-sm font-medium text-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notification Users */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-yellow-100 rounded-lg p-2">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-2H4v2zM4 15h8v-2H4v2zM4 11h10V9H4v2zM4 7h12V5H4v2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-3">Notification Recipients</label>
                      {(() => {
                        const notificationUsers = JSON.parse(saAssignment.sa_assignment_notification_users || '[]');
                        if (notificationUsers.length === 0) {
                          return (
                            <div className="bg-gray-50 rounded-lg px-4 py-6 text-center">
                              <p className="text-sm text-gray-500 italic">No notification recipients specified</p>
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-2">
                            {notificationUsers.map((user, index) => (
                              <div key={index} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
                                <div className="bg-indigo-100 rounded-full p-1">
                                  <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <p className="text-sm font-medium text-gray-900">{extractFriendlyName(user.name || user.email || user)}</p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              {/* Notes Section - Full Width */}
              {saAssignment.notes && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-gray-100 rounded-lg p-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Technologies & Notes</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{saAssignment.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SidebarLayout>
        
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete SA Assignment</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete SA Assignment #{saAssignment.sa_assignment_number}? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
        
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
              // DSR: Practice assignments are already in the correct format from the modal
              // No need for additional validation since the modal handles it
              
              await updateSaAssignment(updateData);
              await fetchSaAssignment(); // Refresh data to show updated practiceAssignments
              setShowAssignResourceModal(false);
              setAssignResourceData({});
            } catch (error) {
              console.error('Error updating SA assignment:', error);
            } finally {
              setSaving(false);
            }
          }}
          initialData={assignResourceData}
          targetStatus={assignResourceTargetStatus}
          saving={saving}
          allUsers={allUsers}
          saAssignment={saAssignment}
        />
        
        {/* Complete Status Modal */}
        <CompleteStatusModal
          isOpen={showCompleteModal}
          onClose={() => {
            setShowCompleteModal(false);
            // Refresh assignment data to show updated statuses
            fetchSaAssignment();
          }}
          saAssignment={saAssignment}
          user={user}
          onComplete={async (targetSA) => {
            try {
              await updateSaAssignment({ 
                markSAComplete: true,
                targetSA: targetSA
              });
              // Refresh assignment data to update practice display
              await fetchSaAssignment();
              setShowCompleteModal(false);
            } catch (error) {
              console.error('Error marking SA complete:', error);
              throw error;
            }
          }}
        />
      </div>
    </AccessCheck>
  );
}