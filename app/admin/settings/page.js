'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CogIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import Navbar from '../../../components/Navbar';
import SidebarLayout from '../../../components/SidebarLayout';
import Breadcrumb from '../../../components/Breadcrumb';
import { useAuth } from '../../../hooks/useAuth';
import { PRACTICE_OPTIONS } from '../../../constants/practices';
import EmailRulesManager from '../../../components/EmailRulesManager';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    appName: 'Issue Tracker',
    loginLogo: null,
    navbarLogo: null,
    maxFileSize: '10',
    allowedFileTypes: '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg',
    autoCloseIssues: false,
    emailNotifications: true,
    webexNotifications: true,
    webexToken: '',
    webexRoomId: '',
    webexRoomName: '',

    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: ''
  });
  
  // WebEx bots state
  const [webexBots, setWebexBots] = useState([]);
  const [showAddBot, setShowAddBot] = useState(false);
  const [editingBot, setEditingBot] = useState(null);
  const [newBot, setNewBot] = useState({
    friendlyName: '',
    name: '',
    practices: [],
    accessToken: ''
  });
  const [botRooms, setBotRooms] = useState([]);
  const [fetchingBotRooms, setFetchingBotRooms] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [savingToken, setSavingToken] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState('');
  const [saving, setSaving] = useState({
    general: false,
    webex: false,
    email: false
  });
  const [rooms, setRooms] = useState([]);
  const [fetchingRooms, setFetchingRooms] = useState(false);
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [ssoSettings, setSsoSettings] = useState({
    ssoEnabled: false,
    duoEntityId: '',
    duoAcs: '',
    duoMetadata: '',
    duoCertificate: ''
  });
  const [savingSso, setSavingSso] = useState(false);
  const [creatingBoards, setCreatingBoards] = useState(false);
  
  // User management state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userFilters, setUserFilters] = useState({
    search: '',
    userType: '',
    role: '',
    authMethod: '',
    webexBot: '',
    status: ''
  });
  const [webexBotsForFilter, setWebexBotsForFilter] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forceReset, setForceReset] = useState(false);
  const [loadingActions, setLoadingActions] = useState({});
  const [syncingBots, setSyncingBots] = useState({});
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: '',
    role: 'practice_member',
    isAdmin: false,
    practices: [],
    auth_method: 'local'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [specifyPassword, setSpecifyPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  
  const practicesList = PRACTICE_OPTIONS.sort();

  // Check if current user can edit another user
  const canEditUser = (targetUser) => {
    // Admins can edit anyone
    if (user?.isAdmin) return true;
    
    // Practice managers and principals can only edit users in their practices or users with no practices
    if (user?.role === 'practice_manager' || user?.role === 'practice_principal') {
      const userPractices = user.practices || [];
      const targetPractices = targetUser.practices || [];
      
      // Can edit users with no practices assigned
      if (targetPractices.length === 0) return true;
      
      // Can edit users who share at least one practice
      return targetPractices.some(practice => userPractices.includes(practice));
    }
    
    return false;
  };

  const loadWebexToken = async () => {
    try {
      const response = await fetch('/api/webex/rooms?action=getToken');
      const data = await response.json();
      if (data.token) {
        setSettings(prev => ({...prev, webexToken: data.token}));
      }
    } catch (error) {
      console.error('Error loading token:', error);
    }
  };

  const loadWebexRoom = async () => {
    try {
      const response = await fetch('/api/webex/rooms?action=getRoomId');
      const data = await response.json();
      if (data.roomId) {
        setSettings(prev => ({...prev, webexRoomId: data.roomId}));
        // If we have rooms loaded, find the name for this ID
        if (rooms.length > 0) {
          const room = rooms.find(r => r.id === data.roomId);
          if (room) {
            setSettings(prev => ({...prev, webexRoomName: room.title}));
          }
        }
      }
    } catch (error) {
      console.error('Error loading room ID:', error);
    }
  };

  const loadWebexRoomName = async () => {
    try {
      const response = await fetch('/api/webex/rooms?action=getRoomName');
      const data = await response.json();

      if (data.roomName) {
        setSettings(prev => ({...prev, webexRoomName: data.roomName}));
      }
    } catch (error) {
      console.error('Error loading room name:', error);
    }
  };



  const saveWebexToken = async () => {
    try {
      await fetch('/api/webex/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.webexToken })
      });
    } catch (error) {
      console.error('Error saving token:', error);
    }
  };

  const saveWebexRoom = async () => {
    try {
      const response = await fetch('/api/webex/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: settings.webexRoomId })
      });
      const result = await response.json();
      if (result.success) {
        alert('Room saved successfully!');
      }
    } catch (error) {
      console.error('Error saving room:', error);
    }
  };

  const fetchWebexRooms = async () => {
    setFetchingRooms(true);
    try {
      const response = await fetch('/api/webex/rooms');
      const data = await response.json();
      if (response.ok) {
        setRooms(data.rooms || []);
      } else {
        alert(data.error || 'Error fetching rooms');
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      alert('Error fetching rooms');
    } finally {
      setFetchingRooms(false);
    }
  };

  // Filter tabs based on user role
  const isNonAdminPracticeUser = user && !user.isAdmin && (user.role === 'practice_manager' || user.role === 'practice_principal');
  
  const tabs = [
    { id: 'general', name: 'General Settings', icon: '⚙️' },
    { id: 'users', name: 'User Management', icon: '👥' },
    { id: 'practice', name: 'Practice Information', icon: '🏢' },
    { id: 'webex', name: 'WebEx Settings', icon: '💬' },
    { id: 'email', name: 'E-mail Settings', icon: '📧' },
    { id: 'resources', name: 'Resource Assignments', icon: '📋' },
    { id: 'sso', name: 'SSO Settings', icon: '🔐' }
  ]; // Show all tabs but restrict access

  useEffect(() => {
    if (user && !user.isAdmin && user.role !== 'practice_manager' && user.role !== 'practice_principal') {
      router.push('/');
      return;
    }
    
    // Force practice managers/principals to users tab
    if (isNonAdminPracticeUser && activeTab !== 'users') {
      setActiveTab('users');
    }
    
    if (user) {
      const loadData = async () => {
      // Load general settings
      if (activeTab === 'general') {
        try {
          const response = await fetch('/api/settings/general?t=' + Date.now());
          const data = await response.json();
          setSettings(prev => ({
            ...prev,
            appName: data.appName || 'Issue Tracker',
            loginLogo: data.loginLogo,
            navbarLogo: data.navbarLogo
          }));
        } catch (error) {
          console.error('Error loading general settings:', error);
        }
      }
      
      // Load email settings
      if (activeTab === 'email') {
        try {
          const response = await fetch('/api/settings/email?t=' + Date.now());
          const data = await response.json();
          setSettings(prev => ({
            ...prev,
            emailNotifications: data.emailNotifications,
            smtpHost: data.smtpHost,
            smtpPort: data.smtpPort,
            smtpUser: data.smtpUser,
            smtpPassword: data.smtpPassword
          }));
        } catch (error) {
          console.error('Error loading email settings:', error);
        }
      }
      
      // Load WebEx bots (practice-aware)
      if (activeTab === 'webex') {
        try {
          const response = await fetch('/api/admin/webex-bots?t=' + Date.now());
          const data = await response.json();
          setWebexBots(data.bots || []);
        } catch (error) {
          console.error('Error loading WebEx bots:', error);
        }
      }
      
      // Load SSO settings
      if (activeTab === 'sso') {
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
      }
      
      // Load users for user management tab
      if (activeTab === 'users') {
        fetchUsers();
        fetchWebexBotsForFilter();
      }
      
      // Load resource assignment settings
      if (activeTab === 'resources') {
        try {
          // Load resource settings
          const resourceResponse = await fetch('/api/settings/resources?t=' + Date.now());
          const resourceData = await resourceResponse.json();
          
          // Also load email settings to check if they're configured
          const emailResponse = await fetch('/api/settings/email?t=' + Date.now());
          const emailData = await emailResponse.json();
          
          setSettings(prev => ({
            ...prev,
            resourceEmailEnabled: resourceData.resourceEmailEnabled || false,
            emailNotifications: emailData.emailNotifications,
            smtpHost: emailData.smtpHost,
            smtpPort: emailData.smtpPort,
            smtpUser: emailData.smtpUser,
            smtpPassword: emailData.smtpPassword
          }));
        } catch (error) {
          console.error('Error loading resource settings:', error);
        }
      }

      };
      loadData();
    }
  }, [user, router, isNonAdminPracticeUser, activeTab]);
  
  // Set default practice team filter when webex bots are loaded
  useEffect(() => {
    if (isNonAdminPracticeUser && user.practices && user.practices.length > 0 && webexBots.length > 0) {
      // Find matching practice teams
      const userPractices = user.practices;
      const matchingBots = webexBots.filter(bot => 
        bot.practices && bot.practices.some(practice => userPractices.includes(practice))
      );
      
      if (matchingBots.length === 1) {
        // Auto-select if only one matching team
        setUserFilters(prev => ({...prev, webexBot: matchingBots[0].friendlyName || matchingBots[0].name}));
      }
    }
  }, [webexBots, isNonAdminPracticeUser, user?.practices]);

  // Update room name when rooms are loaded and we have a room ID
  useEffect(() => {
    if (rooms.length > 0 && settings.webexRoomId) {
      const room = rooms.find(r => r.id === settings.webexRoomId);
      if (room && room.title !== settings.webexRoomName) {
        setSettings(prev => ({...prev, webexRoomName: room.title}));
      }
    }
  }, [rooms.length, settings.webexRoomId, settings.webexRoomName]);

  const handleSaveGeneral = async () => {
    setSaving(prev => ({...prev, general: true}));
    try {
      const response = await fetch('/api/settings/general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          appName: settings.appName,
          loginLogo: settings.loginLogo,
          navbarLogo: settings.navbarLogo
        })
      });
      
      if (response.ok) {
        alert('General settings saved successfully!');
      } else {
        const result = await response.json();
        alert('Failed to save: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving general settings:', error);
      alert('Error saving general settings');
    } finally {
      setSaving(prev => ({...prev, general: false}));
    }
  };
  
  const handleAddBot = async () => {
    setSaving(prev => ({...prev, webex: true}));
    try {
      const response = await fetch('/api/webex-bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBot)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`WebEx bot created successfully! SSM parameters created with prefix: ${result.ssmPrefix}`);
        setShowAddBot(false);
        setNewBot({ name: '', practices: [], accessToken: '' });
        setBotRooms([]);
        setCurrentStep(1);
        setCompletedSteps([]);
        setSelectedSpace('');
        // Reload bots
        const botsResponse = await fetch('/api/webex-bots');
        const botsData = await botsResponse.json();
        setWebexBots(botsData.bots || []);
      } else {
        alert('Failed to create WebEx bot: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating WebEx bot:', error);
      alert('Error creating WebEx bot');
    } finally {
      setSaving(prev => ({...prev, webex: false}));
    }
  };
  
  const handleEditBot = async () => {
    setSaving(prev => ({...prev, webex: true}));
    try {
      const response = await fetch('/api/webex-bots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBot)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('WebEx bot updated successfully!');
        setEditingBot(null);
        // Reload bots
        const botsResponse = await fetch('/api/webex-bots');
        const botsData = await botsResponse.json();
        setWebexBots(botsData.bots || []);
      } else {
        alert('Failed to update WebEx bot: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating WebEx bot:', error);
      alert('Error updating WebEx bot');
    } finally {
      setSaving(prev => ({...prev, webex: false}));
    }
  };
  
  const handleDeleteBot = async (botId) => {
    if (!confirm('Are you sure you want to delete this WebEx bot?')) return;
    
    try {
      const response = await fetch(`/api/webex-bots?id=${botId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('WebEx bot deleted successfully!');
        // Reload bots
        const botsResponse = await fetch('/api/webex-bots');
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
  
  const handleSaveEmail = async () => {
    setSaving(prev => ({...prev, email: true}));
    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailNotifications: settings.emailNotifications,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUser: settings.smtpUser,
          smtpPassword: settings.smtpPassword !== '••••••••' ? settings.smtpPassword : undefined
        })
      });
      
      if (response.ok) {
        alert('Email settings saved successfully!');
      } else {
        alert('Failed to save email settings');
      }
    } catch (error) {
      console.error('Error saving email settings:', error);
      alert('Error saving email settings');
    } finally {
      setSaving(prev => ({...prev, email: false}));
    }
  };

  const handleTestEmail = async () => {
    setSendingTest(true);
    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          testEmail,
          appName: settings.appName
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Test email sent successfully!');
        setShowTestEmail(false);
        setTestEmail('');
      } else {
        alert(`Failed to send test email: ${data.error}`);
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      alert('Error sending test email');
    } finally {
      setSendingTest(false);
    }
  };
  
  // User management functions
  const fetchWebexBotsForFilter = async () => {
    try {
      const response = await fetch('/api/admin/webex-bots');
      const data = await response.json();
      setWebexBotsForFilter(data.bots || []);
    } catch (error) {
      console.error('Error fetching WebEx bots for filter:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setUsersLoading(false);
    }
  };
  
  const validatePracticeRoles = (role, practices, excludeEmail = null) => {
    if (role !== 'practice_manager' && role !== 'practice_principal') {
      return { valid: true };
    }
    
    for (const practice of practices) {
      const existingUser = users.find(user => 
        user.email !== excludeEmail &&
        user.role === role && 
        (user.practices || []).includes(practice)
      );
      
      if (existingUser) {
        return {
          valid: false,
          message: `There is already a ${role.replace('_', ' ')} for ${practice} practice (${existingUser.name})`
        };
      }
    }
    
    return { valid: true };
  };
  
  const handleAddUser = async () => {
    // Validate practice role constraints
    const validation = validatePracticeRoles(newUser.role, newUser.practices || []);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }
    
    setLoadingActions(prev => ({...prev, add: true}));
    try {
      const userData = {
        ...newUser,
        specifyPassword: specifyPassword
      };
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      if (response.ok) {
        fetchUsers();
        setShowAddUser(false);
        setNewUser({ email: '', name: '', password: '', role: 'practice_member', isAdmin: false, practices: [], auth_method: 'local' });
        setShowPassword(false);
        setSpecifyPassword(false);
      }
    } catch (error) {
      console.error('Error adding user:', error);
    } finally {
      setLoadingActions(prev => ({...prev, add: false}));
    }
  };
  
  const handleEditUser = async () => {
    // Validate practice role constraints (exclude current user from check)
    const validation = validatePracticeRoles(editingUser.role, editingUser.practices || [], editingUser.email);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }
    
    setLoadingActions(prev => ({...prev, edit: true}));
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(editingUser.email)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingUser.name,
          role: editingUser.role,
          isAdmin: editingUser.isAdmin,
          practices: editingUser.practices || [],
          status: 'active'
        })
      });
      
      if (response.ok) {
        fetchUsers();
        setEditingUser(null);
      }
    } catch (error) {
      console.error('Error editing user:', error);
    } finally {
      setLoadingActions(prev => ({...prev, edit: false}));
    }
  };
  
  const handleDeleteUser = async (email) => {
    setLoadingActions(prev => ({...prev, [email]: 'delete'}));
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchUsers();
        setShowDeleteModal(null);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    } finally {
      setLoadingActions(prev => ({...prev, [email]: false}));
    }
  };
  
  const handleResetPassword = async () => {
    if (!forceReset && (!newPassword || !confirmPassword)) {
      alert('Please enter and confirm the password');
      return;
    }
    
    if (!forceReset && newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    setLoadingActions(prev => ({...prev, resetPassword: true}));
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(resetPasswordUser.email)}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          password: forceReset ? null : newPassword,
          forceReset: forceReset
        })
      });
      
      if (response.ok) {
        setResetPasswordUser(null);
        setNewPassword('');
        setConfirmPassword('');
        setForceReset(false);
        alert(forceReset ? 'User will be required to reset password on next login!' : 'Password reset successfully!');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
    } finally {
      setLoadingActions(prev => ({...prev, resetPassword: false}));
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

        <div>
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
                      setActiveTab(tab.id);
                    }}
                    className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                      activeTab === tab.id
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

            {/* Tab Content */}
            {activeTab === 'general' && !isNonAdminPracticeUser && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">General Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Application Name</label>
                  <input
                    type="text"
                    value={settings.appName}
                    onChange={(e) => setSettings({...settings, appName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Login Logo</label>
                  <div className="space-y-3">
                    {settings.loginLogo && (
                      <div className="flex items-center gap-3">
                        <img src={settings.loginLogo} alt="Login Logo" className="h-16 w-auto border rounded" />
                        <span className="text-sm text-gray-600">Current login logo</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            setSettings({...settings, loginLogo: e.target.result});
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-sm text-gray-500">Upload image for login page logo</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Navbar Logo</label>
                  <div className="space-y-3">
                    {settings.navbarLogo && (
                      <div className="flex items-center gap-3">
                        <img src={settings.navbarLogo} alt="Navbar Logo" className="h-8 w-auto border rounded" />
                        <span className="text-sm text-gray-600">Current navbar logo</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            setSettings({...settings, navbarLogo: e.target.result});
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-sm text-gray-500">Upload image for navigation bar logo</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max File Size (MB)</label>
                  <input
                    type="number"
                    value={settings.maxFileSize}
                    onChange={(e) => setSettings({...settings, maxFileSize: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                  <p className="text-sm text-gray-500 mt-1">Comma-separated file extensions</p>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoClose"
                    checked={settings.autoCloseIssues}
                    onChange={(e) => setSettings({...settings, autoCloseIssues: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="autoClose" className="ml-2 block text-sm text-gray-900">
                    Auto-close resolved issues after 30 days
                  </label>
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleSaveGeneral}
                    disabled={saving.general}
                    className={`${saving.general ? 'btn-disabled' : 'btn-primary'}`}
                  >
                    {saving.general ? 'Saving...' : 'Save General Settings'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'webex' && !isNonAdminPracticeUser && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">WebEx Bot Management</h2>
                  <button
                    onClick={() => setShowAddBot(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add WebEx Bot
                  </button>
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
                                <span className="font-medium">Room:</span> {bot.roomName}
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
                              onClick={() => setEditingBot({...bot})}
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
            )}

            {false && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">SSO Settings</h2>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="ssoEnabled"
                    checked={settings.ssoEnabled}
                    onChange={(e) => setSettings({...settings, ssoEnabled: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="ssoEnabled" className="ml-2 block text-sm text-gray-900">
                    Enable Single Sign-On
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SSO Provider</label>
                  <select
                    value={settings.ssoProvider}
                    onChange={(e) => setSettings({...settings, ssoProvider: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="duo">Duo Security</option>
                    <option value="azure">Azure AD</option>
                    <option value="okta">Okta</option>
                    <option value="google">Google Workspace</option>
                  </select>
                </div>
                
                {settings.ssoProvider === 'duo' && (
                  <div className="space-y-6 p-6 bg-gray-50 rounded-lg border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Duo Security SAML Configuration</h3>
                      
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">SAML Issuer (SP Entity ID)</label>
                        <input
                          type="text"
                          value={settings.duoIssuer || 'urn:amazon:webservices:issuestracker'}
                          onChange={(e) => setSettings({...settings, duoIssuer: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="urn:amazon:webservices:issuestracker"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Duo API Hostname</label>
                        <input
                          type="text"
                          value={settings.duoApiHostname || ''}
                          onChange={(e) => setSettings({...settings, duoApiHostname: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="api-xxxxxxxx.duosecurity.com"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">SAML Entry Point (IdP SSO URL)</label>
                      <input
                        type="url"
                        value={settings.duoEntryPoint || ''}
                        onChange={(e) => setSettings({...settings, duoEntryPoint: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://api-xxxxxxxx.duosecurity.com/saml2/idp/sso"
                      />
                    </div>
                      
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">SAML Logout URL (IdP SLO URL)</label>
                      <input
                        type="url"
                        value={settings.duoLogoutUrl || ''}
                        onChange={(e) => setSettings({...settings, duoLogoutUrl: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://api-xxxxxxxx.duosecurity.com/saml2/idp/slo"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">IdP Certificate (X.509)</label>
                      <textarea
                        value={settings.duoCertificate || ''}
                        onChange={(e) => setSettings({...settings, duoCertificate: e.target.value})}
                        rows="8"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                        placeholder="-----BEGIN CERTIFICATE-----&#10;MIICXjCCAcegAwIBAgIBADANBgkqhkiG9w0BAQ0FADBLMQswCQYDVQQGEwJ1czEL&#10;...&#10;-----END CERTIFICATE-----"
                      />
                      <p className="text-sm text-gray-500 mt-1">Download from Duo Admin Panel → Applications → Your App → Certificate</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">SP Private Key (Optional - for request signing)</label>
                      <textarea
                        value={settings.duoPrivateKey || ''}
                        onChange={(e) => setSettings({...settings, duoPrivateKey: e.target.value})}
                        rows="6"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                        placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...&#10;-----END PRIVATE KEY-----"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="signRequests"
                          checked={settings.duoSignRequests || false}
                          onChange={(e) => setSettings({...settings, duoSignRequests: e.target.checked})}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="signRequests" className="ml-2 block text-sm text-gray-900">
                          Sign SAML Requests
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="forceAuthn"
                          checked={settings.duoForceAuthn || false}
                          onChange={(e) => setSettings({...settings, duoForceAuthn: e.target.checked})}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="forceAuthn" className="ml-2 block text-sm text-gray-900">
                          Force Re-authentication
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="autoProvision"
                          checked={settings.ssoAutoProvision || true}
                          onChange={(e) => setSettings({...settings, ssoAutoProvision: e.target.checked})}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="autoProvision" className="ml-2 block text-sm text-gray-900">
                          Auto-provision Users
                        </label>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Admin Email Domains</label>
                      <input
                        type="text"
                        value={settings.ssoAdminDomains || ''}
                        onChange={(e) => setSettings({...settings, ssoAdminDomains: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="yourdomain.com,anotherdomain.com"
                      />
                      <p className="text-sm text-gray-500 mt-1">Users from these domains will be granted admin access</p>
                    </div>
                    
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-900 mb-3">Duo Configuration</h4>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-blue-700 mb-2">1. Download SAML metadata file for Duo:</p>
                          <button
                            onClick={() => {
                              const url = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
                              window.open(`${url}/api/auth/saml/metadata`, '_blank');
                            }}
                            className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Download Metadata XML
                          </button>
                        </div>
                        
                        <div>
                          <p className="text-sm text-blue-700 mb-2">2. Or use these URLs manually in Duo:</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-blue-600 w-16">ACS URL:</span>
                              <code className="flex-1 px-2 py-1 bg-white border rounded text-xs font-mono">
                                {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/auth/saml/callback
                              </code>
                              <button
                                onClick={() => {
                                  const url = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
                                  navigator.clipboard.writeText(`${url}/api/auth/saml/callback`);
                                  alert('ACS URL copied!');
                                }}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Copy
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-blue-600 w-16">Entity ID:</span>
                              <code className="flex-1 px-2 py-1 bg-white border rounded text-xs font-mono">
                                {settings.duoIssuer || 'urn:amazon:webservices:issuestracker'}
                              </code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(settings.duoIssuer || 'urn:amazon:webservices:issuestracker');
                                  alert('Entity ID copied!');
                                }}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/auth/duo/test', { method: 'POST' });
                            const data = await response.json();
                            
                            if (data.success) {
                              const passedTests = data.results.tests.filter(t => t.status === 'pass').length;
                              const totalTests = data.results.tests.length;
                              const details = data.results.tests.map(t => `${t.name}: ${t.message}`).join('\n');
                              
                              alert(`Duo Test Results (${passedTests}/${totalTests} passed):\n\n${details}`);
                            } else {
                              alert(`Test failed: ${data.error}`);
                            }
                          } catch (error) {
                            alert('Test failed: Unable to connect to test endpoint');
                          }
                        }}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Test Configuration
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'practice' && !isNonAdminPracticeUser && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Practice Information Settings</h2>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-blue-800">Practice Board Management</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Practice boards are automatically created based on Practice Manager role assignments. 
                        Each Practice Manager gets a board for all their assigned practices.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Practice Board Creation</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Use this button to create any missing practice boards for existing Practice Managers. 
                      This will scan all users with the Practice Manager role and create boards for their assigned practices.
                    </p>
                    
                    <div className="flex gap-4">
                      <button
                        onClick={async () => {
                          setCreatingBoards(true);
                          try {
                            const response = await fetch('/api/practice-boards/initialize', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' }
                            });
                            
                            const data = await response.json();
                            
                            if (data.success) {
                              const created = data.results.filter(r => r.status === 'created').length;
                              const existing = data.results.filter(r => r.status === 'already_exists').length;
                              const errors = data.results.filter(r => r.status === 'error').length;
                              
                              let message = `Practice Board Creation Complete!\n\n`;
                              message += `Practice Managers Found: ${data.practiceManagersFound}\n`;
                              message += `Boards Created: ${created}\n`;
                              message += `Boards Already Existed: ${existing}\n`;
                              
                              if (errors > 0) {
                                message += `Errors: ${errors}\n\n`;
                                message += 'Check console for error details.';
                              }
                              
                              alert(message);
                            } else {
                              alert('Failed to create practice boards: ' + data.error);
                            }
                          } catch (error) {
                            console.error('Error creating practice boards:', error);
                            alert('Error creating practice boards');
                          } finally {
                            setCreatingBoards(false);
                          }
                        }}
                        disabled={creatingBoards}
                        title="Create any missing Practice Boards based on Practice Managers and which Practices they manage"
                        className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                          creatingBoards
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {creatingBoards ? 'Creating Practice Boards...' : 'Create Practice Boards'}
                      </button>
                      
                      <button
                        onClick={async () => {
                          if (!confirm('Are you sure you want to delete ALL practice boards? This will permanently remove all boards, columns, cards, and data.')) {
                            return;
                          }
                          
                          setCreatingBoards(true);
                          try {
                            const response = await fetch('/api/practice-boards/delete-all', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' }
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
                            console.error('Error deleting practice boards:', error);
                            alert('Error deleting practice boards');
                          } finally {
                            setCreatingBoards(false);
                          }
                        }}
                        disabled={creatingBoards}
                        title="Delete all existing practice boards - WARNING: This will permanently remove all data"
                        className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                          creatingBoards
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                      >
                        {creatingBoards ? 'Deleting...' : 'Delete All Practice Boards'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-2">How Practice Boards Work</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Each Practice Manager gets one board for all their assigned practices</li>
                      <li>• Multiple practices assigned to the same manager share one board</li>
                      <li>• Practice members can access boards for practices they belong to</li>
                      <li>• Boards are created automatically when assigning Practice Manager roles</li>
                      <li>• Use the button above to create boards for existing Practice Managers</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        const botCount = webexBots.length;
                        if (botCount === 0) {
                          alert('No WebEx bots configured. Please configure WebEx bots in the WebEx Settings tab first.');
                          return;
                        }
                        
                        const botNames = webexBots.map(bot => bot.friendlyName || bot.name).join(', ');
                        
                        const confirmed = confirm(
                          `This will synchronize users from ALL ${botCount} configured WebEx bots:\n\n${botNames}\n\nThis may take a few moments. Continue?`
                        );
                        
                        if (!confirmed) return;
                        
                        try {
                          // Sync all bots sequentially
                          let totalSynced = 0;
                          let errors = [];
                          
                          for (const bot of webexBots) {
                            try {
                              const response = await fetch('/api/webex/sync-bot', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ botId: bot.id })
                              });
                              const data = await response.json();
                              if (data.success) {
                                totalSynced++;
                              } else {
                                errors.push(`${bot.friendlyName || bot.name}: ${data.error}`);
                              }
                            } catch (error) {
                              errors.push(`${bot.friendlyName || bot.name}: Sync failed`);
                            }
                          }
                          
                          if (errors.length === 0) {
                            alert(`Successfully synchronized users from all ${totalSynced} WebEx bots!`);
                          } else {
                            alert(`Synchronized ${totalSynced} bots successfully.\n\nErrors:\n${errors.join('\n')}`);
                          }
                          
                          fetchUsers();
                        } catch (error) {
                          alert('Sync failed');
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      disabled={webexBots.length === 0}
                      title="Sync users from ALL configured WebEx bots"
                    >
                      Sync WebEx Users
                    </button>
                    <button
                      onClick={() => setShowAddUser(true)}
                      className="btn-primary flex items-center gap-2"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add User
                    </button>
                  </div>
                </div>
                
                {/* Modern Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                      </svg>
                      Filter Users
                    </h3>
                    <button
                      onClick={() => {
                        if (isNonAdminPracticeUser && user.practices && user.practices.length > 0) {
                          // For practice users, reset but maintain their practice team restriction
                          const userPractices = user.practices;
                          const matchingBots = webexBots.filter(bot => 
                            bot.practices && bot.practices.some(practice => userPractices.includes(practice))
                          );
                          
                          const defaultTeam = matchingBots.length === 1 ? matchingBots[0].friendlyName || matchingBots[0].name : '';
                          setUserFilters({ search: '', userType: '', role: '', authMethod: '', webexBot: defaultTeam, status: '' });
                        } else {
                          // For admins, full reset
                          setUserFilters({ search: '', userType: '', role: '', authMethod: '', webexBot: '', status: '' });
                        }
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset
                    </button>
                  </div>
                  
                  {/* Search Bar */}
                  <div className="relative mb-6">
                    <svg className="h-5 w-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by name, email..."
                      value={userFilters.search}
                      onChange={(e) => setUserFilters({...userFilters, search: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
                    />
                  </div>
                  
                  {/* Filter Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {/* User Type Filter */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">User Type</label>
                      <select
                        value={userFilters.userType}
                        onChange={(e) => setUserFilters({...userFilters, userType: e.target.value, webexBot: ''})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                      >
                        <option value="">All Types</option>
                        <option value="local">Local Users</option>
                        <option value="webex">WebEx Synchronized Users</option>
                      </select>
                    </div>
                    
                    {/* Practice Team Filter */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Practice Team</label>
                      <select
                        value={userFilters.webexBot}
                        onChange={(e) => setUserFilters({...userFilters, webexBot: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                      >
                        {!isNonAdminPracticeUser && <option value="">All Teams</option>}
                        {webexBots.filter(bot => {
                          // Filter bots based on user's practices for non-admin practice users
                          if (isNonAdminPracticeUser && user.practices && user.practices.length > 0) {
                            return bot.practices && bot.practices.some(practice => user.practices.includes(practice));
                          }
                          return true; // Show all bots for admins
                        }).map(bot => (
                          <option key={bot.id} value={bot.friendlyName || bot.name}>
                            {bot.friendlyName || bot.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Role Filter */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Role</label>
                      <select
                        value={userFilters.role}
                        onChange={(e) => setUserFilters({...userFilters, role: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                      >
                        <option value="">All Roles</option>
                        <option value="netsync_employee">NetSync Employee</option>
                        <option value="practice_manager">Practice Manager</option>
                        <option value="practice_member">Practice Member</option>
                        <option value="practice_principal">Practice Principal</option>
                      </select>
                    </div>
                    
                    {/* Auth Method Filter */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Auth Method</label>
                      <select
                        value={userFilters.authMethod}
                        onChange={(e) => setUserFilters({...userFilters, authMethod: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                      >
                        <option value="">All Methods</option>
                        <option value="local">Local</option>
                        <option value="sso">SSO</option>
                      </select>
                    </div>
                    
                    {/* Status Filter */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={userFilters.status}
                        onChange={(e) => setUserFilters({...userFilters, status: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                      >
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="staged">Staged</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Active Filters Display */}
                  {(userFilters.search || userFilters.userType || userFilters.role || userFilters.authMethod || userFilters.webexBot || userFilters.status) && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-600">Active filters:</span>
                        {userFilters.search && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            Search: "{userFilters.search}"
                            <button onClick={() => setUserFilters({...userFilters, search: ''})} className="hover:bg-blue-200 rounded-full p-0.5">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {userFilters.userType && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            Type: {userFilters.userType === 'local' ? 'Local Users' : 'WebEx Synchronized Users'}
                            <button onClick={() => setUserFilters({...userFilters, userType: '', webexBot: ''})} className="hover:bg-green-200 rounded-full p-0.5">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {userFilters.role && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                            Role: {userFilters.role.replace('_', ' ')}
                            <button onClick={() => setUserFilters({...userFilters, role: ''})} className="hover:bg-purple-200 rounded-full p-0.5">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {userFilters.authMethod && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                            Auth: {userFilters.authMethod === 'sso' ? 'SSO' : 'Local'}
                            <button onClick={() => setUserFilters({...userFilters, authMethod: ''})} className="hover:bg-orange-200 rounded-full p-0.5">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {userFilters.webexBot && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                            Team: {userFilters.webexBot}
                            <button onClick={() => setUserFilters({...userFilters, webexBot: ''})} className="hover:bg-indigo-200 rounded-full p-0.5">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </span>
                        )}
                        {userFilters.status && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                            Status: {userFilters.status}
                            <button onClick={() => setUserFilters({...userFilters, status: ''})} className="hover:bg-yellow-200 rounded-full p-0.5">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {usersLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Practices</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Practice Team</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auth Method</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.filter(userItem => {
                          // Search filter
                          if (userFilters.search) {
                            const searchLower = userFilters.search.toLowerCase();
                            const matchesSearch = 
                              userItem.name.toLowerCase().includes(searchLower) ||
                              userItem.email.toLowerCase().includes(searchLower);
                            if (!matchesSearch) return false;
                          }
                          
                          // User type filter
                          if (userFilters.userType === 'local' && userItem.created_from === 'webex_sync') return false;
                          if (userFilters.userType === 'webex' && userItem.created_from !== 'webex_sync') return false;
                          
                          // Practice Team filter (by webex_bot_source)
                          if (userFilters.webexBot && userItem.webex_bot_source !== userFilters.webexBot) return false;
                          
                          // For non-admin practice users, only show WebEx synchronized users
                          if (isNonAdminPracticeUser && userItem.created_from !== 'webex_sync') return false;
                          
                          // Role filter
                          if (userFilters.role && userItem.role !== userFilters.role) return false;
                          
                          // Auth method filter
                          if (userFilters.authMethod && userItem.auth_method !== userFilters.authMethod) return false;
                          
                          // Status filter
                          if (userFilters.status && userItem.status !== userFilters.status) return false;
                          
                          return true;
                        }).map((userItem) => (
                          <tr key={userItem.email} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{userItem.name}</div>
                                <div className="text-sm text-gray-500">{userItem.email}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                userItem.status === 'staged'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {userItem.status === 'staged' ? 'Staged' : 'Active'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex gap-1">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  userItem.role === 'practice_principal'
                                    ? 'bg-blue-100 text-blue-800'
                                    : userItem.role === 'practice_manager'
                                    ? 'bg-orange-100 text-orange-800'
                                    : userItem.role === 'netsync_employee'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {userItem.role.replace('_', ' ')}
                                </span>
                                {userItem.isAdmin && (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                    Admin
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {(userItem.practices || []).map(practice => (
                                  <span key={practice} className="inline-flex px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                                    {practice}
                                  </span>
                                ))}
                                {(!userItem.practices || userItem.practices.length === 0) && (
                                  <span className="text-xs text-gray-400">No practices assigned</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900">
                                {userItem.webex_bot_source || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                userItem.created_from === 'webex_sync'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {userItem.created_from === 'webex_sync' ? 'WebEx' : 'Local'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                userItem.auth_method === 'local' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {userItem.auth_method === 'sso' ? 'SSO' : 'Local'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(userItem.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex gap-2">
                                {canEditUser(userItem) ? (
                                  <button
                                    onClick={() => setEditingUser({...userItem})}
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded"
                                    title="Edit User"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="text-gray-300 p-2 rounded cursor-not-allowed"
                                    title="No permission to edit this user"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                )}
                                {userItem.auth_method === 'local' && canEditUser(userItem) && (
                                  <button
                                    onClick={() => setResetPasswordUser(userItem)}
                                    className="text-orange-600 hover:text-orange-800 hover:bg-orange-50 p-2 rounded"
                                    title="Reset Password"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                  </button>
                                )}
                                {userItem.email !== 'admin@localhost' && userItem.created_from !== 'system_default' && canEditUser(userItem) && (
                                  <button
                                    onClick={() => setShowDeleteModal(userItem)}
                                    className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded"
                                    title="Delete User"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'sso' && !isNonAdminPracticeUser && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">SSO Settings</h2>
                
                {/* SSO Enable/Disable */}
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
                
                {/* Read-only fields */}
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
                
                {/* File upload fields */}
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
                          const response = await fetch('/api/admin/sso-settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
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
                      className={`${savingSso ? 'btn-disabled' : 'btn-primary'}`}
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
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Validate SAML
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'email' && !isNonAdminPracticeUser && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">E-mail Settings</h2>
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
                      disabled={saving.email}
                      className={`${saving.email ? 'btn-disabled' : 'btn-primary'}`}
                    >
                      {saving.email ? 'Saving...' : 'Save Email Settings'}
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
            )}

            {activeTab === 'resources' && !isNonAdminPracticeUser && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Resource Assignment Email Processing</h2>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-blue-800">Automated Resource Assignment Creation</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Configure email monitoring to automatically create resource assignments from specific email patterns. 
                        The system will monitor the configured email account for messages matching sender and subject patterns, 
                        then extract data using keyword mappings to populate new resource assignments.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center mb-6">
                  <input
                    type="checkbox"
                    id="resourceEmailEnabled"
                    checked={settings.resourceEmailEnabled || false}
                    onChange={(e) => setSettings({...settings, resourceEmailEnabled: e.target.checked})}
                    disabled={!settings.emailNotifications || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword}
                    className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${
                      !settings.emailNotifications || !settings.smtpHost ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                  <label htmlFor="resourceEmailEnabled" className={`ml-2 block text-sm ${
                    !settings.emailNotifications || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword ? 'text-gray-400' : 'text-gray-900'
                  }`}>
                    Enable Resource Assignment Email Processing
                  </label>
                </div>
                
                {(!settings.emailNotifications || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword) && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
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
                        setSaving(prev => ({...prev, resources: true}));
                        try {
                          const response = await fetch('/api/settings/resources', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
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
                          setSaving(prev => ({...prev, resources: false}));
                        }
                      }}
                      disabled={saving.resources}
                      className={`${saving.resources ? 'btn-disabled' : 'btn-primary'}`}
                    >
                      {saving.resources ? 'Saving...' : 'Save Settings'}
                    </button>
                    
                    {settings.resourceEmailEnabled && (
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/email/process', { method: 'POST' });
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
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Process Emails Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
        
        {/* Add WebEx Bot Modal - Step Wizard */}
        {showAddBot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-6 text-center">Add WebEx Bot</h3>
                
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
                      <p className="text-sm text-gray-600">Enter bot information and save access token</p>
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
                      <label className="block text-sm font-medium mb-2">Access Token *</label>
                      <input
                        type="password"
                        value={newBot.accessToken}
                        onChange={(e) => setNewBot({...newBot, accessToken: e.target.value})}
                        className="input-field"
                        placeholder="WebEx bot access token"
                      />
                    </div>
                    
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={async () => {
                          setSavingToken(true);
                          try {
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
                          } catch (error) {
                            alert('Error saving access token');
                          } finally {
                            setSavingToken(false);
                          }
                        }}
                        disabled={!newBot.friendlyName || !newBot.name || newBot.practices.length === 0 || !newBot.accessToken || savingToken}
                        className={`px-8 py-3 rounded-lg font-medium ${
                          !newBot.friendlyName || !newBot.name || newBot.practices.length === 0 || !newBot.accessToken || savingToken
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {savingToken ? 'Saving Access Token...' : 'Save Access Token & Continue'}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Step 2: Select Space */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="text-center mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Step 2: Select WebEx Space</h4>
                      <p className="text-sm text-gray-600">Choose which space the bot will send notifications to</p>
                    </div>
                    
                    <div className="flex justify-center mb-6">
                      <button
                        onClick={async () => {
                          setFetchingBotRooms(true);
                          try {
                            const practiceKey = newBot.practices.sort()[0].toUpperCase().replace(/[^A-Z0-9]/g, '_');
                            const response = await fetch('/api/webex-bots/fetch-spaces', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ ssmPrefix: practiceKey })
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
                        className={`px-8 py-3 rounded-lg font-medium ${
                          fetchingBotRooms
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {fetchingBotRooms ? 'Fetching Spaces...' : 'Fetch Available Spaces'}
                      </button>
                    </div>
                    
                    {botRooms.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Available Spaces</label>
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
                          className="input-field mb-4"
                        >
                          <option value="">Select a space...</option>
                          {botRooms.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.title}
                            </option>
                          ))}
                        </select>
                        
                        {selectedSpace && (
                          <div className="flex justify-center">
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
                                      roomName: newBot.roomName
                                    })
                                  });
                                  
                                  const result = await response.json();
                                  
                                  if (result.success) {
                                    setCompletedSteps([1, 2]);
                                    setCurrentStep(3);
                                  } else {
                                    alert('Failed to save space');
                                  }
                                } catch (error) {
                                  alert('Error saving space');
                                } finally {
                                  setSaving(prev => ({...prev, webex: false}));
                                }
                              }}
                              disabled={saving.webex}
                              className={`px-8 py-3 rounded-lg font-medium ${
                                saving.webex
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              {saving.webex ? 'Saving Space...' : 'Save Space & Continue'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Step 3: Confirm Setup */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="text-center mb-6">
                      <h4 className="text-lg font-medium text-gray-900">Step 3: Confirm Setup</h4>
                      <p className="text-sm text-gray-600">Review your WebEx bot configuration</p>
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
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Selected Space</label>
                        <div className="text-sm text-gray-900 bg-white p-2 rounded border">{newBot.roomName}</div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Space ID</label>
                        <div className="text-sm text-gray-600 bg-white p-2 rounded border font-mono">{newBot.roomId}</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <button
                        onClick={async () => {
                          setSaving(prev => ({...prev, webex: true}));
                          try {
                            const practiceKey = newBot.practices.sort()[0].toUpperCase().replace(/[^A-Z0-9]/g, '_');
                            const botResponse = await fetch('/api/webex-bots', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                ...newBot,
                                ssmPrefix: practiceKey
                              })
                            });
                            
                            const botResult = await botResponse.json();
                            
                            if (botResult.success) {
                              setCompletedSteps([1, 2, 3]);
                              alert('WebEx bot created successfully!');
                              setShowAddBot(false);
                              setNewBot({ name: '', practices: [], accessToken: '' });
                              setBotRooms([]);
                              setCurrentStep(1);
                              setCompletedSteps([]);
                              setSelectedSpace('');
                              const botsResponse = await fetch('/api/webex-bots');
                              const botsData = await botsResponse.json();
                              setWebexBots(botsData.bots || []);
                            } else {
                              alert('Failed to create bot configuration');
                            }
                          } catch (error) {
                            alert('Error creating bot');
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
                        {saving.webex ? 'Creating Bot...' : 'Complete Bot Setup'}
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
        
        {/* Edit WebEx Bot Modal */}
        {editingBot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Edit WebEx Bot</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Friendly Name</label>
                    <input
                      type="text"
                      value={editingBot.friendlyName || ''}
                      onChange={(e) => setEditingBot({...editingBot, friendlyName: e.target.value})}
                      className="input-field"
                      placeholder="My WebEx Bot"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Bot Email</label>
                    <input
                      type="email"
                      value={editingBot.name}
                      onChange={(e) => setEditingBot({...editingBot, name: e.target.value})}
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Practices</label>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-gray-300 rounded p-2">
                      {practicesList.map(practice => (
                        <label key={practice} className="flex items-center text-sm">
                          <input
                            type="checkbox"
                            checked={editingBot.practices.includes(practice)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingBot({...editingBot, practices: [...editingBot.practices, practice]});
                              } else {
                                setEditingBot({...editingBot, practices: editingBot.practices.filter(p => p !== practice)});
                              }
                            }}
                            className="mr-2 h-3 w-3"
                          />
                          {practice}
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Access Token</label>
                    <input
                      type="password"
                      value={editingBot.accessToken || ''}
                      onChange={(e) => setEditingBot({...editingBot, accessToken: e.target.value})}
                      className="input-field"
                      placeholder="Leave blank to keep current token"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Room ID</label>
                    <input
                      type="text"
                      value={editingBot.roomId || ''}
                      onChange={(e) => setEditingBot({...editingBot, roomId: e.target.value})}
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Room Name</label>
                    <input
                      type="text"
                      value={editingBot.roomName || ''}
                      onChange={(e) => setEditingBot({...editingBot, roomName: e.target.value})}
                      className="input-field"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setEditingBot(null)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditBot}
                    disabled={saving.webex}
                    className={`flex-1 ${saving.webex ? 'btn-disabled' : 'btn-primary'}`}
                  >
                    {saving.webex ? 'Updating...' : 'Update Bot'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Test Email Modal */}
        {showTestEmail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Test Email</h3>
                <p className="text-gray-600 mb-6">
                  Enter an email address to send a test message
                </p>
                
                <div className="mb-6">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowTestEmail(false);
                      setTestEmail('');
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTestEmail}
                    disabled={!testEmail || sendingTest}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {sendingTest ? 'Sending...' : 'Send Test'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* User Management Modals */}
        {/* Add User Modal */}
        {showAddUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Add New User</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="input-field"
                      placeholder="user@example.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Name</label>
                    <input
                      type="text"
                      value={newUser.name}
                      onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                      className="input-field"
                      placeholder="Full Name"
                    />
                  </div>
                  
                  {newUser.auth_method === 'local' && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium">Password</label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={specifyPassword}
                            onChange={(e) => {
                              setSpecifyPassword(e.target.checked);
                              if (!e.target.checked) {
                                setNewUser({...newUser, password: ''});
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-600">Specify Password</span>
                        </label>
                      </div>
                      
                      {specifyPassword ? (
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newUser.password}
                          onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                          className="input-field"
                          placeholder="Enter password"
                        />
                      ) : (
                        <div>
                          <input
                            type="password"
                            disabled
                            className="input-field bg-gray-100 text-gray-500"
                            placeholder="Password will be generated"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            A password will be generated and e-mailed to the user
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                      className="input-field"
                    >
                      {[
                        { value: 'netsync_employee', label: 'NetSync Employee' },
                        { value: 'practice_manager', label: 'Practice Manager' },
                        { value: 'practice_member', label: 'Practice Member' },
                        { value: 'practice_principal', label: 'Practice Principal' }
                      ].sort((a, b) => a.label.localeCompare(b.label)).map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Auth Method</label>
                    <select
                      value={newUser.auth_method}
                      onChange={(e) => setNewUser({...newUser, auth_method: e.target.value})}
                      className="input-field"
                    >
                      {[
                        { value: 'local', label: 'Local' },
                        { value: 'sso', label: 'SSO' }
                      ].sort((a, b) => a.label.localeCompare(b.label)).map(auth => (
                        <option key={auth.value} value={auth.value}>{auth.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  {newUser.role !== 'netsync_employee' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Practices</label>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-gray-300 rounded p-2">
                        {practicesList.map(practice => (
                          <label key={practice} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={(newUser.practices || []).includes(practice)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewUser({...newUser, practices: [...(newUser.practices || []), practice]});
                                } else {
                                  setNewUser({...newUser, practices: (newUser.practices || []).filter(p => p !== practice)});
                                }
                              }}
                              className="mr-2 h-3 w-3"
                            />
                            {practice}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isAdmin"
                      checked={newUser.isAdmin}
                      onChange={(e) => setNewUser({...newUser, isAdmin: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isAdmin" className="ml-2 block text-sm text-gray-900">
                      Grant Admin Privileges
                    </label>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddUser(false);
                      setNewUser({ email: '', name: '', password: '', role: 'practice_member', isAdmin: false, auth_method: 'local' });
                      setShowPassword(false);
                      setSpecifyPassword(false);
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddUser}
                    disabled={!newUser.email || !newUser.name || loadingActions.add}
                    className={`flex-1 ${loadingActions.add ? 'btn-disabled' : 'btn-primary'}`}
                  >
                    {loadingActions.add ? 'Adding...' : 'Add User'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Edit User</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={editingUser.email}
                      disabled
                      className="input-field bg-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Name</label>
                    <input
                      type="text"
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Role</label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                      className="input-field"
                    >
                      {[
                        { value: 'netsync_employee', label: 'NetSync Employee' },
                        { value: 'practice_manager', label: 'Practice Manager' },
                        { value: 'practice_member', label: 'Practice Member' },
                        { value: 'practice_principal', label: 'Practice Principal' }
                      ].sort((a, b) => a.label.localeCompare(b.label)).map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  {editingUser.role !== 'netsync_employee' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Practices</label>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-gray-300 rounded p-2">
                        {practicesList.map(practice => (
                          <label key={practice} className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              checked={(editingUser.practices || []).includes(practice)}
                              onChange={(e) => {
                                const currentPractices = editingUser.practices || [];
                                if (e.target.checked) {
                                  setEditingUser({...editingUser, practices: [...currentPractices, practice]});
                                } else {
                                  setEditingUser({...editingUser, practices: currentPractices.filter(p => p !== practice)});
                                }
                              }}
                              className="mr-2 h-3 w-3"
                            />
                            {practice}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="editIsAdmin"
                      checked={editingUser.isAdmin || false}
                      onChange={(e) => setEditingUser({...editingUser, isAdmin: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="editIsAdmin" className="ml-2 block text-sm text-gray-900">
                      Grant Admin Privileges
                    </label>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setEditingUser(null)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditUser}
                    disabled={loadingActions.edit}
                    className={`flex-1 ${loadingActions.edit ? 'btn-disabled' : 'btn-primary'}`}
                  >
                    {loadingActions.edit ? 'Updating...' : 'Update User'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Reset Password Modal */}
        {resetPasswordUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Reset Password</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Reset password for {resetPasswordUser.name} ({resetPasswordUser.email})
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="forceReset"
                      checked={forceReset}
                      onChange={(e) => {
                        setForceReset(e.target.checked);
                        if (e.target.checked) {
                          setNewPassword('');
                          setConfirmPassword('');
                        }
                      }}
                      className="mr-2"
                    />
                    <label htmlFor="forceReset" className="text-sm text-gray-700">
                      Force user to reset password on next login
                    </label>
                  </div>
                  
                  {!forceReset && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="input-field"
                          placeholder="Enter new password"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Confirm Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="input-field"
                          placeholder="Confirm new password"
                        />
                        {newPassword && confirmPassword && newPassword !== confirmPassword && (
                          <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
                        )}
                      </div>
                    </>
                  )}
                  
                  {forceReset && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        The user will be required to create a new password when they next log in.
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setResetPasswordUser(null);
                      setNewPassword('');
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={forceReset ? loadingActions.resetPassword : (!newPassword || !confirmPassword || newPassword !== confirmPassword || loadingActions.resetPassword)}
                    className={`flex-1 ${(forceReset ? loadingActions.resetPassword : (!newPassword || !confirmPassword || newPassword !== confirmPassword || loadingActions.resetPassword)) ? 'btn-disabled' : 'btn-primary'}`}
                  >
                    {loadingActions.resetPassword ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Delete User Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete User</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete <strong>{showDeleteModal.name}</strong>? This action cannot be undone.
                </p>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(null)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteUser(showDeleteModal.email)}
                    disabled={loadingActions[showDeleteModal.email] === 'delete'}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {loadingActions[showDeleteModal.email] === 'delete' ? 'Deleting...' : 'Delete User'}
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