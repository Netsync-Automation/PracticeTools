'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '../../../components/SidebarLayout';
import Breadcrumb from '../../../components/Breadcrumb';
import AccessCheck from '../../../components/AccessCheck';
import { useAuth } from '../../../hooks/useAuth';
import QuotingToolsModal from '../../../components/QuotingToolsModal';

export default function QuotingToolsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [showToolModal, setShowToolModal] = useState(false);
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);

  const breadcrumbItems = [
    { label: 'Pre-Sales', href: '/pre-sales' },
    { label: 'Quoting Tools', href: '/pre-sales/quoting-tools' }
  ];

  // Check if user can create tools (admin, practice_manager, practice_principal)
  const canCreateTools = user && (user.isAdmin || user.role === 'practice_manager' || user.role === 'practice_principal');

  // Fetch tools data
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await fetch('/api/quoting-tools');
        const data = await response.json();
        setTools(data.tools || []);
      } catch (error) {
        console.error('Error fetching tools:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTools();
  }, []);

  // Check permissions for tool actions
  const canEditTool = (tool) => {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (tool.createdBy === user.email) return true;
    if ((user.role === 'practice_manager' || user.role === 'practice_principal') && 
        tool.practiceId === user.practiceId) return true;
    return false;
  };

  const canUseTool = (tool) => {
    if (!user) return false;
    return user.isAdmin || user.role === 'practice_member' || user.role === 'practice_manager' || user.role === 'practice_principal';
  };

  const handleDeleteTool = async (toolId) => {
    if (!confirm('Are you sure you want to delete this tool?')) return;
    try {
      const response = await fetch(`/api/quoting-tools/${toolId}`, { method: 'DELETE' });
      if (response.ok) {
        setTools(tools.filter(t => t.id !== toolId));
      }
    } catch (error) {
      console.error('Error deleting tool:', error);
    }
  };

  return (
    <AccessCheck>
      <SidebarLayout user={user}>
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <Breadcrumb items={breadcrumbItems} />
            
            <div className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Quoting Tools</h1>
                <p className="text-gray-600">Professional quoting and estimation tools for pre-sales activities</p>
              </div>
              {canCreateTools && (
                <button
                  onClick={() => setShowToolModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New Tool
                </button>
              )}
            </div>

            {loading ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading tools...</p>
              </div>
            ) : tools.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8">
                <div className="text-center">
                  <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Quoting Tools Yet</h3>
                  <p className="text-gray-500">Create your first quoting tool to get started.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => (
                  <div key={tool.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{tool.name}</h3>
                      {canEditTool(tool) && (
                        <div className="flex gap-2 ml-2">
                          <button className="text-blue-600 hover:text-blue-800 text-sm">
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteTool(tool.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-4">{tool.description}</p>
                    <div className="text-xs text-gray-500 mb-4">
                      Created by {tool.createdBy} • {new Date(tool.createdAt).toLocaleDateString()}
                    </div>
                    {canUseTool(tool) && (
                      <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        Use Tool
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {showToolModal && (
          <QuotingToolsModal
            onClose={() => {
              setShowToolModal(false);
              // Refresh tools list
              const fetchTools = async () => {
                try {
                  const response = await fetch('/api/quoting-tools');
                  const data = await response.json();
                  setTools(data.tools || []);
                } catch (error) {
                  console.error('Error fetching tools:', error);
                }
              };
              fetchTools();
            }}
            user={user}
          />
        )}
      </SidebarLayout>
    </AccessCheck>
  );
}