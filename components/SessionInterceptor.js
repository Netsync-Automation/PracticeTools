'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SessionInterceptor() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.fetch) return;
    
    let isRedirecting = false;

    const handleSessionExpired = () => {
      if (isRedirecting) return;
      isRedirecting = true;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('user');
      }
      router.push('/login');
    };

    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      if (response.status === 401 && !args[0].includes('/api/auth/login')) {
        handleSessionExpired();
      }
      
      return response;
    };

    return () => {
      if (typeof window !== 'undefined' && originalFetch) {
        window.fetch = originalFetch;
      }
    };
  }, [router]);

  return null;
}