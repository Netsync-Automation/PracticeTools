import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  const success = (message) => showToast(message, 'success');
  const error = (message) => showToast(message, 'error');

  return { toasts, success, error };
}

export function ToastContainer({ toasts }) {
  if (!toasts?.length) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center p-4 rounded-lg shadow-lg ${
            toast.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 mr-2" />
          ) : (
            <XCircleIcon className="h-5 w-5 mr-2" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}