import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for session cookie and validate against database
        const response = await fetch('/api/auth/check-session');
        if (response.ok) {
          const sessionData = await response.json();
          if (sessionData.user) {
            setUser(sessionData.user);
            localStorage.setItem('user', JSON.stringify(sessionData.user));
            setLoading(false);
            return;
          }
        }
        
        // If session check fails, clear localStorage and redirect
        localStorage.removeItem('user');
        router.push('/login');
      } catch (error) {
        console.error('Error checking authentication:', error);
        localStorage.removeItem('user');
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('user');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('user');
      router.push('/login');
    }
  };

  return { user, loading, logout };
}