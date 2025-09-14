'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import Navbar from '../../../components/Navbar';
import SidebarLayout from '../../../components/SidebarLayout';
import Breadcrumb from '../../../components/Breadcrumb';
import AccessCheck from '../../../components/AccessCheck';

export default function SAToAMMappingPage() {
  const { user, loading, logout } = useAuth();
  const [practiceGroups, setPracticeGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [mappings, setMappings] = useState([]);
  const [regions, setRegions] = useState([]);
  const [practiceUsers, setPracticeUsers] = useState([]);
  const [accountManagers, setAccountManagers] = useState([]);
  const [showSaDropdown, setShowSaDropdown] = useState(false);
  const [showAmDropdown, setShowAmDropdown] = useState(false);
  const [showAddAmModal, setShowAddAmModal] = useState(false);
  const [newAm, setNewAm] = useState({ name: '', email: '', region: '' });
  const [amError, setAmError] = useState('');
  const saDropdownRef = useRef(null);
  const amDropdownRef = useRef(null);
  const [loadingData, setLoadingData] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMapping, setNewMapping] = useState({ saName: '', amName: '', region: '', practices: [] });
  const [editingMapping, setEditingMapping] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredMappings, setFilteredMappings] = useState([]);
  const [filters, setFilters] = useState({
    region: '',
    practices: []
  });
  const [dropdownWidth, setDropdownWidth] = useState('16rem');
  const [saMappingSettings, setSaMappingSettings] = useState({});
  const [practiceManager, setPracticeManager] = useState(null);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [tempPracticeSelection, setTempPracticeSelection] = useState([]);

  useEffect(() => {
    if (user) {
      fetchPracticeGroups();
      fetchRegions();
      fetchSaMappingSettings();
    }
  }, [user]);

  useEffect(() => {
    if (selectedGroup && selectedGroup !== 'all') {
      fetchPracticeManager();
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (selectedGroup) {
      fetchMappings();
      
      // Set up SSE for real-time updates
      const eventSource = new EventSource(`/api/sse/sa-to-am-mapping?practiceGroupId=${selectedGroup}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'sa-to-am-mapping-update' && data.practiceGroupId === selectedGroup) {
          fetchMappings();
        }
      };
      
      return () => {
        eventSource.close();
      };
    }
  }, [selectedGroup]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (saDropdownRef.current && !saDropdownRef.current.contains(event.target)) {
        setShowSaDropdown(false);
      }
      if (amDropdownRef.current && !amDropdownRef.current.contains(event.target)) {
        setShowAmDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    filterMappings();
  }, [mappings, searchTerm, filters]);

  const fetchPracticeGroups = async () => {
    try {
      const response = await fetch('/api/practice-groups');
      const data = await response.json();
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
      }
      
      if (sortedGroups.length > 0) {
        let selectedGroupId = sortedGroups[0].id; // Default to first alphabetically
        
        if (user?.practices && user.practices.length > 0) {
          // Find all groups that match user's practices
          const matchingGroups = sortedGroups.filter(group => 
            group.practices.some(practice => user.practices.includes(practice))
          );
          
          // If matches found, use first one (already sorted alphabetically)
          if (matchingGroups.length > 0) {
            selectedGroupId = matchingGroups[0].id;
          }
        }
        
        setSelectedGroup(selectedGroupId);
      }
    } catch (error) {
      console.error('Error fetching practice groups:', error);
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

  const fetchPracticeUsers = async (practiceGroupId) => {
    if (!practiceGroupId) return;
    try {
      const response = await fetch(`/api/users/by-practice?practiceGroupId=${practiceGroupId}`);
      const data = await response.json();
      setPracticeUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching practice users:', error);
      setPracticeUsers([]);
    }
  };

  const fetchAccountManagers = async () => {
    try {
      const response = await fetch('/api/users/by-role?role=account_manager');
      const data = await response.json();
      setAccountManagers(data.users || []);
    } catch (error) {
      console.error('Error fetching account managers:', error);
      setAccountManagers([]);
    }
  };

  const fetchSaMappingSettings = async () => {
    try {
      const response = await fetch('/api/settings/sa-mappings');
      const data = await response.json();
      setSaMappingSettings(data.settings || {});
    } catch (error) {
      console.error('Error fetching SA mapping settings:', error);
    }
  };

  const fetchPracticeManager = async () => {
    if (!selectedGroup || selectedGroup === 'all') return;
    try {
      const response = await fetch(`/api/practice-groups/${selectedGroup}/manager`);
      const data = await response.json();
      setPracticeManager(data.manager || null);
    } catch (error) {
      console.error('Error fetching practice manager:', error);
      setPracticeManager(null);
    }
  };

  const fetchMappings = async () => {
    if (!selectedGroup) return;
    setLoadingData(true);
    try {
      const url = selectedGroup === 'all' 
        ? '/api/sa-to-am-mapping?all=true'
        : `/api/sa-to-am-mapping?practiceGroupId=${selectedGroup}`;
      const response = await fetch(url);
      const data = await response.json();
      setMappings(data.mappings || []);
    } catch (error) {
      console.error('Error fetching mappings:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const filterMappings = () => {
    let filtered = mappings;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(mapping =>
        mapping.saName.toLowerCase().includes(searchLower) ||
        mapping.amName.toLowerCase().includes(searchLower) ||
        mapping.region.toLowerCase().includes(searchLower)
      );
    }

    // Apply region filter
    if (filters.region) {
      filtered = filtered.filter(mapping => mapping.region === filters.region);
    }

    // Apply practices filter
    if (filters.practices.length > 0) {
      filtered = filtered.filter(mapping => 
        filters.practices.some(practice => 
          mapping.practices && mapping.practices.includes(practice)
        )
      );
    }

    setFilteredMappings(filtered);
  };

  const selectedPracticeGroup = practiceGroups.find(group => group.id === selectedGroup);
  const selectedPracticeName = selectedPracticeGroup?.practices?.[0] || '';
  const isMappingEnabled = selectedPracticeName ? saMappingSettings[selectedPracticeName] !== false : true;

  const userCanEdit = user && selectedGroup && selectedGroup !== 'all' && isMappingEnabled && (
    user.isAdmin || 
    (['practice_manager', 'practice_principal', 'practice_member'].includes(user.role) && 
     user.practices && 
     practiceGroups.find(group => group.id === selectedGroup)?.practices.some(practice => user.practices.includes(practice))
    )
  );

  const handleAddMapping = async () => {
    if (!newMapping.saName || !newMapping.amName || !newMapping.practices.length) {
      alert('Please fill in SA name, AM name, and at least one practice');
      return;
    }
    if (newMapping.amName !== 'All' && !newMapping.region) {
      alert('Please select a region (not required for "All" mappings)');
      return;
    }
    try {
      const response = await fetch('/api/sa-to-am-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newMapping, practiceGroupId: selectedGroup })
      });
      if (response.ok) {
        setShowAddModal(false);
        setNewMapping({ saName: '', amName: '', region: '', practices: [] });
        fetchMappings(); // Refresh immediately
        // SSE will trigger fetchMappings() for all users
      }
    } catch (error) {
      console.error('Error adding mapping:', error);
    }
  };

  const handleEditMapping = async () => {
    if (!newMapping.saName || !newMapping.amName || !newMapping.practices.length) {
      alert('Please fill in SA name, AM name, and at least one practice');
      return;
    }
    if (newMapping.amName !== 'All' && !newMapping.region) {
      alert('Please select a region (not required for "All" mappings)');
      return;
    }
    try {
      const response = await fetch('/api/sa-to-am-mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: editingMapping.id,
          ...newMapping, 
          practiceGroupId: selectedGroup 
        })
      });
      if (response.ok) {
        setShowEditModal(false);
        setEditingMapping(null);
        setNewMapping({ saName: '', amName: '', region: '', practices: [] });
        fetchMappings(); // Refresh immediately
      }
    } catch (error) {
      console.error('Error editing mapping:', error);
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;
    try {
      const response = await fetch(`/api/sa-to-am-mapping?id=${mappingId}&practiceGroupId=${selectedGroup}`, { method: 'DELETE' });
      if (response.ok) {
        fetchMappings(); // Immediate refresh for user who deleted
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
    }
  };

  const handleAddAm = async () => {
    setAmError('');
    
    if (!newAm.name.trim() || !newAm.email.trim() || !newAm.region.trim()) {
      setAmError('Name, email, and region are required');
      return;
    }
    
    if (!newAm.email.endsWith('@netsync.com')) {
      setAmError('Email must be from netsync.com domain');
      return;
    }
    
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAm.name.trim(),
          email: newAm.email.trim(),
          role: 'account_manager',
          region: newAm.region.trim(),
          auth_method: 'sso'
        })
      });
      
      if (response.ok) {
        setShowAddAmModal(false);
        setNewAm({ name: '', email: '', region: '' });
        setNewMapping({...newMapping, amName: newAm.name.trim()});
        await fetchAccountManagers(); // Refresh the list
      } else {
        const errorData = await response.json();
        setAmError(errorData.error || 'Failed to add account manager');
      }
    } catch (error) {
      setAmError('Error adding account manager');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AccessCheck user={user}>
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={logout} />
        <SidebarLayout user={user}>
          <div className="p-8">
            <Breadcrumb items={[
              { label: 'Pre-Sales', href: '#' },
              { label: 'SA to AM Mapping' }
            ]} />

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">SA to AM Mapping</h1>
                <p className="text-gray-600">Manage Solutions Architect to Account Manager mappings by region</p>
              </div>
              <div style={{ width: dropdownWidth }}>
                <label className="block text-sm font-medium text-gray-700 mb-2">Practice Group</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => {
                    setSelectedGroup(e.target.value);
                    setFilters({ region: '', practices: [] });
                    setSearchTerm('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a practice group</option>
                  <option value="all">All Practice Groups</option>
                  {practiceGroups.map(group => (
                    <option key={group.id} value={group.id}>{group.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search and Filters */}
            {selectedGroup && selectedGroup !== '' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  {/* Search */}
                  <div className="space-y-2 lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Search</label>
                    <input
                      type="text"
                      placeholder="Search SA, AM, or region..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* Practices Filter */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Practices</label>
                    <button
                      onClick={() => {
                        setTempPracticeSelection(filters.practices);
                        setShowPracticeModal(true);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm text-left flex items-center justify-between"
                    >
                      <span>
                        {filters.practices.length === 0 ? 'All Practices' : 
                         filters.practices.length === 1 ? filters.practices[0] : 
                         'Multiple Practices'}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Region Filter */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Region</label>
                    <select
                      value={filters.region}
                      onChange={(e) => setFilters({...filters, region: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Regions</option>
                      {regions.map(region => (
                        <option key={region.id} value={region.name}>{region.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Reset Button */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">&nbsp;</label>
                    <button
                      onClick={() => {
                        setFilters({ region: '', practices: [] });
                        setSearchTerm('');
                      }}
                      className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Reset
                    </button>
                  </div>
                  
                  {/* Add New Mapping Button */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">&nbsp;</label>
                    {userCanEdit && (
                      <button
                        onClick={() => {
                          setShowAddModal(true);
                          fetchPracticeUsers(selectedGroup);
                          fetchAccountManagers();
                        }}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Add New Mapping
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Active Filters Display */}
                {(filters.practices.length > 0 || filters.region || searchTerm) && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-medium text-gray-700">Active Filters:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* Practice Filters */}
                      {filters.practices.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                          Practices: {filters.practices.join(', ')}
                          <button
                            onClick={() => setFilters({...filters, practices: []})}
                            className="ml-1 hover:bg-green-200 rounded-full p-0.5"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </span>
                      )}
                      
                      {/* Region Filter */}
                      {filters.region && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                          Region: {filters.region}
                          <button
                            onClick={() => setFilters({...filters, region: ''})}
                            className="ml-1 hover:bg-purple-200 rounded-full p-0.5"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </span>
                      )}
                      
                      {/* Search Filter */}
                      {searchTerm && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                          Search: "{searchTerm}"
                          <button
                            onClick={() => setSearchTerm('')}
                            className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                          >
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
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">SA to AM Mappings ({filteredMappings.length})</h3>
              </div>

              {!selectedGroup ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">Select a practice group to view SA to AM mappings.</p>
                </div>
              ) : selectedGroup !== 'all' && !isMappingEnabled ? (
                <div className="text-center py-12">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 max-w-2xl mx-auto">
                    <div className="flex items-center justify-center mb-4">
                      <svg className="w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Alternative SA Assignment Method</h3>
                    <p className="text-lg text-gray-800 mb-4">
                      This practice uses alternative SA assignment method than direct AM to SA mapping.
                    </p>
                    {practiceManager && (
                      <p className="text-md text-gray-700">
                        Please reach out to <strong>{practiceManager.name}</strong> at <a href={`mailto:${practiceManager.email}`} className="text-blue-600 hover:text-blue-800 underline">{practiceManager.email}</a> for further information.
                      </p>
                    )}
                    {!practiceManager && (
                      <p className="text-md text-gray-700">
                        Please reach out to your Practice Manager for further information.
                      </p>
                    )}
                  </div>
                </div>
              ) : loadingData ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : filteredMappings.length === 0 && mappings.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-sm font-medium text-gray-900">No mappings found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {userCanEdit ? 'Get started by creating your first SA to AM mapping.' : 'No mappings have been created for this practice group.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solutions Architect</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Manager</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Practices</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                        {userCanEdit && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredMappings.map((mapping) => (
                        <tr key={mapping.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{mapping.saName}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{mapping.amName}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="flex flex-wrap gap-1">
                              {(mapping.practices || []).map(practice => (
                                <span key={practice} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {practice}
                                </span>
                              ))}
                              {(!mapping.practices || mapping.practices.length === 0) && (
                                <span className="text-gray-400 italic">No practices assigned</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{mapping.region}</td>
                          {userCanEdit && (
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingMapping(mapping);
                                    setNewMapping({
                                      saName: mapping.saName,
                                      amName: mapping.amName,
                                      region: mapping.region,
                                      practices: mapping.practices || []
                                    });
                                    setShowEditModal(true);
                                    fetchPracticeUsers(selectedGroup);
                                    fetchAccountManagers();
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors duration-150"
                                  title="Edit mapping"
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteMapping(mapping.id)}
                                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 hover:border-red-300 transition-colors duration-150"
                                  title="Delete mapping"
                                >
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {filteredMappings.length === 0 && mappings.length > 0 && (
                <div className="text-center py-12">
                  <h3 className="text-sm font-medium text-gray-900">No mappings match your search</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search terms or filters.
                  </p>
                </div>
              )}
            </div>
          </div>
        </SidebarLayout>

        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New SA to AM Mapping</h3>
              <div className="space-y-4">
                <div className="relative" ref={saDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Solutions Architect Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newMapping.saName}
                      onChange={(e) => {
                        setNewMapping({...newMapping, saName: e.target.value});
                        setShowSaDropdown(true);
                      }}
                      onFocus={() => setShowSaDropdown(true)}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search for Solutions Architect..."
                    />
                    {newMapping.saName && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewMapping({...newMapping, saName: ''});
                          setShowSaDropdown(false);
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {showSaDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {practiceUsers
                        .filter(user => 
                          user.name.toLowerCase().includes((newMapping.saName || '').toLowerCase())
                        )
                        .map(user => (
                          <div
                            key={user.id}
                            onClick={() => {
                              setNewMapping({...newMapping, saName: user.name});
                              setShowSaDropdown(false);
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          >
                            {user.name}
                          </div>
                        ))
                      }
                      {practiceUsers.filter(user => 
                        user.name.toLowerCase().includes((newMapping.saName || '').toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                          No users found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative" ref={amDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Manager Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newMapping.amName}
                      onChange={(e) => {
                        setNewMapping({...newMapping, amName: e.target.value});
                        setShowAmDropdown(true);
                      }}
                      onFocus={() => setShowAmDropdown(true)}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search for Account Manager..."
                    />
                    {newMapping.amName && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewMapping({...newMapping, amName: ''});
                          setShowAmDropdown(false);
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {showAmDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      <div
                        onClick={() => {
                          setShowAddAmModal(true);
                          setShowAmDropdown(false);
                        }}
                        className="px-3 py-2 bg-blue-50 hover:bg-blue-100 cursor-pointer text-sm font-medium text-blue-700 border-b border-gray-200"
                      >
                        + Add New AM
                      </div>
                      <div
                        onClick={() => {
                          setNewMapping({...newMapping, amName: 'All', region: ''});
                          setShowAmDropdown(false);
                        }}
                        className="px-3 py-2 bg-green-50 hover:bg-green-100 cursor-pointer text-sm font-medium text-green-700 border-b border-gray-200"
                        title="Map this SA to all existing Account Managers for the selected practices"
                      >
                        🌐 All Account Managers
                      </div>
                      {accountManagers
                        .filter(am => 
                          am.name.toLowerCase().includes((newMapping.amName || '').toLowerCase())
                        )
                        .map(am => (
                          <div
                            key={am.id}
                            onClick={() => {
                              setNewMapping({...newMapping, amName: am.name, region: am.region || newMapping.region});
                              setShowAmDropdown(false);
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          >
                            {am.name}
                          </div>
                        ))
                      }
                      {accountManagers.filter(am => 
                        am.name.toLowerCase().includes((newMapping.amName || '').toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                          No account managers found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Practices *</label>
                  <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                    {selectedPracticeGroup?.practices?.map(practice => (
                      <label key={practice} className="flex items-center mb-2 last:mb-0">
                        <input
                          type="checkbox"
                          checked={newMapping.practices.includes(practice)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewMapping({...newMapping, practices: [...newMapping.practices, practice]});
                            } else {
                              setNewMapping({...newMapping, practices: newMapping.practices.filter(p => p !== practice)});
                            }
                          }}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{practice}</span>
                      </label>
                    )) || (
                      <p className="text-sm text-gray-500">No practices available for this group</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Select the practices this SA supports for this AM</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Region {newMapping.amName === 'All' && <span className="text-xs text-gray-500">(Not required for "All" mappings)</span>}
                  </label>
                  <select
                    value={newMapping.region}
                    onChange={(e) => setNewMapping({...newMapping, region: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={newMapping.amName === 'All'}
                  >
                    <option value="">{newMapping.amName === 'All' ? 'No region (All AMs)' : 'Select a region'}</option>
                    {newMapping.amName !== 'All' && regions.map(region => (
                      <option key={region.id} value={region.name}>{region.name}</option>
                    ))}
                  </select>
                  {newMapping.amName === 'All' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Region is not assigned when mapping to all Account Managers
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewMapping({ saName: '', amName: '', region: '', practices: [] });
                    setShowSaDropdown(false);
                    setShowAmDropdown(false);
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMapping}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {newMapping.amName === 'All' ? 'Create All Mappings' : 'Add Mapping'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Mapping Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit SA to AM Mapping</h3>
              <div className="space-y-4">
                <div className="relative" ref={saDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Solutions Architect Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newMapping.saName}
                      onChange={(e) => {
                        setNewMapping({...newMapping, saName: e.target.value});
                        setShowSaDropdown(true);
                      }}
                      onFocus={() => setShowSaDropdown(true)}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search for Solutions Architect..."
                    />
                    {newMapping.saName && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewMapping({...newMapping, saName: ''});
                          setShowSaDropdown(false);
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {showSaDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {practiceUsers
                        .filter(user => 
                          user.name.toLowerCase().includes((newMapping.saName || '').toLowerCase())
                        )
                        .map(user => (
                          <div
                            key={user.id}
                            onClick={() => {
                              setNewMapping({...newMapping, saName: user.name});
                              setShowSaDropdown(false);
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          >
                            {user.name}
                          </div>
                        ))
                      }
                      {practiceUsers.filter(user => 
                        user.name.toLowerCase().includes((newMapping.saName || '').toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                          No users found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative" ref={amDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Manager Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newMapping.amName}
                      onChange={(e) => {
                        setNewMapping({...newMapping, amName: e.target.value});
                        setShowAmDropdown(true);
                      }}
                      onFocus={() => setShowAmDropdown(true)}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search for Account Manager..."
                    />
                    {newMapping.amName && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewMapping({...newMapping, amName: ''});
                          setShowAmDropdown(false);
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {showAmDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      <div
                        onClick={() => {
                          setShowAddAmModal(true);
                          setShowAmDropdown(false);
                        }}
                        className="px-3 py-2 bg-blue-50 hover:bg-blue-100 cursor-pointer text-sm font-medium text-blue-700 border-b border-gray-200"
                      >
                        + Add New AM
                      </div>
                      <div
                        onClick={() => {
                          setNewMapping({...newMapping, amName: 'All', region: ''});
                          setShowAmDropdown(false);
                        }}
                        className="px-3 py-2 bg-green-50 hover:bg-green-100 cursor-pointer text-sm font-medium text-green-700 border-b border-gray-200"
                        title="Map this SA to all existing Account Managers for the selected practices"
                      >
                        🌐 All Account Managers
                      </div>
                      {accountManagers
                        .filter(am => 
                          am.name.toLowerCase().includes((newMapping.amName || '').toLowerCase())
                        )
                        .map(am => (
                          <div
                            key={am.id}
                            onClick={() => {
                              setNewMapping({...newMapping, amName: am.name, region: am.region || newMapping.region});
                              setShowAmDropdown(false);
                            }}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                          >
                            {am.name}
                          </div>
                        ))
                      }
                      {accountManagers.filter(am => 
                        am.name.toLowerCase().includes((newMapping.amName || '').toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                          No account managers found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Practices *</label>
                  <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                    {selectedPracticeGroup?.practices?.map(practice => (
                      <label key={practice} className="flex items-center mb-2 last:mb-0">
                        <input
                          type="checkbox"
                          checked={newMapping.practices.includes(practice)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewMapping({...newMapping, practices: [...newMapping.practices, practice]});
                            } else {
                              setNewMapping({...newMapping, practices: newMapping.practices.filter(p => p !== practice)});
                            }
                          }}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{practice}</span>
                      </label>
                    )) || (
                      <p className="text-sm text-gray-500">No practices available for this group</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Select the practices this SA supports for this AM</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Region {newMapping.amName === 'All' && <span className="text-xs text-gray-500">(Not required for "All" mappings)</span>}
                  </label>
                  <select
                    value={newMapping.region}
                    onChange={(e) => setNewMapping({...newMapping, region: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={newMapping.amName === 'All'}
                  >
                    <option value="">{newMapping.amName === 'All' ? 'No region (All AMs)' : 'Select a region'}</option>
                    {newMapping.amName !== 'All' && regions.map(region => (
                      <option key={region.id} value={region.name}>{region.name}</option>
                    ))}
                  </select>
                  {newMapping.amName === 'All' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Region is not assigned when mapping to all Account Managers
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingMapping(null);
                    setNewMapping({ saName: '', amName: '', region: '', practices: [] });
                    setShowSaDropdown(false);
                    setShowAmDropdown(false);
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditMapping}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {newMapping.amName === 'All' ? 'Update All Mappings' : 'Update Mapping'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add New AM Modal */}
        {showAddAmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Account Manager</h3>
              
              {amError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{amError}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newAm.name}
                    onChange={(e) => setNewAm({...newAm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={newAm.email}
                    onChange={(e) => setNewAm({...newAm, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="name@netsync.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be a netsync.com email address</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Region *
                  </label>
                  <select
                    value={newAm.region}
                    onChange={(e) => setNewAm({...newAm, region: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a region</option>
                    {regions.map(region => (
                      <option key={region.id} value={region.name}>{region.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddAmModal(false);
                    setNewAm({ name: '', email: '', region: '' });
                    setAmError('');
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAm}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Account Manager
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Practice Filter Modal */}
        {showPracticeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Practice Filters</h3>
                <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                  {(() => {
                    const availablePractices = selectedGroup === 'all' 
                      ? [...new Set(practiceGroups.flatMap(group => group.practices || []))]
                      : selectedPracticeGroup?.practices || [];
                    
                    return availablePractices.length > 0 ? availablePractices.map(practice => (
                      <label key={practice} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={tempPracticeSelection.includes(practice)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTempPracticeSelection([...tempPracticeSelection, practice]);
                            } else {
                              setTempPracticeSelection(tempPracticeSelection.filter(p => p !== practice));
                            }
                          }}
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">{practice}</span>
                      </label>
                    )) : (
                      <p className="text-sm text-gray-500">No practices available</p>
                    );
                  })()}
                </div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <button
                    onClick={() => {
                      const availablePractices = selectedGroup === 'all' 
                        ? [...new Set(practiceGroups.flatMap(group => group.practices || []))]
                        : selectedPracticeGroup?.practices || [];
                      setTempPracticeSelection(availablePractices);
                    }}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setTempPracticeSelection([])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Unselect All
                  </button>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowPracticeModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setFilters({...filters, practices: tempPracticeSelection});
                      setShowPracticeModal(false);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AccessCheck>
  );
}