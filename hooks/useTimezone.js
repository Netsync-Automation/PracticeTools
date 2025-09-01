import { useState, useEffect } from 'react';
import { TimezoneManager } from '../lib/timezone-manager';

export function useTimezone() {
  const [userTimezone, setUserTimezone] = useState('America/Chicago');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Detect user's timezone
    const detected = TimezoneManager.getUserTimezone();
    setUserTimezone(detected);
    
    // Store for consistency
    if (typeof window !== 'undefined') {
      localStorage.setItem('userTimezone', detected);
    }
  }, []);

  const formatTimestamp = (utcTimestamp, options = {}) => {
    return TimezoneManager.formatTimestamp(utcTimestamp, userTimezone, options);
  };

  const formatRelativeTime = (utcTimestamp) => {
    return TimezoneManager.formatRelativeTime(utcTimestamp, userTimezone);
  };

  return {
    userTimezone,
    isClient,
    formatTimestamp,
    formatRelativeTime
  };
}