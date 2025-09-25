'use client';

import { useState, useEffect, useRef } from 'react';

export default function UserSelector({ 
  value, 
  onChange, 
  assignedPractices = [], 
  placeholder = "Select a user...",
  className = "",
  required = false 
}) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Filter and sort users based on search term and practices
    let filtered = users.filter(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort users: matching practices first, then others
    filtered.sort((a, b) => {
      const aMatchesPractice = assignedPractices.some(practice => 
        a.practices && a.practices.includes(practice)
      );
      const bMatchesPractice = assignedPractices.some(practice => 
        b.practices && b.practices.includes(practice)
      );

      if (aMatchesPractice && !bMatchesPractice) return -1;
      if (!aMatchesPractice && bMatchesPractice) return 1;
      
      // Secondary sort by name
      return a.name.localeCompare(b.name);
    });

    setFilteredUsers(filtered);
  }, [users, searchTerm, assignedPractices]);

  const fetchUsers = async () => {
    try {
      console.log('[UserSelector] Fetching users from /api/admin/users');
      const response = await fetch('/api/admin/users');
      console.log('[UserSelector] Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[UserSelector] Users received:', data.users?.length || 0, 'users');
        console.log('[UserSelector] Sample users:', data.users?.slice(0, 3));
        setUsers(data.users || []);
      } else {
        console.error('[UserSelector] Failed to fetch users:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[UserSelector] Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user) => {
    onChange(user.name);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm(value || '');
  };

  const selectedUser = users.find(user => user.name === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? searchTerm : (value || '')}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
        required={required}
        autoComplete="off"
      />
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-3 text-center text-gray-500">
              {searchTerm ? 'No users found' : 'No users available'}
            </div>
          ) : (
            <>
              {/* Practice-matching users section */}
              {assignedPractices.length > 0 && filteredUsers.some(user => 
                assignedPractices.some(practice => user.practices && user.practices.includes(practice))
              ) && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b">
                    {assignedPractices.join(', ')} Practice Members
                  </div>
                  {filteredUsers
                    .filter(user => assignedPractices.some(practice => 
                      user.practices && user.practices.includes(practice)
                    ))
                    .map(user => (
                      <button
                        key={user.email}
                        onClick={() => handleUserSelect(user)}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        <div className="text-xs text-blue-600">
                          {user.practices ? user.practices.join(', ') : 'No practices'}
                        </div>
                      </button>
                    ))
                  }
                </>
              )}
              
              {/* Other users section */}
              {filteredUsers.some(user => 
                !assignedPractices.some(practice => user.practices && user.practices.includes(practice))
              ) && (
                <>
                  {assignedPractices.length > 0 && (
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b">
                      Other Users
                    </div>
                  )}
                  {filteredUsers
                    .filter(user => !assignedPractices.some(practice => 
                      user.practices && user.practices.includes(practice)
                    ))
                    .map(user => (
                      <button
                        key={user.email}
                        onClick={() => handleUserSelect(user)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        <div className="text-xs text-gray-600">
                          {user.practices ? user.practices.join(', ') : 'No practices'}
                        </div>
                      </button>
                    ))
                  }
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}