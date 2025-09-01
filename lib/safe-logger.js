// Safe logger for server-side operations
export const logger = {
  info: (message, data = {}) => {
    console.log(`[INFO] ${message}`, data);
  },
  
  error: (message, error = {}) => {
    console.error(`[ERROR] ${message}`, error);
  },
  
  warn: (message, data = {}) => {
    console.warn(`[WARN] ${message}`, data);
  },
  
  debug: (message, data = {}) => {
    console.log(`[DEBUG] ${message}`, data);
  }
};