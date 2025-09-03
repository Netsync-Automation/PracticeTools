// Comprehensive timezone management system for consistent timestamp handling
// Detects user timezone and converts UTC timestamps for display

export class TimezoneManager {
  static getUserTimezone() {
    if (typeof window !== 'undefined') {
      // Client-side: Use browser's timezone
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch (error) {
        return 'America/Chicago'; // Fallback
      }
    } else {
      // Server-side: Use environment variable or default
      return process.env.DEFAULT_TIMEZONE || 'America/Chicago';
    }
  }

  static formatTimestamp(utcTimestamp, userTimezone = null, options = {}) {
    if (!utcTimestamp) return 'Unknown time';
    
    const timezone = userTimezone || this.getUserTimezone();
    
    try {
      const date = new Date(utcTimestamp);
      
      // Validate date
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      const defaultOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      
      const formatOptions = { ...defaultOptions, ...options };
      
      return new Intl.DateTimeFormat('en-US', formatOptions).format(date);
    } catch (error) {
      console.error('Timezone formatting error:', error);
      return 'Unknown time';
    }
  }

  static formatRelativeTime(utcTimestamp, userTimezone = null) {
    if (!utcTimestamp) return 'Unknown time';
    
    try {
      const date = new Date(utcTimestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      // For older dates, show formatted date in user's timezone
      return this.formatTimestamp(utcTimestamp, userTimezone, {
        month: 'short',
        day: 'numeric',
        year: diffDays > 365 ? 'numeric' : undefined
      });
    } catch (error) {
      return this.formatTimestamp(utcTimestamp, userTimezone);
    }
  }

  static getTimezoneOffset(timezone = null) {
    const tz = timezone || this.getUserTimezone();
    try {
      const now = new Date();
      const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
      const target = new Date(utc.toLocaleString('en-US', { timeZone: tz }));
      return (target.getTime() - utc.getTime()) / (1000 * 60 * 60);
    } catch (error) {
      return 0;
    }
  }

  static convertToUserTimezone(utcTimestamp, userTimezone = null) {
    if (!utcTimestamp) return null;
    
    const timezone = userTimezone || this.getUserTimezone();
    
    try {
      const date = new Date(utcTimestamp);
      return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    } catch (error) {
      return new Date(utcTimestamp);
    }
  }

  // For WebEx notifications - always use consistent timezone
  static formatForWebEx(utcTimestamp, userTimezone = null) {
    return this.formatTimestamp(utcTimestamp, userTimezone, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // Client-side hook for React components
  static useUserTimezone() {
    if (typeof window === 'undefined') return 'America/Chicago';
    
    // Store in localStorage for consistency
    const stored = localStorage.getItem('userTimezone');
    if (stored) return stored;
    
    const detected = this.getUserTimezone();
    localStorage.setItem('userTimezone', detected);
    return detected;
  }
}