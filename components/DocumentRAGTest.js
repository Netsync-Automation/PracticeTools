'use client';

import { useState } from 'react';

export default function DocumentRAGTest() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [query, setQuery] = useState('');
  const [querying, setQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState(null);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      // Get presigned URL
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Upload directly to S3
      const uploadResponse = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      if (!uploadResponse.ok) throw new Error('Upload failed');

      setUploadResult({
        success: true,
        fileId: data.fileId,
        s3Key: data.s3Key,
        message: 'File uploaded successfully. Processing will begin automatically.'
      });
    } catch (error) {
      setUploadResult({ success: false, error: error.message });
    } finally {
      setUploading(false);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setQuerying(true);
    try {
      const response = await fetch('/api/documents/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setQueryResult(data);
    } catch (error) {
      setQueryResult({ error: error.message });
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Document RAG System Test</h1>
      
      {/* Upload Section */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Upload Document</h2>
        <form onSubmit={handleFileUpload} className="space-y-4">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            type="submit"
            disabled={!file || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </form>
        
        {uploadResult && (
          <div className={`mt-4 p-4 rounded ${uploadResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {uploadResult.success ? uploadResult.message : uploadResult.error}
          </div>
        )}
      </div>

      {/* Query Section */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Query Documents</h2>
        <form onSubmit={handleQuery} className="space-y-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about your documents..."
            className="w-full p-3 border rounded-lg resize-none"
            rows={3}
          />
          <button
            type="submit"
            disabled={!query.trim() || querying}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          >
            {querying ? 'Searching...' : 'Ask Question'}
          </button>
        </form>

        {queryResult && (
          <div className="mt-6 space-y-4">
            {queryResult.error ? (
              <div className="p-4 bg-red-50 text-red-800 rounded">
                {queryResult.error}
              </div>
            ) : (
              <>
                <div className="p-4 bg-blue-50 rounded">
                  <h3 className="font-semibold mb-2">Answer:</h3>
                  <p>{queryResult.answer}</p>
                </div>
                
                {queryResult.sources && queryResult.sources.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded">
                    <h3 className="font-semibold mb-2">Sources ({queryResult.sources.length}):</h3>
                    <div className="space-y-2">
                      {queryResult.sources.map((source, idx) => (
                        <div key={idx} className="p-2 bg-white rounded border text-sm">
                          <div className="font-medium">{source.documentId}</div>
                          <div className="text-gray-600 truncate">{source.text}</div>
                          <div className="text-xs text-gray-500">Score: {source.score?.toFixed(3)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}