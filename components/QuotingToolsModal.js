'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

export default function QuotingToolsModal({ onClose, user }) {
  const [activeSection, setActiveSection] = useState('basicInfo');
  const [partNumbers, setPartNumbers] = useState([]);
  const [customerTypes, setCustomerTypes] = useState([]);
  const [billingTypes, setBillingTypes] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Basic Information state
  const [toolName, setToolName] = useState('');
  const [toolDescription, setToolDescription] = useState('');
  const [useWizard, setUseWizard] = useState(false);

  // Form states for adding new items
  const [newPartNumber, setNewPartNumber] = useState({
    partNumber: '',
    description: '',
    listPrice: '',
    cost: '',
    partType: 'HW/SW',
    customerType: ''
  });
  const [newCustomerType, setNewCustomerType] = useState('');
  const [newBillingType, setNewBillingType] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const partTypes = ['HW/SW', 'Subscription', 'Warranty', 'SaaS-Monthly', 'SaaS-Annual', 'Labor'];

  const sections = [
    { id: 'basicInfo', label: 'Basic Information', icon: 'ℹ️', number: 1 },
    { id: 'customerTypes', label: 'Customer Types', icon: '👥', number: 2 },
    { id: 'partNumbers', label: 'Part Numbers', icon: '📦', number: 3 },
    { id: 'billingTypes', label: 'Billing Types', icon: '💳', number: 4 },
    { id: 'terms', label: 'Terms', icon: '📅', number: 5 },
    ...(useWizard ? [{ id: 'wizardConfig', label: 'Wizard Config', icon: '🧙', number: 6 }] : [])
  ];

  const isSectionComplete = (sectionId) => {
    switch (sectionId) {
      case 'basicInfo':
        return toolName.trim() !== '';
      case 'customerTypes':
        return customerTypes.length > 0;
      case 'partNumbers':
        return partNumbers.length > 0;
      case 'billingTypes':
        return billingTypes.length > 0;
      case 'terms':
        return terms.length > 0;
      case 'wizardConfig':
        return true;
      default:
        return false;
    }
  };

  const canAccessSection = (sectionId) => {
    const sectionIndex = sections.findIndex(s => s.id === sectionId);
    if (sectionIndex === 0) return true;
    
    for (let i = 0; i < sectionIndex; i++) {
      if (!isSectionComplete(sections[i].id)) {
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    // Don't load existing data for new tool creation
    // Start with fresh, empty arrays
    setPartNumbers([]);
    setCustomerTypes([]);
    setBillingTypes([]);
    setTerms([]);
    setLoading(false);
  }, []);

  // Removed loadData function - not needed for new tool creation

  const handleAddPartNumber = () => {
    if (!newPartNumber.partNumber.trim() || !newPartNumber.description.trim() || 
        !newPartNumber.listPrice.trim() || !newPartNumber.cost.trim() || !newPartNumber.customerType.trim()) return;

    const partNumber = {
      id: Date.now().toString(),
      ...newPartNumber,
      createdBy: user.email,
      createdByName: user.name,
      createdAt: new Date().toISOString()
    };
    
    setPartNumbers([...partNumbers, partNumber]);
    setNewPartNumber({
      partNumber: '',
      description: '',
      listPrice: '',
      cost: '',
      partType: 'HW/SW',
      customerType: ''
    });
    setHasUnsavedChanges(true);
  };

  const handleClose = () => {
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Are you sure you want to close? All progress will be lost.')) {
      return;
    }
    onClose();
  };

  const handleAddCustomerType = () => {
    if (!newCustomerType.trim()) return;

    const customerType = {
      id: Date.now().toString(),
      name: newCustomerType.trim(),
      createdBy: user.email,
      createdByName: user.name,
      createdAt: new Date().toISOString()
    };
    
    setCustomerTypes([...customerTypes, customerType]);
    setNewCustomerType('');
    setHasUnsavedChanges(true);
  };

  const handleAddBillingType = () => {
    if (!newBillingType.trim()) return;

    const billingType = {
      id: Date.now().toString(),
      name: newBillingType.trim(),
      createdBy: user.email,
      createdByName: user.name,
      createdAt: new Date().toISOString()
    };
    
    setBillingTypes([...billingTypes, billingType]);
    setNewBillingType('');
    setHasUnsavedChanges(true);
  };

  const handleAddTerm = () => {
    if (!newTerm.trim() || isNaN(newTerm)) return;

    const term = {
      id: Date.now().toString(),
      months: parseInt(newTerm),
      createdBy: user.email,
      createdByName: user.name,
      createdAt: new Date().toISOString()
    };
    
    setTerms([...terms, term]);
    setNewTerm('');
    setHasUnsavedChanges(true);
  };

  const handleDeleteItem = (type, id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    if (type === 'customer-types') {
      setCustomerTypes(customerTypes.filter(item => item.id !== id));
    } else if (type === 'part-numbers') {
      setPartNumbers(partNumbers.filter(item => item.id !== id));
    } else if (type === 'billing-types') {
      setBillingTypes(billingTypes.filter(item => item.id !== id));
    } else if (type === 'terms') {
      setTerms(terms.filter(item => item.id !== id));
    }
    setHasUnsavedChanges(true);
  };

  const canEdit = (item) => {
    return user.isAdmin || 
           user.role === 'practice_manager' || 
           user.role === 'practice_principal' ||
           item.createdBy === user.email;
  };

  const handleEditItem = (item, type) => {
    setEditingItem({ ...item, type });
  };

  const handleUpdateItem = async (updatedItem) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/quoting-tools/${updatedItem.type}/${updatedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedItem)
      });

      if (response.ok) {
        // Update local state with edited item
        if (updatedItem.type === 'customer-types') {
          setCustomerTypes(customerTypes.map(item => item.id === updatedItem.id ? updatedItem : item));
        } else if (updatedItem.type === 'part-numbers') {
          setPartNumbers(partNumbers.map(item => item.id === updatedItem.id ? updatedItem : item));
        } else if (updatedItem.type === 'billing-types') {
          setBillingTypes(billingTypes.map(item => item.id === updatedItem.id ? updatedItem : item));
        } else if (updatedItem.type === 'terms') {
          setTerms(terms.map(item => item.id === updatedItem.id ? updatedItem : item));
        }
        setEditingItem(null);
      }
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Create new quoting tool</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Sections</h3>
            </div>
          
            <nav className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => canAccessSection(section.id) && setActiveSection(section.id)}
                  disabled={!canAccessSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                    activeSection === section.id
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : canAccessSection(section.id)
                      ? 'text-gray-700 hover:bg-gray-100'
                      : 'text-gray-400 cursor-not-allowed bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      isSectionComplete(section.id)
                        ? 'bg-green-500 text-white'
                        : activeSection === section.id
                        ? 'bg-blue-500 text-white'
                        : canAccessSection(section.id)
                        ? 'bg-gray-300 text-gray-700'
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      {section.number}
                    </span>
                    {isSectionComplete(section.id) && (
                      <span className="w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center text-xs ml-1">
                        ✓
                      </span>
                    )}
                    <span className="text-lg">{section.icon}</span>
                  </div>
                  <span className="font-medium">{section.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                {sections.find(s => s.id === activeSection)?.label}
              </h3>
            </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeSection === 'basicInfo' && (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-4">Tool Configuration</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tool Name *</label>
                      <input
                        type="text"
                        value={toolName}
                        onChange={(e) => { setToolName(e.target.value); setHasUnsavedChanges(true); }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter tool name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tool Description</label>
                      <textarea
                        value={toolDescription}
                        onChange={(e) => { setToolDescription(e.target.value); setHasUnsavedChanges(true); }}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter tool description"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="useWizard"
                        checked={useWizard}
                        onChange={(e) => { setUseWizard(e.target.checked); setHasUnsavedChanges(true); }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="useWizard" className="ml-2 text-sm font-medium text-gray-700">
                        Use Wizard Interface
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setActiveSection('customerTypes')}
                    disabled={!isSectionComplete('basicInfo')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                {!isSectionComplete('basicInfo') && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">Please enter a tool name to continue to the next section.</p>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'customerTypes' && (
              <div className="space-y-6">
                {/* Add New Customer Type */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-4">Add New Customer Type</h4>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={newCustomerType}
                      onChange={(e) => setNewCustomerType(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomerType()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter customer type name"
                    />
                    <button
                      onClick={handleAddCustomerType}
                      disabled={saving || !newCustomerType.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Type
                    </button>
                  </div>
                </div>

                {/* Customer Types List */}
                <div className="space-y-3">
                  {customerTypes.map((type) => (
                    <div key={type.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{type.name}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Created by {type.createdByName || type.createdBy} on {new Date(type.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {canEdit(type) && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditItem(type, 'customer-types')}
                              className="text-blue-500 hover:text-blue-700 p-1"
                              title="Edit customer type"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem('customer-types', type.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete customer type"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {customerTypes.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No customer types created yet. Add one above to get started.
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setActiveSection('partNumbers')}
                    disabled={!isSectionComplete('customerTypes')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'partNumbers' && (
              <div className="space-y-6">
                {/* Add New Part Number */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-4">Add New Part Number</h4>
                  <div className="grid grid-cols-3 gap-4" onKeyDown={(e) => e.key === 'Enter' && handleAddPartNumber()}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Part Number *</label>
                      <input
                        type="text"
                        value={newPartNumber.partNumber}
                        onChange={(e) => setNewPartNumber({...newPartNumber, partNumber: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter part number"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                      <input
                        type="text"
                        value={newPartNumber.description}
                        onChange={(e) => setNewPartNumber({...newPartNumber, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter description"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type *</label>
                      <select
                        value={newPartNumber.customerType}
                        onChange={(e) => setNewPartNumber({...newPartNumber, customerType: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select customer type</option>
                        {customerTypes.map(type => (
                          <option key={type.id} value={type.name}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">List Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPartNumber.listPrice}
                        onChange={(e) => setNewPartNumber({...newPartNumber, listPrice: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cost *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPartNumber.cost}
                        onChange={(e) => setNewPartNumber({...newPartNumber, cost: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Part Type *</label>
                      <select
                        value={newPartNumber.partType}
                        onChange={(e) => setNewPartNumber({...newPartNumber, partType: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        {partTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      <button
                        onClick={handleAddPartNumber}
                        disabled={saving || !newPartNumber.partNumber.trim() || !newPartNumber.description.trim() || 
                                 !newPartNumber.listPrice.trim() || !newPartNumber.cost.trim() || !newPartNumber.customerType.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Part Number
                      </button>
                    </div>
                  </div>
                </div>

                {/* Part Numbers List */}
                <div className="space-y-3">
                  {partNumbers.map((part) => (
                    <div key={part.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 grid grid-cols-6 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-500">Part Number</span>
                            <p className="font-medium text-gray-900 truncate" title={part.partNumber}>{part.partNumber}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Description</span>
                            <p className="text-gray-900 truncate" title={part.description}>{part.description}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Customer Type</span>
                            <p className="text-gray-900 truncate" title={part.customerType}>{part.customerType}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">List Price</span>
                            <p className="text-gray-900 truncate" title={`$${part.listPrice || '0.00'}`}>${part.listPrice || '0.00'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Cost</span>
                            <p className="text-gray-900 truncate" title={`$${part.cost || '0.00'}`}>${part.cost || '0.00'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-500">Type</span>
                            <p className="text-gray-900 truncate" title={part.partType}>{part.partType}</p>
                          </div>
                        </div>
                        {canEdit(part) && (
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleEditItem(part, 'part-numbers')}
                              className="text-blue-500 hover:text-blue-700 p-1"
                              title="Edit part number"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem('part-numbers', part.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete part number"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Created by {part.createdByName || part.createdBy} on {new Date(part.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  {partNumbers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No part numbers created yet. Add one above to get started.
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setActiveSection('billingTypes')}
                    disabled={!isSectionComplete('partNumbers')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'billingTypes' && (
              <div className="space-y-6">
                {/* Add New Billing Type */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-4">Add New Billing Type</h4>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={newBillingType}
                      onChange={(e) => setNewBillingType(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddBillingType()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter billing type name"
                    />
                    <button
                      onClick={handleAddBillingType}
                      disabled={saving || !newBillingType.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Type
                    </button>
                  </div>
                </div>

                {/* Billing Types List */}
                <div className="space-y-3">
                  {billingTypes.map((type) => (
                    <div key={type.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{type.name}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Created by {type.createdByName || type.createdBy} on {new Date(type.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {canEdit(type) && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditItem(type, 'billing-types')}
                              className="text-blue-500 hover:text-blue-700 p-1"
                              title="Edit billing type"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem('billing-types', type.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete billing type"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {billingTypes.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No billing types created yet. Add one above to get started.
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setActiveSection('terms')}
                    disabled={!isSectionComplete('billingTypes')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'terms' && (
              <div className="space-y-6">
                {/* Add New Term */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-4">Add New Term</h4>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <input
                        type="number"
                        value={newTerm}
                        onChange={(e) => setNewTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTerm()}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter term length in months"
                        min="1"
                      />
                    </div>
                    <button
                      onClick={handleAddTerm}
                      disabled={saving || !newTerm.trim() || isNaN(newTerm)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Term
                    </button>
                  </div>
                </div>

                {/* Terms List */}
                <div className="space-y-3">
                  {terms.map((term) => (
                    <div key={term.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{term.months} months</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Created by {term.createdByName || term.createdBy} on {new Date(term.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {canEdit(term) && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditItem(term, 'terms')}
                              className="text-blue-500 hover:text-blue-700 p-1"
                              title="Edit term"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem('terms', term.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete term"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {terms.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No terms created yet. Add one above to get started.
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => useWizard ? setActiveSection('wizardConfig') : null}
                    disabled={!isSectionComplete('terms')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {useWizard ? 'Next' : 'Complete'}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'wizardConfig' && useWizard && (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-4">Wizard Configuration</h4>
                  <div className="text-center py-8 text-gray-500">
                    <p>Wizard configuration options will be available here.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    setSaving(true);
                    const response = await fetch('/api/quoting-tools/create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        toolName,
                        toolDescription,
                        useWizard,
                        createdBy: user.email,
                        createdByName: user.name,
                        practiceId: user.practiceId || '',
                        partNumbers,
                        customerTypes,
                        billingTypes,
                        terms
                      })
                    });
                    
                    if (response.ok) {
                      window.location.reload();
                    }
                  } catch (error) {
                    console.error('Error creating tool:', error);
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving || !toolName.trim() || !sections.slice(0, -1).every(s => isSectionComplete(s.id))}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
      
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit {editingItem.type.replace('-', ' ')}</h3>
            {editingItem.type === 'customer-types' && (
              <input
                type="text"
                value={editingItem.name}
                onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                placeholder="Customer type name"
              />
            )}
            {editingItem.type === 'billing-types' && (
              <input
                type="text"
                value={editingItem.name}
                onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                placeholder="Billing type name"
              />
            )}
            {editingItem.type === 'terms' && (
              <input
                type="number"
                value={editingItem.months}
                onChange={(e) => setEditingItem({...editingItem, months: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                placeholder="Term length in months"
                min="1"
              />
            )}
            {editingItem.type === 'part-numbers' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editingItem.partNumber}
                  onChange={(e) => setEditingItem({...editingItem, partNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Part number"
                />
                <input
                  type="text"
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Description"
                />
                <select
                  value={editingItem.customerType}
                  onChange={(e) => setEditingItem({...editingItem, customerType: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select customer type</option>
                  {customerTypes.map(type => (
                    <option key={type.id} value={type.name}>{type.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={editingItem.listPrice}
                  onChange={(e) => setEditingItem({...editingItem, listPrice: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="List price"
                />
                <input
                  type="number"
                  step="0.01"
                  value={editingItem.cost}
                  onChange={(e) => setEditingItem({...editingItem, cost: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Cost"
                />
                <select
                  value={editingItem.partType}
                  onChange={(e) => setEditingItem({...editingItem, partType: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {partTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateItem(editingItem)}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}