'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import Breadcrumb from '../../../../components/Breadcrumb';
import { useAuth } from '../../../../hooks/useAuth';

export default function EmailSettingsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [settings, setSettings] = useState({
    emailNotifications: false,
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPassword: ''
  });
  const [saving, setSaving] = useState(false);
  const [showTestEmail, setShowTestEmail] = useState(false);

  const getCSRFToken = async () => {
    try {
      const response = await fetch('/api/csrf-token');
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      return null;
    }
  };

  const tabs = [
    { id: 'general-settings', name: 'General Settings', href: '/admin/settings/general-settings' },
    { id: 'user-management', name: 'User Management', href: '/admin/settings/user-management' },
    { id: 'module-settings', name: 'Module Settings', href: '/admin/settings/module-settings' },
    { id: 'webex-settings', name: 'WebEx Settings', href: '/admin/settings/webex-settings' },
    { id: 'email-settings', name: 'Email Settings', href: '/admin/settings/email-settings' },
    { id: 'email-processing', name: 'E-mail Processing Rules', href: '/admin/settings/email-processing' },
    { id: 'sso-settings', name: 'SSO Settings', href: '/admin/settings/sso-settings' },
    { id: 'company-edu', name: 'Company EDU', href: '/admin/settings/company-edu' }
  ];

  useEffect(() => {
    if (!loading && user && !user.isAdmin && user.role !== 'practice_manager' && user.role !== 'practice_principal') {
      router.push('/');
      return;
    }

    if (user) {
      const loadData = async () => {
        try {
          const response = await fetch('/api/settings/email?t=' + Date.now());
          const data = await response.json();
          setSettings({
            emailNotifications: data.settings?.emailNotifications || false,
            smtpHost: data.settings?.smtpHost || '',
            smtpPort: data.settings?.smtpPort || '',
            smtpUser: data.settings?.smtpUser || '',
            smtpPassword: ''
          });
        } catch (error) {
          console.error('Error loading email settings:', error);
        }
      };
      loadData();
    }
  }, [user, loading, router]);

  const handleSaveEmail = async () => {
    setSaving(true);
    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        alert('Security token unavailable');
        return;
      }

      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(settings)
      });

      const data = await response.json();
      if (data.success) {
        alert('Email settings saved successfully');
      } else {
        alert('Failed to save email settings: ' + data.error);
      }
    } catch (error) {
      alert('Error saving email settings');
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

  if (!user.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={logout} />
      
      <SidebarLayout user={user}>
        <div className="p-8">
          <Breadcrumb items={[
            { label: 'Settings', href: '/admin/settings/general-settings' },
            { label: 'Email Settings' }
          ]} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Settings</h1>
            <p className="text-gray-600">Configure SMTP and email notification settings</p>
          </div>

          <div className="card">
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <a
                    key={tab.id}
                    href={tab.href}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      tab.id === 'email-settings'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.name}
                  </a>
                ))}
              </nav>
            </div>

            <div className="space-y-6">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="emailNotifications"
                  checked={settings.emailNotifications}
                  onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-900">
                  Enable email notifications
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Host</label>
                <input
                  type="text"
                  value={settings.smtpHost}
                  onChange={(e) => setSettings({...settings, smtpHost: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="smtp.gmail.com"
                />
                <p className="text-sm text-gray-500 mt-1">Stored securely in SMTP_HOST SSM parameter</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Port</label>
                <input
                  type="number"
                  value={settings.smtpPort}
                  onChange={(e) => setSettings({...settings, smtpPort: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="587"
                />
                <p className="text-sm text-gray-500 mt-1">Stored securely in SMTP_PORT SSM parameter</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Username</label>
                <input
                  type="text"
                  value={settings.smtpUser}
                  onChange={(e) => setSettings({...settings, smtpUser: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your-email@domain.com"
                />
                <p className="text-sm text-gray-500 mt-1">Stored securely in SMTP_USERNAME SSM parameter</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Password</label>
                <input
                  type="password"
                  value={settings.smtpPassword}
                  onChange={(e) => setSettings({...settings, smtpPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password to update"
                />
                <p className="text-sm text-gray-500 mt-1">Stored securely in SMTP_PW SSM parameter (encrypted)</p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveEmail}
                    disabled={saving}
                    className={`px-4 py-2 rounded-md font-medium ${
                      saving
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {saving ? 'Saving...' : 'Save Email Settings'}
                  </button>
                  
                  <button
                    onClick={() => setShowTestEmail(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Test Email
                  </button>
                  
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/ews/test', { method: 'POST' });
                        const data = await response.json();
                        
                        if (data.success) {
                          alert(`EWS Connection Successful!\n\nFolder: ${data.folderName}\nTotal Items: ${data.totalItems}\n\n${data.message}`);
                        } else {
                          let errorMsg = `EWS Connection Failed:\n\n${data.error}`;
                          if (data.diagnostics) {
                            errorMsg += '\n\nTroubleshooting Steps:';
                            data.diagnostics.suggestions.forEach((suggestion, i) => {
                              errorMsg += `\n${i + 1}. ${suggestion}`;
                            });
                          }
                          alert(errorMsg);
                        }
                      } catch (error) {
                        alert('EWS test failed: Unable to connect');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Test EWS
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Test SMTP configuration and EWS (Exchange Web Services) connectivity
                </p>
              </div>
            </div>
          </div>
        </div>
      </SidebarLayout>

      {showTestEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Test Email</h3>
            <input
              type="email"
              placeholder="Enter test email address"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              id="testEmailAddress"
            />
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  const email = document.getElementById('testEmailAddress').value;
                  if (!email) {
                    alert('Please enter an email address');
                    return;
                  }
                  try {
                    const csrfToken = await getCSRFToken();
                    const response = await fetch('/api/email/test', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                      },
                      body: JSON.stringify({ email })
                    });
                    const data = await response.json();
                    if (data.success) {
                      alert('Test email sent successfully');
                      setShowTestEmail(false);
                    } else {
                      alert('Failed to send test email: ' + data.error);
                    }
                  } catch (error) {
                    alert('Error sending test email');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Send Test
              </button>
              <button
                onClick={() => setShowTestEmail(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
