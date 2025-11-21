'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';

export default function FileUploadProgress({ uploads, onCancel }) {
  if (!uploads || uploads.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <h3 className="text-sm font-semibold text-gray-900">Uploading Files</h3>
      </div>
      <div className="p-4 space-y-3">
        {uploads.map((upload) => (
          <div key={upload.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{upload.filename}</p>
                <p className="text-xs text-gray-500">
                  {upload.progress === 100 ? 'Complete' : `${upload.progress}%`}
                  {upload.size && ` • ${(upload.size / 1024 / 1024).toFixed(2)} MB`}
                </p>
              </div>
              {upload.progress < 100 && onCancel && (
                <button
                  onClick={() => onCancel(upload.id)}
                  className="ml-2 text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                  title="Cancel upload"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  upload.progress === 100
                    ? 'bg-green-500'
                    : upload.error
                    ? 'bg-red-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${upload.progress}%` }}
              />
            </div>
            {upload.error && (
              <p className="text-xs text-red-600">{upload.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
