'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import Breadcrumb from '../../../../components/Breadcrumb';
import { useAuth } from '../../../../hooks/useAuth';
import EmailRulesManager from '../../../../components/EmailRulesManager';

export default function EmailProcessingPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [settings, setSettings] = useState({
    resourceEmailEnabled: false,
    emailNotifications: false,
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPassword: ''
  });
  const [saving, setSaving] = useState(false);
  const [expandedActions, setExpandedActions] = useState(new Set());

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
          const [emailResponse, resourcesResponse] = await Promise.all([
            fetch('/api/settings/email?t=' + Date.now()),
            fetch('/api/settings/resources?t=' + Date.now())
          ]);
          
          const emailData = await emailResponse.json();
          const resourcesData = await resourcesResponse.json();
          
          setSettings({
            resourceEmailEnabled: resourcesData.settings?.resourceEmailEnabled || false,
            emailNotifications: emailData.settings?.emailNotifications || false,
            smtpHost: emailData.settings?.smtpHost || '',
            smtpPort: emailData.settings?.smtpPort || '',
            smtpUser: emailData.settings?.smtpUser || '',
            smtpPassword: emailData.settings?.smtpPassword || ''
          });
        } catch (error) {
          console.error('Error loading settings:', error);
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

  const emailConfigured = settings.emailNotifications && settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPassword;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={logout} />
      
      <SidebarLayout user={user}>
        <div className="p-8">
          <Breadcrumb items={[
            { label: 'Settings', href: '/admin/settings/general-settings' },
            { label: 'E-mail Processing Rules' }
          ]} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">E-mail Processing Rules</h1>
            <p className="text-gray-600">Configure automated email processing for resource and SA assignments</p>
          </div>

          <div className="card">
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <a
                    key={tab.id}
                    href={tab.href}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      tab.id === 'email-processing'
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
              <div className="mb-6">
                <button
                  onClick={() => setSettings({...settings, resourceEmailEnabled: !settings.resourceEmailEnabled})}
                  disabled={!emailConfigured}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    settings.resourceEmailEnabled 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } ${!emailConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={settings.resourceEmailEnabled ? 'Click to Disable E-mail Processing' : 'Click to Enable E-mail Processing'}
                >
                  {settings.resourceEmailEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">Important: Outlook Forwarding Rules Required</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      In order for E-mail processing rules to function, each Practice Manager must create a server-side forwarding rule in their outlook client that matches the "Sender Email Address" and "Subject Pattern" in your E-mail processing rule, that forwards all of those E-mails to: <a href="mailto:practicetools@netsync.com" className="underline font-medium">practicetools@netsync.com</a>. To do this, in Outlook, go to File → Automatic Replies, then click "Rules" at the bottom left hand corner of the screen. Then Add Rule.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="w-full">
                    <h3 className="text-sm font-medium text-blue-800 mb-3">Explanation of what actions are available</h3>
                    <div className="space-y-2">
                      <div className="bg-white rounded-md border border-blue-100 overflow-hidden">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedActions);
                            if (newExpanded.has('resource_assignment')) {
                              newExpanded.delete('resource_assignment');
                            } else {
                              newExpanded.add('resource_assignment');
                            }
                            setExpandedActions(newExpanded);
                          }}
                          className="w-full p-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between"
                        >
                          <span className="text-sm font-semibold text-blue-900">Resource Assignment</span>
                          <svg 
                            className={`w-4 h-4 text-blue-600 transition-transform ${expandedActions.has('resource_assignment') ? 'rotate-180' : ''}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedActions.has('resource_assignment') && (
                          <div className="px-3 pb-3 border-t border-blue-100">
                            <p className="text-sm text-blue-700 pt-2">
                              Configure email monitoring to automatically create resource assignments from specific email patterns. 
                              The system will monitor the configured email account for messages matching sender and subject patterns, 
                              then extract data using keyword mappings to populate new resource assignments.
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-white rounded-md border border-blue-100 overflow-hidden">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedActions);
                            if (newExpanded.has('sa_assignment')) {
                              newExpanded.delete('sa_assignment');
                            } else {
                              newExpanded.add('sa_assignment');
                            }
                            setExpandedActions(newExpanded);
                          }}
                          className="w-full p-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between"
                        >
                          <span className="text-sm font-semibold text-blue-900">SA Assignment</span>
                          <svg 
                            className={`w-4 h-4 text-blue-600 transition-transform ${expandedActions.has('sa_assignment') ? 'rotate-180' : ''}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedActions.has('sa_assignment') && (
                          <div className="px-3 pb-3 border-t border-blue-100">
                            <p className="text-sm text-blue-700 pt-2">
                              Configure email monitoring to automatically create SA assignments from specific email patterns. 
                              The system will monitor the configured email account for messages matching sender and subject patterns, 
                              then extract data using keyword mappings to populate new SA assignments for pre-sales activities.
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-white rounded-md border border-blue-100 overflow-hidden">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedActions);
                            if (newExpanded.has('sa_assignment_approval_request')) {
                              newExpanded.delete('sa_assignment_approval_request');
                            } else {
                              newExpanded.add('sa_assignment_approval_request');
                            }
                            setExpandedActions(newExpanded);
                          }}
                          className="w-full p-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between"
                        >
                          <span className="text-sm font-semibold text-blue-900">SA Assignment Approval Request</span>
                          <svg 
                            className={`w-4 h-4 text-blue-600 transition-transform ${expandedActions.has('sa_assignment_approval_request') ? 'rotate-180' : ''}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedActions.has('sa_assignment_approval_request') && (
                          <div className="px-3 pb-3 border-t border-blue-100">
                            <p className="text-sm text-blue-700 pt-2">
                              Configure email monitoring to automatically update existing SA assignment statuses from "Assigned" to "Pending Approval" 
                              for specific practice and SA combinations. The system will monitor the configured email account for approval request messages 
                              matching sender and subject patterns, then extract practice and SA information to update the corresponding assignment status.
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-white rounded-md border border-blue-100 overflow-hidden">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedActions);
                            if (newExpanded.has('sa_assignment_approved')) {
                              newExpanded.delete('sa_assignment_approved');
                            } else {
                              newExpanded.add('sa_assignment_approved');
                            }
                            setExpandedActions(newExpanded);
                          }}
                          className="w-full p-3 text-left hover:bg-blue-50 transition-colors flex items-center justify-between"
                        >
                          <span className="text-sm font-semibold text-blue-900">SA Assignment Approved</span>
                          <svg 
                            className={`w-4 h-4 text-blue-600 transition-transform ${expandedActions.has('sa_assignment_approved') ? 'rotate-180' : ''}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedActions.has('sa_assignment_approved') && (
                          <div className="px-3 pb-3 border-t border-blue-100">
                            <p className="text-sm text-blue-700 pt-2">
                              Configure email monitoring to automatically update existing SA assignment statuses from "Pending Approval" to "Complete" 
                              for specific practice and SA combinations. The system will monitor the configured email account for approval confirmation messages 
                              matching sender and subject patterns, then extract practice and SA information to update the corresponding assignment status. 
                              Includes revision number validation to ensure approvals only process when revision numbers match.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!emailConfigured && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-yellow-800">Email Settings Required</h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        Before enabling resource assignment email processing, you must first configure and enable email settings in the E-mail Settings tab.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {settings.resourceEmailEnabled && (
                <div className="space-y-6">
                  <EmailRulesManager />
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-medium text-yellow-800">Email Processing Requirements</h3>
                        <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside space-y-1">
                          <li>Email monitoring uses the same SMTP credentials configured in E-mail Settings</li>
                          <li>The system checks for new emails every 5 minutes</li>
                          <li>Only unread emails matching the rules will be processed</li>
                          <li>Processed emails will be marked as read to prevent duplicate processing</li>
                          <li>Failed processing attempts will be logged for troubleshooting</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const csrfToken = await getCSRFToken();
                        if (!csrfToken) {
                          alert('Security token unavailable');
                          return;
                        }
                        
                        const response = await fetch('/api/settings/resources', {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                          },
                          body: JSON.stringify({
                            resourceEmailEnabled: settings.resourceEmailEnabled
                          })
                        });
                        
                        if (response.ok) {
                          alert('Resource assignment settings saved successfully!');
                        } else {
                          alert('Failed to save resource assignment settings');
                        }
                      } catch (error) {
                        console.error('Error saving resource assignment settings:', error);
                        alert('Error saving resource assignment settings');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      saving
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                  
                  {settings.resourceEmailEnabled && (
                    <button
                      onClick={async () => {
                        try {
                          const csrfToken = await getCSRFToken();
                          if (!csrfToken) {
                            alert('Security token unavailable');
                            return;
                          }
                          
                          const response = await fetch('/api/email/process', { 
                            method: 'POST',
                            headers: {
                              'X-CSRF-Token': csrfToken
                            }
                          });
                          const data = await response.json();
                          
                          if (data.success) {
                            alert('Email processing triggered successfully! Check the server logs for processing details.');
                          } else {
                            alert(`Email processing failed: ${data.error}`);
                          }
                        } catch (error) {
                          alert('Failed to trigger email processing');
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                    >
                      Process Emails Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarLayout>
    </div>
  );
}
