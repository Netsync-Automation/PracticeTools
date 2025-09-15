'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function MultiAccountManagerSelector({ 
  value = [], 
  onChange, 
  placeholder = "Select or type account manager names...",
  className = "",
  required = false,
  maxManagers = 5
}) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const selectedManagers = useMemo(() => {
    return Array.isArray(value) ? value : (value ? [value] : []);
  }, [value]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Filter account managers: exclude already selected ones and filter by search term
    let filtered = users.filter(user => 
      user.role === 'account_manager' &&
      !selectedManagers.includes(user.name) &&
      (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    filtered.sort((a, b) => a.name.localeCompare(b.name));
    setFilteredUsers(filtered);
  }, [users, searchTerm, selectedManagers]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManagerSelect = (user) => {
    if (selectedManagers.length < maxManagers) {
      onChange([...selectedManagers, user.name]);
      setSearchTerm('');
      setIsOpen(false);
    }
  };

  const handleRemoveManager = (managerToRemove) => {
    onChange(selectedManagers.filter(manager => manager !== managerToRemove));
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleAddFromInput = () => {
    if (searchTerm.trim() && selectedManagers.length < maxManagers && !selectedManagers.includes(searchTerm.trim())) {
      onChange([...selectedManagers, searchTerm.trim()]);
      setSearchTerm('');
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      handleAddFromInput();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Selected Managers Display */}
      {selectedManagers.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-500">
            Account Managers ({selectedManagers.length}/{maxManagers})
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {selectedManagers.map((manager, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg group hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold text-sm">
                      {manager.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{manager}</p>
                    <p className="text-xs text-gray-500">Account Manager #{index + 1}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveManager(manager)}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Manager */}
      {selectedManagers.length < maxManagers && (
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {selectedManagers.length === 0 ? 'Account Manager' : 'Add Another Account Manager'}
            {required && selectedManagers.length === 0 && ' *'}
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required={required && selectedManagers.length === 0}
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
                    {searchTerm ? (
                      <div>
                        <p className="text-sm">No account managers found</p>
                        {searchTerm.trim() && (
                          <button
                            onClick={handleAddFromInput}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                          >
                            Add "{searchTerm.trim()}" as custom account manager
                          </button>
                        )}
                      </div>
                    ) : 'No account managers available'}
                  </div>
                ) : (
                  <>
                    {filteredUsers.map(user => (
                      <button
                        key={user.email}
                        onClick={() => handleManagerSelect(user)}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        {user.region && <div className="text-xs text-blue-600">{user.region}</div>}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          
          {selectedManagers.length >= maxManagers && (
            <p className="mt-1 text-xs text-amber-600">
              Maximum of {maxManagers} account managers reached
            </p>
          )}
        </div>
      )}
    </div>
  );
}