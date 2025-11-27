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
  const [syncingRegions, setSyncingRegions] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedMappingHistory, setSelectedMappingHistory] = useState(null);

  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp);
    const timeZoneAbbr = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short',
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      }),
      timeZone: timeZoneAbbr
    };
  };

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
    user.isAdmin || user.role === 'executive' ||
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
          <div className="p-4 sm:p-6 lg:p-8 w-full max-w-full overflow-x-hidden">
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
                          // Auto-select current user as SA if they are a practice member
                          if (user?.role === 'practice_member') {
                            setNewMapping({...newMapping, saName: user.name || ''});
                          }
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
                {(user?.isAdmin || ['practice_manager', 'practice_principal', 'practice_member', 'executive'].includes(user?.role)) && (
                  <button
                    onClick={async () => {
                      if (!confirm('This will update all mappings with missing regions using AM data from the user database. Continue?')) return;
                      setSyncingRegions(true);
                      try {
                        const response = await fetch('/api/sa-to-am-mapping/sync-regions', {
                          method: 'POST'
                        });
                        const result = await response.json();
                        if (result.success) {
                          alert(result.message);
                          fetchMappings(); // Refresh the mappings
                        } else {
                          alert('Failed to sync regions: ' + result.error);
                        }
                      } catch (error) {
                        alert('Error syncing regions: ' + error.message);
                      } finally {
                        setSyncingRegions(false);
                      }
                    }}
                    disabled={syncingRegions}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {syncingRegions ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Syncing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sync AM Regions
                      </>
                    )}
                  </button>
                )}
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
                <div className="overflow-x-auto w-full">
                  <table className="w-full divide-y divide-gray-200" style={{minWidth: '1000px'}}>
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solutions Architect</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Manager</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Practices</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Modified</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
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
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div className="flex flex-col">
                              <span className="font-medium">{mapping.updated_by || mapping.created_by || 'Unknown'}</span>
                              <span className="text-xs text-gray-500">
                                {mapping.updated_at ? new Date(mapping.updated_at).toLocaleString() : 
                                 mapping.created_at ? new Date(mapping.created_at).toLocaleString() : 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedMappingHistory(mapping);
                                  setShowHistoryModal(true);
                                }}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:border-gray-300 transition-colors duration-150"
                                title="View history"
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                History
                              </button>
                              {userCanEdit && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingMapping(mapping);
                                      const defaultSaName = user?.role === 'practice_member' && !mapping.saName ? user.name || '' : mapping.saName;
                                      setNewMapping({
                                        saName: defaultSaName,
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
                                </>
                              )}
                            </div>
                          </td>
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

        {/* History Modal */}
        {showHistoryModal && selectedMappingHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden border border-gray-100">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Mapping History
                    </h3>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 font-medium block mb-1">Solutions Architect</span>
                          <span className="text-gray-900 font-semibold">{selectedMappingHistory.saName}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 font-medium block mb-1">Account Manager</span>
                          <span className="text-gray-900 font-semibold">{selectedMappingHistory.amName}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 font-medium block mb-1">Practices</span>
                          <div className="flex flex-wrap gap-1">
                            {(selectedMappingHistory.practices || []).map(practice => (
                              <span key={practice} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {practice}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 font-medium block mb-1">Region</span>
                          <span className="text-gray-900 font-semibold">{selectedMappingHistory.region || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowHistoryModal(false);
                      setSelectedMappingHistory(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 hover:bg-white hover:bg-opacity-50 rounded-full p-2 transition-all duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[65vh] bg-gray-50">
                {selectedMappingHistory.history && selectedMappingHistory.history.length > 0 ? (
                  <div className="space-y-6">
                    {selectedMappingHistory.history.map((entry, index) => {
                      const date = new Date(entry.timestamp);
                      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                      const timeZoneAbbr = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
                      
                      return (
                        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
                          {/* Entry Header */}
                          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  entry.action === 'created' ? 'bg-green-100' :
                                  entry.action === 'updated' ? 'bg-blue-100' :
                                  entry.action === 'deleted' ? 'bg-red-100' :
                                  entry.action === 'reinstated' ? 'bg-purple-100' :
                                  'bg-gray-100'
                                }`}>
                                  {entry.action === 'created' && (
                                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                  )}
                                  {entry.action === 'updated' && (
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  )}
                                  {entry.action === 'deleted' && (
                                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  )}
                                  {entry.action === 'reinstated' && (
                                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                                      entry.action === 'created' ? 'bg-green-100 text-green-800' :
                                      entry.action === 'updated' ? 'bg-blue-100 text-blue-800' :
                                      entry.action === 'deleted' ? 'bg-red-100 text-red-800' :
                                      entry.action === 'reinstated' ? 'bg-purple-100 text-purple-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)}
                                    </span>
                                    <span className="text-lg font-semibold text-gray-900">{entry.user}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-gray-900">
                                  {date.toLocaleDateString('en-US', { 
                                    weekday: 'short',
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {date.toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    second: '2-digit'
                                  })} {timeZoneAbbr}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Entry Content */}
                          <div className="p-6">
                            {entry.action === 'created' && (
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                                <h4 className="text-lg font-semibold text-green-900 flex items-center gap-2 mb-3">
                                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  Initial Mapping Created
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-green-700 font-medium block mb-1">Solutions Architect</span>
                                    <span className="text-green-900 font-semibold">{selectedMappingHistory.saName}</span>
                                  </div>
                                  <div>
                                    <span className="text-green-700 font-medium block mb-1">Account Manager</span>
                                    <span className="text-green-900 font-semibold">{selectedMappingHistory.amName}</span>
                                  </div>
                                  <div>
                                    <span className="text-green-700 font-medium block mb-1">Practices</span>
                                    <div className="flex flex-wrap gap-1">
                                      {(selectedMappingHistory.practices || []).map(practice => (
                                        <span key={practice} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          {practice}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-green-700 font-medium block mb-1">Region</span>
                                    <span className="text-green-900 font-semibold">{selectedMappingHistory.region || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {entry.changes && entry.changes.length > 0 && (
                              <div className="space-y-4">
                                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                  </svg>
                                  {entry.user} made the following changes:
                                </h4>
                                <div className="grid gap-4">
                                  {entry.changes.map((change, changeIndex) => (
                                    <div key={changeIndex} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                                      <div className="flex items-center gap-3 mb-3">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-200 text-blue-900">
                                          {change.field}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        {change.from !== undefined && (
                                          <div className="flex-1">
                                            <div className="text-xs font-medium text-blue-700 mb-2">CHANGED FROM</div>
                                            <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                              <span className="text-red-800 font-medium">
                                                {Array.isArray(change.from) ? 
                                                  (change.from.length > 0 ? change.from.join(', ') : '(none)') : 
                                                  (change.from || '(empty)')}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                        {change.from !== undefined && change.to !== undefined && (
                                          <div className="flex-shrink-0 pt-6">
                                            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                          </div>
                                        )}
                                        {change.to !== undefined && (
                                          <div className="flex-1">
                                            <div className="text-xs font-medium text-blue-700 mb-2">CHANGED TO</div>
                                            <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                              <span className="text-green-800 font-medium">
                                                {Array.isArray(change.to) ? 
                                                  (change.to.length > 0 ? change.to.join(', ') : '(none)') : 
                                                  (change.to || '(empty)')}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {entry.action === 'deleted' && (
                              <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-lg p-4 border border-red-200">
                                <h4 className="text-lg font-semibold text-red-900 flex items-center gap-2 mb-2">
                                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  {entry.user} deleted this mapping
                                </h4>
                                <p className="text-red-800">The mapping was removed from active use but preserved in history.</p>
                              </div>
                            )}
                            
                            {entry.action === 'reinstated' && (
                              <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg p-4 border border-purple-200">
                                <h4 className="text-lg font-semibold text-purple-900 flex items-center gap-2 mb-2">
                                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  {entry.user} reinstated this mapping
                                </h4>
                                <p className="text-purple-800">The previously deleted mapping was restored to active use.</p>
                              </div>
                            )}
                            
                            {!entry.changes && entry.action === 'updated' && (
                              <div className="text-center py-4">
                                <span className="text-gray-500 italic">{entry.user} updated this mapping (no specific changes recorded)</span>
                              </div>
                            )}
                            
                            {entry.reason && (
                              <div className="mt-4">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                  <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-2 mb-2">
                                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Note
                                  </h4>
                                  <p className="text-amber-800">{entry.reason}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No History Available</h3>
                      <p className="text-gray-600">
                        This mapping was created before history tracking was implemented.
                      </p>
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