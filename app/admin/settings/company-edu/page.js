'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import Breadcrumb from '../../../../components/Breadcrumb';
import { useAuth } from '../../../../hooks/useAuth';
import WebhookTraceViewer from '../../../../components/WebhookTraceViewer';

export default function CompanyEduPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  
  const [webexMeetingsEnabled, setWebexMeetingsEnabled] = useState(false);
  const [webexMeetingsSites, setWebexMeetingsSites] = useState([]);
  const [showAddSite, setShowAddSite] = useState(false);
  const [editingSiteIndex, setEditingSiteIndex] = useState(null);
  const [modalTab, setModalTab] = useState('meetings');
  const [newSite, setNewSite] = useState({
    siteUrl: '',
    accessToken: '',
    refreshToken: '',
    clientId: '',
    clientSecret: '',
    recordingHosts: [''],
    botName: '',
    botEmail: '',
    botToken: '',
    monitoredRooms: []
  });
  const [roomSearch, setRoomSearch] = useState('');
  const [searchingRooms, setSearchingRooms] = useState(false);
  const [roomSearchResults, setRoomSearchResults] = useState([]);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [savingWebexMeetings, setSavingWebexMeetings] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookAction, setWebhookAction] = useState('');
  const [webhookResults, setWebhookResults] = useState([]);
  const [processingWebhooks, setProcessingWebhooks] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [showApiManagementModal, setShowApiManagementModal] = useState(false);
  const [showApiLogsModal, setShowApiLogsModal] = useState(false);
  const [showWebhookLogsModal, setShowWebhookLogsModal] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState(null);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [apiResults, setApiResults] = useState([]);
  const [apiLogs, setApiLogs] = useState([]);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [validatingApi, setValidatingApi] = useState(false);
  const [loadingApiLogs, setLoadingApiLogs] = useState(false);
  const [loadingWebhookLogs, setLoadingWebhookLogs] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationResults, setValidationResults] = useState([]);
  const [hasValidCredentials, setHasValidCredentials] = useState(false);
  const [checkingCredentials, setCheckingCredentials] = useState(false);
  const [hasBotToken, setHasBotToken] = useState(false);

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
          const response = await fetch('/api/settings/webex-meetings?t=' + Date.now());
          const data = await response.json();
          setWebexMeetingsEnabled(data.enabled || false);
          setWebexMeetingsSites(data.sites || []);
        } catch (error) {
          console.error('Error loading Webex Meetings settings:', error);
        }
      };
      loadData();
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (showAddSite && modalTab === 'messaging' && editingSiteIndex !== null) {
      loadBotCredentials();
    }
  }, [showAddSite, modalTab, editingSiteIndex]);

  const loadBotCredentials = async () => {
    try {
      const siteUrl = editingSiteIndex !== null ? webexMeetingsSites[editingSiteIndex]?.siteUrl : newSite.siteUrl;
      if (!siteUrl) return;
      
      const response = await fetch(`/api/webexmessaging/monitored-rooms?siteUrl=${encodeURIComponent(siteUrl)}`);
      const data = await response.json();
      
      setHasBotToken(!!data.botToken);
      
      const site = webexMeetingsSites[editingSiteIndex];
      setNewSite(prev => ({
        ...prev,
        botName: site.botName || '',
        botEmail: site.botEmail || '',
        monitoredRooms: data.rooms || []
      }));
    } catch (error) {
      console.error('Error loading bot credentials:', error);
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
            { label: 'Company EDU' }
          ]} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Company Education Settings</h1>
            <p className="text-gray-600">Configure educational tools and integrations</p>
          </div>

          <div className="card">
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <a
                    key={tab.id}
                    href={tab.href}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      tab.id === 'company-edu'
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">Webex Integration</h3>
                    <p className="text-sm text-gray-600">Configure Webex Meeting and Messaging Integrations</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={webexMeetingsEnabled}
                      onChange={async (e) => {
                        const newEnabled = e.target.checked;
                        setWebexMeetingsEnabled(newEnabled);
                        setSavingWebexMeetings(true);
                        try {
                          const response = await fetch('/api/settings/webex-meetings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              enabled: newEnabled,
                              sites: webexMeetingsSites
                            })
                          });
                          if (!response.ok) {
                            const errorData = await response.json();
                            alert('Failed to save toggle: ' + (errorData.error || 'Unknown error'));
                          }
                        } catch (error) {
                          alert('Error saving toggle');
                        } finally {
                          setSavingWebexMeetings(false);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      {webexMeetingsEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                {webexMeetingsEnabled && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-semibold text-gray-900">Configured Webex Integrations</h4>
                      <button
                        onClick={() => {
                          setEditingSiteIndex(null);
                          setModalTab('meetings');
                          setNewSite({
                            siteUrl: '',
                            accessToken: '',
                            refreshToken: '',
                            clientId: '',
                            clientSecret: '',
                            recordingHosts: [''],
                            botName: '',
                            botEmail: '',
                            botToken: '',
                            monitoredRooms: []
                          });
                          setShowAddSite(true);
                        }}
                        className="btn-primary flex items-center gap-2 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Webex Integration
                      </button>
                    </div>

                    <div>
                      {webexMeetingsSites.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                          <svg className="w-8 h-8 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <h4 className="text-sm font-medium text-gray-900 mb-1">No sites configured</h4>
                          <p className="text-sm text-gray-600">Add your first Webex integration to get started</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {webexMeetingsSites.map((site, index) => (
                            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                              <div className="flex items-start justify-between mb-3">
                                <h5 className="font-medium text-gray-900">{site.siteUrl}</h5>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingSiteIndex(index);
                                      setModalTab('meetings');
                                      setNewSite({
                                        siteUrl: site.siteUrl,
                                        accessToken: '',
                                        refreshToken: '',
                                        clientId: '',
                                        clientSecret: '',
                                        recordingHosts: site.recordingHosts.map(host => typeof host === 'string' ? host : host.email || ''),
                                        botName: site.botName || '',
                                        botEmail: site.botEmail || '',
                                        botToken: '',
                                        monitoredRooms: site.monitoredRooms || []
                                      });
                                      setShowAddSite(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded"
                                    title="Edit Integration"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updatedSites = webexMeetingsSites.filter((_, i) => i !== index);
                                      setWebexMeetingsSites(updatedSites);
                                    }}
                                    className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded"
                                    title="Remove Integration"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h6 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                    <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Meetings
                                  </h6>
                                  <div className="space-y-1">
                                    <div className="text-xs text-gray-600">Recording Hosts:</div>
                                    <div className="flex flex-wrap gap-1">
                                      {site.recordingHosts.map((host, hostIndex) => {
                                        const hostEmail = typeof host === 'string' ? host : host?.email || '[object Object]';
                                        return (
                                          <span key={hostIndex} className="inline-flex px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                            {hostEmail}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  <h6 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    Messaging
                                  </h6>
                                  {(site.botName || site.botEmail) && site.monitoredRooms?.length > 0 ? (
                                    <div className="space-y-1">
                                      {site.botName && <div className="text-xs text-gray-600">Bot: {site.botName}</div>}
                                      <div className="text-xs text-gray-600">Monitored Rooms:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {site.monitoredRooms.map((room, roomIndex) => (
                                          <span key={roomIndex} className="inline-flex px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                                            {room.title}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-500 italic">Not configured</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-gray-200 flex gap-3">
                      {webexMeetingsEnabled && webexMeetingsSites.length > 0 && (
                        <>
                          <button
                            onClick={() => setShowWebhookModal(true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 616 0z" />
                            </svg>
                            Manage Webhooks
                          </button>
                          
                          <button
                            onClick={() => setShowApiManagementModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Manage API
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {showWebhookModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 616 0z" />
                  </svg>
                  Webhook Management
                </h3>
                
                <p className="text-sm text-gray-600 mb-6">
                  Manage Webex webhooks for recordings and messages. Recordings webhook notifies when new recordings are available. Messaging webhooks notify when messages are posted to monitored rooms.
                </p>
                
                <div className="space-y-4">
                  <button
                    onClick={async () => {
                      setProcessingWebhooks(true);
                      setWebhookAction('create');
                      try {
                        const response = await fetch('/api/webexmeetings/settings/webhookmgmt', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'create' })
                        });
                        
                        const data = await response.json();
                        setWebhookResults(data.results || []);
                        
                        const successCount = data.results?.filter(r => r.status === 'created').length || 0;
                        const errorCount = data.results?.filter(r => r.status === 'error').length || 0;
                        
                        if (successCount > 0) {
                          alert(`✅ Successfully created webhook for ${successCount} site(s)!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
                        } else {
                          const errorDetails = data.results?.filter(r => r.status === 'error').map(r => `${r.site}: ${r.error}`).join('\\n') || 'Unknown error';
                          alert(`❌ Failed to create webhook:\\n\\n${errorDetails}`);
                        }
                      } catch (error) {
                        alert('❌ Error creating webhooks');
                      } finally {
                        setProcessingWebhooks(false);
                      }
                    }}
                    disabled={processingWebhooks}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {processingWebhooks && webhookAction === 'create' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating Webhook...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create Webhook
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={async () => {
                      setProcessingWebhooks(true);
                      setWebhookAction('validate');
                      try {
                        const response = await fetch('/api/webexmeetings/settings/webhookmgmt', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'validate' })
                        });
                        
                        const data = await response.json();
                        setWebhookResults(data.results || []);
                        setValidationResults(data.results || []);
                        setShowValidationModal(true);
                      } catch (error) {
                        alert('❌ Error validating webhooks');
                      } finally {
                        setProcessingWebhooks(false);
                      }
                    }}
                    disabled={processingWebhooks}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {processingWebhooks && webhookAction === 'validate' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Validating Webhook...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Validate Webhook
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={async () => {
                      if (!confirm('⚠️ Are you sure you want to delete the webhook? This will stop automatic recording processing.')) {
                        return;
                      }
                      
                      setProcessingWebhooks(true);
                      setWebhookAction('delete');
                      try {
                        const response = await fetch('/api/webexmeetings/settings/webhookmgmt', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'delete' })
                        });
                        
                        const data = await response.json();
                        setWebhookResults(data.results || []);
                        
                        const deletedCount = data.results?.filter(r => r.status === 'deleted').length || 0;
                        const errorCount = data.results?.filter(r => r.status === 'error').length || 0;
                        
                        if (deletedCount > 0) {
                          alert(`🗑️ Successfully deleted webhook for ${deletedCount} site(s)!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
                        } else {
                          alert('❌ Failed to delete webhook.');
                        }
                      } catch (error) {
                        alert('❌ Error deleting webhooks');
                      } finally {
                        setProcessingWebhooks(false);
                      }
                    }}
                    disabled={processingWebhooks}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {processingWebhooks && webhookAction === 'delete' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Deleting Webhook...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Webhook
                      </>
                    )}
                  </button>
                </div>
                
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Webhook URLs:</h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div>Recordings: <code className="bg-white px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/webhooks/webexmeetings/recordings</code></div>
                    <div>Messages: <code className="bg-white px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/webhooks/webexmessaging/messages</code></div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={async () => {
                      setLoadingWebhookLogs(true);
                      try {
                        const response = await fetch('/api/webexmeetings/settings/webhooklogs');
                        const data = await response.json();
                        setWebhookLogs(data.logs || []);
                        setShowWebhookLogsModal(true);
                      } catch (error) {
                        alert('❌ Error loading webhook logs');
                      } finally {
                        setLoadingWebhookLogs(false);
                      }
                    }}
                    disabled={loadingWebhookLogs}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loadingWebhookLogs ? 'Loading...' : 'View Logs'}
                  </button>
                  <button
                    onClick={() => {
                      setShowWebhookModal(false);
                      setWebhookResults([]);
                      setWebhookAction('');
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showApiManagementModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    API Management
                  </h3>
                  <button
                    onClick={() => setShowApiManagementModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-6">
                  Manage and validate Webex Meetings API access and view detailed logs.
                </p>
                
                <div className="space-y-4">
                  <button
                    onClick={async () => {
                      setValidatingApi(true);
                      try {
                        const response = await fetch('/api/webexmeetings/settings/apivalidation', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        
                        const data = await response.json();
                        setApiResults(data.results || []);
                        setShowApiManagementModal(false);
                        setShowApiModal(true);
                      } catch (error) {
                        alert('❌ Error validating API access');
                      } finally {
                        setValidatingApi(false);
                      }
                    }}
                    disabled={validatingApi}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {validatingApi ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Validating APIs...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Validate APIs
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={async () => {
                      setLoadingApiLogs(true);
                      try {
                        const response = await fetch('/api/webexmeetings/settings/apilogs');
                        const data = await response.json();
                        setApiLogs(data.logs || []);
                        setShowApiManagementModal(false);
                        setShowApiLogsModal(true);
                      } catch (error) {
                        alert('❌ Error loading API logs');
                      } finally {
                        setLoadingApiLogs(false);
                      }
                    }}
                    disabled={loadingApiLogs}
                    className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {loadingApiLogs ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Loading Logs...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        View Logs
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showApiModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    WebEx API Validation Results
                  </h3>
                  <button
                    onClick={() => setShowApiModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-6">
                  {apiResults.map((result, index) => (
                    <div key={index} className={`border rounded-lg p-4 ${
                      result.status === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-lg">{result.site}</h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          result.status === 'error' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {result.status === 'error' ? '❌ Failed' : '✅ Passed'}
                        </span>
                      </div>
                      
                      {result.error && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded text-red-800 text-sm">
                          <strong>Error:</strong> {result.error}
                        </div>
                      )}
                      
                      {result.scopes && (
                        <div className="mb-4">
                          <h5 className="font-medium mb-2">Required Scopes:</h5>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {result.scopes.required.map(scope => (
                              <span key={scope} className={`px-2 py-1 text-xs rounded ${
                                result.scopes.missing.includes(scope)
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {scope} {result.scopes.missing.includes(scope) ? '❌' : '✅'}
                              </span>
                            ))}
                          </div>
                          {result.scopes.missing.length > 0 && (
                            <p className="text-red-600 text-sm">
                              Missing scopes: {result.scopes.missing.join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div>
                        <h5 className="font-medium mb-2">API Tests:</h5>
                        <div className="space-y-2">
                          {result.tests.map((test, testIndex) => (
                            <div key={testIndex} className={`p-3 rounded border ${
                              test.status === 'error' 
                                ? 'border-red-200 bg-red-50' 
                                : 'border-green-200 bg-green-50'
                            }`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{test.name}</span>
                                <span className={`text-sm ${
                                  test.status === 'error' ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {test.status === 'error' ? '❌' : '✅'} {test.statusCode}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">{test.description}</p>
                              <p className="text-xs text-gray-500">{test.endpoint}</p>
                              {test.error && (
                                <p className="text-sm text-red-600 mt-1">Error: {test.error}</p>
                              )}
                              {test.requiredScopes.length > 0 && (
                                <div className="mt-1">
                                  <span className="text-xs text-gray-500">Scopes: </span>
                                  {test.requiredScopes.map(scope => (
                                    <span key={scope} className="text-xs bg-gray-100 px-1 rounded mr-1">
                                      {scope}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showApiLogsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    API Error Logs
                  </h3>
                  <button
                    onClick={() => setShowApiLogsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {apiLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No API errors found</h4>
                    <p className="text-gray-600">All API validations are working correctly.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {apiLogs.map((log, index) => (
                      <div key={index} className="border border-red-200 bg-red-50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h4 className="font-semibold text-red-900">{log.site || 'Unknown Site'}</h4>
                          </div>
                          <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium text-red-900">Error:</span>
                            <p className="text-sm text-red-800 mt-1">{log.error}</p>
                          </div>
                          
                          {log.endpoint && (
                            <div>
                              <span className="text-sm font-medium text-red-900">Endpoint:</span>
                              <p className="text-sm text-red-700 font-mono mt-1">{log.endpoint}</p>
                            </div>
                          )}
                          
                          {log.statusCode && (
                            <div>
                              <span className="text-sm font-medium text-red-900">Status Code:</span>
                              <span className="text-sm text-red-800 ml-2">{log.statusCode}</span>
                            </div>
                          )}
                          
                          {log.details && (
                            <div>
                              <span className="text-sm font-medium text-red-900">Details:</span>
                              <pre className="text-xs text-red-700 bg-red-100 p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showValidationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Webhook Validation Results
                  </h3>
                  <button
                    onClick={() => setShowValidationModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-800">Active</span>
                    </div>
                    <div className="text-2xl font-bold text-green-900 mt-1">
                      {validationResults.filter(r => r.hasWebhooks).length}
                    </div>
                    <div className="text-xs text-green-600">Sites with webhook</div>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-medium text-red-800">Inactive</span>
                    </div>
                    <div className="text-2xl font-bold text-red-900 mt-1">
                      {validationResults.filter(r => !r.hasWebhooks).length}
                    </div>
                    <div className="text-xs text-red-600">Sites without webhook</div>
                  </div>
                </div>
                
                <div className="overflow-y-auto max-h-[50vh]">
                  <div className="space-y-4">
                    {validationResults.map((result, index) => (
                      <div key={index} className={`border rounded-lg p-4 ${
                        result.hasWebhooks ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}>
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${
                              result.hasWebhooks ? 'bg-green-500' : 'bg-red-500'
                            }`}></span>
                            {result.site}
                          </h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            result.hasWebhooks ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {result.hasWebhooks ? 'Active' : 'Missing'}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Webhook Status
                          </h5>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              {result.webhookDetails?.recordings ? (
                                <span className="text-green-600">✓</span>
                              ) : (
                                <span className="text-red-600">✗</span>
                              )}
                              <span>Recordings Webhook</span>
                              {result.webhookDetails?.recordings && (
                                <span className="text-xs text-gray-500">({result.webhookDetails.recordings.status})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {result.webhookDetails?.messaging?.length > 0 ? (
                                <span className="text-green-600">✓</span>
                              ) : (
                                <span className="text-red-600">✗</span>
                              )}
                              <span>Messaging Webhooks</span>
                              {result.webhookDetails?.messaging?.length > 0 && (
                                <span className="text-xs text-gray-500">({result.webhookDetails.messaging.length} rooms)</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {result.connectivity?.[0]?.reachable ? (
                                <span className="text-green-600">✓</span>
                              ) : (
                                <span className="text-red-600">✗</span>
                              )}
                              <span>Endpoint Connectivity</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-blue-600">📊</span>
                              <span>Total WebEx Webhooks: {result.totalWebhooksInWebEx || 0}</span>
                            </div>
                          </div>
                        </div>
                        
                        {!result.hasWebhooks && (
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                            <h6 className="text-sm font-medium text-blue-800 mb-1">Recommended Actions:</h6>
                            <ul className="text-xs text-blue-700 space-y-1">
                              {!result.webhookDetails?.recordings && (
                                <li>• Create recordings webhook using "Create Webhook" button</li>
                              )}
                              {!result.connectivity?.[0]?.reachable && (
                                <li>• Check network connectivity and firewall settings</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowValidationModal(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showWebhookLogsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Webhook Activity Logs
                  </h3>
                  <button
                    onClick={() => setShowWebhookLogsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {webhookLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No webhook activity found</h4>
                    <p className="text-gray-600">Webhook logs will appear here when recordings or messages are processed.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {webhookLogs.map((log, index) => (
                      <div key={index} className={`border rounded-lg p-4 ${
                        log.status === 'error' ? 'border-red-200 bg-red-50' : 
                        log.status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                        'border-green-200 bg-green-50'
                      }`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <svg className={`w-5 h-5 ${
                              log.status === 'error' ? 'text-red-600' : 
                              log.status === 'warning' ? 'text-yellow-600' :
                              'text-green-600'
                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                                log.status === 'error' ? "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" :
                                log.status === 'warning' ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" :
                                "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              } />
                            </svg>
                            <h4 className={`font-semibold ${
                              log.status === 'error' ? 'text-red-900' : 
                              log.status === 'warning' ? 'text-yellow-900' :
                              'text-green-900'
                            }`}>
                              {log.webhookType === 'recordings' ? '🎥 Recording' : '💬 Message'} - {log.siteUrl}
                            </h4>
                          </div>
                          <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <span className={`text-sm font-medium ${
                              log.status === 'error' ? 'text-red-900' : 
                              log.status === 'warning' ? 'text-yellow-900' :
                              'text-green-900'
                            }`}>Message:</span>
                            <p className={`text-sm mt-1 ${
                              log.status === 'error' ? 'text-red-800' : 
                              log.status === 'warning' ? 'text-yellow-800' :
                              'text-green-800'
                            }`}>{log.message}</p>
                          </div>
                          
                          {log.meetingId && (
                            <div>
                              <span className="text-sm font-medium text-gray-700">Meeting ID:</span>
                              <span className="text-sm text-gray-600 ml-2 font-mono">{log.meetingId}</span>
                            </div>
                          )}
                          
                          {log.error && (
                            <div>
                              <span className="text-sm font-medium text-red-900">Error:</span>
                              <p className="text-sm text-red-800 mt-1">{log.error}</p>
                            </div>
                          )}
                          
                          {log.processingDetails && (
                            <div>
                              <span className="text-sm font-medium text-gray-700">Details:</span>
                              <p className="text-sm text-gray-600 mt-1">{log.processingDetails}</p>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>DB: {log.databaseAction || 'none'}</span>
                              <span>S3: {log.s3Upload ? '✅' : '❌'}</span>
                              <span>SSE: {log.sseNotification ? '✅' : '❌'}</span>
                            </div>
                            {log.trace && (
                              <button
                                onClick={() => {
                                  setSelectedTrace(log.trace);
                                  setShowTraceModal(true);
                                }}
                                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Show Detailed Trace
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showAddSite && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">{editingSiteIndex !== null ? 'Edit' : 'Add'} Webex Integration</h3>
                  <button onClick={() => setShowAddSite(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="border-b border-gray-200 mb-6">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setModalTab('meetings')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        modalTab === 'meetings'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Webex Meetings
                    </button>
                    <button
                      onClick={() => setModalTab('messaging')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        modalTab === 'messaging'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Webex Messaging
                    </button>
                  </nav>
                </div>
                
                {modalTab === 'meetings' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Site URL *</label>
                    <input
                      type="text"
                      value={newSite.siteUrl}
                      onChange={(e) => setNewSite({...newSite, siteUrl: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="netsync.webex.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Access Token * {editingSiteIndex !== null && <span className="text-xs text-gray-500">(leave blank to keep current)</span>}
                    </label>
                    <input
                      type="text"
                      value={newSite.accessToken}
                      onChange={(e) => setNewSite({...newSite, accessToken: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                      placeholder={editingSiteIndex !== null ? "Leave blank to keep current" : "Enter access token"}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Refresh Token * {editingSiteIndex !== null && <span className="text-xs text-gray-500">(leave blank to keep current)</span>}
                    </label>
                    <input
                      type="text"
                      value={newSite.refreshToken}
                      onChange={(e) => setNewSite({...newSite, refreshToken: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                      placeholder={editingSiteIndex !== null ? "Leave blank to keep current" : "Enter refresh token"}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Client ID * {editingSiteIndex !== null && <span className="text-xs text-gray-500">(leave blank to keep current)</span>}
                    </label>
                    <input
                      type="text"
                      value={newSite.clientId}
                      onChange={(e) => setNewSite({...newSite, clientId: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                      placeholder={editingSiteIndex !== null ? "Leave blank to keep current" : "Enter client ID"}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Client Secret * {editingSiteIndex !== null && <span className="text-xs text-gray-500">(leave blank to keep current)</span>}
                    </label>
                    <input
                      type="text"
                      value={newSite.clientSecret}
                      onChange={(e) => setNewSite({...newSite, clientSecret: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                      placeholder={editingSiteIndex !== null ? "Leave blank to keep current" : "Enter client secret"}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Recording Hosts (Email Addresses)</label>
                    {newSite.recordingHosts.map((host, index) => {
                      const hostEmail = typeof host === 'string' ? host : host.email || '';
                      const hostUserId = typeof host === 'object' ? host.userId : null;
                      return (
                      <div key={index} className="flex gap-2 mb-2">
                        <div className="flex-1">
                          <input
                            type="email"
                            value={hostEmail}
                            onChange={(e) => {
                              const updated = [...newSite.recordingHosts];
                              if (hostUserId) {
                                updated[index] = { email: e.target.value, userId: hostUserId };
                              } else {
                                updated[index] = e.target.value;
                              }
                              setNewSite({...newSite, recordingHosts: updated});
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="host@example.com"
                          />
                          {hostUserId && (
                            <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              User ID: {hostUserId.substring(0, 20)}...
                            </div>
                          )}
                        </div>
                        {newSite.recordingHosts.length > 1 && (
                          <button
                            onClick={() => {
                              const updated = newSite.recordingHosts.filter((_, i) => i !== index);
                              setNewSite({...newSite, recordingHosts: updated});
                            }}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );})}
                    <button
                      onClick={() => setNewSite({...newSite, recordingHosts: [...newSite.recordingHosts, '']})}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Another Host
                    </button>
                  </div>
                </div>
                )}
                
                {modalTab === 'messaging' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bot Name</label>
                    <input
                      type="text"
                      value={newSite.botName}
                      onChange={(e) => setNewSite({...newSite, botName: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="My Webex Bot"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bot Email</label>
                    <input
                      type="email"
                      value={newSite.botEmail}
                      onChange={(e) => setNewSite({...newSite, botEmail: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="bot@webex.bot"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bot Access Token * {editingSiteIndex !== null && <span className="text-xs text-gray-500">(leave blank to keep current)</span>}
                    </label>
                    <input
                      type="text"
                      value={newSite.botToken}
                      onChange={(e) => setNewSite({...newSite, botToken: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                      placeholder={editingSiteIndex !== null ? "Leave blank to keep current" : "Enter bot access token"}
                    />
                  </div>
                  
                  {(newSite.botToken || hasBotToken) && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Add Rooms to Monitor</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={roomSearch}
                            onChange={async (e) => {
                              const value = e.target.value;
                              setRoomSearch(value);
                              
                              if (value.trim()) {
                                setSearchingRooms(true);
                                setShowRoomDropdown(true);
                                try {
                                  const response = await fetch('/api/webexmessaging/rooms', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      siteUrl: newSite.siteUrl,
                                      botToken: newSite.botToken,
                                      search: value
                                    })
                                  });
                                  const data = await response.json();
                                  setRoomSearchResults(data.rooms || []);
                                } catch (error) {
                                  console.error('Error searching rooms:', error);
                                } finally {
                                  setSearchingRooms(false);
                                }
                              } else {
                                setRoomSearchResults([]);
                                setShowRoomDropdown(false);
                              }
                            }}
                            onFocus={async () => {
                              if (!roomSearchResults.length && !roomSearch) {
                                setSearchingRooms(true);
                                setShowRoomDropdown(true);
                                try {
                                  const response = await fetch('/api/webexmessaging/rooms', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      siteUrl: newSite.siteUrl,
                                      botToken: newSite.botToken
                                    })
                                  });
                                  const data = await response.json();
                                  setRoomSearchResults(data.rooms || []);
                                } catch (error) {
                                  console.error('Error loading rooms:', error);
                                } finally {
                                  setSearchingRooms(false);
                                }
                              } else if (roomSearchResults.length) {
                                setShowRoomDropdown(true);
                              }
                            }}
                            onBlur={() => setTimeout(() => setShowRoomDropdown(false), 200)}
                            placeholder="Type to search rooms..."
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            {searchingRooms ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            ) : (
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            )}
                          </div>
                          
                          {showRoomDropdown && roomSearchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {roomSearchResults
                                .filter(room => !newSite.monitoredRooms.find(r => r.id === room.id))
                                .map((room) => (
                                  <button
                                    key={room.id}
                                    onClick={() => {
                                      setNewSite({
                                        ...newSite,
                                        monitoredRooms: [...newSite.monitoredRooms, { id: room.id, title: room.title }]
                                      });
                                      setRoomSearch('');
                                      setShowRoomDropdown(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-blue-50"
                                  >
                                    <div className="font-medium text-gray-900">{room.title}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{room.type}</div>
                                  </button>
                                ))}
                              {roomSearchResults.every(room => newSite.monitoredRooms.find(r => r.id === room.id)) && (
                                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                  All matching rooms already added
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Monitored Rooms</label>
                        {newSite.monitoredRooms.length === 0 ? (
                          <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p className="text-sm text-gray-600">No rooms added yet</p>
                            <p className="text-xs text-gray-500 mt-1">Search and select rooms above to monitor</p>
                          </div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto space-y-2 p-1">
                            {newSite.monitoredRooms.map((room, index) => (
                              <div key={room.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-white rounded-lg border border-blue-200 hover:border-blue-300 transition-all group">
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-medium text-gray-900 truncate">{room.title}</h5>
                                  <p className="text-xs text-gray-500 truncate">{room.id}</p>
                                </div>
                                <button
                                  onClick={() => {
                                    setNewSite({
                                      ...newSite,
                                      monitoredRooms: newSite.monitoredRooms.filter((_, i) => i !== index)
                                    });
                                  }}
                                  className="ml-3 text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                  title="Remove room"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                )}
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowAddSite(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!newSite.siteUrl) {
                        alert('Site URL is required');
                        return;
                      }
                      
                      if (editingSiteIndex === null && (!newSite.accessToken || !newSite.refreshToken || !newSite.clientId || !newSite.clientSecret)) {
                        alert('Please fill in all required fields');
                        return;
                      }
                      
                      const validHosts = newSite.recordingHosts.filter(h => (typeof h === 'string' ? h.trim() : h.email?.trim()));
                      if (validHosts.length === 0) {
                        alert('Please add at least one recording host');
                        return;
                      }
                      
                      let updatedSites;
                      if (editingSiteIndex !== null) {
                        updatedSites = [...webexMeetingsSites];
                        updatedSites[editingSiteIndex] = {
                          ...updatedSites[editingSiteIndex],
                          siteUrl: newSite.siteUrl,
                          accessToken: newSite.accessToken || updatedSites[editingSiteIndex].accessToken,
                          refreshToken: newSite.refreshToken || updatedSites[editingSiteIndex].refreshToken,
                          clientId: newSite.clientId || updatedSites[editingSiteIndex].clientId,
                          clientSecret: newSite.clientSecret || updatedSites[editingSiteIndex].clientSecret,
                          recordingHosts: validHosts,
                          botName: newSite.botName || '',
                          botEmail: newSite.botEmail || '',
                          monitoredRooms: newSite.monitoredRooms || []
                        };
                      } else {
                        updatedSites = [...webexMeetingsSites, {
                          siteUrl: newSite.siteUrl,
                          accessToken: newSite.accessToken,
                          refreshToken: newSite.refreshToken,
                          clientId: newSite.clientId,
                          clientSecret: newSite.clientSecret,
                          recordingHosts: validHosts,
                          botName: newSite.botName || '',
                          botEmail: newSite.botEmail || '',
                          monitoredRooms: newSite.monitoredRooms || []
                        }];
                      }
                      
                      setSavingWebexMeetings(true);
                      try {
                        // Save bot token and monitored rooms if bot is configured
                        if (newSite.botToken || hasBotToken) {
                          const roomsResponse = await fetch('/api/webexmessaging/monitored-rooms', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              siteUrl: newSite.siteUrl,
                              botToken: newSite.botToken || undefined,
                              monitoredRooms: newSite.monitoredRooms || []
                            })
                          });
                          
                          if (!roomsResponse.ok) {
                            throw new Error('Failed to save bot configuration');
                          }
                        }
                        
                        const response = await fetch('/api/settings/webex-meetings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            enabled: webexMeetingsEnabled,
                            sites: updatedSites
                          })
                        });
                        
                        if (response.ok) {
                          const refreshResponse = await fetch('/api/settings/webex-meetings?t=' + Date.now());
                          const refreshData = await refreshResponse.json();
                          setWebexMeetingsSites(refreshData.sites || []);
                          setShowAddSite(false);
                          alert('Site saved successfully!');
                        } else {
                          const errorData = await response.json();
                          alert('Failed to save site: ' + (errorData.error || 'Unknown error'));
                        }
                      } catch (error) {
                        alert('Error saving site: ' + error.message);
                      } finally {
                        setSavingWebexMeetings(false);
                      }
                    }}
                    disabled={savingWebexMeetings}
                    className={`px-4 py-2 rounded-md ${savingWebexMeetings ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                  >
                    {savingWebexMeetings ? 'Saving...' : 'Save Site'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </SidebarLayout>
      
      {showTraceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Detailed Webhook Trace
                </h3>
                <button
                  onClick={() => {
                    setShowTraceModal(false);
                    setSelectedTrace(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <WebhookTraceViewer trace={selectedTrace} />
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowTraceModal(false);
                    setSelectedTrace(null);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
