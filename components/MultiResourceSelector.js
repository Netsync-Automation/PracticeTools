'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function MultiResourceSelector({ 
  value = [], 
  onChange, 
  assignedPractices = [], 
  placeholder = "Select or type a user name...",
  className = "",
  required = false,
  maxResources = 10
}) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const selectedResources = useMemo(() => {
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
    // Filter users: exclude already selected ones and filter by search term
    let filtered = users.filter(user => 
      !selectedResources.includes(user.name) &&
      (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       user.email.toLowerCase().includes(searchTerm.toLowerCase()))
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
      
      return a.name.localeCompare(b.name);
    });

    setFilteredUsers(filtered);
  }, [users, searchTerm, assignedPractices, selectedResources]);

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

  const handleUserSelect = (user) => {
    if (selectedResources.length < maxResources) {
      onChange([...selectedResources, user.name]);
      setSearchTerm('');
      setIsOpen(false);
    }
  };

  const handleRemoveResource = (resourceToRemove) => {
    onChange(selectedResources.filter(resource => resource !== resourceToRemove));
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
    if (searchTerm.trim() && selectedResources.length < maxResources && !selectedResources.includes(searchTerm.trim())) {
      onChange([...selectedResources, searchTerm.trim()]);
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
      {/* Selected Resources Display */}
      {selectedResources.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-500">
            Assigned Resources ({selectedResources.length}/{maxResources})
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {selectedResources.map((resource, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg group hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold text-sm">
                      {resource.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{resource}</p>
                    <p className="text-xs text-gray-500">Resource #{index + 1}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveResource(resource)}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Resource */}
      {selectedResources.length < maxResources && (
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {selectedResources.length === 0 ? 'Resource Assigned' : 'Add Another Resource'}
            {required && selectedResources.length === 0 && ' *'}
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
              required={required && selectedResources.length === 0}
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
                        <p className="text-sm">No users found</p>
                        {searchTerm.trim() && (
                          <button
                            onClick={handleAddFromInput}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                          >
                            Add "{searchTerm.trim()}" as custom resource
                          </button>
                        )}
                      </div>
                    ) : 'No users available'}
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
          
          {selectedResources.length >= maxResources && (
            <p className="mt-1 text-xs text-amber-600">
              Maximum of {maxResources} resources reached
            </p>
          )}
        </div>
      )}
    </div>
  );
}