'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [appName, setAppName] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAppName = async (force = false) => {
    // Skip if already loaded and not forced
    if (appName && !force) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch('/api/settings/general');
      const data = await response.json();
      const name = data.appName || 'Practice Tools';
      setAppName(name);
      
      // Update document title
      if (typeof document !== 'undefined') {
        document.title = name;
      }
    } catch (error) {
      console.error('Error loading app name:', error);
      const fallbackName = 'Practice Tools';
      setAppName(fallbackName);
      if (typeof document !== 'undefined') {
        document.title = fallbackName;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppName();

    // SSE connection for real-time updates
    let eventSource;
    const connectSSE = () => {
      eventSource = new EventSource('/api/events?issueId=all');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'general-settings-update') {
            loadAppName(true); // Force reload on SSE update
          }
        } catch (error) {
          console.error('SSE parsing error:', error);
        }
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const updateAppName = (newName) => {
    setAppName(newName);
    if (typeof document !== 'undefined') {
      document.title = newName || 'Practice Tools';
    }
  };

  return (
    <AppContext.Provider value={{ appName, loading, updateAppName, loadAppName }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}