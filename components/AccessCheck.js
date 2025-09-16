'use client';

import { useState, useEffect } from 'react';

export default function AccessCheck({ user, children }) {
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const checkAccess = async () => {
      // If user prop is provided, use it directly (avoid duplicate API calls)
      if (user) {
        // Local auth users already validated
        if (user.auth_method !== 'sso') {
          setHasAccess(true);
          setLoading(false);
          return;
        }

        // Check cache first for SSO users
        const cacheKey = `access_${user.email}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setHasAccess(cached === 'true');
          setLoading(false);
          return;
        }

        // SSO user prop available, grant access
        setHasAccess(true);
        setLoading(false);
        return;
      }
      
      // Only check session API if no user prop provided
      try {
        const response = await fetch('/api/auth/check-session');
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            setHasAccess(true);
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        // Silent error handling
      }
      
      // If no user and session check failed, retry once after short delay
      if (retryCount === 0) {
        setTimeout(() => {
          setRetryCount(1);
        }, 500);
        return;
      }
      
      setHasAccess(false);
      setLoading(false);
    };

    checkAccess();
  }, [user, retryCount]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You do not have access to this system. Please contact your administrator to request access.
          </p>
          {user?.email && (
            <p className="text-sm text-gray-500 mb-4">
              Authenticated as: {user.email}
            </p>
          )}
          <button
            onClick={() => {
              if (user?.email) {
                sessionStorage.removeItem(`access_${user.email}`);
              }
              setRetryCount(0);
              setLoading(true);
              setHasAccess(null);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry Access Check
          </button>
        </div>
      </div>
    );
  }

  return children;
}