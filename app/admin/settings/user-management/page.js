'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import Breadcrumb from '../../../../components/Breadcrumb';
import { useAuth } from '../../../../hooks/useAuth';
import { getRoleColor } from '../../../../utils/roleColors';

export default function UserManagementPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  
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
  const [webexBots, setWebexBots] = useState([]);
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
  const [practicesList, setPracticesList] = useState([]);

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

  // Check if current user can edit another user
  const canEditUser = (targetUser) => {
    if (user?.isAdmin) return true;
    
    if (user?.role === 'practice_manager' || user?.role === 'practice_principal') {
      const userPractices = user.practices || [];
      const targetPractices = targetUser.practices || [];
      
      if (targetPractices.length === 0) return true;
      
      return targetPractices.some(practice => userPractices.includes(practice));
    }
    
    return false;
  };

  useEffect(() => {
    if (user && !user.isAdmin && user.role !== 'practice_manager' && user.role !== 'practice_principal') {
      router.push('/');
      return;
    }
    
    if (user) {
      fetchUsers();
      fetchWebexBotsForFilter();
      fetchUserRoles();
      fetchRegions();
      fetchPractices();
    }
  }, [user, router]);
  
  // Set default practice team filter when webex bots are loaded
  useEffect(() => {
    if (isNonAdminPracticeUser && user.practices && user.practices.length > 0 && webexBots.length > 0) {
      const userPractices = user.practices;
      const matchingBots = webexBots.filter(bot => 
        bot.practices && bot.practices.some(practice => userPractices.includes(practice))
      );
      
      if (matchingBots.length === 1) {
        setUserFilters(prev => ({...prev, webexBot: matchingBots[0].friendlyName || matchingBots[0].name}));
      }
    }
  }, [webexBots, isNonAdminPracticeUser, user?.practices]);

  const fetchWebexBotsForFilter = async () => {
    try {
      const response = await fetch('/api/admin/webex-bots');
      const data = await response.json();
      setWebexBots(data.bots || []);
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

  const fetchPractices = async () => {
    try {
      const response = await fetch('/api/practice-options');
      const data = await response.json();
      setPracticesList(data.practices || []);
    } catch (error) {
      console.error('Error fetching practices:', error);
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
  
  const handleAddUser = async () => {
    
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
        setNewUser({ email: '', name: '', password: '', role: 'practice_member', isAdmin: false, practices: [], auth_method: 'local', region: '' });
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
          status: 'active',
          webex_bot_source: editingUser.webex_bot_source || null
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
            { label: 'Settings', href: '/admin/settings/general-settings' },
            { label: 'User Management' }
          ]} />
          
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
                <p className="text-gray-600">Manage user accounts and permissions</p>
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
                      tab.id === 'users'
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

          {/* User Management Content - EXACT COPY FROM ORIGINAL */}

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
                    const userPractices = user.practices;
                    const matchingBots = webexBots.filter(bot => 
                      bot.practices && bot.practices.some(practice => userPractices.includes(practice))
                    );
                    
                    const defaultTeam = matchingBots.length === 1 ? matchingBots[0].friendlyName || matchingBots[0].name : '';
                    setUserFilters({ search: '', userType: '', role: '', authMethod: '', webexBot: defaultTeam, status: '' });
                  } else {
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
                    if (isNonAdminPracticeUser && user.practices && user.practices.length > 0) {
                      return bot.practices && bot.practices.some(practice => user.practices.includes(practice));
                    }
                    return true;
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
                      if (userFilters.search) {
                        const searchLower = userFilters.search.toLowerCase();
                        const matchesSearch = 
                          userItem.name.toLowerCase().includes(searchLower) ||
                          userItem.email.toLowerCase().includes(searchLower);
                        if (!matchesSearch) return false;
                      }
                      
                      if (userFilters.userType === 'local' && userItem.created_from === 'webex_sync') return false;
                      if (userFilters.userType === 'webex' && userItem.created_from !== 'webex_sync') return false;
                      
                      if (userFilters.webexBot && userItem.webex_bot_source !== userFilters.webexBot) return false;
                      
                      if (isNonAdminPracticeUser && userItem.created_from !== 'webex_sync') return false;
                      
                      if (userFilters.role && userItem.role !== userFilters.role) return false;
                      
                      if (userFilters.authMethod && userItem.auth_method !== userFilters.authMethod) return false;
                      
                      if (userFilters.status && userItem.status !== userFilters.status) return false;
                      
                      return true;
                    }).map((userItem) => (
                      <tr key={userItem.email} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{userItem.name?.replace(/[<>"'&]/g, (match) => ({'<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;'}[match]))}</div>
                            <div className="text-sm text-gray-500">{userItem.email?.replace(/[<>"'&]/g, (match) => ({'<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;'}[match]))}</div>
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
                        <option value="local">Local</option>
                        <option value="sso">SSO</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Region</label>
                      <select
                        value={newUser.region}
                        onChange={(e) => setNewUser({...newUser, region: e.target.value})}
                        className="input-field"
                      >
                        <option value="">Select Region</option>
                        {regions.map(region => (
                          <option key={region.value} value={region.value}>{region.label}</option>
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
                        {userRoles.map(role => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Region</label>
                      <select
                        value={editingUser.region || ''}
                        onChange={(e) => setEditingUser({...editingUser, region: e.target.value})}
                        className="input-field"
                      >
                        <option value="">Select Region</option>
                        {regions.map(region => (
                          <option key={region.value} value={region.value}>{region.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    {editingUser.webex_bot_sources && editingUser.webex_bot_sources.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Practice Team</label>
                        <select
                          value={editingUser.webex_bot_source || ''}
                          onChange={(e) => setEditingUser({...editingUser, webex_bot_source: e.target.value})}
                          className="input-field"
                        >
                          <option value="">None</option>
                          {editingUser.webex_bot_sources.map(botSource => (
                            <option key={botSource} value={botSource}>{botSource}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Available teams: {editingUser.webex_bot_sources.join(', ')}
                        </p>
                      </div>
                    )}
                    
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
                        setConfirmPassword('');
                        setForceReset(false);
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
