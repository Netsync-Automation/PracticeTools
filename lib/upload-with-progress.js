const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export async function uploadFilesWithProgress(files, onProgress, onComplete, onError) {
  const uploadPromises = files.map(file => uploadFileMultipart(file, onProgress, onComplete, onError));
  return Promise.all(uploadPromises);
}

async function uploadFileMultipart(file, onProgress, onComplete, onError) {
  const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Initiate multipart upload
    const initRes = await fetch('/api/files/multipart-upload/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, fileType: file.type })
    });
    const { uploadId, s3Key, fileId: serverFileId } = await initRes.json();

    // Calculate chunks
    const chunks = Math.ceil(file.size / CHUNK_SIZE);
    const parts = [];
    let uploadedBytes = 0;

    // Upload each chunk
    for (let i = 0; i < chunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      // Get presigned URL
      const presignRes = await fetch('/api/files/multipart-upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key, uploadId, partNumber: i + 1 })
      });
      const { presignedUrl } = await presignRes.json();

      // Upload chunk
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: chunk
      });

      const etag = uploadRes.headers.get('ETag');
      parts.push({ PartNumber: i + 1, ETag: etag });

      uploadedBytes += chunk.size;
      const progress = Math.round((uploadedBytes / file.size) * 100);
      onProgress?.(fileId, progress, file.name, file.size);
    }

    // Complete upload
    const completeRes = await fetch('/api/files/multipart-upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ s3Key, uploadId, parts, filename: file.name, fileSize: file.size, fileType: file.type, fileId: serverFileId })
    });
    const result = await completeRes.json();

    onComplete?.(fileId, result);
    return result;
  } catch (error) {
    onError?.(fileId, error.message);
    throw error;
  }
}
