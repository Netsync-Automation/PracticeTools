'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import SidebarLayout from '../../../components/SidebarLayout';
import Navbar from '../../../components/Navbar';
import Breadcrumb from '../../../components/Breadcrumb';
import { ArrowLeftIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function NewPracticeInfoPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    practices: []
  });
  const [availablePractices, setAvailablePractices] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'practice_manager' || user?.role === 'practice_principal';

  useEffect(() => {
    if (user && !canEdit) {
      router.push('/practice-information');
      return;
    }
    
    if (user) {
      loadPractices();
    }
  }, [user, canEdit]);

  const loadPractices = async () => {
    try {
      const response = await fetch('/api/practices');
      const practices = await response.json();
      setAvailablePractices(practices);
    } catch (error) {
      console.error('Error loading practices:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePracticeToggle = (practice) => {
    setFormData(prev => ({
      ...prev,
      practices: prev.practices.includes(practice)
        ? prev.practices.filter(p => p !== practice)
        : [...prev.practices, practice]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }
    
    if (formData.practices.length === 0) {
      alert('Please select at least one practice');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/practice-info-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          created_by: user.email
        })
      });

      if (response.ok) {
        router.push('/practice-information');
      } else {
        alert('Error creating page. Please try again.');
      }
    } catch (error) {
      console.error('Error creating page:', error);
      alert('Error creating page. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!canEdit) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={logout} />
      
      <SidebarLayout user={user}>
        <div className="p-8">
          <Breadcrumb items={[
            { label: 'Practice Information', href: '/practice-information' },
            { label: 'New Page' }
          ]} />
          
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => router.push('/practice-information')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Create New Information Page</h1>
                <p className="text-gray-600 mt-2">Create a new practice information page</p>
              </div>
            </div>
          </div>

          <div className="max-w-4xl">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Page Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter page title..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief description of this page..."
                    />
                  </div>
                </div>
              </div>

              {/* Practice Assignment */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Practice Assignment</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Practices *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availablePractices.map(practice => (
                      <button
                        key={practice}
                        type="button"
                        onClick={() => handlePracticeToggle(practice)}
                        className={`p-3 text-left border rounded-lg transition-colors ${
                          formData.practices.includes(practice)
                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                            : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{practice}</span>
                          {formData.practices.includes(practice) && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {formData.practices.length > 0 && (
                    <div className="mt-3 text-sm text-gray-600">
                      Selected: {formData.practices.join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Content</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Page Content
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => handleInputChange('content', e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="Enter your content here... You can use markdown formatting."
                  />
                  <div className="mt-2 text-sm text-gray-500">
                    Tip: You can use markdown formatting for headers, lists, and links.
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.push('/practice-information')}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <PlusIcon className="h-4 w-4" />
                      Create Page
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </SidebarLayout>
    </div>
  );
}