'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import Breadcrumb from '../../../../components/Breadcrumb';
import { useAuth } from '../../../../hooks/useAuth';

export default function SsoSettingsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [ssoSettings, setSsoSettings] = useState({
    ssoEnabled: false,
    duoEntityId: '',
    duoAcs: '',
    duoMetadata: '',
    duoCertificate: ''
  });
  const [savingSso, setSavingSso] = useState(false);

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
    if (!loading && user && !user.isAdmin) {
      router.push('/');
      return;
    }

    if (user) {
      const loadData = async () => {
        try {
          const response = await fetch('/api/admin/sso-settings?t=' + Date.now());
          const data = await response.json();
          
          if (data.settings) {
            setSsoSettings({
              ssoEnabled: data.settings.SSO_ENABLED === 'true' || false,
              duoEntityId: data.settings.DUO_ENTITY_ID || '',
              duoAcs: data.settings.DUO_ACS || '',
              duoMetadata: data.settings.DUO_METADATA_FILE ? 'STORED_IN_SSM' : '',
              duoCertificate: data.settings.DUO_CERT_FILE ? 'STORED_IN_SSM' : ''
            });
          }
        } catch (error) {
          console.error('Error loading SSO settings:', error);
        }
      };
      loadData();
    }
  }, [user, loading, router]);

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
            { label: 'SSO Settings' }
          ]} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">SSO Settings</h1>
            <p className="text-gray-600">Configure SAML Single Sign-On authentication</p>
          </div>

          <div className="card">
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <a
                    key={tab.id}
                    href={tab.href}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      tab.id === 'sso-settings'
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
              <div className="flex items-center mb-6">
                <input
                  type="checkbox"
                  id="ssoEnabled"
                  checked={ssoSettings.ssoEnabled}
                  onChange={(e) => setSsoSettings(prev => ({...prev, ssoEnabled: e.target.checked}))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="ssoEnabled" className="ml-2 block text-sm text-gray-900">
                  Enable SAML Single Sign-On
                </label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">DUO Entity ID</label>
                  <input
                    type="text"
                    value={ssoSettings.duoEntityId}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                    placeholder="Entity ID will appear here"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">DUO ACS</label>
                  <input
                    type="text"
                    value={ssoSettings.duoAcs}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                    placeholder="ACS URL will appear here"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Metadata XML File</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept=".xml"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const text = await file.text();
                          setSsoSettings(prev => ({...prev, duoMetadata: text}));
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {ssoSettings.duoMetadata && (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Uploaded
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Upload DUO SAML metadata XML file</p>
                  {ssoSettings.duoMetadata === 'STORED_IN_SSM' && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                      ✓ Metadata file is stored in SSM and ready for use
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">DUO Certificate</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept=".crt,.cer,.pem"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const text = await file.text();
                          setSsoSettings(prev => ({...prev, duoCertificate: text}));
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {ssoSettings.duoCertificate && (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Uploaded
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Upload DUO certificate file</p>
                  {ssoSettings.duoCertificate === 'STORED_IN_SSM' && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                      ✓ Certificate file is stored in SSM and ready for use
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setSavingSso(true);
                      try {
                        const csrfToken = await getCSRFToken();
                        if (!csrfToken) {
                          alert('Security token unavailable');
                          return;
                        }
                        
                        const response = await fetch('/api/admin/sso-settings', {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                          },
                          body: JSON.stringify({
                            ssoEnabled: ssoSettings.ssoEnabled,
                            duoMetadata: ssoSettings.duoMetadata,
                            duoCertificate: ssoSettings.duoCertificate
                          })
                        });
                        const data = await response.json();
                        if (data.success) {
                          alert('SSO settings saved successfully!');
                          if (ssoSettings.ssoEnabled) {
                            const refreshResponse = await fetch('/api/admin/sso-settings');
                            const refreshData = await refreshResponse.json();
                            if (refreshData.settings) {
                              setSsoSettings(prev => ({
                                ...prev,
                                duoEntityId: refreshData.settings.DUO_ENTITY_ID || '',
                                duoAcs: refreshData.settings.DUO_ACS || '',
                                duoMetadata: refreshData.settings.DUO_METADATA_FILE ? 'STORED_IN_SSM' : prev.duoMetadata,
                                duoCertificate: refreshData.settings.DUO_CERT_FILE ? 'STORED_IN_SSM' : prev.duoCertificate
                              }));
                            }
                          }
                        } else {
                          alert('Failed to save SSO settings: ' + data.error);
                        }
                      } catch (error) {
                        console.error('Error saving SSO settings:', error);
                        alert('Error saving SSO settings');
                      } finally {
                        setSavingSso(false);
                      }
                    }}
                    disabled={savingSso}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      savingSso
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {savingSso ? 'Saving...' : 'Save SSO Settings'}
                  </button>
                  
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/admin/validate-saml');
                        const data = await response.json();
                        
                        let message = `SAML Configuration Validation\n\n`;
                        message += `Environment: ${data.environment}\n`;
                        message += `SSO Enabled: ${data.sso_enabled}\n`;
                        message += `Base URL: ${data.base_url}\n\n`;
                        
                        message += `Service Provider:\n`;
                        message += `- Entity ID: ${data.sp_entity_id || 'Not set'}\n`;
                        message += `- ACS Endpoint: ${data.sp_acs_endpoint || 'Not set'}\n`;
                        message += `- Certificate: ${data.sp_certificate_present ? 'Present' : 'Missing'}\n\n`;
                        
                        message += `Identity Provider:\n`;
                        message += `- SSO URL: ${data.idp_sso_url || 'Not set'}\n`;
                        message += `- Certificate: ${data.idp_certificate_present ? 'Present' : 'Missing'}\n\n`;
                        
                        if (data.issues && data.issues.length > 0) {
                          message += `Issues Found:\n`;
                          data.issues.forEach(issue => message += `- ${issue}\n`);
                        } else {
                          message += `✅ Configuration is valid!`;
                        }
                        
                        alert(message);
                      } catch (error) {
                        alert('Failed to validate SAML configuration');
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                  >
                    Validate SAML
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarLayout>
    </div>
  );
}
