'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Navbar from '../../../components/Navbar';
import SidebarLayout from '../../../components/SidebarLayout';
import AccessCheck from '../../../components/AccessCheck';
import Breadcrumb from '../../../components/Breadcrumb';
import Pagination from '../../../components/Pagination';
import { PRACTICE_OPTIONS } from '../../../constants/practices';

export default function TrainingCertsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({});
  const [practiceSettings, setPracticeSettings] = useState({ vendors: [], levels: [], types: [] });
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionEntry, setCompletionEntry] = useState(null);
  const [showIterationSignupModal, setShowIterationSignupModal] = useState(false);
  const [showIterationCompletionModal, setShowIterationCompletionModal] = useState(false);
  const [iterationEntry, setIterationEntry] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    practice: '',
    type: '',
    vendor: '',
    level: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 20;

  const canAddNew = () => {
    return user?.isAdmin || user?.role === 'practice_manager' || user?.role === 'practice_principal';
  };

  const canEdit = (entry) => {
    if (user?.isAdmin) return true;
    if (user?.role === 'practice_manager' || user?.role === 'practice_principal') {
      return user?.practices?.includes(entry.practice);
    }
    return false;
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check-session');
        if (response.ok) {
          const sessionData = await response.json();
          if (sessionData.user) {
            setUser(sessionData.user);
            localStorage.setItem('user', JSON.stringify(sessionData.user));
            return;
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
      
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
        return;
      }
      
      router.push('/login');
    };
    
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/training-certs/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings || {});
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    
    const fetchEntries = async () => {
      try {
        const response = await fetch('/api/training-certs');
        if (response.ok) {
          const data = await response.json();
          setEntries(data.entries || []);
        }
      } catch (error) {
        console.error('Error fetching entries:', error);
      }
    };
    
    checkAuth();
    fetchSettings();
    fetchEntries();
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (showSettings) {
      const fetchSettings = async () => {
        try {
          const response = await fetch('/api/training-certs/settings');
          if (response.ok) {
            const data = await response.json();
            setSettings(data.settings || {});
          }
        } catch (error) {
          console.error('Error fetching settings:', error);
        }
      };
      fetchSettings();
    }
  }, [showSettings]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('user');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('user');
      router.push('/login');
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
        <Navbar user={user} onLogout={handleLogout} />
        
        <SidebarLayout user={user}>
          <div className="p-8">
            <Breadcrumb items={[
              { label: 'Practice Information', href: '/practice-information' },
              { label: 'Training & Certs' }
            ]} />
            
            <div className="mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-3">
                Training & Certifications
              </h1>
              <p className="text-blue-600/80 text-lg">Manage training programs and certification tracking</p>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div></div>
              <div className="flex gap-3">
                {canAddNew() && (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </button>
                )}
                {canAddNew() && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add New
                  </button>
                )}
              </div>
            </div>

            {/* Statistics */}
            <TrainingCertsStats entries={entries} filters={filters} />

            {/* Search and Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                  </svg>
                  Filter Training & Certifications
                </h3>
                <button
                  onClick={() => {
                    setFilters({
                      search: '',
                      practice: '',
                      type: '',
                      vendor: '',
                      level: ''
                    });
                    setCurrentPage(1);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </button>
              </div>
              
              {/* Search Bar */}
              <div className="relative mb-6">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, vendor, code, or notes..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
              
              {/* Filter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Practice</label>
                  <select
                    value={filters.practice}
                    onChange={(e) => setFilters({...filters, practice: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    <option value="">All Practices</option>
                    {(PRACTICE_OPTIONS || []).map(practice => (
                      <option key={practice} value={practice}>{practice}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({...filters, type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    <option value="">All Types</option>
                    <option value="Training">Training</option>
                    <option value="Certification">Certification</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Vendor</label>
                  <select
                    value={filters.vendor}
                    onChange={(e) => setFilters({...filters, vendor: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    <option value="">All Vendors</option>
                    {(settings && typeof settings === 'object' ? Object.values(settings) : [])
                      .flatMap(s => (s && s.vendors ? s.vendors : []))
                      .filter((v, i, arr) => v && arr.indexOf(v) === i)
                      .map(vendor => (
                        <option key={vendor} value={vendor}>{vendor}</option>
                      ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Level</label>
                  <select
                    value={filters.level}
                    onChange={(e) => setFilters({...filters, level: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    <option value="">All Levels</option>
                    {(settings && typeof settings === 'object' ? Object.values(settings) : [])
                      .flatMap(s => (s && s.levels ? s.levels : []))
                      .filter((v, i, arr) => v && arr.indexOf(v) === i)
                      .map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                  </select>
                </div>
              </div>
              
              {/* Active Filters Display */}
              {(filters.search || filters.practice || filters.type || filters.vendor || filters.level) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-600">Active filters:</span>
                    {filters.search && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        Search: "{filters.search}"
                        <button onClick={() => setFilters({...filters, search: ''})} className="hover:bg-blue-200 rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {filters.practice && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Practice: {filters.practice}
                        <button onClick={() => setFilters({...filters, practice: ''})} className="hover:bg-green-200 rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {filters.type && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                        Type: {filters.type}
                        <button onClick={() => setFilters({...filters, type: ''})} className="hover:bg-purple-200 rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {filters.vendor && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                        Vendor: {filters.vendor}
                        <button onClick={() => setFilters({...filters, vendor: ''})} className="hover:bg-orange-200 rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    {filters.level && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                        Level: {filters.level}
                        <button onClick={() => setFilters({...filters, level: ''})} className="hover:bg-indigo-200 rounded-full p-0.5">
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

            <TrainingCertsTable 
              entries={entries}
              filters={filters}
              currentPage={currentPage}
              entriesPerPage={entriesPerPage}
              onPageChange={setCurrentPage}
              onEntryClick={(entry) => {
                setEditEntry(entry);
                setShowEditModal(true);
              }}
              canEdit={canEdit}
              user={user}
              onRefresh={() => {
                const fetchEntries = async () => {
                  try {
                    const response = await fetch('/api/training-certs');
                    if (response.ok) {
                      const data = await response.json();
                      setEntries(data.entries || []);
                    }
                  } catch (error) {
                    console.error('Error fetching entries:', error);
                  }
                };
                fetchEntries();
              }}
              onMarkComplete={(entry) => {
                setCompletionEntry(entry);
                setShowCompletionModal(true);
              }}
            />

            <EditTrainingModal
              isOpen={showEditModal}
              onClose={() => {
                setShowEditModal(false);
                setEditEntry(null);
              }}
              entry={editEntry}
              user={user}
              settings={settings}
              canEdit={canEdit}
              onSave={() => {
                const fetchEntries = async () => {
                  try {
                    const response = await fetch('/api/training-certs');
                    if (response.ok) {
                      const data = await response.json();
                      setEntries(data.entries || []);
                    }
                  } catch (error) {
                    console.error('Error fetching entries:', error);
                  }
                };
                fetchEntries();
              }}
            />

            <AddTrainingModal
              isOpen={showAddModal}
              onClose={() => {
                setShowAddModal(false);
                const fetchEntries = async () => {
                  try {
                    const response = await fetch('/api/training-certs');
                    if (response.ok) {
                      const data = await response.json();
                      setEntries(data.entries || []);
                    }
                  } catch (error) {
                    console.error('Error fetching entries:', error);
                  }
                };
                fetchEntries();
              }}
              user={user}
              settings={settings}
            />

            <SettingsModal
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
              settings={settings}
              onSettingsUpdate={setSettings}
              user={user}
            />

            <CompletionModal
              isOpen={showCompletionModal}
              onClose={() => setShowCompletionModal(false)}
              entry={completionEntry}
              user={user}
              onComplete={() => {
                setShowCompletionModal(false);
                const fetchEntries = async () => {
                  try {
                    const response = await fetch('/api/training-certs');
                    if (response.ok) {
                      const data = await response.json();
                      setEntries(data.entries || []);
                    }
                  } catch (error) {
                    console.error('Error fetching entries:', error);
                  }
                };
                fetchEntries();
              }}
            />

            <IterationSignupModal
              isOpen={showIterationSignupModal}
              onClose={() => setShowIterationSignupModal(false)}
              entry={iterationEntry}
              user={user}
              onSignup={(iterations) => {
                setShowIterationSignupModal(false);
                if (iterationEntry) {
                  handleSignUp(iterationEntry.id, iterations);
                }
              }}
            />

            <IterationCompletionModal
              isOpen={showIterationCompletionModal}
              onClose={() => setShowIterationCompletionModal(false)}
              entry={iterationEntry}
              user={user}
              onComplete={() => {
                setShowIterationCompletionModal(false);
                const fetchEntries = async () => {
                  try {
                    const response = await fetch('/api/training-certs');
                    if (response.ok) {
                      const data = await response.json();
                      setEntries(data.entries || []);
                    }
                  } catch (error) {
                    console.error('Error fetching entries:', error);
                  }
                };
                fetchEntries();
              }}
            />
          </div>
        </SidebarLayout>
      </div>
    </AccessCheck>
  );
}
function TrainingCertsTable({ entries, filters, currentPage, entriesPerPage, onPageChange, onEntryClick, canEdit, user, onRefresh, onMarkComplete }) {
  const [userSignUps, setUserSignUps] = useState(new Set());
  const [userCompletions, setUserCompletions] = useState(new Set());
  const [showIterationSignupModal, setShowIterationSignupModal] = useState(false);
  const [showIterationCompletionModal, setShowIterationCompletionModal] = useState(false);
  const [iterationEntry, setIterationEntry] = useState(null);

  useEffect(() => {
    if (user && entries.length > 0) {
      const signedUpEntries = new Set();
      const completedEntries = new Set();
      entries.forEach(entry => {
        const userSignup = (entry.signUps || []).find(signup => signup.email === user.email);
        if (userSignup) {
          signedUpEntries.add(entry.id);
          const totalIterations = userSignup.iterations || 1;
          const completedIterations = userSignup.completedIterations || 0;
          if (completedIterations >= totalIterations) {
            completedEntries.add(entry.id);
          }
        }
      });
      setUserSignUps(signedUpEntries);
      setUserCompletions(completedEntries);
    }
  }, [user, entries]);

  const handleSignUp = async (entryId, iterations = 1) => {
    try {
      const response = await fetch(`/api/training-certs/${entryId}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: userSignUps.has(entryId) ? 'remove' : 'add',
          iterations: iterations
        })
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error updating signup:', error);
    }
  };

  const handleIterationSignup = (entry) => {
    setIterationEntry(entry);
    setShowIterationSignupModal(true);
  };

  const handleIterationCompletion = (entry) => {
    setIterationEntry(entry);
    setShowIterationCompletionModal(true);
  };

  const handleUnComplete = async (entryId) => {
    try {
      const response = await fetch(`/api/training-certs/${entryId}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uncomplete' })
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error updating completion:', error);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !filters.search || 
      entry.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      entry.vendor.toLowerCase().includes(filters.search.toLowerCase()) ||
      (entry.code && entry.code.toLowerCase().includes(filters.search.toLowerCase())) ||
      (entry.notes && entry.notes.toLowerCase().includes(filters.search.toLowerCase()));
    
    const matchesPractice = !filters.practice || entry.practice === filters.practice;
    const matchesType = !filters.type || entry.type === filters.type;
    const matchesVendor = !filters.vendor || entry.vendor === filters.vendor;
    const matchesLevel = !filters.level || entry.level === filters.level;
    
    return matchesSearch && matchesPractice && matchesType && matchesVendor && matchesLevel;
  });

  const totalPages = Math.ceil(filteredEntries.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + entriesPerPage);

  useEffect(() => {
    onPageChange(1);
  }, [filters.search, filters.practice, filters.type, filters.vendor, filters.level, onPageChange]);

  if (filteredEntries.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">🎓</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {entries.length === 0 ? 'No Training & Certifications' : 'No Matching Results'}
          </h3>
          <p className="text-gray-500 mb-6">
            {entries.length === 0 
              ? 'No training or certification entries yet.' 
              : 'No entries match your current filters.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500">
        {filteredEntries.length} entries, Page {currentPage} of {totalPages}
      </div>
      
      <Pagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Practice</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type/Path</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam Cost</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Needed/Signed Up/Completed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created/Last Edit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onEntryClick(entry)}>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {entry.practice}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      entry.type === 'Training' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{entry.vendor}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{entry.name}</div>
                    {entry.notes && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2" title={entry.notes}>
                        {entry.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 font-mono">{entry.code || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{entry.level || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{entry.trainingType || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {entry.examCost ? `$${parseFloat(entry.examCost).toFixed(2)}` : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {parseInt(entry.quantityNeeded) || 0}/{(entry.signUps || []).reduce((sum, signup) => sum + (signup.iterations || 1), 0)}/{(entry.signUps || []).reduce((sum, signup) => sum + (signup.completedIterations || 0), 0)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'No date'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {entry.updatedAt ? new Date(entry.updatedAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      }) : 'No time'}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      by {entry.updatedBy || 'Unknown'}
                    </div>

                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {!userCompletions.has(entry.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (userSignUps.has(entry.id)) {
                              handleSignUp(entry.id);
                            } else {
                              handleIterationSignup(entry);
                            }
                          }}
                          className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${
                            userSignUps.has(entry.id)
                              ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300'
                              : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                          }`}
                          title={userSignUps.has(entry.id) ? 'Remove yourself from the Sign-Up of this training or certification' : 'Sign up for this training or certification'}
                        >
                          {userSignUps.has(entry.id) ? 'Unsign' : 'Sign Up'}
                        </button>
                      )}
                      {userSignUps.has(entry.id) && !userCompletions.has(entry.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleIterationCompletion(entry);
                          }}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-green-600 border border-green-600 rounded hover:bg-green-700 hover:border-green-700 transition-all duration-200"
                          title="Click here to show that you have completed this training or certification"
                        >
                          Complete
                        </button>
                      )}
                      {userCompletions.has(entry.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnComplete(entry.id);
                          }}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-green-600 border border-green-600 rounded hover:bg-green-700 hover:border-green-700 transition-all duration-200"
                          title="You have completed this training or certification, click to Revert to Signed Up"
                        >
                          Revert
                        </button>
                      )}
                      {canEdit(entry) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle delete
                          }}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-red-600 border border-red-600 rounded hover:bg-red-700 hover:border-red-700 transition-all duration-200"
                          title="Delete this training or certification entry"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <Pagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
      
      <IterationSignupModal
        isOpen={showIterationSignupModal}
        onClose={() => setShowIterationSignupModal(false)}
        entry={iterationEntry}
        user={user}
        onSignup={(iterations) => {
          setShowIterationSignupModal(false);
          if (iterationEntry) {
            handleSignUp(iterationEntry.id, iterations);
          }
        }}
      />

      <IterationCompletionModal
        isOpen={showIterationCompletionModal}
        onClose={() => setShowIterationCompletionModal(false)}
        entry={iterationEntry}
        user={user}
        onComplete={() => {
          setShowIterationCompletionModal(false);
          onRefresh();
        }}
      />
    </div>
  );
}
function AddTrainingModal({ isOpen, onClose, user, settings }) {
  const [formData, setFormData] = useState({
    practice: user?.practices?.[0] || '',
    type: '',
    vendor: '',
    name: '',
    code: '',
    level: '',
    trainingType: '',
    prerequisites: '',
    examsRequired: '',
    examCost: '',
    quantityNeeded: '',
    incentive: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [practiceOptions, setPracticeOptions] = useState({ vendors: [], levels: [], types: [] });

  useEffect(() => {
    const loadPracticeOptions = async () => {
      if (formData.practice) {
        try {
          const response = await fetch(`/api/training-certs/settings?practice=${encodeURIComponent(formData.practice)}`);
          if (response.ok) {
            const data = await response.json();
            setPracticeOptions(data.settings || { vendors: [], levels: [], types: [] });
          }
        } catch (error) {
          console.error('Error loading practice options:', error);
          setPracticeOptions({ vendors: [], levels: [], types: [] });
        }
      } else {
        setPracticeOptions({ vendors: [], levels: [], types: [] });
      }
    };
    
    if (isOpen) {
      loadPracticeOptions();
    }
  }, [formData.practice, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/training-certs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        onClose();
        setFormData({
          practice: user?.practices?.[0] || '',
          type: '',
          vendor: '',
          name: '',
          code: '',
          level: '',
          trainingType: '',
          prerequisites: '',
          examsRequired: '',
          examCost: '',
          quantityNeeded: '',
          incentive: '',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Add Training/Certification</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Practice *</label>
                <select
                  value={formData.practice}
                  onChange={(e) => setFormData({...formData, practice: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Practice</option>
                  {(PRACTICE_OPTIONS || []).filter(practice => 
                    user?.isAdmin || (user?.practices || []).includes(practice)
                  ).map(practice => (
                    <option key={practice} value={practice}>{practice}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Type</option>
                  <option value="Training">Training</option>
                  <option value="Certification">Certification</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
                <select
                  value={formData.vendor}
                  onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Vendor</option>
                  {practiceOptions.vendors.map(vendor => (
                    <option key={vendor} value={vendor}>{vendor}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({...formData, level: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Level</option>
                  {practiceOptions.levels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Training Type/Path</label>
                <select
                  value={formData.trainingType}
                  onChange={(e) => setFormData({...formData, trainingType: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Type/Path</option>
                  {practiceOptions.types.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Cost</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.examCost}
                  onChange={(e) => setFormData({...formData, examCost: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Needed</label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantityNeeded}
                  onChange={(e) => setFormData({...formData, quantityNeeded: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Incentive</label>
                <input
                  type="text"
                  value={formData.incentive}
                  onChange={(e) => setFormData({...formData, incentive: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Bonus, Time off, etc."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prerequisites</label>
              <textarea
                value={formData.prerequisites}
                onChange={(e) => setFormData({...formData, prerequisites: e.target.value.slice(0, 300)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                maxLength={300}
                placeholder="Required prerequisites or experience"
              />
              <div className="text-xs text-gray-500 mt-1">{formData.prerequisites.length}/300 characters</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exams Required</label>
              <textarea
                value={formData.examsRequired}
                onChange={(e) => setFormData({...formData, examsRequired: e.target.value.slice(0, 300)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                maxLength={300}
                placeholder="List of required exams"
              />
              <div className="text-xs text-gray-500 mt-1">{formData.examsRequired.length}/300 characters</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value.slice(0, 500)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                maxLength={500}
                placeholder="Additional notes or information"
              />
              <div className="text-xs text-gray-500 mt-1">{formData.notes.length}/500 characters</div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
function SettingsModal({ isOpen, onClose, settings, onSettingsUpdate, user }) {
  const [selectedPractice, setSelectedPractice] = useState('');
  const [localSettings, setLocalSettings] = useState({ vendors: [], levels: [], types: [] });
  const [activeCategory, setActiveCategory] = useState('vendors');
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    const loadPracticeSettings = async () => {
      if (selectedPractice) {
        try {
          const response = await fetch(`/api/training-certs/settings?practice=${encodeURIComponent(selectedPractice)}`);
          if (response.ok) {
            const data = await response.json();
            setLocalSettings(data.settings || { vendors: [], levels: [], types: [] });
          }
        } catch (error) {
          console.error('Error loading practice settings:', error);
          setLocalSettings({ vendors: [], levels: [], types: [] });
        }
      } else {
        setLocalSettings({ vendors: [], levels: [], types: [] });
      }
    };
    
    if (isOpen && selectedPractice) {
      loadPracticeSettings();
    }
  }, [selectedPractice, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const defaultPractice = user?.practices?.[0] || '';
      setSelectedPractice(defaultPractice);
      setLocalSettings({ vendors: [], levels: [], types: [] });
    }
  }, [isOpen, user]);

  const categoryLabels = {
    vendors: 'Vendor Options',
    levels: 'Level Options',
    types: 'Type/Path Options'
  };

  const handleSave = async (category, options) => {
    if (!selectedPractice) return;
    
    try {
      const updatedSettings = {
        ...localSettings,
        [category]: options
      };
      
      const response = await fetch('/api/training-certs/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practice: selectedPractice, settings: updatedSettings })
      });
      
      if (response.ok) {
        setLocalSettings(updatedSettings);
        const updatedParentSettings = {
          ...settings,
          [selectedPractice]: updatedSettings
        };
        onSettingsUpdate(updatedParentSettings);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    
    const currentOptions = localSettings[activeCategory] || [];
    const newOptions = [...currentOptions, newOption.trim()];
    
    handleSave(activeCategory, newOptions);
    setNewOption('');
  };

  const removeOption = (category, optionToRemove) => {
    const currentOptions = localSettings[category] || [];
    const newOptions = currentOptions.filter(opt => opt !== optionToRemove);
    handleSave(category, newOptions);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl h-full max-h-[95vh] flex flex-col shadow-2xl">
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700 p-4 sm:p-6 text-white rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Training & Certifications Settings</h2>
              <p className="text-blue-100 text-sm mt-1">Manage dropdown options and field configurations</p>
            </div>
            <button
              onClick={onClose}
              className="text-blue-100 hover:text-white transition-colors p-2 rounded-lg hover:bg-blue-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-shrink-0 border-b bg-gray-50 p-4">
          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Practice to Configure
            </label>
            <select
              value={selectedPractice}
              onChange={(e) => setSelectedPractice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">Choose a practice...</option>
              {(PRACTICE_OPTIONS || []).map(practice => (
                <option key={practice} value={practice}>{practice}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {selectedPractice ? (
            <>
              <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r bg-gray-50 p-4 overflow-y-auto">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Option Categories</h3>
                <div className="grid grid-cols-1 gap-2">
                  {Object.keys(categoryLabels).map(category => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        activeCategory === category
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {categoryLabels[category]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
                <div className="h-full flex flex-col">
                  <div className="flex-shrink-0">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {categoryLabels[activeCategory]} for {selectedPractice}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Configure {activeCategory} options specific to the {selectedPractice} practice.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2 mb-6">
                      <input
                        type="text"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        placeholder="Enter new option"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && addOption()}
                      />
                      <button
                        onClick={addOption}
                        disabled={!newOption.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        Add Option
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-2">
                      {(localSettings[activeCategory] || []).map((option, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-gray-900 flex-1 mr-2">{option}</span>
                          <button
                            onClick={() => removeOption(activeCategory, option)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50"
                            title="Remove option"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      
                      {(localSettings[activeCategory] || []).length === 0 && (
                        <div className="text-center py-12">
                          <div className="text-gray-400 mb-2">
                            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                          </div>
                          <p className="text-gray-500">No {activeCategory} configured for {selectedPractice}</p>
                          <p className="text-gray-400 text-sm mt-1">Add your first option above</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Practice</h3>
                <p className="text-gray-500">Choose a practice above to configure its training and certification options.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex justify-end p-4 sm:p-6 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
function EditTrainingModal({ isOpen, onClose, entry, user, settings, canEdit, onSave }) {
  const [formData, setFormData] = useState({
    practice: '',
    type: '',
    vendor: '',
    name: '',
    code: '',
    level: '',
    trainingType: '',
    prerequisites: '',
    examsRequired: '',
    examCost: '',
    quantityNeeded: '',
    incentive: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [practiceOptions, setPracticeOptions] = useState({ vendors: [], levels: [], types: [] });
  const [activeTab, setActiveTab] = useState('details');
  const [userSignedUp, setUserSignedUp] = useState(false);
  const [userCompleted, setUserCompleted] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const hasEditPermission = canEdit(entry || {});

  useEffect(() => {
    if (isOpen && entry) {
      setFormData({
        practice: entry.practice || '',
        type: entry.type || '',
        vendor: entry.vendor || '',
        name: entry.name || '',
        code: entry.code || '',
        level: entry.level || '',
        trainingType: entry.trainingType || '',
        prerequisites: entry.prerequisites || '',
        examsRequired: entry.examsRequired || '',
        examCost: entry.examCost || '',
        quantityNeeded: entry.quantityNeeded || '',
        incentive: entry.incentive || '',
        notes: entry.notes || ''
      });
      
      // Check user signup/completion status
      if (user && entry) {
        const userSignup = (entry.signUps || []).find(signup => signup.email === user.email);
        setUserSignedUp(!!userSignup);
        const totalIterations = userSignup?.iterations || 1;
        const completedIterations = userSignup?.completedIterations || 0;
        setUserCompleted(completedIterations >= totalIterations);
      }
    }
  }, [isOpen, entry, user]);

  useEffect(() => {
    const loadPracticeOptions = async () => {
      if (formData.practice) {
        try {
          const response = await fetch(`/api/training-certs/settings?practice=${encodeURIComponent(formData.practice)}`);
          if (response.ok) {
            const data = await response.json();
            setPracticeOptions(data.settings || { vendors: [], levels: [], types: [] });
          }
        } catch (error) {
          console.error('Error loading practice options:', error);
          setPracticeOptions({ vendors: [], levels: [], types: [] });
        }
      } else {
        setPracticeOptions({ vendors: [], levels: [], types: [] });
      }
    };
    
    if (isOpen && formData.practice) {
      loadPracticeOptions();
    }
  }, [formData.practice, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasEditPermission) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/training-certs/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        await onSave();
        onClose();
      }
    } catch (error) {
      console.error('Error updating:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!hasEditPermission || !confirm('Are you sure you want to delete this training/certification entry?')) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`/api/training-certs/${entry.id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        onSave();
        onClose();
      }
    } catch (error) {
      console.error('Error deleting:', error);
    } finally {
      setDeleting(false);
    }
  };

  const refreshEntryData = async () => {
    try {
      const response = await fetch('/api/training-certs');
      if (response.ok) {
        const data = await response.json();
        const updatedEntry = data.entries.find(e => e.id === entry.id);
        if (updatedEntry) {
          // Update local state with fresh data
          const userSignup = (updatedEntry.signUps || []).find(signup => signup.email === user.email);
          setUserSignedUp(!!userSignup);
          const totalIterations = userSignup?.iterations || 1;
          const completedIterations = userSignup?.completedIterations || 0;
          setUserCompleted(completedIterations >= totalIterations);
          // Update the entry prop for tabs
          Object.assign(entry, updatedEntry);
        }
      }
      onSave();
    } catch (error) {
      console.error('Error refreshing entry data:', error);
    }
  };

  const handleSignUp = async () => {
    try {
      const response = await fetch(`/api/training-certs/${entry.id}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: userSignedUp ? 'remove' : 'add' })
      });
      if (response.ok) {
        await refreshEntryData();
      }
    } catch (error) {
      console.error('Error updating signup:', error);
    }
  };

  const handleUnComplete = async () => {
    try {
      const response = await fetch(`/api/training-certs/${entry.id}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uncomplete' })
      });
      if (response.ok) {
        await refreshEntryData();
      }
    } catch (error) {
      console.error('Error updating completion:', error);
    }
  };

  const handleMarkComplete = () => {
    setShowCompletionModal(true);
  };

  const handleCompletionSuccess = async () => {
    setShowCompletionModal(false);
    await refreshEntryData();
  };

  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full h-[90vh] flex flex-col">
        <div className="p-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {hasEditPermission ? 'Edit' : 'View'} Training/Certification
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('signups')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'signups'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Signed Up Users ({(entry?.signUps || []).reduce((sum, signup) => sum + (signup.iterations || 1), 0)})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Completed ({(entry?.signUps || []).reduce((sum, signup) => sum + (signup.completedIterations || 0), 0)})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' ? (
            <form onSubmit={handleSubmit} className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Practice *</label>
                  {hasEditPermission ? (
                    <select
                      value={formData.practice}
                      onChange={(e) => setFormData({...formData, practice: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Practice</option>
                      {(PRACTICE_OPTIONS || []).filter(practice => 
                        user?.isAdmin || (user?.practices || []).includes(practice)
                      ).map(practice => (
                        <option key={practice} value={practice}>{practice}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.practice}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      readOnly
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  {hasEditPermission ? (
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Type</option>
                      <option value="Training">Training</option>
                      <option value="Certification">Certification</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.type}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      readOnly
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
                  {hasEditPermission ? (
                    <select
                      value={formData.vendor}
                      onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Vendor</option>
                      {practiceOptions.vendors.map(vendor => (
                        <option key={vendor} value={vendor}>{vendor}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.vendor}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      readOnly
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  {hasEditPermission ? (
                    <select
                      value={formData.level}
                      onChange={(e) => setFormData({...formData, level: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Level</option>
                      {practiceOptions.levels.map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.level}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      readOnly
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => hasEditPermission && setFormData({...formData, name: e.target.value})}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!hasEditPermission ? 'bg-gray-50' : ''}`}
                    readOnly={!hasEditPermission}
                    required={hasEditPermission}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => hasEditPermission && setFormData({...formData, code: e.target.value})}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!hasEditPermission ? 'bg-gray-50' : ''}`}
                    readOnly={!hasEditPermission}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Training Type/Path</label>
                  {hasEditPermission ? (
                    <select
                      value={formData.trainingType}
                      onChange={(e) => setFormData({...formData, trainingType: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Type/Path</option>
                      {practiceOptions.types.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.trainingType}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      readOnly
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exam Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.examCost}
                    onChange={(e) => hasEditPermission && setFormData({...formData, examCost: e.target.value})}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!hasEditPermission ? 'bg-gray-50' : ''}`}
                    readOnly={!hasEditPermission}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Needed</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.quantityNeeded}
                    onChange={(e) => hasEditPermission && setFormData({...formData, quantityNeeded: e.target.value})}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!hasEditPermission ? 'bg-gray-50' : ''}`}
                    readOnly={!hasEditPermission}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Incentive</label>
                  <input
                    type="text"
                    value={formData.incentive}
                    onChange={(e) => hasEditPermission && setFormData({...formData, incentive: e.target.value})}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!hasEditPermission ? 'bg-gray-50' : ''}`}
                    readOnly={!hasEditPermission}
                    placeholder="e.g., Bonus, Time off, etc."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prerequisites</label>
                <textarea
                  value={formData.prerequisites}
                  onChange={(e) => hasEditPermission && setFormData({...formData, prerequisites: e.target.value.slice(0, 300)})}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!hasEditPermission ? 'bg-gray-50' : ''}`}
                  rows={2}
                  maxLength={300}
                  readOnly={!hasEditPermission}
                  placeholder="Required prerequisites or experience"
                />
                {hasEditPermission && (
                  <div className="text-xs text-gray-500 mt-1">{formData.prerequisites.length}/300 characters</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exams Required</label>
                <textarea
                  value={formData.examsRequired}
                  onChange={(e) => hasEditPermission && setFormData({...formData, examsRequired: e.target.value.slice(0, 300)})}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!hasEditPermission ? 'bg-gray-50' : ''}`}
                  rows={2}
                  maxLength={300}
                  readOnly={!hasEditPermission}
                  placeholder="List of required exams"
                />
                {hasEditPermission && (
                  <div className="text-xs text-gray-500 mt-1">{formData.examsRequired.length}/300 characters</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => hasEditPermission && setFormData({...formData, notes: e.target.value.slice(0, 500)})}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${!hasEditPermission ? 'bg-gray-50' : ''}`}
                  rows={3}
                  maxLength={500}
                  readOnly={!hasEditPermission}
                  placeholder="Additional notes or information"
                />
                {hasEditPermission && (
                  <div className="text-xs text-gray-500 mt-1">{formData.notes.length}/500 characters</div>
                )}
              </div>

              </div>
              <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50/50">
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {!userCompleted && (
                    <button
                      type="button"
                      onClick={handleSignUp}
                      className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                        userSignedUp
                          ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:border-green-300'
                          : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                      }`}
                      title={userSignedUp ? 'Remove yourself from the Sign-Up of this training or certification' : 'Sign up for this training or certification'}
                    >
                      {userSignedUp ? 'Unsign' : 'Sign Up'}
                    </button>
                  )}
                  {userSignedUp && !userCompleted && (
                    <button
                      type="button"
                      onClick={handleMarkComplete}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-md hover:bg-green-700 hover:border-green-700 transition-all duration-200"
                      title="Click here to show that you have completed this training or certification"
                    >
                      Complete
                    </button>
                  )}
                  {userCompleted && (
                    <button
                      type="button"
                      onClick={handleUnComplete}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-md hover:bg-green-700 hover:border-green-700 transition-all duration-200"
                      title="You have completed this training or certification, click to Revert to Signed Up"
                    >
                      Revert
                    </button>
                  )}
                </div>
                
                {/* Form Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    {hasEditPermission ? 'Cancel' : 'Close'}
                  </button>
                  {hasEditPermission && (
                    <>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting || saving}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 border border-red-600 rounded-md hover:bg-red-700 hover:border-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {deleting ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        type="submit"
                        disabled={saving || deleting}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {saving ? 'Updating...' : 'Update'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </form>
          ) : activeTab === 'signups' ? (
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-medium text-gray-900">All Signed Up Users</h4>
                <div className="text-xs text-gray-500">
                  Shows all users regardless of completion status
                </div>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {(!entry?.signUps || entry.signUps.length === 0) ? (
                  <p className="text-gray-500 text-sm">No users signed up.</p>
                ) : (
                  entry.signUps.map((signup, index) => {
                    const totalIterations = signup.iterations || 1;
                    const completedIterations = signup.completedIterations || 0;
                    const progressPercent = (completedIterations / totalIterations) * 100;
                    const isFullyCompleted = completedIterations >= totalIterations;
                    
                    return (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{signup.name}</div>
                            <div className="text-sm text-gray-500">{signup.email}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              Signed up: {new Date(signup.signedUpAt || signup.timestamp).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              {totalIterations} iteration{totalIterations > 1 ? 's' : ''}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              isFullyCompleted 
                                ? 'bg-green-100 text-green-800' 
                                : completedIterations > 0 
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}>
                              {isFullyCompleted ? 'Complete' : completedIterations > 0 ? 'Partial' : 'Pending'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Progress</span>
                            <span className="font-medium text-gray-900">
                              {completedIterations} of {totalIterations} completed
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                isFullyCompleted ? 'bg-green-600' : completedIterations > 0 ? 'bg-yellow-500' : 'bg-gray-400'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            ></div>
                          </div>
                          {completedIterations > 0 && (
                            <div className={`text-xs font-medium ${
                              isFullyCompleted ? 'text-green-600' : 'text-yellow-600'
                            }`}>
                              ✓ {completedIterations} iteration{completedIterations > 1 ? 's' : ''} completed
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              <div className="flex justify-end pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          ) : activeTab === 'completed' ? (
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-medium text-gray-900">Completed Users</h4>
              </div>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {(entry?.signUps || []).filter(signup => (signup.completedIterations || 0) > 0).length === 0 ? (
                  <p className="text-gray-500 text-sm">No users have completed this training yet.</p>
                ) : (
                  (entry?.signUps || []).filter(signup => (signup.completedIterations || 0) > 0).map((signup, index) => {
                    const totalIterations = signup.iterations || 1;
                    const completedIterations = signup.completedIterations || 0;
                    const isFullyCompleted = completedIterations >= totalIterations;
                    const progressPercent = (completedIterations / totalIterations) * 100;
                    
                    return (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{signup.name}</div>
                            <div className="text-sm text-gray-500">{signup.email}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              Last completed: {new Date(signup.lastCompletedAt || signup.completedAt || signup.signedUpAt || signup.timestamp).toLocaleDateString()}
                            </div>
                            {signup.completionNotes && (
                              <div className="text-xs text-gray-600 mt-1 italic bg-white p-2 rounded border">
                                Notes: {signup.completionNotes}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              isFullyCompleted 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {isFullyCompleted ? 'Fully Complete' : 'Partially Complete'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Completion Progress</span>
                            <span className="font-medium text-gray-900">
                              {completedIterations} of {totalIterations} iterations
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                isFullyCompleted ? 'bg-green-600' : 'bg-yellow-500'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            ></div>
                          </div>
                          
                          {/* Per-iteration certificates */}
                          {completedIterations > 0 && (
                            <div className="pt-3 border-t border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-700">Iteration Details</span>
                                <span className="text-xs text-gray-500">{(signup.iterationCertificates || []).filter(cert => cert.certificateUrl).length} certificates uploaded</span>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {Array.from({ length: completedIterations }, (_, index) => {
                                  const iterationNumber = index + 1;
                                  const cert = (signup.iterationCertificates || []).find(c => c.iteration === iterationNumber);
                                  return (
                                    <div key={`${signup.email}-${iterationNumber}`} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg">
                                      <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-semibold">
                                          {iterationNumber}
                                        </span>
                                        <div>
                                          <div className="text-xs font-medium text-gray-900">Iteration {iterationNumber}</div>
                                          {cert?.notes && (
                                            <div className="text-xs text-gray-500 truncate max-w-32" title={cert.notes}>
                                              {cert.notes}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {cert?.certificateUrl ? (
                                        <a
                                          href={cert.certificateUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                                          title={`View certificate for iteration ${iterationNumber}`}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                          View
                                        </a>
                                      ) : (
                                        <span className="text-xs text-gray-400 italic">No file uploaded</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Legacy single certificate */}
                          {signup.certificateUrl && (!signup.iterationCertificates || signup.iterationCertificates.length === 0) && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                              <span className="text-xs text-gray-600">Certificate Available</span>
                              <a
                                href={signup.certificateUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                                title="View certificate"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                View Certificate
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              <div className="flex justify-end pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
        
        {/* Completion Modal */}
        <CompletionModal
          isOpen={showCompletionModal}
          onClose={() => setShowCompletionModal(false)}
          entry={entry}
          user={user}
          onComplete={handleCompletionSuccess}
        />
      </div>
    </div>
  );
}

function TrainingCertsStats({ entries, filters }) {
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !filters.search || 
      entry.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      entry.vendor.toLowerCase().includes(filters.search.toLowerCase()) ||
      (entry.code && entry.code.toLowerCase().includes(filters.search.toLowerCase())) ||
      (entry.notes && entry.notes.toLowerCase().includes(filters.search.toLowerCase()));
    
    const matchesPractice = !filters.practice || entry.practice === filters.practice;
    const matchesType = !filters.type || entry.type === filters.type;
    const matchesVendor = !filters.vendor || entry.vendor === filters.vendor;
    const matchesLevel = !filters.level || entry.level === filters.level;
    
    return matchesSearch && matchesPractice && matchesType && matchesVendor && matchesLevel;
  });

  const totalNeeded = filteredEntries.reduce((sum, entry) => sum + (parseInt(entry.quantityNeeded) || 0), 0);
  const totalSignUps = filteredEntries.reduce((sum, entry) => sum + (entry.signUps || []).length, 0);
  const totalCompleted = filteredEntries.reduce((sum, entry) => sum + (entry.signUps || []).filter(signup => signup.completed).length, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-blue-100 mr-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Total Needed</p>
            <p className="text-2xl font-bold text-gray-900">{totalNeeded}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-yellow-100 mr-4">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Total Sign-Ups</p>
            <p className="text-2xl font-bold text-gray-900">{totalSignUps}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-green-100 mr-4">
            <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Total Completed</p>
            <p className="text-2xl font-bold text-gray-900">{totalCompleted}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompletionModal({ isOpen, onClose, entry, user, onComplete }) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [notes, setNotes] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
    } else {
      alert('Please select an image file');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('action', 'complete');
      if (selectedFile) {
        formData.append('certificate', selectedFile);
      }
      if (notes) {
        formData.append('notes', notes);
      }
      
      const response = await fetch(`/api/training-certs/${entry.id}/signup`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        onComplete();
      }
    } catch (error) {
      console.error('Error marking complete:', error);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Mark Training Complete</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Certificate (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 mt-1">Selected: {selectedFile.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Completion Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                maxLength={200}
                placeholder="Any additional notes about completion..."
              />
              <div className="text-xs text-gray-500 mt-1">{notes.length}/200 characters</div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {uploading ? 'Marking Complete...' : 'Mark Complete'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function IterationSignupModal({ isOpen, onClose, entry, user, onSignup }) {
  const [iterations, setIterations] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSignup(iterations);
    } catch (error) {
      console.error('Error signing up:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Sign Up for Training</h3>
              <p className="text-sm text-gray-600 mt-1">{entry.name}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                How many iterations do you want to sign up for?
              </label>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => setIterations(Math.max(1, iterations - 1))}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={iterations}
                  onChange={(e) => setIterations(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                  className="w-20 text-center text-lg font-semibold py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setIterations(Math.min(99, iterations + 1))}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                You can track completion progress for each iteration separately
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-blue-900">About Iterations</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Iterations allow you to track multiple completions of the same training or certification over time.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center"
              >
                {loading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {loading ? 'Signing Up...' : `Sign Up for ${iterations} Iteration${iterations > 1 ? 's' : ''}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function IterationCompletionModal({ isOpen, onClose, entry, user, onComplete }) {
  // Get user's current signup info
  const userSignup = entry?.signUps?.find(signup => signup.email === user?.email);
  const totalIterations = userSignup?.iterations || 1;
  const currentCompleted = userSignup?.completedIterations || 0;
  const remainingIterations = totalIterations - currentCompleted;
  
  const [completedIterations, setCompletedIterations] = useState(remainingIterations);
  const [iterationData, setIterationData] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Update completedIterations when modal opens with fresh data
  useEffect(() => {
    if (isOpen && remainingIterations > 0) {
      setCompletedIterations(remainingIterations);
    }
  }, [isOpen, remainingIterations]);

  // Initialize iteration data when completedIterations changes
  useEffect(() => {
    const newData = Array.from({ length: completedIterations }, (_, index) => ({
      id: index + 1,
      file: null,
      notes: ''
    }));
    setIterationData(newData);
  }, [completedIterations]);

  const handleFileChange = (iterationIndex, file) => {
    if (file && file.type.startsWith('image/')) {
      setIterationData(prev => prev.map((item, index) => 
        index === iterationIndex ? { ...item, file } : item
      ));
    } else {
      alert('Please select an image file');
    }
  };

  const handleIterationNotesChange = (iterationIndex, notes) => {
    setIterationData(prev => prev.map((item, index) => 
      index === iterationIndex ? { ...item, notes: notes.slice(0, 100) } : item
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('action', 'complete');
      formData.append('completedIterations', completedIterations.toString());
      
      // Add per-iteration data
      iterationData.forEach((iteration, index) => {
        if (iteration.file) {
          formData.append(`certificate_${index}`, iteration.file);
        }
        if (iteration.notes) {
          formData.append(`iterationNotes_${index}`, iteration.notes);
        }
      });
      
      if (notes) {
        formData.append('notes', notes);
      }
      
      const response = await fetch(`/api/training-certs/${entry.id}/signup`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        onComplete();
      }
    } catch (error) {
      console.error('Error marking complete:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !entry || !userSignup) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full h-[90vh] flex flex-col shadow-2xl">
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Mark Iterations Complete</h3>
              <p className="text-sm text-gray-600 mt-1">{entry.name}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-600">{currentCompleted} of {totalIterations} completed</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${(currentCompleted / totalIterations) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                How many iterations did you complete?
              </label>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => setCompletedIterations(Math.max(1, completedIterations - 1))}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <input
                  type="number"
                  min="1"
                  max={remainingIterations}
                  value={completedIterations}
                  onChange={(e) => setCompletedIterations(Math.max(1, Math.min(remainingIterations, parseInt(e.target.value) || 1)))}
                  className="w-20 text-center text-lg font-semibold py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setCompletedIterations(Math.min(remainingIterations, completedIterations + 1))}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Maximum: {remainingIterations} remaining iteration{remainingIterations !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Per-iteration uploads */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Iteration Details
              </h4>
              
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {iterationData.map((iteration, index) => (
                  <div key={iteration.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-gray-900 flex items-center gap-2">
                        <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </span>
                        Iteration {index + 1}
                      </h5>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Certificate Upload
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(index, e.target.files[0])}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        {iteration.file && (
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {iteration.file.name}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Notes
                        </label>
                        <textarea
                          value={iteration.notes}
                          onChange={(e) => handleIterationNotesChange(index, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          rows={2}
                          maxLength={100}
                          placeholder="Notes for this iteration..."
                        />
                        <div className="text-xs text-gray-500 mt-1">{iteration.notes.length}/100 characters</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overall Completion Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                maxLength={200}
                placeholder="General notes about completing these iterations..."
              />
              <div className="text-xs text-gray-500 mt-1">{notes.length}/200 characters</div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium flex items-center"
              >
                {loading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {loading ? 'Completing...' : `Complete ${completedIterations} Iteration${completedIterations > 1 ? 's' : ''}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}