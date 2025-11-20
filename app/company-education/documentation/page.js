'use client';

import { useState, useEffect } from 'react';
import Navbar from '../../../components/Navbar';
import SidebarLayout from '../../../components/SidebarLayout';
import Breadcrumb from '../../../components/Breadcrumb';
import { useAuth } from '../../../hooks/useAuth';
import AccessCheck from '../../../components/AccessCheck';

export default function DocumentationPage() {
  const { user, loading, logout } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [isRecordingHost, setIsRecordingHost] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showExpirationModal, setShowExpirationModal] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');
  const [hasExpiration, setHasExpiration] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  useEffect(() => {
    if (user) {
      loadDocuments();
      checkRecordingHost();
    }
  }, [user]);

  useEffect(() => {
    const eventSource = new EventSource('/api/sse/documentation');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'documentation_updated') {
        loadDocuments();
      }
    };

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    if (!loadingDocs && documents.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const docId = params.get('id');
      if (docId) {
        const doc = documents.find(d => d.id === docId);
        if (doc) {
          setSelectedDoc(doc);
          window.history.replaceState({}, '', '/company-education/documentation');
        }
      }
    }
  }, [documents, loadingDocs]);

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documentation');
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const checkRecordingHost = async () => {
    try {
      const response = await fetch('/api/documentation/check-host');
      const data = await response.json();
      setIsRecordingHost(data.isHost);
    } catch (error) {
      console.error('Error checking host status:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`/api/documentation/delete?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadDocuments();
      } else {
        const data = await response.json();
        alert(data.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Delete failed');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'png', 'jpg', 'jpeg', 'tiff', 'tif'];
    const fileExt = file.name.toLowerCase().split('.').pop();
    
    if (!allowedExts.includes(fileExt)) {
      alert('Unsupported file type. Supported formats: PDF, Word, Excel, PowerPoint, images, text files.');
      e.target.value = '';
      return;
    }

    setPendingFile(file);
    setShowExpirationModal(true);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!pendingFile) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadStage('Preparing upload...');

    try {
      // Get presigned URL
      const uploadData = {
        fileName: pendingFile.name,
        fileType: pendingFile.type
      };
      
      if (hasExpiration && expirationDate) {
        uploadData.expirationDate = expirationDate;
      }

      const response = await fetch('/api/documentation/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to prepare upload');
      }

      const { uploadUrl, id } = await response.json();
      setUploadingDocId(id);
      
      // Upload to S3
      setUploadProgress(10);
      setUploadStage('Uploading to cloud...');
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: pendingFile,
        headers: {
          'Content-Type': pendingFile.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Processing stage
      setUploadProgress(40);
      setUploadStage('Processing document...');
      
      const processingInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(processingInterval);
            return 90;
          }
          return prev + 2;
        });
      }, 300);

      // Poll for completion
      const startTime = Date.now();
      const checkCompletion = async () => {
        try {
          const checkResponse = await fetch('/api/documentation');
          const checkData = await checkResponse.json();
          const uploadedDoc = checkData.documents?.find(doc => doc.id === id);
          
          if (uploadedDoc && uploadedDoc.extractionStatus === 'completed') {
            clearInterval(processingInterval);
            setUploadProgress(100);
            setUploadStage('Complete');
            
            setTimeout(() => {
              setUploading(false);
              setUploadProgress(0);
              setUploadStage('');
              setUploadingDocId(null);
              loadDocuments();
            }, 1000);
            return;
          }
          
          if (Date.now() - startTime > 60000) { // 60 second timeout
            clearInterval(processingInterval);
            setUploadProgress(100);
            setUploadStage('Processing in background');
            setTimeout(() => {
              setUploading(false);
              setUploadProgress(0);
              setUploadStage('');
              setUploadingDocId(null);
              loadDocuments();
            }, 2000);
            return;
          }
          
          setTimeout(checkCompletion, 2000);
        } catch (error) {
          console.error('Error checking completion:', error);
          setTimeout(checkCompletion, 3000);
        }
      };
      
      setTimeout(checkCompletion, 3000);
      
      // Reset modal state
      setShowExpirationModal(false);
      setPendingFile(null);
      setHasExpiration(false);
      setExpirationDate('');
    } catch (error) {
      console.error('Upload error:', error);
      alert(error.message || 'Upload failed');
      setUploading(false);
      setUploadProgress(0);
      setUploadStage('');
      setUploadingDocId(null);
      setShowExpirationModal(false);
      setPendingFile(null);
      setHasExpiration(false);
      setExpirationDate('');
    }
  };

  const filteredDocs = documents.filter(doc =>
    doc.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.uploadedBy?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AccessCheck requiredModule="company-education">
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={logout} />
        
        <SidebarLayout user={user}>
          <div className="p-8">
            <Breadcrumb items={[
              { label: 'Company Education', href: '/company-education' },
              { label: 'Documentation' }
            ]} />
            
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Documentation</h1>
              <p className="text-gray-600">Upload and access training documentation</p>
            </div>

            <div className="card">
              <div className="mb-6 flex gap-4">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {isRecordingHost && (
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors" title="Supported formats: PDF, Word, Excel, PowerPoint, images, text files">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      {uploading ? 'Processing...' : 'Upload Document'}
                      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.tiff,.tif" className="hidden" onChange={handleFileSelect} disabled={uploading} />
                    </label>
                    {uploading && (
                      <div className="w-64">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span className="font-medium">{uploadStage}</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {uploadStage === 'Preparing upload...' && 'Getting upload credentials'}
                          {uploadStage === 'Uploading to cloud...' && 'Transferring file to AWS S3'}
                          {uploadStage === 'Processing document...' && 'Extracting text with AWS Textract'}
                          {uploadStage === 'Complete' && 'Document ready for search'}
                          {uploadStage === 'Processing in background' && 'Upload complete, processing continues'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {loadingDocs ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
                  <p className="text-gray-600">Upload documents to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded By</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiration</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Extraction Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredDocs.map((doc) => (
                        <tr key={doc.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedDoc(doc)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(doc.uploadedAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {doc.fileName}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {doc.uploadedBy}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {doc.expirationDate ? (
                              <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                new Date(doc.expirationDate) < new Date() 
                                  ? 'bg-red-100 text-red-800' 
                                  : new Date(doc.expirationDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {new Date(doc.expirationDate) < new Date() ? 'Expired' : new Date(doc.expirationDate).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-gray-400">No expiration</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {(() => {
                              const status = doc.extractionStatus || 'pending';
                              const statusColors = {
                                pending: 'bg-yellow-100 text-yellow-800',
                                completed: 'bg-green-100 text-green-800',
                                failed: 'bg-red-100 text-red-800'
                              };
                              return (
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
                                    {status === 'pending' ? 'Processing' : status === 'completed' ? 'Complete' : status === 'failed' ? 'Failed' : status}
                                  </span>
                                  {status === 'pending' && (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                                  )}
                                </div>
                              );
                            })()} 
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <a
                                href={`/api/documentation/download?id=${doc.id}`}
                                className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                                download
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download
                              </a>
                              {(user?.isAdmin || doc.uploadedBy === user?.email) && (
                                <button
                                  onClick={() => handleDelete(doc.id)}
                                  className="inline-flex items-center px-3 py-1 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
                                >
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </SidebarLayout>
      </div>

      {selectedDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedDoc(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Document Details</h3>
              <button onClick={() => setSelectedDoc(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">File Name</label>
                <p className="text-gray-900 mt-1">{selectedDoc.fileName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Uploaded By</label>
                <p className="text-gray-900 mt-1">{selectedDoc.uploadedBy}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Upload Date</label>
                <p className="text-gray-900 mt-1">{new Date(selectedDoc.uploadedAt).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">File Size</label>
                <p className="text-gray-900 mt-1">
                  {selectedDoc.fileSize ? `${(selectedDoc.fileSize / 1024).toFixed(2)} KB` : 'Processing...'}
                </p>
              </div>
              {selectedDoc.expirationDate && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Expiration Date</label>
                  <p className={`mt-1 font-medium ${
                    new Date(selectedDoc.expirationDate) < new Date() 
                      ? 'text-red-600' 
                      : new Date(selectedDoc.expirationDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    {new Date(selectedDoc.expirationDate).toLocaleDateString()}
                    {new Date(selectedDoc.expirationDate) < new Date() && ' (Expired)'}
                  </p>
                </div>
              )}
              {selectedDoc.extractionStatus && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Text Extraction Status</label>
                  <p className="text-gray-900 mt-1 capitalize">{selectedDoc.extractionStatus}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <a
                href={`/api/documentation/download?id=${selectedDoc.id}`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                download
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </a>
              {(user?.isAdmin || selectedDoc.uploadedBy === user?.email) && (
                <button
                  onClick={() => {
                    setSelectedDoc(null);
                    handleDelete(selectedDoc.id);
                  }}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showExpirationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Document Expiration</h3>
              <p className="text-sm text-gray-600 mt-1">Set an expiration date for this document</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Selected File</label>
                <p className="text-gray-900 mt-1 font-medium">{pendingFile?.name}</p>
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="expiration"
                    checked={!hasExpiration}
                    onChange={() => {
                      setHasExpiration(false);
                      setExpirationDate('');
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">No expiration date</span>
                </label>
                
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="expiration"
                    checked={hasExpiration}
                    onChange={() => setHasExpiration(true)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Set expiration date</span>
                </label>
              </div>
              
              {hasExpiration && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    After this date, the document will be excluded from ChatNPT responses
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowExpirationModal(false);
                  setPendingFile(null);
                  setHasExpiration(false);
                  setExpirationDate('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={hasExpiration && !expirationDate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Upload Document
              </button>
            </div>
          </div>
        </div>
      )}
    </AccessCheck>
  );
}
