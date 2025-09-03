'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams } from 'next/navigation';
import { PaperClipIcon, XMarkIcon, DocumentIcon, PhotoIcon } from '@heroicons/react/24/outline';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import AccessCheck from '../../../../components/AccessCheck';
import Breadcrumb from '../../../../components/Breadcrumb';
import AssignmentConversation from '../../../../components/AssignmentConversation';
import AttachmentPreview from '../../../../components/AttachmentPreview';
import MultiAttachmentPreview from '../../../../components/MultiAttachmentPreview';
import { ASSIGNMENT_STATUS_OPTIONS } from '../../../../constants/assignmentStatus';
import { PRACTICE_OPTIONS } from '../../../../constants/practices';

function FileUploadZone({ attachments, setAttachments }) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const validTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'application/zip'
  ];

  const validateFiles = (fileList) => {
    const validFiles = Array.from(fileList).filter(file => {
      return file.size <= 5 * 1024 * 1024 && validTypes.includes(file.type);
    });
    return validFiles.slice(0, 5 - attachments.length);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const validFiles = validateFiles(e.dataTransfer.files);
      setAttachments(prev => [...prev, ...validFiles]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const validFiles = validateFiles(e.target.files);
      setAttachments(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) {
      return <PhotoIcon className="h-5 w-5 text-blue-500" />;
    }
    return <DocumentIcon className="h-5 w-5 text-gray-500" />;
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <PaperClipIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleChange}
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.zip"
          className="hidden"
        />
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-blue-600 hover:text-blue-500 font-medium transition-all duration-150 hover:scale-105 active:scale-95"
          >
            Click to upload files
          </button>
          <span className="text-gray-500"> or drag and drop</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Max 5 files, 5MB each. Images, PDF, DOC, TXT, ZIP
        </p>
      </div>
      
      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Selected files ({attachments.length}/5):</p>
          {attachments.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center space-x-3">
                {getFileIcon(file)}
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{Math.round(file.size / 1024)}KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-all duration-150 hover:scale-110 active:scale-95"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AssignmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [user, setUser] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProjectEditModal, setShowProjectEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [projectEditFormData, setProjectEditFormData] = useState({});
  const [projectAttachments, setProjectAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [hoveredImage, setHoveredImage] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const hoverTimeoutRef = useRef(null);

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
    fetchAssignment();
  }, [router, params.id]);

  const fetchAssignment = async () => {
    try {
      const response = await fetch(`/api/assignments/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setAssignment(data.assignment);
      } else {
        console.error('Assignment not found');
        router.push('/projects/resource-assignments');
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
      router.push('/projects/resource-assignments');
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

  const openEditModal = () => {
    setEditFormData({
      projectNumber: assignment.projectNumber || '',
      status: assignment.status || '',
      practice: assignment.practice || '',
      region: assignment.region || '',
      am: assignment.am || '',
      pm: assignment.pm || '',
      resourceAssigned: assignment.resourceAssigned || '',
      dateAssigned: assignment.dateAssigned || '',
      requestDate: assignment.requestDate || '',
      eta: assignment.eta || ''
    });
    setShowEditModal(true);
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveAssignment = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/assignments/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
      });

      const data = await response.json();
      if (data.success) {
        setAssignment(data.assignment);
        setShowEditModal(false);
      } else {
        alert('Failed to update assignment');
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      alert('Failed to update assignment');
    } finally {
      setSaving(false);
    }
  };

  const openProjectEditModal = () => {
    setProjectEditFormData({
      customerName: assignment.customerName || '',
      projectDescription: assignment.projectDescription || '',
      notes: assignment.notes || ''
    });
    setProjectAttachments([]);
    setShowProjectEditModal(true);
  };

  const handleProjectEditFormChange = (field, value) => {
    setProjectEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveProjectInfo = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      
      // Add form fields
      Object.keys(projectEditFormData).forEach(key => {
        formData.append(key, projectEditFormData[key]);
      });
      
      // Add existing attachments (keep them)
      const existingAttachments = JSON.parse(assignment.attachments || '[]');
      formData.append('existingAttachments', JSON.stringify(existingAttachments));
      
      // Add new attachments
      projectAttachments.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await fetch(`/api/assignments/${params.id}`, {
        method: 'PUT',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setAssignment(data.assignment);
        setShowProjectEditModal(false);
        setProjectAttachments([]);
      } else {
        alert('Failed to update project information');
      }
    } catch (error) {
      console.error('Error updating project information:', error);
      alert('Failed to update project information');
    } finally {
      setSaving(false);
    }
  };

  const deleteAssignment = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/assignments/${params.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        router.push('/projects/resource-assignments');
      } else {
        alert('Failed to delete assignment');
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Failed to delete assignment');
    } finally {
      setSaving(false);
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

  if (!assignment) {
    return (
      <AccessCheck user={user}>
        <div className="min-h-screen bg-gray-50">
          <Navbar user={user} onLogout={handleLogout} />
          <SidebarLayout user={user}>
            <div className="p-8">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Assignment Not Found</h1>
                <button
                  onClick={() => router.push('/projects/resource-assignments')}
                  className="btn-primary"
                >
                  Back to Assignments
                </button>
              </div>
            </div>
          </SidebarLayout>
        </div>
      </AccessCheck>
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
              { label: 'Resource Assignments', href: '/projects/resource-assignments' },
              { label: `Assignment #${assignment.assignment_number}` }
            ]} />

            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" style={{gridTemplateRows: '1fr'}}>
                {/* Main Content */}
                <div className="lg:col-span-2">
                  {/* Project Information */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const attachments = JSON.parse(assignment.attachments || '[]');
                          if (attachments.length === 0) return null;
                          
                          return (
                            <MultiAttachmentPreview attachments={attachments} position="right">
                              <div className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95">
                                <PaperClipIcon className="h-5 w-5" />
                                {attachments.length > 1 && <span className="ml-1 text-xs">{attachments.length}</span>}
                              </div>
                            </MultiAttachmentPreview>
                          );
                        })()}
                        <h2 className="text-lg font-semibold text-gray-900">Project Information</h2>
                        <span className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">ID: #{assignment.assignment_number}</span>
                      </div>
                      {(user.isAdmin || 
                        (assignment.practice === 'Pending' && (user.role === 'practice_manager' || user.role === 'practice_principal')) ||
                        (assignment.practice !== 'Pending' && (user.role === 'practice_manager' || user.role === 'practice_principal') && user.practices?.includes(assignment.practice))
                      ) && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowDeleteModal(true)}
                            className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                          <button
                            onClick={openProjectEditModal}
                            className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Customer Name</label>
                        <p className="text-sm text-gray-900">{assignment.customerName}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-500 mb-1">Project Description</label>
                        <p className="text-sm text-gray-900">{assignment.projectDescription}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                        <p className="text-sm text-gray-900">{assignment.notes || 'No notes'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <div>
                  {/* Assignment Information */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Assignment Information</h3>
                      {(user.isAdmin || 
                        (assignment.practice === 'Pending' && (user.role === 'practice_manager' || user.role === 'practice_principal')) ||
                        (assignment.practice !== 'Pending' && (user.role === 'practice_manager' || user.role === 'practice_principal') && user.practices?.includes(assignment.practice))
                      ) && (
                        <button
                          onClick={openEditModal}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-6 flex-1">
                      {/* Left Column - Project & Status */}
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Project #</dt>
                          <dd className="text-sm text-gray-900 font-medium">{assignment.projectNumber}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Status</dt>
                          <dd className="text-sm text-gray-900 font-medium">{assignment.status}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Practice</dt>
                          <dd className="text-sm text-gray-900 font-medium">{assignment.practice}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Region</dt>
                          <dd className="text-sm text-gray-900 font-medium">{assignment.region}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Request Date</dt>
                          <dd className="text-sm text-gray-900">{assignment.requestDate ? new Date(assignment.requestDate).toLocaleDateString() : 'Not set'}</dd>
                        </div>
                      </dl>
                      
                      {/* Right Column - Team & Dates */}
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Account Manager</dt>
                          <dd className="text-sm text-gray-900">{assignment.am}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Project Manager</dt>
                          <dd className="text-sm text-gray-900">{assignment.pm}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Resource Assigned</dt>
                          <dd className="text-sm text-gray-900">{assignment.resourceAssigned}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Date Assigned</dt>
                          <dd className="text-sm text-gray-900">{assignment.dateAssigned ? new Date(assignment.dateAssigned).toLocaleDateString() : 'Not set'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500">ETA</dt>
                          <dd className="text-sm text-gray-900">{assignment.eta ? new Date(assignment.eta).toLocaleDateString() : 'Not set'}</dd>
                        </div>
                        {assignment.documentationLink && (
                          <div>
                            <dt className="text-xs font-medium text-gray-500">Documentation</dt>
                            <dd className="text-sm">
                              <a 
                                href={assignment.documentationLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                View Documentation
                              </a>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Conversation Section - Full Width */}
              <div className="mt-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <AssignmentConversation assignmentId={params.id} user={user} />
                </div>
              </div>
            </div>
            
            {/* Edit Assignment Modal */}
            {showEditModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Edit Assignment</h3>
                      <button
                        onClick={() => setShowEditModal(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Column */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Project Number</label>
                          <input
                            type="text"
                            value={editFormData.projectNumber}
                            onChange={(e) => handleEditFormChange('projectNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                          <select
                            value={editFormData.status}
                            onChange={(e) => handleEditFormChange('status', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {ASSIGNMENT_STATUS_OPTIONS.map(status => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Practice</label>
                          <select
                            value={editFormData.practice}
                            onChange={(e) => handleEditFormChange('practice', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {PRACTICE_OPTIONS.map(practice => (
                              <option key={practice} value={practice}>{practice}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                          <select
                            value={editFormData.region}
                            onChange={(e) => handleEditFormChange('region', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
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
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Request Date</label>
                          <input
                            type="date"
                            value={editFormData.requestDate}
                            onChange={(e) => handleEditFormChange('requestDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                      
                      {/* Right Column */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Account Manager</label>
                          <input
                            type="text"
                            value={editFormData.am}
                            onChange={(e) => handleEditFormChange('am', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Project Manager</label>
                          <input
                            type="text"
                            value={editFormData.pm}
                            onChange={(e) => handleEditFormChange('pm', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Resource Assigned</label>
                          <input
                            type="text"
                            value={editFormData.resourceAssigned}
                            onChange={(e) => handleEditFormChange('resourceAssigned', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date Assigned</label>
                          <input
                            type="date"
                            value={editFormData.dateAssigned}
                            onChange={(e) => handleEditFormChange('dateAssigned', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">ETA</label>
                          <input
                            type="date"
                            value={editFormData.eta}
                            onChange={(e) => handleEditFormChange('eta', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                      <button
                        onClick={() => setShowEditModal(false)}
                        disabled={saving}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveAssignment}
                        disabled={saving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Edit Project Information Modal */}
            {showProjectEditModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Edit Project Information</h3>
                      <button
                        onClick={() => setShowProjectEditModal(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                        <input
                          type="text"
                          value={projectEditFormData.customerName}
                          onChange={(e) => handleProjectEditFormChange('customerName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
                        <textarea
                          value={projectEditFormData.projectDescription}
                          onChange={(e) => handleProjectEditFormChange('projectDescription', e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                          value={projectEditFormData.notes}
                          onChange={(e) => handleProjectEditFormChange('notes', e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      {/* File Attachments */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
                        <FileUploadZone attachments={projectAttachments} setAttachments={setProjectAttachments} />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                      <button
                        onClick={() => setShowProjectEditModal(false)}
                        disabled={saving}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveProjectInfo}
                        disabled={saving}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full">
                  <div className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Delete Assignment</h3>
                    </div>
                    
                    <p className="text-gray-600 mb-6">
                      Are you sure you want to delete Assignment #{assignment.assignment_number}? This action cannot be undone.
                    </p>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteModal(false)}
                        disabled={saving}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={deleteAssignment}
                        disabled={saving}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {saving ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Image Hover Preview Portal */}
            {hoveredImage && typeof window !== 'undefined' && createPortal(
              <div 
                className="fixed z-50 pointer-events-none"
                style={{
                  left: Math.min(hoveredImage.x + 10, window.innerWidth - 320),
                  top: Math.max(hoveredImage.y - 250, 10)
                }}
              >
                <div 
                  className="bg-white rounded-lg shadow-xl border border-gray-300 overflow-hidden pointer-events-auto max-w-2xl max-h-[48rem]"
                  onMouseEnter={() => {
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                  }}
                  onMouseLeave={() => setHoveredImage(null)}
                >
                  <img
                    src={`/api/files/${hoveredImage.path}`}
                    alt={hoveredImage.filename}
                    className="max-w-full max-h-[40rem] object-contain"
                    style={{ minWidth: '400px', minHeight: '300px' }}
                  />
                  <div className="p-3">
                    <p className="font-semibold text-gray-900 text-sm mb-1 truncate">
                      {hoveredImage.filename}
                    </p>
                    <p className="text-xs text-gray-500 mb-2">
                      {(hoveredImage.size / 1024).toFixed(1)} KB
                    </p>
                    <a
                      href={`/api/files/${hoveredImage.path}`}
                      download={hoveredImage.filename}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download
                    </a>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
        </SidebarLayout>
      </div>
    </AccessCheck>
  );
}