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
import { getRoleColor } from '../../../utils/roleColors';
import { useApp } from '../../../contexts/AppContext';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { updateAppName } = useApp();
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
  const [selectedSpace, setSelectedSpace] = useState('');
  const [selectedResourceSpace, setSelectedResourceSpace] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState({
    general: false,
    webex: false,
    email: false
  });
  const [expandedActions, setExpandedActions] = useState(new Set());
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
  const [saMappingSettings, setSaMappingSettings] = useState({});
  const [savingMappings, setSavingMappings] = useState(false);
  const [practiceGroups, setPracticeGroups] = useState([]);
  const [showSSMModal, setShowSSMModal] = useState(false);
  const [ssmSecrets, setSSMSecrets] = useState('');
  const [ssmEnvironment, setSSMEnvironment] = useState('');
  const [loadingSSM, setLoadingSSM] = useState(false);
  
  // Webex Meetings Integration state
  const [webexMeetingsEnabled, setWebexMeetingsEnabled] = useState(false);
  const [webexMeetingsSites, setWebexMeetingsSites] = useState([]);
  const [showAddSite, setShowAddSite] = useState(false);
  const [editingSiteIndex, setEditingSiteIndex] = useState(null);
  const [newSite, setNewSite] = useState({
    siteUrl: '',
    accessToken: '',
    refreshToken: '',
    recordingHosts: ['']
  });
  const [savingWebexMeetings, setSavingWebexMeetings] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookAction, setWebhookAction] = useState('');
  const [webhookResults, setWebhookResults] = useState([]);
  const [processingWebhooks, setProcessingWebhooks] = useState(false);

  
  // CSRF token management
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
    auth_method: 'local',
    region: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [specifyPassword, setSpecifyPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [regions, setRegions] = useState([]);
  
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
    { id: 'modules', name: 'Module Settings', icon: '🧩' },
    { id: 'webex', name: 'WebEx Settings', icon: '💬' },
    { id: 'email', name: 'E-mail Settings', icon: '📧' },
    { id: 'resources', name: 'E-mail Processing Rules', icon: '📧' },
    { id: 'sso', name: 'SSO Settings', icon: '🔐' },
    { id: 'company-edu', name: 'Company EDU', icon: '🎓' }
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
            appName: data.appName || 'Practice Tools',
            loginLogo: data.loginLogo,
            navbarLogo: data.navbarLogo,
            allowedFileTypes: data.allowedFileTypes || '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg'
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
          let bots = data.bots || [];
          
          // DSR: Auto-migrate legacy single WebEx spaces to Room 1 (Practice Issues)
          const migratedBots = [];
          for (const bot of bots) {
            if (bot.roomId && !bot.hasOwnProperty('resourceRoomId') && !bot.migrated) {
              try {
                console.log('DSR: Migrating legacy WebEx bot:', bot.name);
                const migrateResponse = await fetch('/api/webex-bots/migrate-legacy', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    botId: bot.id,
                    roomId: bot.roomId,
                    roomName: bot.roomName
                  })
                });
                
                if (migrateResponse.ok) {
                  const migrateResult = await migrateResponse.json();
                  if (migrateResult.success) {
                    console.log('DSR: Successfully migrated bot to Practice Issues notifications');
                    migratedBots.push({ 
                      ...bot, 
                      resourceRoomId: '', 
                      resourceRoomName: '',
                      migrated: true
                    });
                  } else {
                    migratedBots.push(bot);
                  }
                } else {
                  migratedBots.push(bot);
                }
              } catch (error) {
                console.error('DSR: Migration failed for bot:', bot.name, error);
                migratedBots.push(bot);
              }
            } else {
              migratedBots.push(bot);
            }
          }
          
          setWebexBots(migratedBots);
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
        fetchUserRoles();
        fetchRegions();
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
      
      // Load SA mapping settings and practice groups
      if (activeTab === 'modules') {
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
      }
      
      // Load company education settings
      if (activeTab === 'company-edu') {
        try {
          const response = await fetch('/api/settings/webex-meetings?t=' + Date.now());
          const data = await response.json();
          setWebexMeetingsEnabled(data.enabled || false);
          setWebexMeetingsSites(data.sites || []);
        } catch (error) {
          console.error('Error loading Webex Meetings settings:', error);
        }
      }
      


      };
      loadData();
    }
  }, [user, router, isNonAdminPracticeUser, activeTab]);
  
  // Set default practice team filter when webex bots are loaded
  useEffect(() => {
    if (isNonAdminPracticeUser && user.practices && user.practices.length > 0 && webexBotsForFilter.length > 0) {
      // Find matching practice teams
      const userPractices = user.practices;
      const matchingBots = webexBotsForFilter.filter(bot => 
        bot.practices && bot.practices.some(practice => userPractices.includes(practice))
      );
      
      if (matchingBots.length === 1) {
        // Auto-select if only one matching team
        setUserFilters(prev => ({...prev, webexBot: matchingBots[0].friendlyName || matchingBots[0].name}));
      }
    }
  }, [webexBotsForFilter, isNonAdminPracticeUser, user?.practices]);

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
      setSaving(prev => ({...prev, general: false}));
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

  const fetchUserRoles = async () => {
    try {
      const response = await fetch('/api/user-roles');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setUserRoles(data.roles || []);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      // Fallback to hardcoded roles if API fails
      setUserRoles([
        { value: 'account_manager', label: 'Account Manager' },
        { value: 'netsync_employee', label: 'NetSync Employee' },
        { value: 'practice_manager', label: 'Practice Manager' },
        { value: 'practice_member', label: 'Practice Member' },
        { value: 'practice_principal', label: 'Practice Principal' }
      ]);
    }
  };

  const fetchRegions = async () => {
    try {
      const response = await fetch('/api/regions');
      const data = await response.json();
      setRegions(data.regions || []);
    } catch (error) {
      console.error('Error fetching regions:', error);
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
          auth_method: editingUser.auth_method,
          region: editingUser.region,
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
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">General Settings</h2>
                  <button
                    onClick={handleSaveGeneral}
                    disabled={saving.general}
                    className={`${saving.general ? 'btn-disabled' : 'btn-primary'} flex items-center gap-2`}
                  >
                    {saving.general ? (
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
                          // Update app context immediately
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


              </div>
            )}

            {activeTab === 'webex' && !isNonAdminPracticeUser && (
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
                
                {/* WebEx SSM Configuration Export */}
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
                              onClick={async () => {

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
            
            {activeTab === 'modules' && !isNonAdminPracticeUser && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Module Settings</h2>
                    <p className="text-sm text-gray-600 mt-1">Configure and manage application modules</p>
                  </div>
                </div>

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
                          const matchingBots = webexBotsForFilter.filter(bot => 
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
                        {webexBotsForFilter.filter(bot => {
                          // Filter bots based on user's practices for non-admin practice users
                          if (isNonAdminPracticeUser && user.practices && user.practices.length > 0) {
                            return bot.practices && bot.practices.some(practice => user.practices.includes(practice));
                          }
                          return true; // Show all bots for admins
                        }).sort((a, b) => (a.friendlyName || a.name).localeCompare(b.friendlyName || b.name)).map(bot => (
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
                        {userRoles.map(role => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
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
                          if (userFilters.webexBot) {
                            // Check if user has webex_bot_source that matches the selected bot
                            if (!userItem.webex_bot_source || userItem.webex_bot_source !== userFilters.webexBot) {
                              return false;
                            }
                          }
                          
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
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(userItem.role)}`}>
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
                              {['netsync_employee', 'executive', 'account_manager', 'isr'].includes(userItem.role) ? (
                                <span className="text-xs text-gray-500 italic">Can't be assigned to practices</span>
                              ) : (
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
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {['netsync_employee', 'executive', 'account_manager', 'isr'].includes(userItem.role) ? (
                                <span className="text-xs text-gray-500 italic">Can't be assigned to practices</span>
                              ) : (
                                <span className="text-sm text-gray-900">
                                  {userItem.webex_bot_source || 'N/A'}
                                </span>
                              )}
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
                <h2 className="text-xl font-semibold text-gray-900 mb-4">E-mail Processing Rules</h2>
                <div className="mb-6">
                  <button
                    onClick={() => setSettings({...settings, resourceEmailEnabled: !settings.resourceEmailEnabled})}
                    disabled={!settings.emailNotifications || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      settings.resourceEmailEnabled 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } ${(!settings.emailNotifications || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={settings.resourceEmailEnabled ? 'Click to Disable E-mail Processing' : 'Click to Enable E-mail Processing'}
                  >
                    {settings.resourceEmailEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
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
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
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

            {activeTab === 'company-edu' && !isNonAdminPracticeUser && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Company Education Settings</h2>
                    <p className="text-sm text-gray-600 mt-1">Configure educational tools and integrations</p>
                  </div>
                </div>

                {/* Webex Meetings Integration Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">Webex Meetings Integration</h3>
                      <p className="text-sm text-gray-600">Configure Webex Meetings sites and recording hosts</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webexMeetingsEnabled}
                        onChange={(e) => setWebexMeetingsEnabled(e.target.checked)}
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
                      {/* Site URLs List */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-md font-semibold text-gray-900">Configured Sites</h4>
                          <button
                            onClick={() => {
                              setEditingSiteIndex(null);
                              setNewSite({
                                siteUrl: '',
                                accessToken: '',
                                refreshToken: '',
                                recordingHosts: ['']
                              });
                              setShowAddSite(true);
                            }}
                            className="btn-primary flex items-center gap-2 text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add Site URL
                          </button>
                        </div>

                        {webexMeetingsSites.length === 0 ? (
                          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <svg className="w-8 h-8 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <h4 className="text-sm font-medium text-gray-900 mb-1">No sites configured</h4>
                            <p className="text-sm text-gray-600">Add your first Webex Meetings site to get started</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {webexMeetingsSites.map((site, index) => (
                              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-gray-900 mb-2">{site.siteUrl}</h5>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-gray-600">Access Token:</span>
                                        <span className="text-xs text-gray-500 font-mono">••••••••</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-gray-600">Refresh Token:</span>
                                        <span className="text-xs text-gray-500 font-mono">••••••••</span>
                                      </div>
                                      <div>
                                        <span className="text-xs font-medium text-gray-600">Recording Hosts:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {site.recordingHosts.map((host, hostIndex) => (
                                            <span key={hostIndex} className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                              {host}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingSiteIndex(index);
                                        setNewSite({
                                          siteUrl: site.siteUrl,
                                          accessToken: '',
                                          refreshToken: '',
                                          recordingHosts: [...site.recordingHosts]
                                        });
                                        setShowAddSite(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded"
                                      title="Edit Site"
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
                                      title="Remove Site"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                      {/* Action Buttons */}
                      <div className="pt-4 border-t border-gray-200 flex gap-3">
                        <button
                          onClick={async () => {
                            setSavingWebexMeetings(true);
                            try {
                              const response = await fetch('/api/settings/webex-meetings', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  enabled: webexMeetingsEnabled,
                                  sites: webexMeetingsSites
                                })
                              });
                              
                              if (response.ok) {
                                alert('Webex Meetings settings saved successfully!');
                              } else {
                                const errorData = await response.json();
                                alert('Failed to save settings: ' + (errorData.error || 'Unknown error'));
                              }
                            } catch (error) {
                              console.error('Error saving Webex Meetings settings:', error);
                              alert('Error saving Webex Meetings settings');
                            } finally {
                              setSavingWebexMeetings(false);
                            }
                          }}
                          disabled={savingWebexMeetings}
                          className={`${savingWebexMeetings ? 'btn-disabled' : 'btn-primary'} flex items-center gap-2`}
                        >
                          {savingWebexMeetings ? (
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
                        
                        {webexMeetingsEnabled && webexMeetingsSites.length > 0 && (
                          <button
                            onClick={() => {
                              console.log('🔧 [FRONTEND-WEBHOOK] Manage Webhooks button clicked');
                              console.log('🔧 [FRONTEND-WEBHOOK] Current state:', {
                                webexMeetingsEnabled,
                                sitesCount: webexMeetingsSites.length,
                                sites: webexMeetingsSites.map(s => ({ siteUrl: s.siteUrl, hasAccessToken: !!s.accessToken }))
                              });
                              setShowWebhookModal(true);
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Manage Webhooks
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}




          </div>
        </div>
        
        {/* Webhook Management Modal */}
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
                {console.log('🔧 [FRONTEND-WEBHOOK] Webhook modal opened')}
                
                <p className="text-sm text-gray-600 mb-6">
                  Manage Webex Meetings webhooks for recordings and transcripts. These webhooks notify the system when new recordings and transcripts are available.
                </p>
                
                <div className="space-y-4">
                  <button
                    onClick={async () => {
                      console.log('🔧 [FRONTEND-WEBHOOK] Create webhooks button clicked');
                      console.log('🔧 [FRONTEND-WEBHOOK] Current webex meetings sites:', webexMeetingsSites);
                      console.log('🔧 [FRONTEND-WEBHOOK] Webex meetings enabled:', webexMeetingsEnabled);
                      
                      setProcessingWebhooks(true);
                      setWebhookAction('create');
                      try {
                        console.log('🔧 [FRONTEND-WEBHOOK] Sending create webhook request...');
                        const requestPayload = { action: 'create' };
                        console.log('🔧 [FRONTEND-WEBHOOK] Request payload:', requestPayload);
                        
                        const response = await fetch('/api/webexmeetings/settings/webhookmgmt', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(requestPayload)
                        });
                        
                        console.log('🔧 [FRONTEND-WEBHOOK] Response status:', response.status);
                        console.log('🔧 [FRONTEND-WEBHOOK] Response headers:', Object.fromEntries(response.headers.entries()));
                        console.log('🔧 [FRONTEND-WEBHOOK] Response ok:', response.ok);
                        
                        const data = await response.json();
                        console.log('🔧 [FRONTEND-WEBHOOK] Response data:', data);
                        
                        setWebhookResults(data.results || []);
                        
                        const successCount = data.results?.filter(r => r.status === 'created').length || 0;
                        const errorCount = data.results?.filter(r => r.status === 'error').length || 0;
                        
                        console.log('🔧 [FRONTEND-WEBHOOK] Results summary:', {
                          successCount,
                          errorCount,
                          totalResults: data.results?.length || 0,
                          results: data.results
                        });
                        
                        if (successCount > 0) {
                          console.log('🔧 [FRONTEND-WEBHOOK] Success - showing success alert');
                          alert(`✅ Successfully created webhooks for ${successCount} site(s)!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
                        } else {
                          console.log('🔧 [FRONTEND-WEBHOOK] No successes - showing failure alert');
                          alert('❌ Failed to create webhooks. Check your site configurations.');
                        }
                      } catch (error) {
                        console.error('🔧 [FRONTEND-WEBHOOK] Error creating webhooks:', {
                          message: error.message,
                          stack: error.stack,
                          name: error.name
                        });
                        alert('❌ Error creating webhooks');
                      } finally {
                        console.log('🔧 [FRONTEND-WEBHOOK] Finished webhook creation process');
                        setProcessingWebhooks(false);
                      }
                    }}
                    disabled={processingWebhooks}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {processingWebhooks && webhookAction === 'create' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating Webhooks...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create Webhooks
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={async () => {
                      console.log('🔧 [FRONTEND-WEBHOOK] Validate webhooks button clicked');
                      setProcessingWebhooks(true);
                      setWebhookAction('validate');
                      try {
                        console.log('🔧 [FRONTEND-WEBHOOK] Sending validate webhook request...');
                        const response = await fetch('/api/webexmeetings/settings/webhookmgmt', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'validate' })
                        });
                        
                        console.log('🔧 [FRONTEND-WEBHOOK] Validate response status:', response.status);
                        const data = await response.json();
                        console.log('🔧 [FRONTEND-WEBHOOK] Validate response data:', data);
                        
                        setWebhookResults(data.results || []);
                        
                        const validCount = data.results?.filter(r => r.status === 'valid').length || 0;
                        const invalidCount = data.results?.filter(r => r.status === 'invalid').length || 0;
                        const noWebhooksCount = data.results?.filter(r => !r.hasWebhooks).length || 0;
                        
                        console.log('🔧 [FRONTEND-WEBHOOK] Validation summary:', {
                          validCount,
                          invalidCount,
                          noWebhooksCount
                        });
                        
                        let message = `🔍 Webhook Validation Results:\n\n`;
                        message += `✅ Valid: ${validCount}\n`;
                        message += `❌ Invalid: ${invalidCount}\n`;
                        message += `⚠️ No webhooks: ${noWebhooksCount}`;
                        
                        alert(message);
                      } catch (error) {
                        console.error('🔧 [FRONTEND-WEBHOOK] Error validating webhooks:', error);
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
                        Validating Webhooks...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Validate Webhooks
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={async () => {
                      console.log('🔧 [FRONTEND-WEBHOOK] Delete webhooks button clicked');
                      if (!confirm('⚠️ Are you sure you want to delete all webhooks? This will stop automatic recording and transcript processing.')) {
                        console.log('🔧 [FRONTEND-WEBHOOK] User cancelled delete operation');
                        return;
                      }
                      
                      setProcessingWebhooks(true);
                      setWebhookAction('delete');
                      try {
                        console.log('🔧 [FRONTEND-WEBHOOK] Sending delete webhook request...');
                        const response = await fetch('/api/webexmeetings/settings/webhookmgmt', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'delete' })
                        });
                        
                        console.log('🔧 [FRONTEND-WEBHOOK] Delete response status:', response.status);
                        const data = await response.json();
                        console.log('🔧 [FRONTEND-WEBHOOK] Delete response data:', data);
                        
                        setWebhookResults(data.results || []);
                        
                        const deletedCount = data.results?.filter(r => r.status === 'deleted').length || 0;
                        const errorCount = data.results?.filter(r => r.status === 'error').length || 0;
                        
                        console.log('🔧 [FRONTEND-WEBHOOK] Delete summary:', {
                          deletedCount,
                          errorCount
                        });
                        
                        if (deletedCount > 0) {
                          alert(`🗑️ Successfully deleted webhooks for ${deletedCount} site(s)!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
                        } else {
                          alert('❌ Failed to delete webhooks.');
                        }
                      } catch (error) {
                        console.error('🔧 [FRONTEND-WEBHOOK] Error deleting webhooks:', error);
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
                        Deleting Webhooks...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Webhooks
                      </>
                    )}
                  </button>
                </div>
                
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Webhook URLs:</h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div>Recordings: <code className="bg-white px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/webhooks/webexmeetings/recordings</code></div>
                    <div>Transcripts: <code className="bg-white px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/webhooks/webexmeetings/transcripts</code></div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      console.log('🔧 [FRONTEND-WEBHOOK] Closing webhook modal');
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
        
        {/* Add Site Modal */}
        {showAddSite && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">{editingSiteIndex !== null ? 'Edit Webex Meetings Site' : 'Add Webex Meetings Site'}</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Site URL *</label>
                    <input
                      type="url"
                      value={newSite.siteUrl}
                      onChange={(e) => setNewSite({...newSite, siteUrl: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://company.webex.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Access Token {editingSiteIndex !== null ? '(leave blank to keep current)' : '*'}</label>
                    <input
                      type="password"
                      value={newSite.accessToken}
                      onChange={(e) => setNewSite({...newSite, accessToken: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={editingSiteIndex !== null ? "Leave blank to keep current token" : "Enter access token"}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Refresh Token {editingSiteIndex !== null ? '(leave blank to keep current)' : '*'}</label>
                    <input
                      type="password"
                      value={newSite.refreshToken}
                      onChange={(e) => setNewSite({...newSite, refreshToken: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={editingSiteIndex !== null ? "Leave blank to keep current token" : "Enter refresh token"}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Recording Hosts *</label>
                    <div className="space-y-2">
                      {newSite.recordingHosts.map((host, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={host}
                            onChange={(e) => {
                              const updatedHosts = [...newSite.recordingHosts];
                              updatedHosts[index] = e.target.value;
                              setNewSite({...newSite, recordingHosts: updatedHosts});
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Recording host email"
                          />
                          {newSite.recordingHosts.length > 1 && (
                            <button
                              onClick={() => {
                                const updatedHosts = newSite.recordingHosts.filter((_, i) => i !== index);
                                setNewSite({...newSite, recordingHosts: updatedHosts});
                              }}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setNewSite({...newSite, recordingHosts: [...newSite.recordingHosts, '']});
                        }}
                        className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                      >
                        + Add Recording Host
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddSite(false);
                      setEditingSiteIndex(null);
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editingSiteIndex !== null) {
                        // Edit mode - validate required fields except tokens if blank
                        if (!newSite.siteUrl || newSite.recordingHosts.some(host => !host.trim())) {
                          alert('Please fill in all required fields');
                          return;
                        }
                        
                        const filteredHosts = newSite.recordingHosts.filter(host => host.trim());
                        const updatedSites = [...webexMeetingsSites];
                        const existingSite = updatedSites[editingSiteIndex];
                        
                        updatedSites[editingSiteIndex] = {
                          siteUrl: newSite.siteUrl,
                          accessToken: newSite.accessToken || existingSite.accessToken,
                          refreshToken: newSite.refreshToken || existingSite.refreshToken,
                          recordingHosts: filteredHosts
                        };
                        
                        setWebexMeetingsSites(updatedSites);
                      } else {
                        // Add mode - validate all required fields
                        if (!newSite.siteUrl || !newSite.accessToken || !newSite.refreshToken || newSite.recordingHosts.some(host => !host.trim())) {
                          alert('Please fill in all required fields');
                          return;
                        }
                        
                        const filteredHosts = newSite.recordingHosts.filter(host => host.trim());
                        setWebexMeetingsSites([...webexMeetingsSites, {...newSite, recordingHosts: filteredHosts}]);
                      }
                      
                      setShowAddSite(false);
                      setEditingSiteIndex(null);
                      setNewSite({
                        siteUrl: '',
                        accessToken: '',
                        refreshToken: '',
                        recordingHosts: ['']
                      });
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {editingSiteIndex !== null ? 'Update Site' : 'Add Site'}
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

                              
                              // For edit mode, just proceed to next step
                              setCompletedSteps([1]);
                              setCurrentStep(2);
                              
                              // Load existing rooms for edit mode
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
                              } else {

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
                        
                        {/* Continue Button - Only requires Practice Issues space */}
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
                    
                    {/* Bot Details */}
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
                    
                    {/* Notification Spaces Configuration */}
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
                        {/* Practice Issues Channel */}
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
                        
                        {/* Resource Assignment Channel */}
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
                        
                        {/* No spaces configured message */}
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
                      {userRoles.map(role => (
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
                  
                  {newUser.role === 'account_manager' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Region *</label>
                      <select
                        value={newUser.region}
                        onChange={(e) => setNewUser({...newUser, region: e.target.value})}
                        className="input-field"
                        required
                      >
                        <option value="">Select a region</option>
                        {regions.map(region => (
                          <option key={region.id} value={region.name}>{region.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {!['netsync_employee', 'account_manager', 'isr', 'executive'].includes(newUser.role) && (
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
                      setNewUser({ email: '', name: '', password: '', role: 'practice_member', isAdmin: false, practices: [], auth_method: 'local', region: '' });
                      setShowPassword(false);
                      setSpecifyPassword(false);
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddUser}
                    disabled={!newUser.email || !newUser.name || (newUser.role === 'account_manager' && !newUser.region) || loadingActions.add}
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
                      {userRoles.map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Auth Method</label>
                    <select
                      value={editingUser.auth_method || 'local'}
                      onChange={(e) => setEditingUser({...editingUser, auth_method: e.target.value})}
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
                  
                  {editingUser.role === 'account_manager' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Region *</label>
                      <select
                        value={editingUser.region || ''}
                        onChange={(e) => setEditingUser({...editingUser, region: e.target.value})}
                        className="input-field"
                        required
                      >
                        <option value="">Select a region</option>
                        {regions.map(region => (
                          <option key={region.id} value={region.name}>{region.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {!['netsync_employee', 'account_manager', 'isr', 'executive'].includes(editingUser.role) && (
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
                    disabled={loadingActions.edit || (editingUser.role === 'account_manager' && !editingUser.region)}
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
        
        {/* WebEx SSM Secrets Modal */}
        {showSSMModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
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
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">App Runner YAML Secrets Section</label>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(ssmSecrets);
                        alert('WebEx SSM parameters copied to clipboard!');
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                  <textarea
                    value={ssmSecrets}
                    readOnly
                    rows={15}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
                    placeholder="No WebEx bots configured"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Copy this content into the 'secrets:' section of your App Runner YAML file
                  </p>
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowSSMModal(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Close
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
