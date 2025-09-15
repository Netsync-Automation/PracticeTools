'use client';

import { useState, useEffect } from 'react';
import { useCsrf } from '../hooks/useCsrf';
import { sanitizeText } from '../lib/sanitize';

export default function ContactSettingsModal({ isOpen, onClose, practiceGroupId, onSettingsChange }) {
  const { getHeaders } = useCsrf();
  const [fieldOptions, setFieldOptions] = useState({
    msaSigned: [],
    tier: [],
    technology: [],
    solutionType: []
  });
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState('msaSigned');
  const [newOption, setNewOption] = useState('');

  const fieldLabels = {
    msaSigned: 'MSA Signed Options',
    tier: 'Tier Options',
    technology: 'Technology Options',
    solutionType: 'Solution Type Options'
  };

  useEffect(() => {
    if (isOpen && practiceGroupId) {
      fetchAllFieldOptions();
    }
  }, [isOpen, practiceGroupId]);

  const fetchAllFieldOptions = async () => {
    setLoading(true);
    try {
      const fields = ['msaSigned', 'tier', 'technology', 'solutionType'];
      const options = {};
      
      for (const field of fields) {
        const response = await fetch(`/api/field-options?practiceGroupId=${practiceGroupId}&fieldName=${field}`);
        const data = await response.json();
        options[field] = data.options || ['Create your own options in Settings'];
      }
      
      setFieldOptions(options);
    } catch (error) {
      // Error fetching field options - continue with defaults
    } finally {
      setLoading(false);
    }
  };

  const saveFieldOptions = async (fieldName, options) => {
    try {
      const sanitizedOptions = options
        .filter(opt => opt !== 'Create your own options in Settings')
        .map(opt => sanitizeText(opt))
        .filter(opt => opt.length > 0);
        
      const response = await fetch('/api/field-options', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          practiceGroupId,
          fieldName,
          options: sanitizedOptions
        })
      });

      if (response.ok) {
        setFieldOptions(prev => ({
          ...prev,
          [fieldName]: options
        }));
        // Notify parent component that settings changed
        if (onSettingsChange) {
          onSettingsChange();
        }
      }
    } catch (error) {
      // Error saving field options - user will see no change
    }
  };

  const addOption = () => {
    const sanitizedOption = sanitizeText(newOption);
    if (!sanitizedOption) return;
    
    const currentOptions = fieldOptions[activeField] || [];
    const filteredOptions = currentOptions.filter(opt => opt !== 'Create your own options in Settings');
    const newOptions = [...filteredOptions, sanitizedOption];
    
    saveFieldOptions(activeField, newOptions);
    setNewOption('');
  };

  const removeOption = (fieldName, optionToRemove) => {
    const currentOptions = fieldOptions[fieldName] || [];
    const newOptions = currentOptions.filter(opt => opt !== optionToRemove);
    
    // If no options left, add default message
    if (newOptions.length === 0) {
      newOptions.push('Create your own options in Settings');
    }
    
    saveFieldOptions(fieldName, newOptions);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Contact Information Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex h-96">
          {/* Field Selection Sidebar */}
          <div className="w-1/3 border-r bg-gray-50 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Company Fields</h3>
            <div className="space-y-2">
              {Object.keys(fieldLabels).map(field => (
                <button
                  key={field}
                  onClick={() => setActiveField(field)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeField === field
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {fieldLabels[field]}
                </button>
              ))}
            </div>
          </div>

          {/* Options Management */}
          <div className="flex-1 p-6">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {fieldLabels[activeField]}
                </h3>

                {/* Add New Option */}
                <div className="flex gap-2 mb-6">
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>

                {/* Current Options */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(fieldOptions[activeField] || []).map((option, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
                    >
                      <span className="text-gray-900">{option}</span>
                      {option !== 'Create your own options in Settings' && (
                        <button
                          onClick={() => removeOption(activeField, option)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title="Remove option"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {(fieldOptions[activeField] || []).length === 0 && (
                    <p className="text-gray-500 text-center py-8">No options configured</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}