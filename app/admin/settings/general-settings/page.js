'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import Breadcrumb from '../../../../components/Breadcrumb';
import { useAuth } from '../../../../hooks/useAuth';
import { useApp } from '../../../../contexts/AppContext';

export default function GeneralSettingsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { updateAppName } = useApp();
  const [settings, setSettings] = useState({
    appName: 'Issue Tracker',
    loginLogo: null,
    navbarLogo: null,
    maxFileSize: '10',
    allowedFileTypes: '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg',
    autoCloseIssues: false
  });
  const [saving, setSaving] = useState(false);

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
    if (user && !user.isAdmin) {
      router.push('/');
      return;
    }
    
    if (user) {
      const loadData = async () => {
        try {
          const response = await fetch('/api/settings/general?t=' + Date.now());
          const data = await response.json();
          setSettings(prev => ({
            ...prev,
            appName: data.appName || 'Practice Tools',
            loginLogo: data.loginLogo,
            navbarLogo: data.navbarLogo,
            allowedFileTypes: data.allowedFileTypes || '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg'
          }));
        } catch (error) {
          console.error('Error loading general settings:', error);
        }
      };
      loadData();
    }
  }, [user, router]);

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          appName: settings.appName?.trim(),
          loginLogo: settings.loginLogo,
          navbarLogo: settings.navbarLogo,
          allowedFileTypes: settings.allowedFileTypes?.trim()
        })
      });
      
      if (response.ok) {
        alert('General settings saved successfully!');
      } else {
        const result = await response.json();
        alert('Failed to save: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error saving general settings');
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={logout} />
      
      <SidebarLayout user={user}>
        <div className="p-8">
          <Breadcrumb items={[
            { label: 'Settings', href: '/admin/settings/general-settings' },
            { label: 'General Settings' }
          ]} />
          
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">General Settings</h1>
                <p className="text-gray-600">Configure application identity, file management, and system behavior</p>
              </div>
            </div>
          </div>

          <div className="card mb-6">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
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
                      tab.id === 'general'
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
          </div>

          <div className="space-y-8">

            {/* Application Identity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Application Identity</h3>
                  <p className="text-sm text-gray-600">Configure your application name and branding</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Application Name</label>
                  <input
                    type="text"
                    value={settings.appName}
                    onChange={(e) => {
                      setSettings({...settings, appName: e.target.value});
                      updateAppName(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter application name"
                  />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Login Page Logo</label>
                    <div className="space-y-3">
                      {settings.loginLogo && (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <img src={settings.loginLogo} alt="Login Logo" className="h-16 w-auto border rounded" />
                          <span className="text-sm text-gray-600">Current login logo</span>
                        </div>
                      )}
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                alert('File size must be less than 5MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                setSettings({...settings, loginLogo: e.target.result});
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <p className="text-xs text-gray-500">Upload image for login page (max 5MB)</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Navigation Bar Logo</label>
                    <div className="space-y-3">
                      {settings.navbarLogo && (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <img src={settings.navbarLogo} alt="Navbar Logo" className="h-8 w-auto border rounded" />
                          <span className="text-sm text-gray-600">Current navbar logo</span>
                        </div>
                      )}
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                alert('File size must be less than 5MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                setSettings({...settings, navbarLogo: e.target.result});
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <p className="text-xs text-gray-500">Upload image for navigation bar (max 5MB)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* File Management */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">File Management</h3>
                  <p className="text-sm text-gray-600">Configure file upload restrictions and allowed types</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Maximum File Size (MB)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={settings.maxFileSize}
                    onChange={(e) => setSettings({...settings, maxFileSize: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum size for uploaded files</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Allowed File Types</label>
                  <input
                    type="text"
                    value={settings.allowedFileTypes}
                    onChange={(e) => setSettings({...settings, allowedFileTypes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Comma-separated file extensions</p>
                </div>
              </div>
            </div>

            {/* System Behavior */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">System Behavior</h3>
                  <p className="text-sm text-gray-600">Configure automated system behaviors and preferences</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="autoClose"
                    checked={settings.autoCloseIssues}
                    onChange={(e) => setSettings({...settings, autoCloseIssues: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                  />
                  <div className="flex-1">
                    <label htmlFor="autoClose" className="block text-sm font-medium text-gray-900">
                      Auto-close resolved issues
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Automatically close issues that have been resolved for 30 days
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-start">
              <button
                onClick={handleSaveGeneral}
                disabled={saving}
                className={`${saving ? 'btn-disabled' : 'btn-primary'} flex items-center gap-2`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </SidebarLayout>
    </div>
  );
}
