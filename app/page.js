'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../components/Navbar';
import SidebarLayout from '../components/SidebarLayout';
import AccessCheck from '../components/AccessCheck';
import { useApp } from '../contexts/AppContext';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { appName } = useApp();

  useEffect(() => {
    const checkAuth = async () => {
      try {
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
      } catch (error) {
        console.error('Error checking session:', error);
      }
      
      // Check localStorage as fallback
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setLoading(false);
          return;
        } catch {
          localStorage.removeItem('user');
        }
      }
      
      // No valid authentication found
      router.replace('/login');
    };
    
    // App name is now managed by AppProvider
    
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AccessCheck user={user}>
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={handleLogout} />
        
        <SidebarLayout user={user}>
          <div className="p-8">
            {/* Dashboard Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-3">
                Welcome to {appName || 'Practice Tools'}
              </h1>
              <p className="text-gray-600 text-lg">
                Your comprehensive practice management dashboard
              </p>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-500">Recent activity will appear here</p>
              </div>
            </div>
          </div>
        </SidebarLayout>
      </div>
    </AccessCheck>
  );
}