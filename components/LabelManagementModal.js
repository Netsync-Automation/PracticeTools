'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function LabelManagementModal({ 
  isOpen, 
  onClose, 
  currentPracticeId, 
  availableLabels, 
  onLabelsUpdated,
  getHeaders 
}) {
  const [labels, setLabels] = useState([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3B82F6');
  const [editingLabel, setEditingLabel] = useState(null);
  const [editLabelName, setEditLabelName] = useState('');
  const [editLabelColor, setEditLabelColor] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLabels(availableLabels || []);
    }
  }, [isOpen, availableLabels]);

  const addLabel = async () => {
    if (!newLabelName.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/practice-boards/labels', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          practiceId: currentPracticeId, 
          name: newLabelName.trim(), 
          color: newLabelColor 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setLabels(data.labels);
        onLabelsUpdated(data.labels);
        setNewLabelName('');
        setNewLabelColor('#3B82F6');
      }
    } catch (error) {
      console.error('Error adding label:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateLabel = async (labelId) => {
    if (!editLabelName.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/practice-boards/labels', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ 
          practiceId: currentPracticeId, 
          labelId: labelId,
          name: editLabelName.trim(), 
          color: editLabelColor 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setLabels(data.labels);
        onLabelsUpdated(data.labels);
        setEditingLabel(null);
        setEditLabelName('');
        setEditLabelColor('');
      }
    } catch (error) {
      console.error('Error updating label:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteLabel = async (labelId) => {
    if (!window.confirm('Are you sure you want to delete this label? It will be removed from all cards.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/practice-boards/labels', {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ 
          practiceId: currentPracticeId, 
          labelId: labelId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setLabels(data.labels);
        onLabelsUpdated(data.labels);
      }
    } catch (error) {
      console.error('Error deleting label:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (label) => {
    setEditingLabel(label.id);
    setEditLabelName(label.name);
    setEditLabelColor(label.color);
  };

  const cancelEditing = () => {
    setEditingLabel(null);
    setEditLabelName('');
    setEditLabelColor('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Manage Labels</h3>
              <p className="text-sm text-gray-600 mt-1">Create, edit, and organize your practice board labels</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white hover:shadow-md transition-all duration-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Add New Label */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <h4 className="text-md font-semibold text-gray-800 mb-3">Add New Label</h4>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Label Name</label>
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter label name..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addLabel();
                    if (e.key === 'Escape') setNewLabelName('');
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="w-16 h-9 border border-gray-300 rounded cursor-pointer"
                />
              </div>
              <button
                onClick={addLabel}
                disabled={!newLabelName.trim() || isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add Label
              </button>
            </div>
          </div>

          {/* Existing Labels */}
          <div>
            <h4 className="text-md font-semibold text-gray-800 mb-3">
              Existing Labels ({labels.length})
            </h4>
            
            {labels.length === 0 ? (
              <div className="text-center py-8 text-gray-400 border border-gray-200 rounded-lg bg-gray-50">
                <svg className="h-8 w-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <p className="text-sm">No labels created yet</p>
                <p className="text-xs text-gray-500 mt-1">Add your first label above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {labels.map(label => (
                  <div key={label.id} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm transition-all">
                    {editingLabel === label.id ? (
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="color"
                          value={editLabelColor}
                          onChange={(e) => setEditLabelColor(e.target.value)}
                          className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={editLabelName}
                          onChange={(e) => setEditLabelName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateLabel(label.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateLabel(label.id)}
                            disabled={!editLabelName.trim() || isLoading}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-300"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-6 h-6 rounded-full border border-gray-200"
                            style={{ backgroundColor: label.color }}
                          />
                          <span className="font-medium text-gray-900">{label.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditing(label)}
                            disabled={isLoading}
                            className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
                            title="Edit label"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteLabel(label.id)}
                            disabled={isLoading}
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Delete label"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {labels.length} label{labels.length !== 1 ? 's' : ''} available
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}