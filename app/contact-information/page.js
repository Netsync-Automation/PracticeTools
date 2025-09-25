'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCsrf } from '../../hooks/useCsrf';
import { sanitizeText } from '../../lib/sanitize';
import Navbar from '../../components/Navbar';
import SidebarLayout from '../../components/SidebarLayout';
import Breadcrumb from '../../components/Breadcrumb';
import AccessCheck from '../../components/AccessCheck';
import ContactManagementSystem from '../../components/ContactManagementSystem';
import ContactSettingsModal from '../../components/ContactSettingsModal';

export default function ContactInformationPage() {
  const { user, loading, logout } = useAuth();
  const { getHeaders } = useCsrf();
  const [practiceGroups, setPracticeGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedType, setSelectedType] = useState('Main Contact List');
  const [contactTypes, setContactTypes] = useState(['Main Contact List']);
  const [contactInfo, setContactInfo] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dropdownWidth, setDropdownWidth] = useState('16rem');
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (user) {
      fetchPracticeGroups();
    }
  }, [user]);

  const fetchPracticeGroups = async () => {
    try {
      const response = await fetch('/api/practice-groups');
      const data = await response.json();
      
      // Sort groups alphabetically by displayName
      const sortedGroups = (data.groups || []).sort((a, b) => a.displayName.localeCompare(b.displayName));
      setPracticeGroups(sortedGroups);
      
      // Calculate width based on longest option
      if (sortedGroups.length > 0) {
        const longestText = sortedGroups.reduce((longest, group) => 
          group.displayName.length > longest.length ? group.displayName : longest, 
          'Select a practice group'
        );
        const calculatedWidth = Math.max(16, longestText.length * 0.6 + 4);
        setDropdownWidth(`${calculatedWidth}rem`);
        
        // Auto-select based on user's practices or first alphabetically
        let selectedGroupId = sortedGroups[0].id; // Default to first alphabetically
        
        if (user?.practices && user.practices.length > 0) {
          // Find group that matches user's practices
          const userGroup = sortedGroups.find(group => 
            group.practices.some(practice => user.practices.includes(practice))
          );
          if (userGroup) {
            selectedGroupId = userGroup.id;
          }
        }
        
        setSelectedGroup(selectedGroupId);
        fetchContactInfo(selectedGroupId);
        fetchContactTypes(selectedGroupId);
      }
    } catch (error) {
      // Error fetching practice groups - continue with empty array
    }
  };

  const fetchContactInfo = async (groupId) => {
    if (!groupId) return;
    
    setLoadingData(true);
    try {
      const response = await fetch(`/api/contact-information?groupId=${groupId}`);
      const data = await response.json();
      setContactInfo(data.contactInfo || null);
    } catch (error) {
      // Error fetching contact info - continue with null
    } finally {
      setLoadingData(false);
    }
  };

  const handleGroupChange = (groupId) => {
    setSelectedGroup(groupId);
    fetchContactInfo(groupId);
    fetchContactTypes(groupId);
  };

  const fetchContactTypes = async (groupId) => {
    if (!groupId) return;
    
    try {
      const response = await fetch(`/api/contact-types?practiceGroupId=${groupId}`);
      const data = await response.json();
      const types = ['Main Contact List', ...(data.contactTypes || [])];
      setContactTypes(types);
    } catch (error) {
      setContactTypes(['Main Contact List']);
    }
  };

  const canAddTypes = () => {
    if (!user || !selectedGroup) return false;
    
    // Admins and executives can add types for all practice groups
    if (user.isAdmin || user.role === 'executive') return true;
    
    // Practice managers and principals can add types for their assigned practices
    if ((user.role === 'practice_manager' || user.role === 'practice_principal') && user.practices) {
      const selectedGroupData = practiceGroups.find(group => group.id === selectedGroup);
      if (selectedGroupData) {
        return selectedGroupData.practices.some(practice => user.practices.includes(practice));
      }
    }
    
    return false;
  };

  const canManageSettings = () => {
    if (!user || !selectedGroup) return false;
    
    // Admins and executives can manage settings for all practice groups
    if (user.isAdmin || user.role === 'executive') return true;
    
    // Practice managers and principals can manage settings for their assigned practices
    if ((user.role === 'practice_manager' || user.role === 'practice_principal') && user.practices) {
      const selectedGroupData = practiceGroups.find(group => group.id === selectedGroup);
      if (selectedGroupData) {
        return selectedGroupData.practices.some(practice => user.practices.includes(practice));
      }
    }
    
    return false;
  };

  const canAddCompaniesContacts = () => {
    if (!user || !selectedGroup) return false;
    
    // Admins and executives can add for all practice groups
    if (user.isAdmin || user.role === 'executive') return true;
    
    // Practice members, managers, and principals can add for their assigned practices
    if ((user.role === 'practice_member' || user.role === 'practice_manager' || user.role === 'practice_principal') && user.practices) {
      const selectedGroupData = practiceGroups.find(group => group.id === selectedGroup);
      if (selectedGroupData) {
        return selectedGroupData.practices.some(practice => user.practices.includes(practice));
      }
    }
    
    return false;
  };

  const handleAddType = async () => {
    const sanitizedTypeName = sanitizeText(newTypeName);
    if (!sanitizedTypeName) return;
    
    try {
      const response = await fetch('/api/contact-types', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          practiceGroupId: selectedGroup,
          typeName: sanitizedTypeName
        })
      });
      
      if (response.ok) {
        setContactTypes([...contactTypes, sanitizedTypeName]);
        setSelectedType(sanitizedTypeName);
        setShowAddTypeModal(false);
        setNewTypeName('');
      }
    } catch (error) {
      // Error adding contact type - user will see no change
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
    <AccessCheck user={user}>
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={logout} />
        
        <SidebarLayout user={user}>
          <div className="p-8">
            <div className="w-full">
              <Breadcrumb items={[
                { label: 'Practice Information', href: '#' },
                { label: 'Contact Information' }
              ]} />

              <div className="mb-8">
                {/* Main Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    {/* Left: Title & Description */}
                    <div className="flex-1">
                      <h1 className="text-2xl font-bold text-gray-900">Contact Information</h1>
                      <p className="text-sm text-gray-600 mt-1">Manage practice contact information and directories</p>
                    </div>
                    
                    {/* Right: Settings Button */}
                    <div className="flex items-center gap-3">
                      {canManageSettings() && (
                        <button
                          onClick={() => setShowSettingsModal(true)}
                          className="p-3 text-gray-500 hover:text-blue-600 hover:bg-white rounded-xl border border-transparent hover:border-blue-200 transition-all duration-200 shadow-sm hover:shadow-md"
                          title="Contact Information Settings"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Controls Bar */}
                <div className="mt-6 bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between gap-6">
                    {/* Left: Selectors */}
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-semibold text-gray-700 min-w-fit">Practice Group</label>
                        <select
                          value={selectedGroup}
                          onChange={(e) => handleGroupChange(e.target.value)}
                          className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm font-medium min-w-64 shadow-sm"
                        >
                          <option value="">Select a practice group</option>
                          {practiceGroups.map(group => (
                            <option key={group.id} value={group.id}>
                              {group.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-semibold text-gray-700 min-w-fit">Type</label>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm font-medium min-w-48 shadow-sm"
                          >
                            {contactTypes.sort().map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          {canAddTypes() && (
                            <button
                              onClick={() => setShowAddTypeModal(true)}
                              className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-all duration-200"
                              title="Add new contact type"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Management System */}
              {selectedGroup && selectedType ? (
                <ContactManagementSystem 
                  practiceGroupId={selectedGroup}
                  contactType={selectedType}
                  user={user}
                  refreshTrigger={refreshTrigger}
                  canAddCompaniesContacts={canAddCompaniesContacts()}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Select a practice group and type to manage contact information.</p>
                </div>
              )}
            </div>
          </div>
        </SidebarLayout>
        
        {/* Add Type Modal */}
        {showAddTypeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Contact Type</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type Name
                </label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter contact type name"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddType()}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddTypeModal(false);
                    setNewTypeName('');
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddType}
                  disabled={!newTypeName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Type
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Contact Settings Modal */}
        <ContactSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          practiceGroupId={selectedGroup}
          contactType={selectedType}
          onSettingsChange={() => setRefreshTrigger(prev => prev + 1)}
        />
      </div>
    </AccessCheck>
  );
}