'use client';

import { useState, useEffect } from 'react';
import { TimezoneManager } from '../lib/timezone.js';

export default function TimestampDisplay({ 
  timestamp, 
  format = 'full', 
  timezone = null,
  className = '' 
}) {
  const [formattedTime, setFormattedTime] = useState('Loading...');
  const [userTimezone, setUserTimezone] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tz = timezone || TimezoneManager.getUserTimezone();
      setUserTimezone(tz);
      
      if (timestamp) {
        let formatted;
        switch (format) {
          case 'relative':
            formatted = TimezoneManager.formatRelativeTime(timestamp, tz);
            break;
          case 'webex':
            formatted = TimezoneManager.formatForWebEx(timestamp, tz);
            break;
          case 'full':
          default:
            formatted = TimezoneManager.formatTimestamp(timestamp, tz);
            break;
        }
        setFormattedTime(formatted);
      }
    }
  }, [timestamp, format, timezone]);

  if (!timestamp) {
    return <span className={className}>Unknown time</span>;
  }

  return (
    <span 
      className={className}
      title={userTimezone ? `${formattedTime} (${userTimezone})` : formattedTime}
    >
      {formattedTime}
    </span>
  );
}