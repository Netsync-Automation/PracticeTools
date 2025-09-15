import { useState, useEffect } from 'react';

export function useCsrf() {
  const [csrfToken, setCsrfToken] = useState(null);

  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        setCsrfToken(data.token);
      } catch (error) {
        // Error fetching CSRF token - continue without protection
      }
    };

    fetchCsrfToken();
  }, []);

  const getHeaders = () => {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    
    return headers;
  };

  return { csrfToken, getHeaders };
}