'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, PaperClipIcon, PlusIcon, XMarkIcon, DocumentIcon, PhotoIcon } from '@heroicons/react/24/outline';
import Breadcrumb from '../../components/Breadcrumb';
import SidebarLayout from '../../components/SidebarLayout';
import Navbar from '../../components/Navbar';
import AccessCheck from '../../components/AccessCheck';
import { useAuth } from '../../hooks/useAuth';

function FileDropZone({ onFilesSelected, files }) {
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
    return validFiles.slice(0, 5);
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
      onFilesSelected(validFiles);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const validFiles = validateFiles(e.target.files);
      const newFiles = [...files, ...validFiles].slice(0, 5);
      onFilesSelected(newFiles);
    }
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesSelected(newFiles);
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
      
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Selected files:</p>
          {files.map((file, index) => (
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

export default function NewIssuePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [formData, setFormData] = useState({
    issue_type: '',
    title: '',
    problem_link: '',
    description: '',
    email: '',
    practice: '',
    selectedLeadership: []
  });
  
  const [practiceLeadership, setPracticeLeadership] = useState([]);
  
  const practicesList = [
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
  ].sort();
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdIssueId, setCreatedIssueId] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [similarIssues, setSimilarIssues] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [pastedImages, setPastedImages] = useState([]);
  const descriptionRef = useRef(null);
  const [issueTypes, setIssueTypes] = useState([]);

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          // Create a file with timestamp name
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const file = new File([blob], `pasted-image-${timestamp}.png`, { type: blob.type || 'image/png' });
          
          // Convert to data URL to bypass CSP restrictions
          const reader = new FileReader();
          reader.onload = (e) => {
            const previewUrl = e.target.result;
            setPastedImages(prev => [...prev, { file, previewUrl, id: Date.now() }]);
          };
          reader.readAsDataURL(blob);
        }
        break;
      }
    }
  };

  const removePastedImage = (id) => {
    setPastedImages(prev => prev.filter(img => img.id !== id));
  };

  const isFormValid = formData.title.trim() && 
                     formData.description.trim() && 
                     formData.email.trim() && 
                     formData.issue_type &&
                     (formData.issue_type !== 'Technical Question' || formData.problem_link.trim()) &&
                     (formData.issue_type !== 'Leadership Question' || formData.selectedLeadership.length > 0);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({ 
        ...prev, 
        email: user.email
      }));
    }
    
    // Fetch issue types
    const fetchIssueTypes = async () => {
      try {
        const response = await fetch('/api/issue-types');
        const data = await response.json();
        setIssueTypes(data.issueTypes || []);
      } catch (error) {
        console.error('Error fetching issue types:', error);
      }
    };
    
    fetchIssueTypes();
  }, [user]);
  
  useEffect(() => {
    // Auto-select Collaboration practice for Feature Request and Bug Report, otherwise clear practice
    if (formData.issue_type === 'Feature Request' || formData.issue_type === 'Bug Report') {
      setFormData(prev => ({ 
        ...prev, 
        practice: 'Collaboration'
      }));
    } else if (formData.issue_type) {
      setFormData(prev => ({ 
        ...prev, 
        practice: ''
      }));
    }
  }, [formData.issue_type]);
  
  // Fetch practice leadership when practice changes
  useEffect(() => {
    const fetchPracticeLeadership = async () => {
      if (formData.practice) {
        try {
          const response = await fetch(`/api/practice-leadership?practice=${encodeURIComponent(formData.practice)}`);
          const data = await response.json();
          setPracticeLeadership(data.leadership || []);
          
          // Auto-select practice manager by default
          const manager = data.leadership?.find(leader => leader.role === 'practice_manager');
          if (manager) {
            setFormData(prev => ({ ...prev, selectedLeadership: [manager.email] }));
          }
        } catch (error) {
          console.error('Error fetching practice leadership:', error);
          setPracticeLeadership([]);
        }
      } else {
        setPracticeLeadership([]);
        setFormData(prev => ({ ...prev, selectedLeadership: [] }));
      }
    };
    
    if (formData.issue_type === 'Leadership Question') {
      fetchPracticeLeadership();
    }
  }, [formData.practice, formData.issue_type]);

  const checkForDuplicates = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      console.log('Skipping duplicate check - missing title or description');
      return false;
    }
    
    console.log('Checking for duplicates:', { title: formData.title, description: formData.description.substring(0, 100) + '...' });
    setCheckingDuplicates(true);
    try {
      const response = await fetch('/api/issues/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description
        })
      });
      
      const result = await response.json();
      console.log('Duplicate check result:', result);
      
      if (result.similarIssues && result.similarIssues.length > 0) {
        console.log(`Found ${result.similarIssues.length} similar issues`);
        setSimilarIssues(result.similarIssues);
        setShowDuplicateModal(true);
        return true;
      }
      console.log('No similar issues found');
      return false;
    } catch (error) {
      console.error('Duplicate check error:', error);
      return false;
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);

    // Check for duplicates first
    const hasDuplicates = await checkForDuplicates();
    if (hasDuplicates) {
      setSubmitting(false);
      return;
    }

    await submitNewIssue();
  };

  const handleDuplicateSelection = async (issueId) => {
    try {
      // Create FormData with description, attachments, and issue ID
      const submitData = new FormData();
      submitData.append('issueId', issueId);
      submitData.append('description', formData.description);
      submitData.append('userEmail', formData.email);
      
      files.forEach(file => {
        submitData.append('attachments', file);
      });
      
      // Add pasted images
      pastedImages.forEach(img => {
        submitData.append('attachments', img.file);
      });

      const response = await fetch('/api/issues/merge-duplicate', {
        method: 'POST',
        body: submitData
      });
      
      if (response.ok) {
        // Clean up pasted images
        setPastedImages([]);
        
        setShowDuplicateModal(false);
        setShowSuccess(true);
        setCreatedIssueId('existing issue');
        setSubmitting(true); // Keep button disabled
        setTimeout(() => {
          router.push(`/issue/${issueId}`);
        }, 6000); // Extended to 6 seconds (3x longer)
      } else {
        const result = await response.json();
        setErrors([result.error || 'Failed to merge with existing issue']);
        setSubmitting(false);
      }
    } catch (error) {
      setErrors(['Network error occurred']);
      setSubmitting(false);
    }
  };

  const submitNewIssue = async () => {
    // Normalize problem_link URL
    const normalizedFormData = { ...formData };
    if (formData.issue_type === 'Technical Question' && formData.problem_link) {
      const link = formData.problem_link.trim();
      if (link && !link.startsWith('http://') && !link.startsWith('https://')) {
        normalizedFormData.problem_link = 'https://' + link;
      }
    }

    const submitData = new FormData();
    Object.keys(normalizedFormData).forEach(key => {
      if (key === 'selectedLeadership') {
        submitData.append(key, JSON.stringify(normalizedFormData[key]));
      } else {
        submitData.append(key, normalizedFormData[key]);
      }
    });
    
    files.forEach(file => {
      submitData.append('attachments', file);
    });
    
    // Add pasted images
    pastedImages.forEach(img => {
      submitData.append('attachments', img.file);
    });

    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        body: submitData
      });

      const result = await response.json();

      if (response.ok) {
        // Clean up pasted images
        setPastedImages([]);
        
        setCreatedIssueId(result.issue_number || result.id.substring(0, 8));
        setShowSuccess(true);
        setTimeout(() => {
          router.push('/practice-issues');
        }, 2000);
        // Keep submitting state true until redirect
      } else {
        setErrors(result.errors || [result.error]);
        setSubmitting(false);
      }
    } catch (error) {
      setErrors(['Network error occurred']);
      setSubmitting(false);
    }
  };



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
            <div className="max-w-2xl mx-auto">
        <Breadcrumb items={[
          { label: 'Practice Issues', href: '/practice-issues' },
          { label: 'New Issue' }
        ]} />

        <div className="card">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create New Issue</h1>
            <p className="text-gray-600 mt-1">Describe the issue you're experiencing</p>
          </div>

          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <ul className="text-sm text-red-600 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Issue Type *
                </label>
                <select
                  value={formData.issue_type}
                  onChange={(e) => setFormData({...formData, issue_type: e.target.value})}
                  required
                  className="input-field"
                >
                  <option value="">Select an issue type</option>
                  {issueTypes.sort((a, b) => a.name.localeCompare(b.name)).map(type => (
                    <option key={type.name} value={type.name}>
                      {type.icon} {type.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Practice *
                </label>
                <select
                  value={formData.practice}
                  onChange={(e) => setFormData({...formData, practice: e.target.value})}
                  required
                  disabled={formData.issue_type === 'Feature Request' || formData.issue_type === 'Bug Report'}
                  className={`input-field ${(formData.issue_type === 'Feature Request' || formData.issue_type === 'Bug Report') ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select a practice</option>
                  {practicesList.map(practice => (
                    <option key={practice} value={practice}>{practice}</option>
                  ))}
                </select>
                {(formData.issue_type === 'Feature Request' || formData.issue_type === 'Bug Report') && (
                  <p className="text-xs text-gray-500 mt-1">
                    Practice automatically set to Collaboration for {formData.issue_type}
                  </p>
                )}
              </div>
            </div>
            
            {/* Leadership Selection for Leadership Question */}
            {formData.issue_type === 'Leadership Question' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Leadership *
                </label>
                {!formData.practice ? (
                  <p className="text-sm text-gray-500 italic">Please select a practice to load leadership for that practice</p>
                ) : practiceLeadership.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No leadership found for this practice</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-orange-600 mb-3">Your issue will only be viewable by the leadership you select</p>
                    {practiceLeadership.map(leader => (
                      <label key={leader.email} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.selectedLeadership.includes(leader.email)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                selectedLeadership: [...prev.selectedLeadership, leader.email]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                selectedLeadership: prev.selectedLeadership.filter(email => email !== leader.email)
                              }));
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                        />
                        <span className="text-sm text-gray-900">
                          {leader.name} - {leader.role === 'practice_manager' ? 'Practice Manager' : 'Practice Principal'}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                maxLength="100"
                required
                className="input-field"
                placeholder="Brief description of the issue"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.title.length}/100 characters
              </p>
            </div>

            {formData.issue_type === 'Technical Question' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Problem Link *
                </label>
                <input
                  type="text"
                  value={formData.problem_link}
                  onChange={(e) => setFormData({...formData, problem_link: e.target.value})}
                  required
                  className="input-field"
                  placeholder="Enter the URL related to your technical question"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <div className="relative">
                <textarea
                  ref={descriptionRef}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  onPaste={handlePaste}
                  maxLength="1000"
                  rows={pastedImages.length > 0 ? "8" : "6"}
                  required
                  className="input-field resize-none"
                  placeholder="Provide detailed information about the issue... (Ctrl+V to paste images)"
                />
                
                {/* Pasted Images Preview Inside Textarea */}
                {pastedImages.length > 0 && (
                  <div key={`pasted-${pastedImages.length}`} className="absolute bottom-3 left-3 right-3 bg-gray-50 border border-gray-200 rounded p-2">
                    <div className="flex flex-wrap gap-2">
                      {pastedImages.map((img) => (
                        <div key={img.id} className="relative group">
                          <img
                            src={img.previewUrl}
                            alt="Pasted image preview"
                            className="w-16 h-16 object-cover rounded border border-gray-300"
                            onError={(e) => {
                              console.error('Image preview failed to load:', img.previewUrl);
                              e.target.style.display = 'none';
                            }}
                            onLoad={() => console.log('Image preview loaded successfully:', img.previewUrl)}
                          />
                          <button
                            type="button"
                            onClick={() => removePastedImage(img.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow-sm"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formData.description.length}/1000 characters
                {pastedImages.length > 0 && ` • ${pastedImages.length} pasted image${pastedImages.length > 1 ? 's' : ''}`}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                className="input-field bg-gray-50"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attachments (optional)
              </label>
              <FileDropZone onFilesSelected={setFiles} files={files} />
              
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="btn-secondary flex-1"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isFormValid || submitting || checkingDuplicates}
                className={`flex-1 flex items-center justify-center gap-2 ${
                  !isFormValid || submitting || checkingDuplicates ? 'btn-disabled' : 'btn-primary'
                }`}
              >
                {checkingDuplicates ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Checking for duplicates...
                  </>
                ) : submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating Issue...
                  </>
                ) : (
                  'Create Issue'
                )}
              </button>
            </div>
          </form>
          </div>
            </div>
          </div>
        </SidebarLayout>
        
        {/* Duplicate Detection Modal */}
        {showDuplicateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">🔍 Similar Issues Found</h3>
                <p className="text-gray-600 mb-6">
                  We found some existing issues that might be similar to yours. Please check if any of these match your issue:
                </p>
                
                <div className="space-y-4 mb-6">
                  {similarIssues.map((issue) => (
                    <div key={issue.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-blue-500 font-mono bg-blue-50 px-2 py-1 rounded">#{issue.issue_number}</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              issue.status === 'Open' ? 'bg-red-100 text-red-800' :
                              issue.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {issue.status}
                            </span>
                          </div>
                          <h4 className="font-medium text-gray-900 mb-2 cursor-help" title={issue.title}>{issue.title}</h4>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2 cursor-help" title={issue.description}>{issue.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>👍 {issue.upvotes || 0} upvotes</span>
                            <span>By {issue.email}</span>
                            <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDuplicateSelection(issue.id)}
                          className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          This is the same issue
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDuplicateModal(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowDuplicateModal(false);
                      setSubmitting(true);
                      submitNewIssue();
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    None match - Submit new issue
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Notification */}
        {showSuccess && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium">
                  {createdIssueId === 'existing issue' ? 'Thank you for validating!' : 'Issue Created Successfully!'}
                </p>
                <p className="text-sm opacity-90">
                  {createdIssueId === 'existing issue' 
                    ? 'We\'ve automatically upvoted the existing issue and added your description and attachments as a comment. You are now following this issue.' 
                    : `Issue #${createdIssueId} has been submitted`
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AccessCheck>
  );
}