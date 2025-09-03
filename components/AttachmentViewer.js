'use client';

import { useState, useEffect } from 'react';
import { DocumentIcon, PhotoIcon, EyeIcon, ArrowDownTrayIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { generatePresignedUrl } from '../lib/s3';

export default function AttachmentViewer({ attachments, user }) {
  const [urls, setUrls] = useState({});
  const [showPreview, setShowPreview] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchUrls = async () => {
      const urlMap = {};
      for (const attachment of attachments) {
        try {
          const url = await generatePresignedUrl(attachment.path, attachment.filename);
          if (url) {
            urlMap[attachment.path] = url;
          }
        } catch (error) {
          console.error('Error generating URL for', attachment.filename, error);
        }
      }
      setUrls(urlMap);
    };

    if (attachments.length > 0) {
      fetchUrls();
    }
  }, [attachments]);

  const getFileType = (filename) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'document';
    if (['xls', 'xlsx'].includes(ext)) return 'spreadsheet';
    if (['ppt', 'pptx'].includes(ext)) return 'presentation';
    if (['txt', 'md'].includes(ext)) return 'text';
    if (['zip', 'rar', '7z'].includes(ext)) return 'archive';
    return 'file';
  };



  const getFileColor = (type) => {
    switch (type) {
      case 'image': return 'from-purple-500 to-pink-500';
      case 'pdf': return 'from-red-500 to-red-600';
      case 'document': return 'from-blue-500 to-blue-600';
      case 'spreadsheet': return 'from-green-500 to-green-600';
      case 'presentation': return 'from-orange-500 to-orange-600';
      case 'text': return 'from-gray-500 to-gray-600';
      case 'archive': return 'from-yellow-500 to-yellow-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const openPreview = (attachment, index) => {
    setCurrentIndex(index);
    setShowPreview({ 
      url: urls[attachment.path], 
      filename: attachment.filename,
      size: attachment.size,
      type: getFileType(attachment.filename)
    });
  };

  const navigatePreview = (direction) => {
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % attachments.length
      : (currentIndex - 1 + attachments.length) % attachments.length;
    
    const attachment = attachments[newIndex];
    if (urls[attachment.path]) {
      openPreview(attachment, newIndex);
    }
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <p className="text-sm font-semibold text-gray-800">Attachments ({attachments.length})</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {attachments.map((attachment, index) => {
            const url = urls[attachment.path];
            const fileType = getFileType(attachment.filename);

            const colorClass = getFileColor(fileType);
            
            return (
              <div key={index} className="group relative bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-blue-300 transition-all duration-200 cursor-pointer"
                   onClick={() => url && openPreview(attachment, index)}>
                

                
                {/* Thumbnail/Icon Area */}
                <div className="mb-3">
                  {fileType === 'image' && url ? (
                    <div className="w-full h-24 bg-gray-100 rounded-lg overflow-hidden">
                      <img 
                        src={url} 
                        alt={attachment.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg hidden items-center justify-center">
                        <PhotoIcon className="h-8 w-8 text-gray-400" />
                      </div>
                    </div>
                  ) : (
                    <div className={`w-full h-24 bg-gradient-to-br ${colorClass} rounded-lg flex items-center justify-center`}>
                      <DocumentIcon className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>
                
                {/* File Info */}
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors" title={attachment.filename}>
                    {attachment.filename}
                  </h4>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="capitalize">{fileType}</span>
                    <span>{attachment.size ? formatFileSize(attachment.size) : '—'}</span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                {url && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openPreview(attachment, index);
                        }}
                        className="p-2 bg-white bg-opacity-90 hover:bg-opacity-100 text-blue-600 rounded-lg shadow-lg transform hover:scale-110 transition-all duration-150"
                        title="Preview"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      {user?.isAdmin && (
                        <a
                          href={url}
                          download={attachment.filename}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 bg-white bg-opacity-90 hover:bg-opacity-100 text-green-600 rounded-lg shadow-lg transform hover:scale-110 transition-all duration-150"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
                
                {!url && (
                  <div className="absolute inset-0 bg-gray-100 bg-opacity-50 rounded-xl flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Enhanced Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
          {/* Header */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-medium truncate max-w-md">{showPreview.filename}</h3>
                <p className="text-sm text-gray-300">
                  {showPreview.size ? formatFileSize(showPreview.size) : ''} • {currentIndex + 1} of {attachments.length}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {attachments.length > 1 && (
                <>
                  <button
                    onClick={() => navigatePreview('prev')}
                    className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all"
                    title="Previous"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => navigatePreview('next')}
                    className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all"
                    title="Next"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </>
              )}
              {user?.isAdmin && (
                <a
                  href={showPreview.url}
                  download={showPreview.filename}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all"
                  title="Download"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                </a>
              )}
              <button
                onClick={() => setShowPreview(null)}
                className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all"
                title="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="relative max-w-[90vw] max-h-[80vh] mt-16" onClick={(e) => e.stopPropagation()}>
            {showPreview.type === 'image' ? (
              <img
                src={showPreview.url}
                alt={showPreview.filename}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <div className="p-12 text-center bg-white rounded-lg shadow-2xl max-w-md">
                <div className={`w-20 h-20 mx-auto mb-6 bg-gradient-to-br ${getFileColor(showPreview.type)} rounded-2xl flex items-center justify-center`}>
                  <DocumentIcon className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{showPreview.filename}</h3>
                <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                {user?.isAdmin && (
                  <a
                    href={showPreview.url}
                    download={showPreview.filename}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Download File
                  </a>
                )}
              </div>
            )}
          </div>
          
          {/* Click outside to close */}
          <div 
            className="absolute inset-0 -z-10" 
            onClick={() => setShowPreview(null)}
          />
        </div>
      )}
    </>
  );
}