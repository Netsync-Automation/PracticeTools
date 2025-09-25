'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';

function ChecklistTemplateEditModal({ 
  template, 
  onClose, 
  onSave, 
  currentPracticeId, 
  getHeaders 
}) {
  const [templateName, setTemplateName] = useState('');
  const [templateItems, setTemplateItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setTemplateName(template.name);
      setTemplateItems([...template.items]);
    }
  }, [template]);

  const addItem = () => {
    if (newItem.trim()) {
      setTemplateItems([...templateItems, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index) => {
    setTemplateItems(templateItems.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!templateName.trim() || templateItems.length === 0) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/practice-boards/checklist-templates', {
        method: 'PUT',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          practiceId: currentPracticeId,
          templateId: template.id,
          name: templateName.trim(),
          items: templateItems
        })
      });

      if (response.ok) {
        onSave();
        onClose();
      }
    } catch (error) {
      console.error('Error updating template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Edit Checklist Template</h3>
              <p className="text-sm text-gray-600 mt-1">Modify template items and settings</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white hover:shadow-md transition-all duration-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {/* Template Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Template Name</label>
            <input
              type="text"
              placeholder="Enter template name..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
          
          {/* Add New Item */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Add Template Item</label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Enter checklist item..."
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItem.trim()) {
                    addItem();
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={addItem}
                disabled={!newItem.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>
          
          {/* Template Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-800">
                Template Items ({templateItems.length})
              </label>
              {templateItems.length > 0 && (
                <button
                  onClick={() => setTemplateItems([])}
                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
            
            {templateItems.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                {templateItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-4 h-4 border-2 border-gray-300 rounded flex-shrink-0"></div>
                      <span className="text-sm text-gray-900">{item}</span>
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition-all duration-200"
                      title="Remove item"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 border border-gray-200 rounded-lg bg-gray-50">
                <svg className="h-8 w-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-sm">No template items</p>
                <p className="text-xs text-gray-500 mt-1">Add items using the input above</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {templateItems.length} item{templateItems.length !== 1 ? 's' : ''} in template
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!templateName.trim() || templateItems.length === 0 || isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChecklistTemplateEditModal;