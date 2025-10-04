import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast';

export function useAssumedUsers() {
  const [loading, setLoading] = useState(false);
  const { toasts, success, error } = useToast();

  const handleUserCreated = useCallback(async (newUser, assumedUser, assignmentId, fieldType, assignmentType = 'assignment') => {
    setLoading(true);
    try {
      const apiPath = assignmentType === 'sa-assignment' 
        ? `/api/sa-assignments/${assignmentId}/update-assumed-user`
        : `/api/assignments/${assignmentId}/update-assumed-user`;
        
      const response = await fetch(apiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assumedUser,
          newUser,
          fieldType
        })
      });

      if (response.ok) {
        success('Assignment updated with new user');
        window.location.reload();
      } else {
        error('Failed to update assignment');
      }
    } catch (error) {
      error('Error updating assignment');
    } finally {
      setLoading(false);
    }
  }, []);

  const parseUserField = useCallback((userField) => {
    if (!userField) return null;
    
    // Parse "Name <email>" format (with optional (assumed) suffix)
    const match = userField.match(/^(.+?)\s*<([^>]+)>/);
    if (match) {
      return {
        name: match[1].trim(),
        email: match[2].trim(),
        isAssumed: userField.includes('(assumed)') || !userField.includes('@netsync.com')
      };
    }
    
    // Fallback for plain text
    return {
      name: userField,
      email: userField.includes('@') ? userField : null,
      isAssumed: true
    };
  }, []);

  return {
    loading,
    handleUserCreated,
    parseUserField,
    toasts
  };
}