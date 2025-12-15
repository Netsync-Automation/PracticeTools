'use client';

import { useState } from 'react';
import { XMarkIcon, PhotoIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import ChecklistTemplateEditModal from './ChecklistTemplateEditModal';
import UserManagementTab from './UserManagementTab';

function BoardSettingsModal({ 
  onClose, 
  currentPracticeId,
  currentBoardName,
  isPersonalBoard,
  user,
  boardBackground, 
  setBoardBackground, 
  predefinedBackgrounds, 
  uploadCustomBackground, 
  uploadingBackground, 
  uploadSuccess, 
  backgroundInputRef, 
  saveBoardSettings,
  checklistTemplates,
  loadChecklistTemplates,
  getHeaders
}) {
  const [activeTab, setActiveTab] = useState('background');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const tabs = [
    { id: 'background', label: 'Background' },
    { id: 'cards', label: 'Card Settings' },
    ...(isPersonalBoard ? [{ id: 'users', label: 'User Management' }] : [])
  ];

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setShowEditModal(true);
  };

  const handleSaveTemplate = async () => {
    await loadChecklistTemplates();
    setShowEditModal(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/practice-boards/checklist-templates?practiceId=${currentPracticeId}&templateId=${templateId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      if (response.ok) {
        await loadChecklistTemplates();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };



  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Board Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="mt-6">
            <nav className="flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6">
            {activeTab === 'background' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Background</h3>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Choose a preset background:</label>
                  <div className="grid grid-cols-2 gap-3">
                    {predefinedBackgrounds.map(bg => (
                      <button
                        key={bg.id}
                        onClick={async () => {
                          try {
                            await saveBoardSettings({ background: bg.id });
                            setBoardBackground(bg.id);
                          } catch (error) {
                            console.error('Failed to save background:', error);
                          }
                        }}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          boardBackground === bg.id 
                            ? 'border-blue-500 ring-2 ring-blue-200' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="h-16 w-full rounded mb-2" style={bg.style}></div>
                        <p className="text-sm font-medium text-gray-900">{bg.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Upload custom background:</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      ref={backgroundInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert('File size must be less than 5MB');
                            return;
                          }
                          uploadCustomBackground(file);
                        }
                      }}
                      className="hidden"
                    />
                    <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <button
                      onClick={() => backgroundInputRef.current?.click()}
                      disabled={uploadingBackground}
                      className="text-blue-600 hover:text-blue-500 font-medium disabled:opacity-50"
                    >
                      {uploadingBackground ? 'Uploading...' : 'Choose Image'}
                    </button>
                    {uploadSuccess && (
                      <p className="text-sm text-green-600 mt-2 font-medium">
                        ✅ Background uploaded successfully!
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Supported: JPG, PNG, WebP • Max 5MB • Recommended: 1920x1080 or higher
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <UserManagementTab
                currentPracticeId={currentPracticeId}
                currentBoardName={currentBoardName}
                isPersonalBoard={isPersonalBoard}
                user={user}
                getHeaders={getHeaders}
              />
            )}

            {activeTab === 'cards' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Checklist Templates</h3>
                <p className="text-sm text-gray-600 mb-6">Manage reusable checklist templates for this practice board.</p>
                
                {checklistTemplates.length > 0 ? (
                  <div className="space-y-3">
                    {checklistTemplates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors">
                        <div className="flex-1">
                          <h4 className="text-md font-semibold text-gray-800 mb-1">{template.name}</h4>
                          <p className="text-sm text-gray-600">
                            {template.usageCount || 0} card{(template.usageCount || 0) !== 1 ? 's' : ''} using this template
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="text-blue-500 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Edit template"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-100 transition-colors"
                            title="Delete template"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <svg className="h-12 w-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <p className="text-lg font-medium">No Templates Created</p>
                    <p className="text-sm mt-1">Create checklist templates by saving checklists when adding them to cards.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
      
      {/* Edit Template Modal */}
      {showEditModal && editingTemplate && (
        <ChecklistTemplateEditModal
          template={editingTemplate}
          onClose={() => {
            setShowEditModal(false);
            setEditingTemplate(null);
          }}
          onSave={handleSaveTemplate}
          currentPracticeId={currentPracticeId}
          getHeaders={getHeaders}
        />
      )}
    </div>
  );
}

export default BoardSettingsModal;