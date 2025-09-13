'use client';

import { useState, useEffect } from 'react';

export default function EmailRulesManager() {
  const [rules, setRules] = useState([]);
  const [fieldMappings, setFieldMappings] = useState([]);
  const [emailActions, setEmailActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedRules, setExpandedRules] = useState(new Set());

  useEffect(() => {
    fetchRules();
    fetchFieldMappings();
    fetchEmailActions();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/settings/email-rules');
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (error) {
      console.error('Error fetching email rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFieldMappings = async () => {
    try {
      const response = await fetch('/api/email-field-mappings');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setFieldMappings(data.mappings || []);
    } catch (error) {
      console.error('Error fetching field mappings:', error);
      setFieldMappings([
        { value: 'projectNumber', label: 'Project Number' },
        { value: 'clientName', label: 'Client Name' },
        { value: 'requestedBy', label: 'Requested By' },
        { value: 'skillsRequired', label: 'Skills Required' },
        { value: 'startDate', label: 'Start Date' },
        { value: 'endDate', label: 'End Date' },
        { value: 'description', label: 'Description' },
        { value: 'priority', label: 'Priority' },
        { value: 'region', label: 'Region' },
        { value: 'pm', label: 'PM' },
        { value: 'documentationLink', label: 'Documentation Link' },
        { value: 'notes', label: 'Notes' },
        { value: 'resource_assignment_notification_users', label: 'Notification Users' }
      ]);
    }
  };

  const fetchEmailActions = async () => {
    try {
      const response = await fetch('/api/email-actions');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setEmailActions(data.success && data.actions ? data.actions : [
        { value: 'resource_assignment', name: 'Resource Assignment' }
      ]);
    } catch (error) {
      setEmailActions([
        { value: 'resource_assignment', name: 'Resource Assignment' }
      ]);
    }
  };

  const saveRule = async (rule, ruleIndex) => {
    if (!rule.friendlyName || rule.friendlyName.trim() === '') {
      alert('Friendly Name is required');
      return false;
    }
    
    setSaving(true);
    try {
      const method = rule.id ? 'PUT' : 'POST';
      const response = await fetch('/api/settings/email-rules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });

      if (response.ok) {
        await fetchRules();
        
        // Collapse the accordion after successful save
        const newExpanded = new Set(expandedRules);
        newExpanded.delete(ruleIndex);
        setExpandedRules(newExpanded);
        
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2';
        notification.innerHTML = `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          Rule saved successfully!
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.remove();
        }, 3000);
        
        return true;
      } else {
        const errorData = await response.json();
        alert(`Failed to save rule: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error saving rule: ${error.message}`);
    } finally {
      setSaving(false);
    }
    return false;
  };

  const deleteRule = async (id) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/settings/email-rules?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchRules();
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (index, updates) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    setRules(newRules);
  };

  const addRule = () => {
    const newRule = {
      name: 'New Rule',
      friendlyName: 'Post-Sales Resource Assignment',
      senderEmail: '',
      subjectPattern: '',
      keywordMappings: [],
      action: 'resource_assignment',
      enabled: true
    };
    setRules([...rules, newRule]);
    setExpandedRules(new Set([rules.length]));
  };

  const toggleRule = (index) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRules(newExpanded);
  };

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-32 rounded-lg"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Email Processing Rules</h3>
        <p className="text-sm text-gray-600 mb-4">
          Create persistent rules that match specific email senders and subjects, then map keywords to database fields for automated data extraction, then execute an action based on the extraction.
        </p>
        
        {rules.map((rule, index) => {
          const isExpanded = expandedRules.has(index);
          const isNew = !rule.id;
          
          return (
            <div key={rule.id || index} className="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 overflow-hidden">
              <div className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => toggleRule(index)}
                  >
                    <div className={`w-3 h-3 rounded-full ${
                      rule.enabled !== false ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <h3 className="font-medium text-gray-900">
                      {rule.friendlyName || 'Untitled Rule'}
                    </h3>
                    {isNew && <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">New</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateRule(index, { enabled: !rule.enabled });
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        rule.enabled !== false 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title={rule.enabled !== false ? 'Click to Disable' : 'Click to Enable'}
                    >
                      {rule.enabled !== false ? 'Enabled' : 'Disabled'}
                    </button>
                    {rule.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRule(rule.id);
                        }}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                        title="Delete rule"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {rule.keywordMappings?.length || 0} mappings
                      </span>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform cursor-pointer ${
                          isExpanded ? 'rotate-180' : ''
                        }`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                        onClick={() => toggleRule(index)}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-6 bg-gray-50">
                  <div className="space-y-8">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</div>
                        <h4 className="font-medium text-gray-900">Basic Information</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Friendly Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={rule.friendlyName || ''}
                            onChange={(e) => updateRule(index, { friendlyName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Post-Sales Resource Assignment"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Action Type
                          </label>
                          <select
                            value={rule.action || 'resource_assignment'}
                            onChange={(e) => updateRule(index, { action: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {emailActions.map(action => (
                              <option key={action.value} value={action.value}>
                                {action.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</div>
                        <h4 className="font-medium text-gray-900">Email Matching Criteria</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Sender Email Address
                          </label>
                          <div className="space-y-3">
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name={`sender-${index}`}
                                checked={!rule.senderEmail || rule.senderEmail === '' || rule.senderEmail === 'anyone'}
                                onChange={() => updateRule(index, { senderEmail: 'anyone' })}
                                className="mr-3"
                              />
                              <span className="text-sm text-gray-700">Any sender email</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name={`sender-${index}`}
                                checked={rule.senderEmail && rule.senderEmail !== '' && rule.senderEmail !== 'anyone'}
                                onChange={() => updateRule(index, { senderEmail: 'savant@netsync.com' })}
                                className="mr-3"
                              />
                              <span className="text-sm text-gray-700">Specific email address</span>
                            </label>
                            {rule.senderEmail && rule.senderEmail !== 'anyone' && (
                              <input
                                type="email"
                                value={rule.senderEmail}
                                onChange={(e) => updateRule(index, { senderEmail: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ml-6"
                                placeholder="savant@netsync.com"
                              />
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Subject Pattern
                          </label>
                          <input
                            type="text"
                            value={rule.subjectPattern || ''}
                            onChange={(e) => updateRule(index, { subjectPattern: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="PMO - New Resource Request"
                          />
                          <p className="text-xs text-gray-500 mt-1">Leave blank to match any subject</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</div>
                        <h4 className="font-medium text-gray-900">Field Mapping</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Map keywords found in emails to resource assignment fields.
                      </p>
                      
                      <div className="space-y-3">
                        {(rule.keywordMappings || []).map((mapping, mappingIndex) => (
                          <div key={mappingIndex} className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Keyword</label>
                              <input
                                type="text"
                                value={mapping.keyword || ''}
                                onChange={(e) => {
                                  const newMappings = [...(rule.keywordMappings || [])];
                                  newMappings[mappingIndex] = { ...mapping, keyword: e.target.value };
                                  updateRule(index, { keywordMappings: newMappings });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Job Number"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Maps to Field</label>
                              <select
                                value={mapping.field || ''}
                                onChange={(e) => {
                                  const newMappings = [...(rule.keywordMappings || [])];
                                  newMappings[mappingIndex] = { ...mapping, field: e.target.value };
                                  updateRule(index, { keywordMappings: newMappings });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select Field</option>
                                {fieldMappings.map(field => (
                                  <option key={field.value} value={field.value}>
                                    {field.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => {
                                const newMappings = [...(rule.keywordMappings || [])];
                                newMappings.splice(mappingIndex, 1);
                                updateRule(index, { keywordMappings: newMappings });
                              }}
                              className="mt-5 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Remove mapping"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        
                        <button
                          onClick={() => {
                            const newMappings = [...(rule.keywordMappings || []), { keyword: '', field: '' }];
                            updateRule(index, { keywordMappings: newMappings });
                          }}
                          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Add Field Mapping
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-start pt-4 border-t border-gray-200">
                      <button
                        onClick={() => saveRule(rule, index)}
                        disabled={saving}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                          saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        } text-white`}
                      >
                        {saving ? 'Saving...' : 'Save Rule'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        <button
          onClick={addRule}
          className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2 font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add New Email Processing Rule
        </button>
      </div>
    </div>
  );
}