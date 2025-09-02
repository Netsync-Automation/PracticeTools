'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import SidebarLayout from '../../components/SidebarLayout';
import Navbar from '../../components/Navbar';
import Breadcrumb from '../../components/Breadcrumb';
import { PlusIcon, PencilIcon, EyeIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function PracticeInformationPage() {
  const { user, loading, logout } = useAuth();
  const [pages, setPages] = useState([]);
  const [filteredPages, setFilteredPages] = useState([]);
  const [practices, setPractices] = useState([]);
  const [selectedPractices, setSelectedPractices] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const canEdit = user?.role === 'admin' || user?.role === 'practice_manager' || user?.role === 'practice_principal';

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    filterPages();
  }, [pages, selectedPractices]);

  const loadData = async () => {
    try {
      const [pagesRes, practicesRes] = await Promise.all([
        fetch('/api/practice-info-pages'),
        fetch('/api/practices')
      ]);
      
      const pagesData = await pagesRes.json();
      const practicesData = await practicesRes.json();
      
      setPages(pagesData);
      setPractices(practicesData);
      
      // Auto-filter to user's practices by default
      if (user?.practices?.length > 0) {
        setSelectedPractices(user.practices);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterPages = () => {
    if (selectedPractices.length === 0) {
      setFilteredPages(pages);
    } else {
      const filtered = pages.filter(page => 
        page.practices?.some(practice => selectedPractices.includes(practice))
      );
      setFilteredPages(filtered);
    }
  };

  const handlePracticeFilter = (practice) => {
    setSelectedPractices(prev => 
      prev.includes(practice) 
        ? prev.filter(p => p !== practice)
        : [...prev, practice]
    );
  };

  const clearFilters = () => {
    setSelectedPractices([]);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={logout} />
      
      <SidebarLayout user={user}>
        <div className="p-8">
          <Breadcrumb items={[{ label: 'Practice Information' }]} />
          
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Practice Information</h1>
                <p className="text-gray-600 mt-2">Manage and view practice-specific information pages</p>
              </div>
              
              {canEdit && (
                <button
                  onClick={() => window.location.href = '/practice-information/new'}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <PlusIcon className="h-5 w-5" />
                  New Page
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                  >
                    <FunnelIcon className="h-5 w-5" />
                    Filters
                  </button>
                  
                  {selectedPractices.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {selectedPractices.length} practice{selectedPractices.length !== 1 ? 's' : ''} selected
                      </span>
                      <button
                        onClick={clearFilters}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Practices
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {practices.map(practice => (
                        <button
                          key={practice}
                          onClick={() => handlePracticeFilter(practice)}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            selectedPractices.includes(practice)
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {practice}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pages Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredPages.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredPages.map(page => (
                <div key={page.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{page.title}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.location.href = `/practice-information/${page.id}`}
                        className="text-blue-600 hover:text-blue-800"
                        title="View page"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => window.location.href = `/practice-information/${page.id}/edit`}
                          className="text-gray-600 hover:text-gray-800"
                          title="Edit page"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">{page.description}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {page.practices?.map(practice => (
                      <span
                        key={practice}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {practice}
                      </span>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Updated {new Date(page.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📄</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No information pages found</h3>
              <p className="text-gray-600 mb-6">
                {selectedPractices.length > 0 
                  ? 'No pages match your current filter selection.'
                  : 'Get started by creating your first practice information page.'
                }
              </p>
              {canEdit && (
                <button
                  onClick={() => window.location.href = '/practice-information/new'}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create First Page
                </button>
              )}
            </div>
          )}
        </div>
      </SidebarLayout>
    </div>
  );
}