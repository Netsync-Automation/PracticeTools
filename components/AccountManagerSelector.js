'use client';

import { useState, useEffect, useRef } from 'react';
import RegionSelector from './RegionSelector';

export default function AccountManagerSelector({ 
  value, 
  onChange, 
  placeholder = "Select account manager...",
  className = "",
  required = false 
}) {
  const [accountManagers, setAccountManagers] = useState([]);
  const [filteredManagers, setFilteredManagers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAmData, setNewAmData] = useState({ name: '', email: '', region: '' });
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchAccountManagers();
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
    // Filter account managers based on search term
    const filtered = accountManagers.filter(manager => 
      manager.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredManagers(filtered);
  }, [accountManagers, searchTerm]);

  const fetchAccountManagers = async () => {
    try {
      const response = await fetch('/api/users/by-role?role=account_manager');
      if (response.ok) {
        const data = await response.json();
        setAccountManagers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching account managers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManagerSelect = (manager) => {
    if (manager.name === 'Add New AM') {
      setShowAddModal(true);
      setIsOpen(false);
      return;
    }
    onChange(manager.name);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleAddNewAM = async () => {
    if (!newAmData.name || !newAmData.email || !newAmData.region) {
      alert('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newAmData.name,
          email: newAmData.email,
          role: 'account_manager',
          region: newAmData.region
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Refresh account managers list
        await fetchAccountManagers();
        
        // Select the newly created AM
        onChange(newAmData.name);
        
        // Reset form and close modal
        setNewAmData({ name: '', email: '', region: '' });
        setShowAddModal(false);
        
        alert('Account Manager added successfully!');
      } else {
        alert(data.error || 'Failed to add Account Manager');
      }
    } catch (error) {
      console.error('Error adding Account Manager:', error);
      alert('Failed to add Account Manager');
    } finally {
      setSaving(false);
    }
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

  return (
    <>
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
            ) : (
              <>
                {/* Add New AM Option */}
                <button
                  onClick={() => handleManagerSelect({ name: 'Add New AM' })}
                  className="w-full px-3 py-2 text-left hover:bg-green-50 focus:bg-green-50 focus:outline-none border-b border-gray-100 bg-green-25"
                >
                  <div className="font-medium text-green-700 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add New AM
                  </div>
                  <div className="text-sm text-green-600">Create a new Account Manager</div>
                </button>
                
                {/* Existing Account Managers */}
                {filteredManagers.length === 0 ? (
                  <div className="p-3 text-center text-gray-500">
                    {searchTerm ? 'No account managers found' : 'No account managers available'}
                  </div>
                ) : (
                  filteredManagers.map(manager => (
                    <button
                      key={manager.email}
                      onClick={() => handleManagerSelect(manager)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{manager.name}</div>
                      <div className="text-sm text-gray-500">{manager.email}</div>
                      {manager.region && (
                        <div className="text-xs text-blue-600">{manager.region}</div>
                      )}
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Add New AM Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Add New Account Manager</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newAmData.name}
                    onChange={(e) => setNewAmData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={newAmData.email}
                    onChange={(e) => setNewAmData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter email address"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
                  <RegionSelector
                    value={newAmData.region}
                    onChange={(region) => setNewAmData(prev => ({ ...prev, region }))}
                    placeholder="Select region..."
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewAmData({ name: '', email: '', region: '' });
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewAM}
                  disabled={saving || !newAmData.name || !newAmData.email || !newAmData.region}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Account Manager'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}