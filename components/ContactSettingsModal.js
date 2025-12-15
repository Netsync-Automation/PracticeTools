'use client';

import { useState, useEffect } from 'react';
import { useCsrf } from '../hooks/useCsrf';
import { sanitizeText } from '../lib/sanitize';

export default function ContactSettingsModal({ isOpen, onClose, practiceGroupId, contactType, onSettingsChange, practiceGroupName }) {
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
  const [activeTab, setActiveTab] = useState('fields');
  const [deletedCompanies, setDeletedCompanies] = useState([]);
  const [deletedContacts, setDeletedContacts] = useState([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [searchDeleted, setSearchDeleted] = useState('');
  const [selectedDeletedRecord, setSelectedDeletedRecord] = useState(null);
  const [deletedRecordType, setDeletedRecordType] = useState('companies');
  const [availableTypes, setAvailableTypes] = useState([]);
  const [selectedRestoreType, setSelectedRestoreType] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [contactCounts, setContactCounts] = useState({});

  const fieldLabels = {
    msaSigned: 'MSA Signed Options',
    tier: 'Tier Options',
    technology: 'Technology Options',
    solutionType: 'Solution Type Options'
  };

  useEffect(() => {
    if (isOpen && practiceGroupId) {
      if (activeTab === 'fields') {
        fetchAllFieldOptions();
      } else if (activeTab === 'deleted') {
        fetchDeletedRecords();
      }
    }
  }, [isOpen, practiceGroupId, activeTab]);

  const fetchAllFieldOptions = async () => {
    setLoading(true);
    try {
      const fields = ['msaSigned', 'tier', 'technology', 'solutionType'];
      const options = {};
      
      for (const field of fields) {
        if (field === 'msaSigned') {
          // DSR: MSA Signed is fixed to Yes/No for all practices
          options[field] = ['Yes', 'No'];
        } else {
          const response = await fetch(`/api/field-options?practiceGroupId=${practiceGroupId}&fieldName=${field}`);
          const data = await response.json();
          options[field] = data.options || ['Create your own options in Settings'];
        }
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

  const fetchDeletedRecords = async () => {
    setLoadingDeleted(true);
    try {
      const [companiesResponse, contactsResponse, typesResponse] = await Promise.all([
        fetch(`/api/companies/deleted/all?practiceGroupId=${practiceGroupId}`, {
          headers: getHeaders()
        }),
        fetch(`/api/contacts/deleted?practiceGroupId=${practiceGroupId}`, {
          headers: getHeaders()
        }),
        fetch(`/api/contact-types?practiceGroupId=${practiceGroupId}`)
      ]);
      
      if (companiesResponse.ok) {
        const companiesData = await companiesResponse.json();
        const companies = companiesData.companies || [];
        setDeletedCompanies(companies);
        
        // Fetch contact counts for each company
        const counts = {};
        for (const company of companies) {
          try {
            const countResponse = await fetch(`/api/companies/deleted-contacts-count?companyId=${company.id}`, {
              headers: getHeaders()
            });
            if (countResponse.ok) {
              const countData = await countResponse.json();
              counts[company.id] = countData.count;
            }
          } catch (error) {
            counts[company.id] = 0;
          }
        }
        setContactCounts(counts);
      }
      
      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();
        setDeletedContacts(contactsData.contacts || []);
      }
      
      if (typesResponse.ok) {
        const typesData = await typesResponse.json();
        setAvailableTypes(['Main Contact List', ...(typesData.contactTypes || [])]);
      }
    } catch (error) {
      // Error fetching deleted records
    } finally {
      setLoadingDeleted(false);
    }
  };

  const checkForDuplicates = async (record, targetType) => {
    try {
      const response = await fetch(`/api/companies/check-duplicate?practiceGroupId=${practiceGroupId}&contactType=${targetType}&name=${encodeURIComponent(record.name)}&website=${encodeURIComponent(record.website)}`);
      const data = await response.json();
      return data.exists;
    } catch (error) {
      return false;
    }
  };

  const handleRestoreRecord = async (record, type) => {
    if (type === 'company') {
      const originalType = record.contactType || record.contact_type;
      const typeExists = availableTypes.includes(originalType);
      const targetType = typeExists ? originalType : selectedRestoreType;
      
      if (!typeExists && !selectedRestoreType) {
        alert('Please select a contact type to restore to.');
        return;
      }
      
      // Check for duplicates if restoring a company
      const hasDuplicate = await checkForDuplicates(record, targetType);
      if (hasDuplicate) {
        if (!window.confirm(`A company with the name "${record.name}" already exists in ${targetType}. Do you want to restore anyway? This may create a duplicate.`)) {
          return;
        }
      }
      
      if (!window.confirm(`Are you sure you want to restore ${record.name}${!typeExists ? ` to ${targetType}` : ''}?`)) return;
      
      try {
        const response = await fetch('/api/companies/deleted', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            id: record.id,
            practiceGroupId,
            newContactType: !typeExists ? targetType : undefined
          })
        });
        
        if (response.ok) {
          // Refresh both companies and contacts lists since company restoration also restores contacts
          fetchDeletedRecords();
          setSelectedDeletedRecord(null);
          setSelectedRestoreType('');
          setDuplicateWarning('');
          alert(`${record.name} has been successfully restored${!typeExists ? ` to ${targetType}` : ''}.`);
          if (onSettingsChange) {
            onSettingsChange();
          }
        }
      } catch (error) {
        alert('Failed to restore record. Please try again.');
      }
    } else {
      // Contact restoration - no contact type validation needed
      if (!window.confirm(`Are you sure you want to restore ${record.name}?`)) return;
      
      try {
        const response = await fetch('/api/contacts/deleted', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            id: record.id,
            practiceGroupId
          })
        });
        
        if (response.ok) {
          // Refresh the deleted contacts list
          fetchDeletedRecords();
          setSelectedDeletedRecord(null);
          alert(`${record.name} has been successfully restored.`);
          if (onSettingsChange) {
            onSettingsChange();
          }
        }
      } catch (error) {
        alert('Failed to restore record. Please try again.');
      }
    }
  };

  const filteredDeletedRecords = () => {
    const records = deletedRecordType === 'companies' ? deletedCompanies : deletedContacts;
    if (!searchDeleted) return records;
    
    return records.filter(record => 
      record.name.toLowerCase().includes(searchDeleted.toLowerCase()) ||
      (record.email && record.email.toLowerCase().includes(searchDeleted.toLowerCase())) ||
      (record.website && record.website.toLowerCase().includes(searchDeleted.toLowerCase()))
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700 p-4 sm:p-6 text-white rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Contact Information Settings</h2>
              <p className="text-blue-100 text-sm mt-1">Manage field options and deleted records</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white">
                  Practice Group: {practiceGroupName || 'Unknown'}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white">
                  Type: {contactType || 'Unknown'}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                setSelectedDeletedRecord(null);
                setSearchDeleted('');
                setActiveTab('fields');
              }}
              className="text-blue-100 hover:text-white transition-colors p-2 rounded-lg hover:bg-blue-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex-shrink-0 border-b bg-gray-50">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('fields')}
              className={`flex-shrink-0 px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'fields'
                  ? 'border-blue-500 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Company Fields
            </button>
            <button
              onClick={() => setActiveTab('deleted')}
              className={`flex-shrink-0 px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'deleted'
                  ? 'border-blue-500 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Deleted Records
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {activeTab === 'fields' ? (
            <>
              {/* Field Selection Sidebar */}
              <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r bg-gray-50 p-4 overflow-y-auto">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Company Fields</h3>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                  {Object.keys(fieldLabels).map(field => (
                    <button
                      key={field}
                      onClick={() => setActiveField(field)}
                      className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
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
              <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="flex-shrink-0">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {fieldLabels[activeField]}
                      </h3>

                      {/* Add New Option - Hidden for MSA Signed */}
                      {activeField !== 'msaSigned' && (
                        <div className="flex flex-col sm:flex-row gap-2 mb-6">
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
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            Add Option
                          </button>
                        </div>
                      )}
                      
                      {/* MSA Signed Notice */}
                      {activeField === 'msaSigned' && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm text-blue-800">
                              <strong>MSA Signed Options are fixed to "Yes" and "No" for all practices and cannot be modified.</strong>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Current Options */}
                    <div className="flex-1 overflow-y-auto">
                      <div className="space-y-2">
                        {(fieldOptions[activeField] || []).map((option, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                          >
                            <span className="text-gray-900 flex-1 mr-2">{option}</span>
                            {option !== 'Create your own options in Settings' && activeField !== 'msaSigned' && (
                              <button
                                onClick={() => removeOption(activeField, option)}
                                className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50"
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
                          <div className="text-center py-12">
                            <div className="text-gray-400 mb-2">
                              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            </div>
                            <p className="text-gray-500">No options configured</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Deleted Records Management */
            <>
              {/* Search and Filter Panel */}
              <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r p-4 overflow-y-auto">
                <div className="flex-shrink-0">
                  <div className="relative mb-4">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search deleted records..."
                      value={searchDeleted}
                      onChange={(e) => setSearchDeleted(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg mb-4">
                    <button
                      onClick={() => setDeletedRecordType('companies')}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                        deletedRecordType === 'companies'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Companies ({deletedCompanies.length})
                    </button>
                    <button
                      onClick={() => setDeletedRecordType('contacts')}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                        deletedRecordType === 'contacts'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Contacts ({deletedContacts.length})
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-2">
                    {loadingDeleted ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      filteredDeletedRecords().map(record => (
                        <div
                          key={record.id}
                          onClick={() => setSelectedDeletedRecord(record)}
                          className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${
                            selectedDeletedRecord?.id === record.id
                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-gray-900 truncate">{record.name}</h5>
                              <p className="text-sm text-gray-600 truncate">
                                {deletedRecordType === 'companies' ? record.website : record.email}
                              </p>
                              <p className="text-xs text-red-600 mt-1">
                                Deleted {new Date(record.deletedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      ))
                    )}
                    
                    {!loadingDeleted && filteredDeletedRecords().length === 0 && (
                      <div className="text-center py-12">
                        <div className="text-gray-400 mb-2">
                          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                        </div>
                        <p className="text-gray-500">No deleted {deletedRecordType} found</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Record Details Panel */}
              <div className="w-full lg:w-1/2 p-4 overflow-y-auto">
                {selectedDeletedRecord ? (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      {deletedRecordType === 'companies' ? 'Company Details' : 'Contact Details'}
                    </h4>
                    
                    <div className="space-y-3 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDeletedRecord.name}</p>
                      </div>
                      
                      {deletedRecordType === 'companies' ? (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Website</label>
                            <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDeletedRecord.website}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Original Type</label>
                            <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDeletedRecord.contactType}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Technology</label>
                            <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDeletedRecord.technology}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDeletedRecord.email}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Role</label>
                            <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedDeletedRecord.role}</p>
                          </div>
                        </>
                      )}
                      
                      {deletedRecordType === 'companies' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Contacts to Restore</label>
                          <div className="bg-blue-50 border border-blue-200 rounded p-3">
                            <p className="text-sm text-blue-800">
                              <strong>{contactCounts[selectedDeletedRecord.id] || 0}</strong> deleted contacts will be automatically restored with this company
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <p className="text-sm text-red-800">
                          <strong>Deleted by:</strong> {selectedDeletedRecord.deletedBy}
                        </p>
                        <p className="text-sm text-red-800">
                          <strong>Deleted on:</strong> {new Date(selectedDeletedRecord.deletedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    {/* Type Selection for Missing Types */}
                    {deletedRecordType === 'companies' && selectedDeletedRecord && !availableTypes.includes(selectedDeletedRecord.contactType) && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Original type "{selectedDeletedRecord.contactType}" no longer exists. Select new type:
                        </label>
                        <select
                          value={selectedRestoreType}
                          onChange={(e) => setSelectedRestoreType(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select contact type</option>
                          {availableTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <button
                      onClick={() => handleRestoreRecord(selectedDeletedRecord, deletedRecordType === 'companies' ? 'company' : 'contact')}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                    >
                      Restore {deletedRecordType === 'companies' ? 'Company' : 'Contact'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Select a Record</h3>
                    <p className="mt-1 text-sm text-gray-500">Choose a deleted record to view details and restore.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex justify-end p-4 sm:p-6 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={() => {
              onClose();
              setSelectedDeletedRecord(null);
              setSearchDeleted('');
              setActiveTab('fields');
            }}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}