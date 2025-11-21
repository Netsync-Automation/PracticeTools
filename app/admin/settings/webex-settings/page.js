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
  const [showSSMModal, setShowSSMModal] = useState(false);
  const [ssmSecrets, setSSMSecrets] = useState('');
  const [ssmEnvironment, setSSMEnvironment] = useState('');
  const [showAddBot, setShowAddBot] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newBot, setNewBot] = useState({
    friendlyName: '',
    name: '',
    practices: [],
    accessToken: '',
    resourceRoomId: '',
    resourceRoomName: ''
  });
  const [botRooms, setBotRooms] = useState([]);
  const [fetchingBotRooms, setFetchingBotRooms] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [savingToken, setSavingToken] = useState(false);
  const [saving, setSaving] = useState({ webex: false });
  const [selectedSpace, setSelectedSpace] = useState('');
  const [selectedResourceSpace, setSelectedResourceSpace] = useState('');

  const practicesList = PRACTICE_OPTIONS.sort();

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
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsEditMode(false);
                      setNewBot({
                        friendlyName: '',
                        name: '',
                        practices: [],
                        accessToken: ''
                      });
                      setCurrentStep(1);
                      setCompletedSteps([]);
                      setSelectedSpace('');
                      setBotRooms([]);
                      setShowAddBot(true);
                    }}
                    className="btn-primary flex items-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add WebEx Bot
                  </button>
                </div>
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
                            setSSMSecrets(data.yamlFormat);
                            setSSMEnvironment('Development');
                            setShowSSMModal(true);
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
                            setSSMSecrets(data.yamlFormat);
                            setSSMEnvironment('Production');
                            setShowSSMModal(true);
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
                            onClick={() => {
                              setIsEditMode(true);
                              setNewBot({
                                id: bot.id,
                                friendlyName: bot.friendlyName || '',
                                name: bot.name,
                                practices: bot.practices || [],
                                accessToken: '',
                                roomId: bot.roomId || '',
                                roomName: bot.roomName || '',
                                resourceRoomId: bot.resourceRoomId || '',
                                resourceRoomName: bot.resourceRoomName || ''
                              });
                              setCurrentStep(1);
                              setCompletedSteps([]);
                              setSelectedSpace(bot.roomId || '');
                              setSelectedResourceSpace(bot.resourceRoomId || '');
                              setShowAddBot(true);
                            }}
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

          {/* SSM Modal */}
          {showSSMModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">{ssmEnvironment} WebEx Bot SSM Parameters</h3>
                    <button
                      onClick={() => setShowSSMModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="mb-4">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(ssmSecrets);
                        alert('WebEx SSM parameters copied to clipboard!');
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                  
                  <textarea
                    value={ssmSecrets}
                    readOnly
                    rows="20"
                    className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
                    placeholder="No WebEx bots configured"
                  />
                  
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setShowSSMModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Add WebEx Bot Modal - Step Wizard */}
          {showAddBot && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-6 text-center">{isEditMode ? 'Edit WebEx Bot' : 'Add WebEx Bot'}</h3>
                  
                  {/* Step Progress Indicator */}
                  <div className="flex items-center justify-center mb-8">
                    <div className="flex items-center space-x-4">
                      {[1, 2, 3].map((step) => (
                        <div key={step} className="flex items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                            completedSteps.includes(step) 
                              ? 'bg-green-500 text-white' 
                              : currentStep === step 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-200 text-gray-500'
                          }`}>
                            {completedSteps.includes(step) ? '✓' : step}
                          </div>
                          {step < 3 && (
                            <div className={`w-16 h-1 mx-2 ${
                              completedSteps.includes(step) ? 'bg-green-500' : 'bg-gray-200'
                            }`} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Step Labels */}
                  <div className="flex justify-between mb-8 text-sm">
                    <div className={`text-center flex-1 ${
                      currentStep === 1 ? 'text-blue-600 font-medium' : 
                      completedSteps.includes(1) ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      Setup Bot Details
                    </div>
                    <div className={`text-center flex-1 ${
                      currentStep === 2 ? 'text-blue-600 font-medium' : 
                      completedSteps.includes(2) ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      Select Space
                    </div>
                    <div className={`text-center flex-1 ${
                      currentStep === 3 ? 'text-blue-600 font-medium' : 
                      completedSteps.includes(3) ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      Confirm Setup
                    </div>
                  </div>
                  
                  {/* Step 1: Bot Details */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="text-center mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Step 1: Setup Bot Details</h4>
                      <p className="text-sm text-gray-600">{isEditMode ? 'Update bot information and access token' : 'Enter bot information and save access token'}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Friendly Name *</label>
                      <input
                        type="text"
                        value={newBot.friendlyName}
                        onChange={(e) => setNewBot({...newBot, friendlyName: e.target.value})}
                        className="input-field"
                        placeholder="My WebEx Bot"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Bot E-mail *</label>
                      <input
                        type="email"
                        value={newBot.name}
                        onChange={(e) => setNewBot({...newBot, name: e.target.value})}
                        className="input-field"
                        placeholder="bot@webex.bot"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Select Practices *</label>
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded p-3 bg-gray-50">
                        {practicesList.map(practice => (
                          <label key={practice} className="flex items-center text-sm hover:bg-white p-1 rounded">
                            <input
                              type="checkbox"
                              checked={newBot.practices.includes(practice)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewBot({...newBot, practices: [...newBot.practices, practice]});
                                } else {
                                  setNewBot({...newBot, practices: newBot.practices.filter(p => p !== practice)});
                                }
                              }}
                              className="mr-2 h-4 w-4 text-blue-600"
                            />
                            {practice}
                          </label>
                        ))}
                      </div>
                      {newBot.practices.length > 0 && (
                        <p className="text-sm text-green-600 mt-2">✓ {newBot.practices.length} practice(s) selected</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Access Token {isEditMode ? '(leave blank to keep current)' : '*'}</label>
                      <input
                        type="password"
                        value={newBot.accessToken}
                        onChange={(e) => setNewBot({...newBot, accessToken: e.target.value})}
                        className="input-field"
                        placeholder={isEditMode ? "Leave blank to keep current token" : "WebEx bot access token"}
                      />
                    </div>
                    
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={async () => {
                          setSavingToken(true);
                          try {
                            if (isEditMode) {
                              setCompletedSteps([1]);
                              setCurrentStep(2);
                              
                              if (newBot.roomId || newBot.resourceRoomId) {
                                const practiceKey = newBot.practices.sort()[0].toUpperCase().replace(/[^A-Z0-9]/g, '_');
                                
                                const response = await fetch('/api/webex-bots/fetch-spaces', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ 
                                    ssmPrefix: practiceKey,
                                    accessToken: newBot.accessToken || null
                                  })
                                });
                                const data = await response.json();
                                if (response.ok) {
                                  setBotRooms(data.rooms || []);
                                } else {
                                  console.error('Fetch spaces failed:', data);
                                }
                              }
                              
                              if (newBot.accessToken) {
                                setBotRooms([]);
                              }
                            } else {
                              const response = await fetch('/api/webex-bots/save-token', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  practices: newBot.practices,
                                  accessToken: newBot.accessToken
                                })
                              });
                              
                              const result = await response.json();
                              
                              if (result.success) {
                                setCompletedSteps([1]);
                                setCurrentStep(2);
                                alert(`Access token saved! SSM parameters created with prefix: ${result.ssmPrefix}`);
                              } else {
                                alert('Failed to save access token: ' + (result.error || 'Unknown error'));
                              }
                            }
                          } catch (error) {
                            alert(isEditMode ? 'Error updating bot details' : 'Error saving access token');
                          } finally {
                            setSavingToken(false);
                          }
                        }}
                        disabled={!newBot.friendlyName || !newBot.name || newBot.practices.length === 0 || (!newBot.accessToken && !isEditMode) || savingToken}
                        className={`px-8 py-3 rounded-lg font-medium ${
                          !newBot.friendlyName || !newBot.name || newBot.practices.length === 0 || (!newBot.accessToken && !isEditMode) || savingToken
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {savingToken ? (isEditMode ? 'Updating...' : 'Saving Access Token...') : (isEditMode ? 'Update & Continue' : 'Save Access Token & Continue')}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Step 2: Configure Notification Spaces */}
                {currentStep === 2 && (
                  <div className="space-y-8">
                    <div className="text-center mb-6">
                      <h4 className="text-lg font-medium text-gray-900">Step 2: Configure Practice Issues Notifications</h4>
                      <p className="text-sm text-gray-600">
                        {isEditMode ? 'Update the WebEx space for Practice Issues notifications (required). Other notification spaces are optional.' : 'Configure the WebEx space for Practice Issues notifications (required). Other notification spaces are optional.'}
                      </p>
                    </div>
                    
                    {/* Fetch Spaces Button */}
                    <div className="flex justify-center mb-8">
                      <button
                        onClick={async () => {
                          setFetchingBotRooms(true);
                          try {
                            const practiceKey = newBot.practices.sort()[0].toUpperCase().replace(/[^A-Z0-9]/g, '_');
                            const response = await fetch('/api/webex-bots/fetch-spaces', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                ssmPrefix: practiceKey,
                                accessToken: newBot.accessToken || null
                              })
                            });
                            
                            const data = await response.json();
                            if (response.ok) {
                              setBotRooms(data.rooms || []);
                            } else {
                              alert(data.error || 'Error fetching spaces');
                            }
                          } catch (error) {
                            alert('Error fetching spaces');
                          } finally {
                            setFetchingBotRooms(false);
                          }
                        }}
                        disabled={fetchingBotRooms}
                        className={`inline-flex items-center gap-3 px-8 py-3 rounded-xl font-medium shadow-sm transition-all ${
                          fetchingBotRooms
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 hover:shadow-md'
                        }`}
                      >
                        {fetchingBotRooms ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                            Fetching Spaces...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Fetch Available Spaces
                          </>
                        )}
                      </button>
                    </div>
                    
                    {botRooms.length > 0 && (
                      <div className="space-y-8">
                        {/* Practice Issues Notifications - Required */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 shadow-sm">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h5 className="text-lg font-semibold text-gray-900">Practice Issues Notifications <span className="text-red-500">*</span></h5>
                              <p className="text-sm text-gray-600 mt-1">
                                Configure the WebEx space for issue tracking notifications, updates, and alerts (required)
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700">Select WebEx Space</label>
                            <div className="relative">
                              <select
                                value={selectedSpace}
                                onChange={(e) => {
                                  setSelectedSpace(e.target.value);
                                  const selectedRoom = botRooms.find(room => room.id === e.target.value);
                                  setNewBot({
                                    ...newBot,
                                    roomId: e.target.value,
                                    roomName: selectedRoom ? selectedRoom.title : ''
                                  });
                                }}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm transition-all"
                              >
                                <option value="">Choose a space for issue notifications...</option>
                                {botRooms.map((room) => (
                                  <option key={room.id} value={room.id}>
                                    {room.title}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                            {selectedSpace && (
                              <div className="flex items-center gap-2 p-3 bg-blue-100 rounded-lg">
                                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium text-blue-800">
                                  Selected: {botRooms.find(room => room.id === selectedSpace)?.title}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Resource Assignment Notifications - Optional */}
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-6 shadow-sm">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h5 className="text-lg font-semibold text-gray-900">Resource Assignment Notifications <span className="text-gray-500 text-sm">(Optional)</span></h5>
                              <p className="text-sm text-gray-600 mt-1">
                                Configure the WebEx space for resource assignment notifications and updates (optional)
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700">Select WebEx Space (Optional)</label>
                            <div className="relative">
                              <select
                                value={selectedResourceSpace}
                                onChange={(e) => {
                                  setSelectedResourceSpace(e.target.value);
                                  const selectedRoom = botRooms.find(room => room.id === e.target.value);
                                  setNewBot({
                                    ...newBot,
                                    resourceRoomId: e.target.value,
                                    resourceRoomName: selectedRoom ? selectedRoom.title : ''
                                  });
                                }}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm transition-all"
                              >
                                <option value="">Choose a space for resource notifications (optional)...</option>
                                {botRooms.map((room) => (
                                  <option key={room.id} value={room.id}>
                                    {room.title}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                            {selectedResourceSpace && (
                              <div className="flex items-center gap-2 p-3 bg-purple-100 rounded-lg">
                                <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium text-purple-800">
                                  Selected: {botRooms.find(room => room.id === selectedResourceSpace)?.title}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Continue Button */}
                        {selectedSpace && (
                          <div className="flex justify-center pt-6">
                            <button
                              onClick={async () => {
                                setSaving(prev => ({...prev, webex: true}));
                                try {
                                  const practiceKey = newBot.practices.sort()[0].toUpperCase().replace(/[^A-Z0-9]/g, '_');
                                  const response = await fetch('/api/webex-bots/save-room', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      ssmPrefix: practiceKey,
                                      roomId: newBot.roomId,
                                      roomName: newBot.roomName,
                                      resourceRoomId: newBot.resourceRoomId || '',
                                      resourceRoomName: newBot.resourceRoomName || ''
                                    })
                                  });
                                  
                                  const result = await response.json();
                                  
                                  if (result.success) {
                                    setCompletedSteps([1, 2]);
                                    setCurrentStep(3);
                                  } else {
                                    alert('Failed to save notification spaces');
                                  }
                                } catch (error) {
                                  alert('Error saving notification spaces');
                                } finally {
                                  setSaving(prev => ({...prev, webex: false}));
                                }
                              }}
                              disabled={saving.webex}
                              className={`inline-flex items-center gap-3 px-8 py-3 rounded-xl font-medium shadow-sm transition-all ${
                                saving.webex
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:shadow-md'
                              }`}
                            >
                              {saving.webex ? (
                                <>
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                                  Saving Spaces...
                                </>
                              ) : (
                                <>
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Save Notification Spaces & Continue
                                </>
                              )}
                            </button>
                          </div>
                        )}
                        
                        {/* Info Box */}
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                              <h6 className="text-sm font-medium text-gray-900 mb-1">Notification Space Configuration</h6>
                              <p className="text-sm text-gray-600">
                                Practice Issues notifications are required. Resource Assignment notifications are optional and can be configured later. 
                                You can use the same space for both notification types if desired.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Step 3: Confirm Setup */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="text-center mb-6">
                      <h4 className="text-lg font-medium text-gray-900">Step 3: Confirm {isEditMode ? 'Changes' : 'Setup'}</h4>
                      <p className="text-sm text-gray-600">Review your WebEx bot configuration and notification spaces</p>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bot E-mail</label>
                        <div className="text-sm text-gray-900 bg-white p-2 rounded border">{newBot.name}</div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Practices</label>
                        <div className="flex flex-wrap gap-1">
                          {newBot.practices.map(practice => (
                            <span key={practice} className="inline-flex px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                              {practice}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl border border-gray-200 p-8 shadow-lg">
                      <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">WebEx Notification Channels</h3>
                        <p className="text-gray-600 max-w-md mx-auto">Your configured WebEx spaces will receive automated notifications for different types of activities</p>
                      </div>
                      
                      <div className="grid gap-6">
                        {newBot.roomId && newBot.roomName ? (
                          <div className="group relative overflow-hidden bg-white rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-all duration-300">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5"></div>
                            <div className="relative p-6">
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="text-lg font-semibold text-gray-900">Practice Issues Channel</h4>
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Primary</span>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                    Receives notifications for new issues, status updates, comments, and resolution alerts from your practice's issue tracking system
                                  </p>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                      </svg>
                                      <span className="text-sm font-medium text-gray-900 truncate">{newBot.roomName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                      </svg>
                                      <span className="text-xs text-gray-500 font-mono truncate">{newBot.roomId}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-6">
                            <div className="flex items-center gap-4 text-gray-500">
                              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="font-medium">Practice Issues Channel</h4>
                                <p className="text-sm">Not configured</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {newBot.resourceRoomId && newBot.resourceRoomName ? (
                          <div className="group relative overflow-hidden bg-white rounded-2xl border border-purple-200 shadow-sm hover:shadow-md transition-all duration-300">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5"></div>
                            <div className="relative p-6">
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="text-lg font-semibold text-gray-900">Resource Assignment Channel</h4>
                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Secondary</span>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                    Receives notifications for new resource assignments, status changes, and team member allocations across projects
                                  </p>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                      </svg>
                                      <span className="text-sm font-medium text-gray-900 truncate">{newBot.resourceRoomName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                      </svg>
                                      <span className="text-xs text-gray-500 font-mono truncate">{newBot.resourceRoomId}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-6">
                            <div className="flex items-center gap-4 text-gray-500">
                              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="font-medium">Resource Assignment Channel</h4>
                                <p className="text-sm">Not configured</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {!newBot.roomId && !newBot.resourceRoomId && (
                          <div className="text-center py-12">
                            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">No Notification Channels Configured</h4>
                            <p className="text-gray-600 max-w-sm mx-auto">Go back to Step 2 to configure your WebEx notification spaces</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <button
                        onClick={async () => {
                          setSaving(prev => ({...prev, webex: true}));
                          try {
                            const practiceKey = newBot.practices.sort()[0].toUpperCase().replace(/[^A-Z0-9]/g, '_');
                            const method = isEditMode ? 'PUT' : 'POST';
                            const botResponse = await fetch('/api/webex-bots', {
                              method,
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                ...newBot,
                                ssmPrefix: practiceKey
                              })
                            });
                            
                            const botResult = await botResponse.json();
                            
                            if (botResult.success) {
                              setCompletedSteps([1, 2, 3]);
                              alert(isEditMode ? 'WebEx bot updated successfully!' : 'WebEx bot created successfully!');
                              setShowAddBot(false);
                              setNewBot({ name: '', practices: [], accessToken: '' });
                              setBotRooms([]);
                              setCurrentStep(1);
                              setCompletedSteps([]);
                              setSelectedSpace('');
                              setIsEditMode(false);
                              const botsResponse = await fetch('/api/webex-bots');
                              const botsData = await botsResponse.json();
                              setWebexBots(botsData.bots || []);
                            } else {
                              alert(isEditMode ? 'Failed to update bot configuration' : 'Failed to create bot configuration');
                            }
                          } catch (error) {
                            alert(isEditMode ? 'Error updating bot' : 'Error creating bot');
                          } finally {
                            setSaving(prev => ({...prev, webex: false}));
                          }
                        }}
                        disabled={saving.webex}
                        className={`px-8 py-3 rounded-lg font-medium ${
                          saving.webex
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {saving.webex ? (isEditMode ? 'Updating Bot...' : 'Creating Bot...') : (isEditMode ? 'Update Bot' : 'Complete Bot Setup')}
                      </button>
                    </div>
                  </div>
                )}
                  
                  {/* Cancel Button */}
                  <div className="flex justify-center mt-8 pt-6 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowAddBot(false);
                        setNewBot({ name: '', practices: [], accessToken: '' });
                        setBotRooms([]);
                        setCurrentStep(1);
                        setCompletedSteps([]);
                        setSelectedSpace('');
                        setIsEditMode(false);
                      }}
                      className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SidebarLayout>
    </div>
  );
}
