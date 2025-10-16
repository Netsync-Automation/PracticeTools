'use client';

import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import SidebarLayout from '../../../components/SidebarLayout';
import Navbar from '../../../components/Navbar';
import Breadcrumb from '../../../components/Breadcrumb';
import AccessCheck from '../../../components/AccessCheck';

const tabs = [
  {
    id: 'recording-data',
    name: 'Recording Data',
    description: 'Manage and record SCOOP data'
  }
];

export default function ScoopPage() {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('recording-data');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'recording-data':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Recording Data</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                This section will contain SCOOP data recording functionality. Additional features will be added here as needed.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AccessCheck user={user}>
      <div className="min-h-screen">
        <Navbar user={user} onLogout={logout} />
        
        <SidebarLayout user={user}>
          <div className="p-8">
            <Breadcrumb items={[
              { label: 'Company Education' },
              { label: 'SCOOP' }
            ]} />
            
            <div className="mb-8">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">SCOOP</h1>
                    <p className="text-gray-600 mt-2">Training and data management system</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="mt-6">
                <div className="border-b border-gray-200 bg-white rounded-t-xl">
                  <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                        aria-current={activeTab === tab.id ? 'page' : undefined}
                      >
                        {tab.name}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-96">
              {renderTabContent()}
            </div>
          </div>
        </SidebarLayout>
      </div>
    </AccessCheck>
  );
}