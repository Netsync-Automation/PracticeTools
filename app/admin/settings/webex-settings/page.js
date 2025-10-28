'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import Breadcrumb from '../../../../components/Breadcrumb';
import { useAuth } from '../../../../hooks/useAuth';
import { PRACTICE_OPTIONS } from '../../../../constants/practices';

export default function WebExSettingsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [webexBots, setWebexBots] = useState([]);
  const [syncingBots, setSyncingBots] = useState({});
  const [loadingSSM, setLoadingSSM] = useState(false);

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
          const response = await fetch('/api/admin/webex-bots?t=' + Date.now());
          const data = await response.json();
          setWebexBots(data.bots || []);
        } catch (error) {
          console.error('Error loading WebEx bots:', error);
        }
      };
      loadData();
    }
  }, [user, loading, router]);

  const handleDeleteBot = async (botId) => {
    if (!confirm('Are you sure you want to delete this WebEx bot?')) return;
    
    try {
      const response = await fetch(`/api/webex-bots?id=${botId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('WebEx bot deleted successfully!');
        const botsResponse = await fetch('/api/admin/webex-bots');
        const botsData = await botsResponse.json();
        setWebexBots(botsData.bots || []);
      } else {
        alert('Failed to delete WebEx bot: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting WebEx bot:', error);
      alert('Error deleting WebEx bot');
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
            { label: 'WebEx Settings' }
          ]} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">WebEx Settings</h1>
            <p className="text-gray-600">Configure WebEx bot integrations</p>
          </div>

          <div className="card">
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <a
                    key={tab.id}
                    href={tab.href}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      tab.id === 'webex-settings'
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
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">WebEx Bot Management</h2>
                <button className="btn-primary flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add WebEx Bot
                </button>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-blue-900">WebEx Bot SSM Export</h3>
                    <p className="text-sm text-blue-700 mt-1">Export WebEx bot SSM parameters for App Runner YAML files</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setLoadingSSM(true);
                        try {
                          const response = await fetch('/api/admin/ssm-secrets?env=dev');
                          const data = await response.json();
                          if (data.success) {
                            alert('Dev SSM parameters loaded');
                          } else {
                            alert('Failed to fetch dev WebEx SSM parameters');
                          }
                        } catch (error) {
                          alert('Error fetching dev WebEx SSM parameters');
                        } finally {
                          setLoadingSSM(false);
                        }
                      }}
                      disabled={loadingSSM}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loadingSSM ? 'Loading...' : 'Dev'}
                    </button>
                    <button
                      onClick={async () => {
                        setLoadingSSM(true);
                        try {
                          const response = await fetch('/api/admin/ssm-secrets?env=prod');
                          const data = await response.json();
                          if (data.success) {
                            alert('Prod SSM parameters loaded');
                          } else {
                            alert('Failed to fetch prod WebEx SSM parameters');
                          }
                        } catch (error) {
                          alert('Error fetching prod WebEx SSM parameters');
                        } finally {
                          setLoadingSSM(false);
                        }
                      }}
                      disabled={loadingSSM}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {loadingSSM ? 'Loading...' : 'Prod'}
                    </button>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-600 text-sm">
                Configure WebEx bots for different practices. Each practice can have one bot, but multiple practices can share the same bot.
              </p>
              
              {webexBots.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No WebEx bots configured</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by adding your first WebEx bot.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {webexBots.map((bot) => (
                    <div key={bot.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{bot.friendlyName || bot.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{bot.name}</p>
                          <p className="text-sm text-gray-500 mt-1">SSM Prefix: WEBEX_{bot.ssmPrefix}</p>
                          <div className="mt-2">
                            <span className="text-sm font-medium text-gray-700">Practices: </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {bot.practices.map(practice => (
                                <span key={practice} className="inline-flex px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                  {practice}
                                </span>
                              ))}
                            </div>
                          </div>
                          {bot.roomName && (
                            <p className="text-sm text-gray-600 mt-2">
                              <span className="font-medium">Practice Issues:</span> {bot.roomName}
                            </p>
                          )}
                          {bot.resourceRoomName && (
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Resource Assignment:</span> {bot.resourceRoomName}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={async () => {
                              setSyncingBots(prev => ({...prev, [bot.id]: true}));
                              try {
                                const response = await fetch('/api/webex/sync-bot', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ botId: bot.id })
                                });
                                const data = await response.json();
                                if (data.success) {
                                  alert(`Users synchronized successfully from ${bot.friendlyName || bot.name}!`);
                                } else {
                                  alert(data.error || 'Sync failed');
                                }
                              } catch (error) {
                                alert('Sync failed');
                              } finally {
                                setSyncingBots(prev => ({...prev, [bot.id]: false}));
                              }
                            }}
                            disabled={syncingBots[bot.id]}
                            className="text-green-600 hover:text-green-800 hover:bg-green-50 p-2 rounded disabled:opacity-50"
                            title="Sync WebEx Users"
                          >
                            {syncingBots[bot.id] ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            )}
                          </button>
                          <button
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded"
                            title="Edit Bot"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteBot(bot.id)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded"
                            title="Delete Bot"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarLayout>
    </div>
  );
}
