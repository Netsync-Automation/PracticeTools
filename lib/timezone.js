export class TimezoneManager {
  static getUserTimezone() {
    if (typeof window !== 'undefined') {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch (error) {
        return 'America/Chicago';
      }
    } else {
      return process.env.DEFAULT_TIMEZONE || 'America/Chicago';
    }
  }

  static formatTimestamp(utcTimestamp, userTimezone = null, options = {}) {
    if (!utcTimestamp) return 'Unknown time';
    
    const timezone = userTimezone || this.getUserTimezone();
    
    try {
      const date = new Date(utcTimestamp);
      
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
      
      return this.formatTimestamp(utcTimestamp, userTimezone, {
        month: 'short',
        day: 'numeric',
        year: diffDays > 365 ? 'numeric' : undefined
      });
    } catch (error) {
      return this.formatTimestamp(utcTimestamp, userTimezone);
    }
  }

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
}