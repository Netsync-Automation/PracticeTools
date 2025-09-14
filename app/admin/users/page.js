'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CogIcon, UsersIcon, PlusIcon } from '@heroicons/react/24/outline';
import Navbar from '../../../components/Navbar';
import Breadcrumb from '../../../components/Breadcrumb';
import { useAuth } from '../../../hooks/useAuth';
import { getRoleColor } from '../../../utils/roleColors';

export default function UsersPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [webexBots, setWebexBots] = useState([]);
  const [userFilter, setUserFilter] = useState('all');
  const [selectedBot, setSelectedBot] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forceReset, setForceReset] = useState(false);
  const [loadingActions, setLoadingActions] = useState({});
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: '',
    role: 'user',
    auth_method: 'local'
  });
  const [roles, setRoles] = useState([]);

  const [showPassword, setShowPassword] = useState(false);
  const [specifyPassword, setSpecifyPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);

  useEffect(() => {
    if (user && !user.isAdmin) {
      router.push('/');
      return;
    }
    
    if (user) {
      fetchUsers();
      fetchWebexBots();
      fetchRoles();
    }
  }, [user, router]);

  const fetchWebexBots = async () => {
    try {
      const response = await fetch('/api/admin/webex-bots');
      const data = await response.json();
      setWebexBots(data.bots || []);
    } catch (error) {
      console.error('Error fetching WebEx bots:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles');
      const data = await response.json();
      if (data.success) {
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      setRoles([
        { value: 'account_manager', label: 'Account Manager' },
        { value: 'executive', label: 'Executive' },
        { value: 'isr', label: 'ISR' },
        { value: 'netsync_employee', label: 'Netsync Employee' },
        { value: 'practice_manager', label: 'Practice Manager' },
        { value: 'practice_member', label: 'Practice Member' },
        { value: 'practice_principal', label: 'Practice Principal' }
      ]);
    }
  };



  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      let users = data.users || [];
      
      // Fix specific WebEx users and any others with incorrect auth method
      const specificUsers = ['mbgriffin@netsync.com', 'mgriffin@netsyncdemo.com'];
      const webexUsersToFix = users.filter(u => 
        (u.created_from === 'webex_sync' && u.auth_method !== 'sso') ||
        (specificUsers.includes(u.email) && u.auth_method !== 'sso')
      );
      
      if (webexUsersToFix.length > 0) {
        console.log('Fixing WebEx users:', webexUsersToFix.map(u => u.email));
        for (const user of webexUsersToFix) {
          const updateResponse = await fetch(`/api/users/${encodeURIComponent(user.email)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_method: 'sso', created_from: 'webex_sync' })
          });
          if (updateResponse.ok) {
            // Update the user in the local array
            users = users.map(u => u.email === user.email ? {...u, auth_method: 'sso', created_from: 'webex_sync'} : u);
          }
        }
      }
      setUsers(users);
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
        setNewUser({ email: '', name: '', password: '', role: 'user', auth_method: 'local' });
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
          role: editingUser.role
        })
      });
      
      if (response.ok) {
        fetchUsers();
        setEditingUser(null);
      } else {
        console.error('Update failed:', await response.text());
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
      } else {
        console.error('Delete failed:', await response.text());
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
      } else {
        console.error('Reset password failed:', await response.text());
      }
    } catch (error) {
      console.error('Error resetting password:', error);
    } finally {
      setLoadingActions(prev => ({...prev, resetPassword: false}));
    }
  };

  if (loading || usersLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={logout} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'User Management' }
        ]} />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
              <p className="text-gray-600">Manage user accounts and permissions</p>
            </div>
            <button
              onClick={() => setShowAddUser(true)}
              className="btn-primary flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add User
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Filter Users</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">User Type</label>
              <select
                value={userFilter}
                onChange={(e) => {
                  setUserFilter(e.target.value);
                  setSelectedBot('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Users</option>
                <option value="local">Local Users</option>
                <option value="webex">WebEx Bot Users</option>
              </select>
            </div>
            {userFilter === 'webex' && (
              <div>
                <label className="block text-sm font-medium mb-2">WebEx Bot</label>
                <select
                  value={selectedBot}
                  onChange={(e) => setSelectedBot(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All WebEx Bots</option>
                  {webexBots.map(bot => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name} - Practices: {bot.practices ? bot.practices.join(', ') : 'None'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Users Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auth Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.filter(userItem => {
                  if (userFilter === 'all') return true;
                  if (userFilter === 'local') return userItem.created_from !== 'webex_sync';
                  if (userFilter === 'webex') {
                    if (userItem.created_from !== 'webex_sync') return false;
                    if (selectedBot) {
                      return userItem.webex_bot_id === selectedBot;
                    }
                    return true;
                  }
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
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(userItem.role)}`}>
                        {userItem.role}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        userItem.created_from === 'webex_sync' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {userItem.created_from === 'webex_sync' ? 'WebEx Sync' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(userItem.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {userItem.last_login ? new Date(userItem.last_login).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingUser({...userItem})}
                          className="p-3 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl transition-all duration-150 hover:scale-110 active:scale-95"
                          title="Edit User"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {userItem.auth_method === 'local' && (
                          <button
                            onClick={() => setResetPasswordUser(userItem)}
                            className="p-3 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded-xl transition-all duration-150 hover:scale-110 active:scale-95"
                            title="Reset Password"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </button>
                        )}
                        {userItem.email !== 'admin@localhost' && userItem.created_from !== 'system_default' && (
                          <button
                            onClick={() => setShowDeleteModal(userItem)}
                            disabled={loadingActions[userItem.email] === 'delete'}
                            className={`p-3 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-all duration-150 hover:scale-110 active:scale-95 ${loadingActions[userItem.email] === 'delete' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Delete User"
                          >
                            {loadingActions[userItem.email] === 'delete' ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                            ) : (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
                      {roles.sort((a, b) => a.label.localeCompare(b.label)).map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
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
                    className={`flex-1 flex items-center justify-center gap-2 ${loadingActions.edit ? 'btn-disabled' : 'btn-primary'}`}
                  >
                    {loadingActions.edit && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
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
                    className={`flex-1 flex items-center justify-center gap-2 ${(forceReset ? loadingActions.resetPassword : (!newPassword || !confirmPassword || newPassword !== confirmPassword || loadingActions.resetPassword)) ? 'btn-disabled' : 'btn-primary'}`}
                  >
                    {loadingActions.resetPassword && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    {loadingActions.resetPassword ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={newUser.password}
                            onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                            className="input-field pr-10"
                            placeholder="Enter password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            {showPassword ? (
                              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="password"
                            disabled
                            className="input-field bg-gray-100 text-gray-500"
                            placeholder="Password will be generated"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            A password will be generated and e-mailed to the user for first time login
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {newUser.auth_method !== 'local' && (
                    <div className="p-3 bg-blue-50 rounded-md">
                      <p className="text-sm text-blue-700">
                        {newUser.auth_method === 'duo' ? 'User will authenticate via Duo Security SSO' : 'User will authenticate via SAML SSO'}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                      className="input-field"
                    >
                      {roles.sort((a, b) => a.label.localeCompare(b.label)).map(role => (
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
                        { value: 'duo', label: 'Duo SSO' },
                        { value: 'local', label: 'Local' },
                        { value: 'saml', label: 'SAML' }
                      ].sort((a, b) => a.label.localeCompare(b.label)).map(auth => (
                        <option key={auth.value} value={auth.value}>{auth.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddUser(false);
                      setNewUser({ email: '', name: '', password: '', role: 'user', auth_method: 'local' });
                      setShowPassword(false);
                      setSpecifyPassword(false);
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddUser}
                    disabled={!newUser.email || !newUser.name || (newUser.auth_method === 'local' && specifyPassword && !newUser.password) || loadingActions.add}
                    className={`flex-1 flex items-center justify-center gap-2 ${!newUser.email || !newUser.name || (newUser.auth_method === 'local' && specifyPassword && !newUser.password) || loadingActions.add ? 'btn-disabled' : 'btn-primary'}`}
                  >
                    {loadingActions.add && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    {loadingActions.add ? 'Adding...' : 'Add User'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
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
                  Are you sure you want to delete <strong>{showDeleteModal.name}</strong> ({showDeleteModal.email})? This action cannot be undone.
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
    </div>
  );
}