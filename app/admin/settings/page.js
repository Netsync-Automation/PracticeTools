'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import SidebarLayout from '../../../components/SidebarLayout';
import Breadcrumb from '../../../components/Breadcrumb';
import { useAuth } from '../../../hooks/useAuth';

export default function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  const tabs = [
    { id: 'general', name: 'General Settings', icon: '⚙️', href: '/admin/settings/general-settings' },
    { id: 'users', name: 'User Management', icon: '👥', href: '/admin/settings/user-management' },
    { id: 'modules', name: 'Module Settings', icon: '🧩', href: '/admin/settings/module-settings' },
    { id: 'webex', name: 'WebEx Settings', icon: '💬', href: '/admin/settings/webex-settings' },
    { id: 'email', name: 'E-mail Settings', icon: '📧', href: '/admin/settings/email-settings' },
    { id: 'resources', name: 'E-mail Processing Rules', icon: '📧', href: '/admin/settings/email-processing' },
    { id: 'sso', name: 'SSO Settings', icon: '🔐', href: '/admin/settings/sso-settings' },
    { id: 'company-edu', name: 'Company EDU', icon: '🎓', href: '/admin/settings/company-edu' }
  ];

  const isNonAdminPracticeUser = user && !user.isAdmin && (user.role === 'practice_manager' || user.role === 'practice_principal');

  useEffect(() => {
    if (user && !user.isAdmin && user.role !== 'practice_manager' && user.role !== 'practice_principal') {
      router.push('/');
      return;
    }
    
    // Redirect to general settings if on base settings page
    if (pathname === '/admin/settings') {
      router.push('/admin/settings/general-settings');
    }
  }, [user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={logout} />
      
      <SidebarLayout user={user}>
        <div className="p-8">
          <Breadcrumb items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Settings' }
          ]} />
          
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">App Settings</h1>
                <p className="text-gray-600">Configure application settings and preferences</p>
              </div>
            </div>
          </div>

          <div className="card">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (isNonAdminPracticeUser && tab.id !== 'users') {
                        alert('Access restricted. You can only access User Management.');
                        return;
                      }
                      router.push(tab.href);
                    }}
                    className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                      pathname === tab.href
                        ? 'border-blue-500 text-blue-600'
                        : isNonAdminPracticeUser && tab.id !== 'users'
                        ? 'border-transparent text-gray-300 cursor-not-allowed'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    disabled={isNonAdminPracticeUser && tab.id !== 'users'}
                  >
                    <span>{tab.icon}</span>
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>

            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Redirecting...</p>
            </div>
          </div>
        </div>
      </SidebarLayout>
    </div>
  );
}
