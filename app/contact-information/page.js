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
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    practiceGroup: '',
    tier: '',
    technology: '',
    solutionType: ''
  });
  const [fieldOptions, setFieldOptions] = useState({
    tier: [],
    technology: [],
    solutionType: []
  });
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSearchResult, setSelectedSearchResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPracticeGroups();
    }
  }, [user]);

  useEffect(() => {
    if (selectedGroup) {
      fetchFieldOptions();
    }
  }, [selectedGroup, refreshTrigger, filters.practiceGroup]);

  const fetchFieldOptions = async () => {
    try {
      const fields = ['tier', 'technology', 'solutionType'];
      const options = {};
      
      // If "All Practice Groups" is selected, fetch options from all practice groups
      if (filters.practiceGroup === '') {
        for (const field of fields) {
          const allOptions = new Set();
          for (const group of practiceGroups) {
            const response = await fetch(`/api/field-options?practiceGroupId=${group.id}&fieldName=${field}`);
            const data = await response.json();
            (data.options || []).forEach(opt => {
              if (opt !== 'Create your own options in Settings') {
                allOptions.add(opt);
              }
            });
          }
          options[field] = Array.from(allOptions).sort();
        }
      } else {
        // Fetch options for specific practice group
        const targetGroupId = filters.practiceGroup || selectedGroup;
        for (const field of fields) {
          const response = await fetch(`/api/field-options?practiceGroupId=${targetGroupId}&fieldName=${field}`);
          const data = await response.json();
          options[field] = data.options || [];
        }
      }
      
      setFieldOptions(options);
    } catch (error) {
      // Error fetching field options
    }
  };

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
          <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8">
            <div className="w-full">
              <Breadcrumb items={[
                { label: 'Practice Information', href: '#' },
                { label: 'Contact Information' }
              ]} />

              <div className="mb-8">
                {/* Main Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 shadow-sm">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <h1 className="text-2xl font-bold text-gray-900">Contact Information</h1>
                      <p className="text-sm text-gray-600 mt-1">Manage practice contact information and directories</p>
                    </div>
                  </div>
                </div>
                
                {/* Search and Filters */}
                <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border-2 border-indigo-200 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">Global Search & Filters</h3>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Search companies and contacts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => searchTerm && setShowSearchResults(true)}
                        onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                        className="w-full px-4 py-2.5 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white shadow-sm"
                      />
                      {showSearchResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-y-auto z-50">
                          {searchResults.map((result, index) => (
                            <div
                              key={`${result.type}-${result.id}-${index}`}
                              onClick={() => {
                                setSelectedSearchResult(result);
                                setShowResultModal(true);
                                setSearchTerm('');
                                setShowSearchResults(false);
                              }}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${
                                  result.type === 'company' ? 'bg-blue-500' : 'bg-green-500'
                                }`}></div>
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    {result.matchText}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {result.type === 'company' 
                                      ? `${result.technology} • Tier ${result.tier}` 
                                      : `${result.role} • ${result.email}`
                                    }
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    {result.practiceGroupName} • {result.contactType}
                                  </div>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  result.type === 'company' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {result.type === 'company' ? 'Company' : 'Contact'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <select
                      value={filters.practiceGroup}
                      onChange={(e) => setFilters({...filters, practiceGroup: e.target.value})}
                      className="px-3 py-2.5 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-w-40 max-w-40 truncate bg-white shadow-sm"
                      title={filters.practiceGroup ? practiceGroups.find(g => g.id === filters.practiceGroup)?.displayName : 'All Practice Groups'}
                    >
                      <option value="" title="All Practice Groups">All Practice Groups</option>
                      {practiceGroups.map(group => (
                        <option key={group.id} value={group.id} title={group.displayName}>
                          {group.displayName}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filters.tier}
                      onChange={(e) => setFilters({...filters, tier: e.target.value})}
                      className="px-3 py-2.5 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-w-40 max-w-40 truncate bg-white shadow-sm"
                      title={filters.tier || 'All Tiers'}
                    >
                      <option value="" title="All Tiers">All Tiers</option>
                      {fieldOptions.tier.filter(opt => opt !== 'Create your own options in Settings').map(option => (
                        <option key={option} value={option} title={option}>{option}</option>
                      ))}
                    </select>
                    <select
                      value={filters.technology}
                      onChange={(e) => setFilters({...filters, technology: e.target.value})}
                      className="px-3 py-2.5 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-w-40 max-w-40 truncate bg-white shadow-sm"
                      title={filters.technology || 'All Technology'}
                    >
                      <option value="" title="All Technology">All Technology</option>
                      {fieldOptions.technology.filter(opt => opt !== 'Create your own options in Settings').map(option => (
                        <option key={option} value={option} title={option}>{option}</option>
                      ))}
                    </select>
                    <select
                      value={filters.solutionType}
                      onChange={(e) => setFilters({...filters, solutionType: e.target.value})}
                      className="px-3 py-2.5 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-w-40 max-w-40 truncate bg-white shadow-sm"
                      title={filters.solutionType || 'All Solutions'}
                    >
                      <option value="" title="All Solutions">All Solutions</option>
                      {fieldOptions.solutionType.filter(opt => opt !== 'Create your own options in Settings').map(option => (
                        <option key={option} value={option} title={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Practice Group and Type Selectors */}
                <div className="mt-6 bg-gradient-to-br from-white to-blue-50 rounded-xl p-5 border-2 border-blue-200 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-bold text-blue-900">Contact Management</h3>
                    </div>
                    {canManageSettings() && (
                      <button
                        onClick={() => setShowSettingsModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg border border-gray-300 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow"
                        title="Contact Information Settings"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
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

              {/* Contact Management System */}
              {selectedGroup && selectedType ? (
                <ContactManagementSystem 
                  practiceGroupId={selectedGroup}
                  contactType={selectedType}
                  user={user}
                  refreshTrigger={refreshTrigger}
                  canAddCompaniesContacts={canAddCompaniesContacts()}
                  externalFilters={filters}
                  onSearchResults={(results) => {
                    setSearchResults(results);
                    setShowSearchResults(results.length > 0 && searchTerm.length > 0);
                  }}
                  allPracticeGroups={practiceGroups}
                  searchTerm={searchTerm}
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
          practiceGroupName={practiceGroups.find(g => g.id === selectedGroup)?.displayName}
        />

        {/* Search Result Details Modal */}
        {showResultModal && selectedSearchResult && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden border border-gray-100">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      selectedSearchResult.type === 'company' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      {selectedSearchResult.type === 'company' ? (
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {selectedSearchResult.type === 'company' ? 'Company Details' : 'Contact Details'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedSearchResult.type === 'company' ? selectedSearchResult.name : `${selectedSearchResult.name} at ${selectedSearchResult.companyName}`}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {selectedSearchResult.practiceGroupName}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {selectedSearchResult.contactType}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canAddCompaniesContacts() && (
                      <>
                        <button
                          onClick={() => {
                            setShowResultModal(false);
                            // Edit functionality would go here
                          }}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200"
                          title="Edit"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setShowResultModal(false);
                            // Delete functionality would go here
                          }}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-all duration-200"
                          title="Delete"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setShowResultModal(false);
                            // History functionality would go here
                          }}
                          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200"
                          title="View History"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setShowResultModal(false);
                        setSelectedSearchResult(null);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white hover:bg-opacity-50 rounded-lg transition-all duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 bg-gray-50 max-h-[70vh] overflow-y-auto">
                {selectedSearchResult.type === 'company' ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Company Name</label>
                        <p className="text-xl font-bold text-gray-900 mt-1">{selectedSearchResult.name}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Website</label>
                        <p className="text-gray-900 mt-1">
                          <a href={selectedSearchResult.website?.startsWith('http') ? selectedSearchResult.website : `https://${selectedSearchResult.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1">
                            {selectedSearchResult.website}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">MSA Status</label>
                        <p className="mt-1">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                            selectedSearchResult.msaSigned === 'Yes' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {selectedSearchResult.msaSigned === 'Yes' ? '✓ MSA Signed' : '✗ No MSA'}
                          </span>
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tier</label>
                        <p className="mt-1">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
                            Tier {selectedSearchResult.tier}
                          </span>
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Technology</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(Array.isArray(selectedSearchResult.technology) ? selectedSearchResult.technology : [selectedSearchResult.technology]).map((tech, idx) => (
                            <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Solution Type</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(Array.isArray(selectedSearchResult.solutionType) ? selectedSearchResult.solutionType : [selectedSearchResult.solutionType]).map((solution, idx) => (
                            <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                              {solution}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</label>
                        <p className="text-xl font-bold text-gray-900 mt-1">{selectedSearchResult.name}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</label>
                        <p className="text-lg font-semibold text-gray-700 mt-1">{selectedSearchResult.companyName}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</label>
                        <p className="text-gray-900 mt-1">{selectedSearchResult.role}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                        <p className="text-gray-900 mt-1">
                          <a href={`mailto:${selectedSearchResult.email}`} className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1">
                            📧 {selectedSearchResult.email}
                          </a>
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cell Phone</label>
                        <p className="text-gray-900 mt-1">
                          <a href={`tel:${selectedSearchResult.cellPhone}`} className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1">
                            📱 {selectedSearchResult.cellPhone}
                          </a>
                        </p>
                      </div>
                      {selectedSearchResult.officePhone && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Office Phone</label>
                          <p className="text-gray-900 mt-1">
                            <a href={`tel:${selectedSearchResult.officePhone}`} className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1">
                              📞 {selectedSearchResult.officePhone}
                            </a>
                          </p>
                        </div>
                      )}
                      {selectedSearchResult.fax && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fax</label>
                          <p className="text-gray-900 mt-1">📠 {selectedSearchResult.fax}</p>
                        </div>
                      )}
                      {selectedSearchResult.notes && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</label>
                          <p className="text-gray-900 mt-1 bg-gray-50 rounded-lg p-3 border border-gray-200">📝 {selectedSearchResult.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AccessCheck>
  );
}