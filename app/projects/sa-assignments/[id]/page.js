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
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { PRACTICE_OPTIONS } from '../../../../constants/practices';

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

// Component to display practices with their assigned SAs
function PracticeDisplay({ practice, saAssigned }) {
  const [practiceAssignments, setPracticeAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPracticeAssignments = async () => {
      if (!practice) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        
        if (data.users) {
          const practiceList = practice.split(',').map(p => p.trim());
          const saList = saAssigned ? saAssigned.split(',').map(s => s.trim()) : [];
          const assignments = [];
          
          practiceList.forEach((p, index) => {
            const colors = COLOR_PALETTE[index % COLOR_PALETTE.length];
            
            // Find SAs assigned to this practice
            const assignedSAs = saList.filter(saName => {
              const user = data.users.find(u => u.name === saName);
              return user && user.practices && user.practices.includes(p);
            });
            
            assignments.push({
              practice: p,
              assignedSAs: assignedSAs,
              colors: colors
            });
          });
          
          setPracticeAssignments(assignments);
        }
      } catch (error) {
        console.error('Error loading practice assignments:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPracticeAssignments();
  }, [practice, saAssigned]);

  if (!practice) {
    return (
      <div>
        <dt className="text-xs font-medium text-gray-500">Practices</dt>
        <dd className="text-sm text-gray-900 font-medium">Not specified</dd>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <dt className="text-xs font-medium text-gray-500">Practices</dt>
        <dd className="text-sm text-gray-900 font-medium">Loading...</dd>
      </div>
    );
  }

  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">Practices & SA Assignments</dt>
      <dd className="text-sm text-gray-900 font-medium">
        <div className="space-y-4 mt-2">
          {practiceAssignments.map((assignment, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className={`inline-flex items-center px-3 py-1.5 ${assignment.colors.bg} ${assignment.colors.text} text-xs rounded-full border ${assignment.colors.border} font-medium flex-shrink-0 shadow-sm`}>
                {assignment.practice}
              </span>
              <div className="flex-1 flex items-center">
                <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-gray-200"></div>
                <div className="mx-2">
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-gray-300"></div>
              </div>
              <div className="flex-shrink-0">
                {assignment.assignedSAs.length > 0 ? (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {assignment.assignedSAs.map((sa, saIndex) => (
                      <span key={saIndex} className={`inline-flex items-center px-3 py-1.5 ${assignment.colors.bg} ${assignment.colors.text} text-xs rounded-lg border ${assignment.colors.border} shadow-sm font-medium`}>
                        {sa}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="inline-flex items-center px-3 py-1.5 bg-gray-50 text-gray-600 text-xs rounded-lg border border-gray-200 shadow-sm font-medium">
                    Unassigned
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </dd>
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
    const response = await fetch('/api/admin/users');
    const data = await response.json();
    
    if (!data.users) return { valid: false, uncoveredPractices: [] };
    
    const practiceList = practices.split(',').map(p => p.trim());
    const saList = assignedSas.split(',').map(s => s.trim());
    const coveredPractices = new Set();
    
    saList.forEach(saName => {
      const user = data.users.find(u => u.name === saName);
      if (user && user.practices) {
        user.practices.forEach(practice => {
          if (practiceList.includes(practice)) {
            coveredPractices.add(practice);
          }
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [allUsers, setAllUsers] = useState([]);

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
    fetchUsers();
  }, [params.id, router]);

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

  // Auto-populate region when account managers are selected
  useEffect(() => {
    if (showEditModal && !editFormData.region && editFormData.am && Array.isArray(editFormData.am) && editFormData.am.length > 0 && allUsers.length > 0) {
      const firstAM = allUsers.find(u => u.role === 'account_manager' && editFormData.am.includes(u.name));
      if (firstAM && firstAM.region) {
        setEditFormData(prev => ({...prev, region: firstAM.region}));
      }
    }
  }, [showEditModal, editFormData.am, allUsers, editFormData.region]);

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

            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" style={{gridTemplateRows: '1fr'}}>
                {/* Main Content */}
                <div className="lg:col-span-2">
                  {/* Project Information */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-gray-900">Opportunity Information</h2>
                        <span className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">ID: #{saAssignment.sa_assignment_number}</span>
                      </div>
                      {(canEditSaAssignment(saAssignment) || canDeleteSaAssignment(saAssignment)) && (
                        <div className="flex items-center gap-2">
                          {/* Auto-Assignment Button */}
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
                                    fetchSaAssignment(); // Refresh the data
                                  } else {
                                    alert(`Auto-assignment: ${result.message}`);
                                  }
                                } catch (error) {
                                  console.error('Auto-assignment error:', error);
                                  alert('Auto-assignment failed. Please try again.');
                                }
                              }}
                              className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                              title="Automatically assign SAs based on AM and Practice mapping"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Auto-Assign
                            </button>
                          )}
                          {canDeleteSaAssignment(saAssignment) && (
                            <button
                              onClick={() => setShowDeleteModal(true)}
                              className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          )}
                          {canEditSaAssignment(saAssignment) && (
                            <button
                              onClick={() => setShowEditModal(true)}
                              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Customer Name</label>
                        <p className="text-sm text-gray-900">{saAssignment.customerName}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-500 mb-1">Opportunity Name</label>
                        <p className="text-sm text-gray-900">{saAssignment.opportunityName}</p>
                      </div>

                      {saAssignment.scoopUrl && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-500 mb-1">SCOOP Link</label>
                          <a
                            href={saAssignment.scoopUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 underline"
                          >
                            View in SCOOP
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div>
                  {/* Assignment Information */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Assignment Information</h3>
                      {canEditSaAssignment(saAssignment) && (
                        <button
                          onClick={() => {
                            const amNames = saAssignment.am ? saAssignment.am.split(',').map(a => extractFriendlyName(a.trim())) : [];
                            const formData = {
                              practice: saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : [],
                              am: amNames,
                              region: saAssignment.region || '',
                              saAssigned: Array.isArray(saAssignment.saAssigned) ? saAssignment.saAssigned : (saAssignment.saAssigned ? saAssignment.saAssigned.split(',').map(s => extractFriendlyName(s.trim())) : []),
                              dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0],
                              targetStatus: 'Assigned'
                            };
                            setEditFormData(formData);
                            setShowEditModal(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                      )}
                    </div>
                    <div className="mb-4 grid grid-cols-2 gap-6">
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Status</dt>
                        <dd className="text-sm text-gray-900 font-medium">
                          {canEditSaAssignment(saAssignment) ? (
                            <select
                              value={saAssignment.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                if (newStatus === 'Assigned') {
                                  const amNames = saAssignment.am ? saAssignment.am.split(',').map(a => extractFriendlyName(a.trim())) : [];
                                  const formData = {
                                    practice: saAssignment.practice && saAssignment.practice !== 'Pending' ? saAssignment.practice.split(',').map(p => p.trim()) : [],
                                    am: amNames,
                                    region: saAssignment.region || '',
                                    saAssigned: Array.isArray(saAssignment.saAssigned) ? saAssignment.saAssigned : (saAssignment.saAssigned ? saAssignment.saAssigned.split(',').map(s => extractFriendlyName(s.trim())) : []),
                                    dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0],
                                    targetStatus: newStatus
                                  };
                                  setEditFormData(formData);
                                  setShowEditModal(true);
                                  return;
                                }
                                
                                if (newStatus === 'Unassigned' && saAssignment.status === 'Pending') {
                                  const amNames = saAssignment.am ? saAssignment.am.split(',').map(a => extractFriendlyName(a.trim())) : [];
                                  const formData = {
                                    practice: [],
                                    am: amNames,
                                    region: saAssignment.region || '',
                                    saAssigned: [],
                                    dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0],
                                    targetStatus: newStatus
                                  };
                                  setEditFormData(formData);
                                  setShowEditModal(true);
                                  return;
                                }
                                
                                try {
                                  await updateSaAssignment({ status: newStatus });
                                } catch (error) {
                                  console.error('Status update failed', error);
                                }
                              }}
                              className={`text-sm font-semibold px-3 py-1.5 rounded-full border-0 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-3 focus:ring-opacity-50 ${
                                saAssignment.status === 'Pending' ? 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-300' :
                                saAssignment.status === 'Unassigned' ? 'bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-300' :
                                saAssignment.status === 'Assigned' ? 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-300' :
                                saAssignment.status === 'Complete' ? 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-300' :
                                'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-300'
                              }`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Unassigned">Unassigned</option>
                              <option value="Assigned">Assigned</option>
                              <option value="Complete">Complete</option>
                            </select>
                          ) : (
                            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-lg ${
                              saAssignment.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                              saAssignment.status === 'Unassigned' ? 'bg-orange-100 text-orange-800' :
                              saAssignment.status === 'Assigned' ? 'bg-green-100 text-green-800' :
                              saAssignment.status === 'Complete' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {saAssignment.status}
                            </span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Date Assigned</dt>
                        <dd className="text-sm text-gray-900 font-medium">
                          <span className="inline-flex px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-100 text-gray-800">
                            {saAssignment.dateAssigned ? new Date(saAssignment.dateAssigned).toLocaleDateString() : 'Not set'}
                          </span>
                        </dd>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6 flex-1">
                      {/* Left Column */}
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Opportunity ID</dt>
                          <dd className="text-sm text-gray-900 font-medium">{saAssignment.opportunityId}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Account Manager</dt>
                          <dd className="text-sm text-gray-900">{extractFriendlyName(saAssignment.am) || 'Not assigned'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Requested</dt>
                          <dd className="text-sm text-gray-900">
                            {saAssignment.requestDate ? 
                              new Date(saAssignment.requestDate).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                timeZoneName: 'short'
                              }) : 'Not set'
                            }
                          </dd>
                        </div>

                      </dl>
                      
                      {/* Right Column */}
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Region</dt>
                          <dd className="text-sm text-gray-900 font-medium">{saAssignment.region || 'Not specified'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">ISR/SA Requested</dt>
                          <dd className="text-sm text-gray-900">{extractFriendlyName(saAssignment.isr) || 'Not assigned'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Submitted By</dt>
                          <dd className="text-sm text-gray-900">{extractFriendlyName(saAssignment.submittedBy) || 'Not specified'}</dd>
                        </div>

                      </dl>
                    </div>
                    
                    {/* Full-width sections */}
                    <div className="mt-6 space-y-4">
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Notification Users</dt>
                        <dd className="text-sm text-gray-900">
                          {(() => {
                            const notificationUsers = JSON.parse(saAssignment.sa_assignment_notification_users || '[]');
                            if (notificationUsers.length === 0) {
                              return <span className="text-gray-400 italic">None specified</span>;
                            }
                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {notificationUsers.map((user, index) => (
                                  <span key={index} className="inline-flex items-center px-2 py-1 bg-indigo-50 text-indigo-800 text-xs rounded-full border border-indigo-200">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                    {extractFriendlyName(user.name || user.email || user)}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </dd>
                      </div>
                      
                      <PracticeDisplay practice={saAssignment.practice} saAssigned={saAssignment.saAssigned} />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Notes Section - Full Width */}
              {saAssignment.notes && (
                <div className="mt-8">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Technologies & Notes</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{saAssignment.notes}</p>
                    </div>
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
        
        {showEditModal && (
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
                    {editFormData.targetStatus === 'Assigned' ? 'Assign Resource' : 'Assign to Practice'}
                  </h3>
                </div>
                
                <p className="text-gray-600 mb-6">
                  {editFormData.targetStatus === 'Assigned' 
                    ? 'Please assign this request to a practice, region, and resource.' 
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
                            checked={Array.isArray(editFormData.practice) ? editFormData.practice.includes(practice) : editFormData.practice === practice}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const currentPractices = Array.isArray(editFormData.practice) ? editFormData.practice : (editFormData.practice ? [editFormData.practice] : []);
                                setEditFormData(prev => ({...prev, practice: [...currentPractices, practice]}));
                              } else {
                                const currentPractices = Array.isArray(editFormData.practice) ? editFormData.practice : (editFormData.practice ? [editFormData.practice] : []);
                                setEditFormData(prev => ({...prev, practice: currentPractices.filter(p => p !== practice)}));
                              }
                            }}
                            className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{practice}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <MultiAccountManagerSelector
                      value={editFormData.am || []}
                      onChange={(managers) => setEditFormData(prev => ({...prev, am: managers}))}
                      placeholder="Select or type account manager names..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
                    <select
                      value={editFormData.region || ''}
                      onChange={(e) => setEditFormData(prev => ({...prev, region: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Region</option>
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
                  
                  {editFormData.targetStatus === 'Assigned' && (
                    <>
                      <div>
                        <MultiResourceSelector
                          value={editFormData.saAssigned || []}
                          onChange={(resources) => setEditFormData(prev => ({...prev, saAssigned: resources}))}
                          assignedPractices={Array.isArray(editFormData.practice) ? editFormData.practice : (editFormData.practice ? editFormData.practice.split(',').map(p => p.trim()) : [])}
                          placeholder="Select or type SA names..."
                          amEmail={saAssignment.am?.match(/<([^>]+)>/)?.[1]}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date Assigned *</label>
                        <input
                          type="date"
                          value={editFormData.dateAssigned || ''}
                          onChange={(e) => setEditFormData(prev => ({...prev, dateAssigned: e.target.value}))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowEditModal(false)}
                    disabled={saving}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const practices = Array.isArray(editFormData.practice) ? editFormData.practice : (editFormData.practice ? [editFormData.practice] : []);
                      if (practices.length === 0) {
                        alert('Please select at least one practice');
                        return;
                      }
                      
                      if (!editFormData.region) {
                        alert('Please select a region');
                        return;
                      }
                      
                      if (editFormData.targetStatus === 'Assigned') {
                        if (!editFormData.saAssigned || (Array.isArray(editFormData.saAssigned) && editFormData.saAssigned.length === 0)) {
                          alert('Please assign at least one SA');
                          return;
                        }
                        
                        // Validate practice coverage for Assigned status
                        const assignedSasString = Array.isArray(editFormData.saAssigned) ? editFormData.saAssigned.join(',') : editFormData.saAssigned;
                        const validation = await validatePracticeCoverage(practices.join(','), assignedSasString);
                        
                        if (!validation.valid) {
                          const confirmed = confirm(`The assignment will be saved but will remain in "Unassigned" status.\n\nThe following practices still need SA assignments:\n${validation.uncoveredPractices.join(', ')}\n\nClick OK to save with current assignments, or Cancel to continue editing.`);
                          if (!confirmed) return;
                          
                          // Override target status to Unassigned since not all practices are covered
                          editFormData.targetStatus = 'Unassigned';
                        }
                      }
                      
                      setSaving(true);
                      try {
                        const updateData = {
                          status: editFormData.targetStatus,
                          practice: practices.join(','),
                          am: Array.isArray(editFormData.am) ? editFormData.am.join(',') : editFormData.am,
                          region: editFormData.region
                        };
                        
                        if (editFormData.targetStatus === 'Assigned') {
                          updateData.saAssigned = Array.isArray(editFormData.saAssigned) ? editFormData.saAssigned.join(',') : editFormData.saAssigned;
                          updateData.dateAssigned = editFormData.dateAssigned;
                        } else if (editFormData.saAssigned && (Array.isArray(editFormData.saAssigned) ? editFormData.saAssigned.length > 0 : editFormData.saAssigned)) {
                          // Save SA assignments even for Unassigned status
                          updateData.saAssigned = Array.isArray(editFormData.saAssigned) ? editFormData.saAssigned.join(',') : editFormData.saAssigned;
                        }
                        
                        await updateSaAssignment(updateData);
                        setShowEditModal(false);
                      } catch (error) {
                        console.error('Error updating SA assignment:', error);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving || (Array.isArray(editFormData.practice) ? editFormData.practice.length === 0 : !editFormData.practice) || !editFormData.region || (editFormData.targetStatus === 'Assigned' && (!editFormData.saAssigned || (Array.isArray(editFormData.saAssigned) && editFormData.saAssigned.length === 0)))}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Assigning...' : (editFormData.targetStatus === 'Assigned' ? 'Assign Resource' : 'Assign to Practice')}
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