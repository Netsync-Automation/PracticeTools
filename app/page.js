'use client';

import { useAuth } from '../hooks/useAuth.js';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Navbar from '../components/Navbar.js';

export default function HomePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={logout} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to Practice Tools
            </h1>
            <p className="text-xl text-gray-600">
              A comprehensive development platform with authentication, versioning, and notifications
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🔐 Authentication
              </h3>
              <p className="text-gray-600 mb-4">
                Secure authentication system with role-based access control
              </p>
              <div className="text-sm text-gray-500">
                Current user: {user.name} ({user.role})
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                📦 Versioning
              </h3>
              <p className="text-gray-600 mb-4">
                Automated versioning system with semantic versioning compliance
              </p>
              <button 
                onClick={() => router.push('/release-notes')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View Release Notes →
              </button>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🌐 WebEx Integration
              </h3>
              <p className="text-gray-600 mb-4">
                Rich WebEx notifications with adaptive cards
              </p>
              <div className="text-sm text-gray-500">
                Room: {process.env.NEXT_PUBLIC_WEBEX_ROOM_NAME || 'Not configured'}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🕒 Timezone Management
              </h3>
              <p className="text-gray-600 mb-4">
                Automatic timezone detection and timestamp formatting
              </p>
              <div className="text-sm text-gray-500">
                Your timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🔄 Environment Management
              </h3>
              <p className="text-gray-600 mb-4">
                Production/development environment isolation
              </p>
              <div className="text-sm text-gray-500">
                Environment: {process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev'}
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                🛡️ Breaking Change Control
              </h3>
              <p className="text-gray-600 mb-4">
                Comprehensive system for preventing breaking changes
              </p>
              <div className="text-sm text-gray-500">
                BCPP enabled for all commits
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Getting Started
            </h2>
            <div className="max-w-2xl mx-auto text-gray-600">
              <p className="mb-4">
                This Practice Tools application integrates all the features from the Features library
                into a cohesive development platform. Each feature is properly organized and follows
                industry best practices for web development and security.
              </p>
              <p>
                Use the navigation above to explore different sections of the application,
                or check the release notes to see what's new in the latest version.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}