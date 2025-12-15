'use client';

import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, UserPlusIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function UserManagementTab({ 
  currentPracticeId, 
  currentBoardName,
  isPersonalBoard,
  user,
  getHeaders 
}) {
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isPersonalBoard) {
      loadPermissions();
      loadUsers();
    }
  }, [currentPracticeId, isPersonalBoard]);

  const loadPermissions = async () => {
    try {
      const response = await fetch(`/api/practice-boards/user-management?boardId=${currentPracticeId}`);
      if (response.ok) {
        const data = await response.json();
        setInvitedUsers(data.permissions?.invitedUsers || []);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/practice-boards/users');
      if (response.ok) {
        const data = await response.json();
        setAvailableUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/practice-boards/user-management', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          boardId: currentPracticeId,
          invitedUsers
        })
      });

      if (response.ok) {
        alert('Permissions saved successfully!');
      } else {
        alert('Failed to save permissions');
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert('Error saving permissions');
    } finally {
      setSaving(false);
    }
  };

  const addUser = (userEmail) => {
    if (!invitedUsers.find(u => u.userEmail === userEmail)) {
      setInvitedUsers([...invitedUsers, {
        userEmail,
        topics: [],
        permissions: {}
      }]);
    }
  };

  const removeUser = (userEmail) => {
    setInvitedUsers(invitedUsers.filter(u => u.userEmail !== userEmail));
  };

  const updateUserTopics = (userEmail, topics) => {
    setInvitedUsers(invitedUsers.map(u => 
      u.userEmail === userEmail ? { ...u, topics } : u
    ));
  };

  const updateUserPermissions = (userEmail, topic, permission, value) => {
    setInvitedUsers(invitedUsers.map(u => {
      if (u.userEmail === userEmail) {
        return {
          ...u,
          permissions: {
            ...u.permissions,
            [topic]: {
              ...(u.permissions[topic] || {}),
              [permission]: value
            }
          }
        };
      }
      return u;
    }));
  };

  const filteredUsers = availableUsers.filter(u => 
    u.email !== user?.email &&
    (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isPersonalBoard) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>User management is only available for personal boards.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Managing: {currentBoardName}</h3>
        <p className="text-sm text-gray-600">Invite users to your personal board and control their access</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UserPlusIcon className="h-5 w-5 text-blue-600" />
          Invite Users to Board
        </h4>

        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {searchTerm && (
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg mb-4">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(availableUser => {
                const isInvited = invitedUsers.find(u => u.userEmail === availableUser.email);
                return (
                  <div
                    key={availableUser.email}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {availableUser.name?.charAt(0).toUpperCase() || availableUser.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{availableUser.name || availableUser.email}</div>
                        {availableUser.name && <div className="text-xs text-gray-500">{availableUser.email}</div>}
                      </div>
                    </div>
                    <button
                      onClick={() => isInvited ? removeUser(availableUser.email) : addUser(availableUser.email)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        isInvited
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isInvited ? (
                        <span className="flex items-center gap-1">
                          <CheckIcon className="h-4 w-4" />
                          Invited
                        </span>
                      ) : (
                        'Invite'
                      )}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">No users found</div>
            )}
          </div>
        )}
      </div>

      {invitedUsers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Invited Users ({invitedUsers.length})</h4>
          
          <div className="space-y-4">
            {invitedUsers.map(invitedUser => {
              const userInfo = availableUsers.find(u => u.email === invitedUser.userEmail);
              return (
                <div key={invitedUser.userEmail} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {userInfo?.name?.charAt(0).toUpperCase() || invitedUser.userEmail.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{userInfo?.name || invitedUser.userEmail}</div>
                        <div className="text-sm text-gray-500">{invitedUser.userEmail}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeUser(invitedUser.userEmail)}
                      className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-3 pl-13">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Topic Access</label>
                      <div className="text-xs text-gray-500 mb-2">Select which topics this user can access</div>
                      <div className="flex flex-wrap gap-2">
                        <label className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={invitedUser.topics?.includes('Main Topic')}
                            onChange={(e) => {
                              const topics = e.target.checked
                                ? [...(invitedUser.topics || []), 'Main Topic']
                                : (invitedUser.topics || []).filter(t => t !== 'Main Topic');
                              updateUserTopics(invitedUser.userEmail, topics);
                            }}
                            className="rounded text-blue-600"
                          />
                          <span className="text-sm">Main Topic</span>
                        </label>
                      </div>
                    </div>

                    {invitedUser.topics?.map(topic => (
                      <div key={topic} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <div className="font-medium text-sm text-gray-900 mb-2">{topic} Permissions</div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={invitedUser.permissions?.[topic]?.canEditColumns || false}
                              onChange={(e) => updateUserPermissions(invitedUser.userEmail, topic, 'canEditColumns', e.target.checked)}
                              className="rounded text-blue-600"
                            />
                            <span>Add/Edit Columns</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={invitedUser.permissions?.[topic]?.canEditCards || false}
                              onChange={(e) => updateUserPermissions(invitedUser.userEmail, topic, 'canEditCards', e.target.checked)}
                              className="rounded text-blue-600"
                            />
                            <span>Add/Edit Cards</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={savePermissions}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors"
        >
          {saving ? 'Saving...' : 'Save Permissions'}
        </button>
      </div>
    </div>
  );
}
