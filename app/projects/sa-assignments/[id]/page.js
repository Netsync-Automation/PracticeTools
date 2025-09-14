'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import AccessCheck from '../../../../components/AccessCheck';
import Breadcrumb from '../../../../components/Breadcrumb';
import MultiAttachmentPreview from '../../../../components/MultiAttachmentPreview';
import MultiResourceSelector from '../../../../components/MultiResourceSelector';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { PRACTICE_OPTIONS } from '../../../../constants/practices';

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
  }, [params.id, router]);

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
    if (user.isAdmin) return true;
    
    if (saAssignment.practice === 'Pending') {
      return user.role === 'practice_manager' || user.role === 'practice_principal';
    }
    
    return (user.role === 'practice_manager' || user.role === 'practice_principal') && 
           user.practices?.includes(saAssignment.practice);
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
                    </div>
                    <div className="grid grid-cols-2 gap-6 flex-1">
                      {/* Left Column - Status & Details */}
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Opportunity ID</dt>
                          <dd className="text-sm text-gray-900 font-medium">{saAssignment.opportunityId}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Status</dt>
                          <dd className="text-sm text-gray-900 font-medium">
                            {canEditSaAssignment(saAssignment) ? (
                              <select
                                value={saAssignment.status}
                                onChange={async (e) => {
                                  const newStatus = e.target.value;
                                  console.log('DEBUG: Status change triggered', {
                                    currentStatus: saAssignment.status,
                                    newStatus: newStatus,
                                    showEditModal: showEditModal
                                  });
                                  
                                  console.log('DEBUG: Condition check', {
                                    isPendingToUnassigned: saAssignment.status === 'Pending' && newStatus === 'Unassigned',
                                    isPendingToAssigned: saAssignment.status === 'Pending' && newStatus === 'Assigned',
                                    isUnassignedToAssigned: saAssignment.status === 'Unassigned' && newStatus === 'Assigned',
                                    overallCondition: (saAssignment.status === 'Pending' && (newStatus === 'Unassigned' || newStatus === 'Assigned')) || (saAssignment.status === 'Unassigned' && newStatus === 'Assigned')
                                  });
                                  
                                  if ((saAssignment.status === 'Pending' && (newStatus === 'Unassigned' || newStatus === 'Assigned')) || (saAssignment.status === 'Unassigned' && newStatus === 'Assigned')) {
                                    console.log(`DEBUG: Triggering practice modal for ${saAssignment.status} -> ${newStatus}`);
                                    const formData = {
                                      practice: saAssignment.status === 'Pending' ? [] : (saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : []),
                                      am: extractFriendlyName(saAssignment.am) || '',
                                      region: saAssignment.region || '',
                                      saAssigned: Array.isArray(saAssignment.saAssigned) ? saAssignment.saAssigned : (saAssignment.saAssigned ? saAssignment.saAssigned.split(',').map(s => extractFriendlyName(s.trim())) : []),
                                      dateAssigned: saAssignment.dateAssigned || new Date().toISOString().split('T')[0],
                                      targetStatus: newStatus
                                    };
                                    console.log('DEBUG: Setting form data', formData);
                                    setEditFormData(formData);
                                    console.log('DEBUG: Setting showEditModal to true');
                                    setShowEditModal(true);
                                    console.log('DEBUG: Modal state after setting', { showEditModal: true });
                                    setTimeout(() => console.log('DEBUG: Modal state check after timeout', { showEditModal }), 100);
                                    return;
                                  }
                                  
                                  console.log('DEBUG: Direct status update', { newStatus });
                                  try {
                                    await updateSaAssignment({ status: newStatus });
                                    console.log('DEBUG: Status update successful');
                                  } catch (error) {
                                    console.error('DEBUG: Status update failed', error);
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
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Practice</dt>
                          <dd className="text-sm text-gray-900 font-medium">{saAssignment.practice}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Region</dt>
                          <dd className="text-sm text-gray-900 font-medium">{saAssignment.region || 'Not specified'}</dd>
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
                      
                      {/* Right Column - Team & Dates */}
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Account Manager</dt>
                          <dd className="text-sm text-gray-900">{extractFriendlyName(saAssignment.am) || 'Not assigned'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">ISR</dt>
                          <dd className="text-sm text-gray-900">{extractFriendlyName(saAssignment.isr) || 'Not assigned'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Submitted By</dt>
                          <dd className="text-sm text-gray-900">{extractFriendlyName(saAssignment.submittedBy) || 'Not specified'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">SA Assigned</dt>
                          <dd className="text-sm text-gray-900">
                            {saAssignment.saAssigned ? (
                              saAssignment.saAssigned.includes(',') ? (
                                <div className="space-y-1">
                                  {saAssignment.saAssigned.split(',').map((sa, index) => (
                                    <div key={index} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-800 text-xs rounded-full mr-1 mb-1">
                                      {sa.trim()}
                                    </div>
                                  ))}
                                </div>
                              ) : saAssignment.saAssigned
                            ) : 'Not assigned'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Date Assigned</dt>
                          <dd className="text-sm text-gray-900">{saAssignment.dateAssigned ? new Date(saAssignment.dateAssigned).toLocaleDateString() : 'Not set'}</dd>
                        </div>
                      </dl>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Manager</label>
                    <input
                      type="text"
                      value={editFormData.am || ''}
                      onChange={(e) => setEditFormData(prev => ({...prev, am: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter account manager name (optional)"
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
                      }
                      
                      setSaving(true);
                      try {
                        const updateData = {
                          status: editFormData.targetStatus,
                          practice: practices.join(','),
                          am: editFormData.am,
                          region: editFormData.region
                        };
                        
                        if (editFormData.targetStatus === 'Assigned') {
                          updateData.saAssigned = Array.isArray(editFormData.saAssigned) ? editFormData.saAssigned.join(',') : editFormData.saAssigned;
                          updateData.dateAssigned = editFormData.dateAssigned;
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