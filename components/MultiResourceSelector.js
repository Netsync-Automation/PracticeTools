'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

// Color palette for practice badges - matches PracticeDisplay component
const COLOR_PALETTE = [
  { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  { bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-200' },
  { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
  { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' }
];

export default function MultiResourceSelector({ 
  value = [], 
  onChange, 
  assignedPractices = [], 
  placeholder = "Select or type a user name...",
  className = "",
  required = false,
  maxResources = 10,
  amEmail = null,
  practiceAssignments = {}
}) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userPractices, setUserPractices] = useState({});
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const selectedResources = useMemo(() => {
    return Array.isArray(value) ? value : (value ? [value] : []);
  }, [value]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      mapUserPractices();
    }
  }, [users, assignedPractices, practiceAssignments]);

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
      !selectedResources.some(resource => resource.includes(user.email)) &&
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

  const mapUserPractices = () => {
    const practices = {};
    
    // Helper function to extract friendly name
    const extractFriendlyName = (nameWithEmail) => {
      if (!nameWithEmail) return '';
      const match = nameWithEmail.match(/^(.+?)\s*<[^>]+>/);
      return match ? match[1].trim() : nameWithEmail.trim();
    };
    
    // First, map from practiceAssignments data (existing associations)
    Object.entries(practiceAssignments).forEach(([practice, saList]) => {
      if (Array.isArray(saList)) {
        saList.forEach(sa => {
          const friendlyName = extractFriendlyName(sa);
          // Map both full format and friendly name format
          [sa, friendlyName].forEach(key => {
            if (!practices[key]) practices[key] = [];
            practices[key].push({
              name: practice,
              colors: COLOR_PALETTE[assignedPractices.indexOf(practice) % COLOR_PALETTE.length]
            });
          });
        });
      }
    });
    
    // Then, map from user practices (for new selections)
    users.forEach(user => {
      if (user.practices && Array.isArray(user.practices)) {
        const matchingPractices = user.practices.filter(p => assignedPractices.includes(p));
        if (matchingPractices.length > 0) {
          const userKey = `${user.name} <${user.email}>`;
          const friendlyKey = user.name;
          [userKey, friendlyKey].forEach(key => {
            if (!practices[key]) {
              practices[key] = matchingPractices.map((practice, index) => ({
                name: practice,
                colors: COLOR_PALETTE[assignedPractices.indexOf(practice) % COLOR_PALETTE.length]
              }));
            }
          });
        }
      }
    });
    
    setUserPractices(practices);
  };

  const handleUserSelect = (user) => {
    if (selectedResources.length < maxResources) {
      onChange([...selectedResources, `${user.name} <${user.email}>`]);
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
                      {resource.replace(/<[^>]+>/, '').trim().charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{resource.replace(/<[^>]+>/, '').trim()}</p>
                    {userPractices[resource] && userPractices[resource].length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {userPractices[resource].map((practice, pIndex) => (
                          <span key={pIndex} className={`inline-flex items-center px-2 py-0.5 ${practice.colors?.bg || 'bg-gray-100'} ${practice.colors?.text || 'text-gray-700'} text-xs rounded-full border ${practice.colors?.border || 'border-gray-300'} font-medium`}>
                            {practice.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Resource #{index + 1}</p>
                    )}
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