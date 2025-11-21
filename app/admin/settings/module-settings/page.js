'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import Breadcrumb from '../../../../components/Breadcrumb';
import { useAuth } from '../../../../hooks/useAuth';

export default function ModuleSettingsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [creatingBoards, setCreatingBoards] = useState(false);
  const [saMappingSettings, setSaMappingSettings] = useState({});
  const [savingMappings, setSavingMappings] = useState(false);
  const [practiceGroups, setPracticeGroups] = useState([]);

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
          const [settingsResponse, groupsResponse] = await Promise.all([
            fetch('/api/settings/sa-mappings?t=' + Date.now()),
            fetch('/api/practice-groups')
          ]);
          
          const settingsData = await settingsResponse.json();
          const groupsData = await groupsResponse.json();
          
          setSaMappingSettings(settingsData.settings || {});
          setPracticeGroups((groupsData.groups || []).sort((a, b) => a.displayName.localeCompare(b.displayName)));
        } catch (error) {
          console.error('Error loading SA mapping settings:', error);
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
            { label: 'Module Settings' }
          ]} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Module Settings</h1>
            <p className="text-gray-600">Configure and manage application modules</p>
          </div>

          <div className="card">
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <a
                    key={tab.id}
                    href={tab.href}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      tab.id === 'module-settings'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.name}
                  </a>
                ))}
              </nav>
            </div>

            <div className="space-y-8">
              {/* Practice Information Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Practice Information</h3>
                    <p className="text-sm text-gray-600">Manage practice-related information and settings</p>
                  </div>
                </div>

                {/* Practice Boards Sub-section */}
                <div className="border-l-4 border-blue-500 pl-6 mb-8">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Practice Boards</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Practice boards are automatically created based on Practice Manager role assignments. 
                    Each Practice Manager gets a board for all their assigned practices.
                  </p>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={async () => {
                        setCreatingBoards(true);
                        try {
                          const csrfToken = await getCSRFToken();
                          if (!csrfToken) {
                            alert('Security token unavailable');
                            return;
                          }
                          
                          const response = await fetch('/api/practice-boards/initialize', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'X-CSRF-Token': csrfToken
                            }
                          });
                          
                          const data = await response.json();
                          
                          if (data.success) {
                            const created = data.results.filter(r => r.status === 'created').length;
                            const existing = data.results.filter(r => r.status === 'already_exists').length;
                            alert(`Practice Board Creation Complete!\n\nBoards Created: ${created}\nBoards Already Existed: ${existing}`);
                          } else {
                            alert('Failed to create practice boards: ' + data.error);
                          }
                        } catch (error) {
                          alert('Error creating practice boards');
                        } finally {
                          setCreatingBoards(false);
                        }
                      }}
                      disabled={creatingBoards}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        creatingBoards
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {creatingBoards ? 'Creating...' : 'Create Practice Boards'}
                    </button>
                    
                    <button
                      onClick={async () => {
                        if (!confirm('Are you sure you want to delete ALL practice boards? This will permanently remove all boards, columns, cards, and data.')) {
                          return;
                        }
                        
                        setCreatingBoards(true);
                        try {
                          const csrfToken = await getCSRFToken();
                          if (!csrfToken) {
                            alert('Security token unavailable');
                            return;
                          }
                          
                          const response = await fetch('/api/practice-boards/delete-all', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'X-CSRF-Token': csrfToken
                            }
                          });
                          
                          const data = await response.json();
                          
                          if (data.success) {
                            const boardsCount = data.deletedBoardsCount || 0;
                            const topicsCount = data.deletedTopicsCount || 0;
                            alert(`Successfully deleted:\n• ${boardsCount} practice boards\n• ${topicsCount} topic configurations`);
                          } else {
                            alert('Failed to delete practice boards: ' + data.error);
                          }
                        } catch (error) {
                          alert('Error deleting practice boards');
                        } finally {
                          setCreatingBoards(false);
                        }
                      }}
                      disabled={creatingBoards}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        creatingBoards
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {creatingBoards ? 'Deleting...' : 'Delete All Practice Boards'}
                    </button>
                  </div>
                </div>

                {/* Contact Information Sub-section */}
                <div className="border-l-4 border-green-500 pl-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Contact Information</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Practice groups are automatically created based on Practice Manager role assignments. 
                    Use these controls to manually create missing groups or clean up existing ones.
                  </p>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={async () => {
                        setCreatingBoards(true);
                        try {
                          const csrfToken = await getCSRFToken();
                          if (!csrfToken) {
                            alert('Security token unavailable');
                            return;
                          }
                          
                          const response = await fetch('/api/practice-groups/create', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'X-CSRF-Token': csrfToken
                            }
                          });
                          const data = await response.json();
                          if (data.success) {
                            alert(`Practice groups created: ${data.results.created || 0}`);
                          } else {
                            alert('Failed to create practice groups');
                          }
                        } catch (error) {
                          alert('Error creating practice groups');
                        } finally {
                          setCreatingBoards(false);
                        }
                      }}
                      disabled={creatingBoards}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        creatingBoards
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {creatingBoards ? 'Creating...' : 'Create Practice Groups'}
                    </button>
                    
                    <button
                      onClick={async () => {
                        if (!confirm('Are you sure you want to delete ALL practice groups? This will permanently remove all groups, contact types, companies, and contacts.')) {
                          return;
                        }
                        
                        setCreatingBoards(true);
                        try {
                          const csrfToken = await getCSRFToken();
                          if (!csrfToken) {
                            alert('Security token unavailable');
                            return;
                          }
                          
                          const response = await fetch('/api/practice-groups/delete-all', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'X-CSRF-Token': csrfToken
                            }
                          });
                          const data = await response.json();
                          if (data.success) {
                            alert('Successfully deleted all practice groups');
                          } else {
                            alert('Failed to delete practice groups');
                          }
                        } catch (error) {
                          alert('Error deleting practice groups');
                        } finally {
                          setCreatingBoards(false);
                        }
                      }}
                      disabled={creatingBoards}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        creatingBoards
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {creatingBoards ? 'Deleting...' : 'Delete All Practice Groups'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Pre-Sales Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Pre-Sales</h3>
                    <p className="text-sm text-gray-600">Configure pre-sales module settings and features</p>
                  </div>
                </div>

                {/* SA to AM Mappings Sub-section */}
                <div className="border-l-4 border-blue-500 pl-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">SA to AM Mappings</h4>
                  <p className="text-sm text-gray-600 mb-6">
                    Enable or disable SA to AM mapping functionality for each practice group. 
                    When disabled, the practice will show an alternative message instead of the mapping interface.
                  </p>

                  <div className="space-y-4">
                    {practiceGroups.map(group => {
                      const primaryPractice = group.practices?.[0] || group.displayName;
                      return (
                        <div key={group.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <h5 className="font-medium text-gray-900">{group.displayName}</h5>
                            <p className="text-sm text-gray-600 mb-2">
                              {saMappingSettings[primaryPractice] !== false 
                                ? 'SA to AM mappings are enabled for this practice group'
                                : 'This practice group uses alternative SA assignment method'
                              }
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {group.practices?.map(practice => (
                                <span key={practice} className="inline-flex px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                  {practice}
                                </span>
                              ))}
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={saMappingSettings[primaryPractice] !== false}
                              onChange={(e) => {
                                setSaMappingSettings(prev => ({
                                  ...prev,
                                  [primaryPractice]: e.target.checked
                                }));
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={async () => {
                        setSavingMappings(true);
                        try {
                          const csrfToken = await getCSRFToken();
                          if (!csrfToken) {
                            alert('Security token unavailable');
                            return;
                          }
                          
                          const response = await fetch('/api/settings/sa-mappings', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'X-CSRF-Token': csrfToken
                            },
                            body: JSON.stringify({ settings: saMappingSettings })
                          });
                          
                          if (response.ok) {
                            alert('SA to AM mapping settings saved successfully!');
                          } else {
                            const errorData = await response.json();
                            alert('Failed to save SA to AM mapping settings: ' + (errorData.error || 'Unknown error'));
                          }
                        } catch (error) {
                          console.error('Error saving SA mapping settings:', error);
                          alert('Error saving SA to AM mapping settings');
                        } finally {
                          setSavingMappings(false);
                        }
                      }}
                      disabled={savingMappings}
                      className={`${savingMappings ? 'btn-disabled' : 'btn-primary'} flex items-center gap-2`}
                    >
                      {savingMappings ? (
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
            </div>
          </div>
        </div>
      </SidebarLayout>
    </div>
  );
}
