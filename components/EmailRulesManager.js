'use client';

import { useState, useEffect } from 'react';
import { EMAIL_FIELD_MAPPINGS } from '../constants/email-keyword-fields';

export default function EmailRulesManager() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRules();
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

  const saveRule = async (rule) => {
    setSaving(true);
    try {
      console.log('Saving rule:', rule);
      const method = rule.id ? 'PUT' : 'POST';
      const response = await fetch('/api/settings/email-rules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Save response:', result);
        await fetchRules();
        
        // Show success notification
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
        console.error('Save failed:', errorData);
        alert(`Failed to save rule: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving rule:', error);
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
    setRules([...rules, {
      name: 'New Rule',
      senderEmail: '',
      subjectPattern: '',
      keywordMappings: [],
      enabled: true
    }]);
  };

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-32 rounded-lg"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Email Processing Rules</h3>
        <p className="text-sm text-gray-600 mb-4">
          Create persistent rules that match specific email senders and subjects, then map keywords to resource assignment fields.
        </p>
        
        {rules.map((rule, index) => (
          <div key={rule.id || index} className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <input
                type="text"
                value={rule.name || ''}
                onChange={(e) => updateRule(index, { name: e.target.value })}
                className="font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                placeholder="Rule Name"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rule.enabled !== false}
                    onChange={(e) => updateRule(index, { enabled: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">Enabled</span>
                </label>
                <button
                  onClick={() => deleteRule(rule.id)}
                  disabled={!rule.id}
                  className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sender Email Address
                </label>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id={`anyone-${index}`}
                      name={`sender-${index}`}
                      checked={!rule.senderEmail || rule.senderEmail === 'anyone'}
                      onChange={() => updateRule(index, { senderEmail: 'anyone' })}
                      className="mr-2"
                    />
                    <label htmlFor={`anyone-${index}`} className="text-sm text-gray-700">
                      Anyone (any sender email)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id={`specific-${index}`}
                      name={`sender-${index}`}
                      checked={rule.senderEmail !== 'anyone' && rule.senderEmail !== undefined && rule.senderEmail !== null}
                      onChange={() => updateRule(index, { senderEmail: 'savant@netsync.com' })}
                      className="mr-2"
                    />
                    <label htmlFor={`specific-${index}`} className="text-sm text-gray-700 mr-2">
                      Specific email:
                    </label>
                    <input
                      type="email"
                      value={rule.senderEmail && rule.senderEmail !== 'anyone' ? rule.senderEmail : ''}
                      onChange={(e) => updateRule(index, { senderEmail: e.target.value })}
                      disabled={!rule.senderEmail || rule.senderEmail === 'anyone'}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      placeholder="savant@netsync.com"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-end">
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject Pattern
                  </label>
                  <input
                    type="text"
                    value={rule.subjectPattern || ''}
                    onChange={(e) => updateRule(index, { subjectPattern: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="PMO - New Resource Request"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keyword Mappings
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Map keywords found in emails to resource assignment fields.
              </p>
              
              {(rule.keywordMappings || []).map((mapping, mappingIndex) => (
                <div key={mappingIndex} className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={mapping.keyword || ''}
                    onChange={(e) => {
                      const newMappings = [...(rule.keywordMappings || [])];
                      newMappings[mappingIndex] = { ...mapping, keyword: e.target.value };
                      updateRule(index, { keywordMappings: newMappings });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Job Number"
                  />
                  <select
                    value={mapping.field || ''}
                    onChange={(e) => {
                      const newMappings = [...(rule.keywordMappings || [])];
                      newMappings[mappingIndex] = { ...mapping, field: e.target.value };
                      updateRule(index, { keywordMappings: newMappings });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Field</option>
                    {EMAIL_FIELD_MAPPINGS.map(field => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const newMappings = [...(rule.keywordMappings || [])];
                      newMappings.splice(mappingIndex, 1);
                      updateRule(index, { keywordMappings: newMappings });
                    }}
                    className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    ×
                  </button>
                </div>
              ))}
              
              <button
                onClick={() => {
                  const newMappings = [...(rule.keywordMappings || []), { keyword: '', field: '' }];
                  updateRule(index, { keywordMappings: newMappings });
                }}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
              >
                + Add Keyword Mapping
              </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => saveRule(rule)}
                disabled={saving}
                className={`px-4 py-2 rounded-md text-sm ${
                  saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                {saving ? 'Saving...' : 'Save Rule'}
              </button>
            </div>
          </div>
        ))}
        
        <button
          onClick={addRule}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Add Email Rule
        </button>
      </div>
    </div>
  );
}