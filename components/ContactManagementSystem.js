'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCsrf } from '../hooks/useCsrf';
import { sanitizeText } from '../lib/sanitize';
import { formatPhoneNumber, createPhoneLink } from '../lib/phone-utils.js';
import PhoneInput from './PhoneInput.js';

export default function ContactManagementSystem({ practiceGroupId, contactType, user, refreshTrigger, canAddCompaniesContacts, externalFilters, onSearchResults, allPracticeGroups, searchTerm: externalSearchTerm }) {
  const { getHeaders } = useCsrf();
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Use external filters for tier/technology/solution filtering only
  const activeFilters = externalFilters !== undefined ? externalFilters : filters;
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const searchInputRef = useRef(null);
  const [filters, setFilters] = useState({
    tier: '',
    technology: '',
    solutionType: ''
  });
  const [fieldOptions, setFieldOptions] = useState({
    msaSigned: ['Create your own options in Settings'],
    tier: ['Create your own options in Settings'],
    technology: ['Create your own options in Settings'],
    solutionType: ['Create your own options in Settings']
  });

  // Company form state
  const [companyForm, setCompanyForm] = useState({
    name: '',
    msaSigned: '',
    tier: '',
    technology: [],
    solutionType: [],
    website: ''
  });

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    role: '',
    cellPhone: '',
    officePhone: '',
    fax: '',
    notes: ''
  });
  
  const [phoneErrors, setPhoneErrors] = useState({
    cellPhone: '',
    officePhone: '',
    fax: ''
  });

  // Edit/Delete state
  const [editingCompany, setEditingCompany] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [showCompanyHistory, setShowCompanyHistory] = useState(null);
  const [showContactHistory, setShowContactHistory] = useState(null);
  const [companyHistory, setCompanyHistory] = useState([]);
  const [contactHistory, setContactHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [similarCompanies, setSimilarCompanies] = useState([]);
  const [similarContacts, setSimilarContacts] = useState([]);
  const [showSimilarCompanies, setShowSimilarCompanies] = useState(false);
  const [showSimilarContacts, setShowSimilarContacts] = useState(false);

  useEffect(() => {
    if (practiceGroupId && contactType) {
      fetchCompanies();
    }
  }, [practiceGroupId, contactType]);

  // SSE for real-time updates
  useEffect(() => {
    if (!practiceGroupId) return;

    const eventSource = new EventSource('/api/sse/contact-management');
    
    const handleCompanyRestored = (event) => {
      const data = JSON.parse(event.data);
      if (data.data?.practiceGroupId === practiceGroupId) {
        fetchCompanies();
        if (selectedCompany) {
          fetchContacts(selectedCompany.id);
        }
      }
    };

    const handleContactRestored = (event) => {
      const data = JSON.parse(event.data);
      if (data.data?.practiceGroupId === practiceGroupId && selectedCompany) {
        fetchContacts(selectedCompany.id);
      }
    };

    eventSource.addEventListener('company-restored', handleCompanyRestored);
    eventSource.addEventListener('contact-restored', handleContactRestored);

    return () => {
      eventSource.close();
    };
  }, [practiceGroupId, selectedCompany?.id]);

  useEffect(() => {
    if (practiceGroupId) {
      fetchFieldOptions();
    }
  }, [practiceGroupId, refreshTrigger]);

  const fetchFieldOptions = async () => {
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
    }
  };

  useEffect(() => {
    filterCompanies();
    if (externalSearchTerm) {
      performSearch(externalSearchTerm);
    }
  }, [companies, activeFilters, externalSearchTerm]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/companies?practiceGroupId=${practiceGroupId}&contactType=${contactType}`);
      const data = await response.json();
      setCompanies(data.companies || []);
    } catch (error) {
      // Error fetching companies - continue with empty array
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async (companyId) => {
    try {
      const response = await fetch(`/api/contacts?companyId=${companyId}`);
      const data = await response.json();
      setContacts(data.contacts || []);
    } catch (error) {
      // Error fetching contacts - continue with empty array
    }
  };

  const getAllContacts = async () => {
    try {
      const allContacts = [];
      for (const company of companies) {
        const response = await fetch(`/api/contacts?companyId=${company.id}`);
        const data = await response.json();
        const companyContacts = (data.contacts || []).map(contact => ({
          ...contact,
          companyName: company.name,
          type: 'contact'
        }));
        allContacts.push(...companyContacts);
      }
      return allContacts;
    } catch (error) {
      return [];
    }
  };

  const updateDropdownPosition = () => {
    if (searchInputRef.current) {
      const rect = searchInputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  const performSearch = async (term) => {
    if (!term.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      if (onSearchResults) onSearchResults([]);
      return;
    }

    updateDropdownPosition();

    try {
      // Build query parameters
      const params = new URLSearchParams({ q: term });
      
      // Add practice group filter
      if (externalFilters?.practiceGroup) {
        params.append('practiceGroupId', externalFilters.practiceGroup);
      }
      
      // Add contact type
      if (contactType) {
        params.append('contactType', contactType);
      }
      
      // Add other filters
      if (activeFilters.tier) {
        params.append('tier', activeFilters.tier);
      }
      if (activeFilters.technology) {
        params.append('technology', activeFilters.technology);
      }
      if (activeFilters.solutionType) {
        params.append('solutionType', activeFilters.solutionType);
      }

      const response = await fetch(`/api/search/contacts?${params.toString()}`);
      const data = await response.json();
      const results = data.results || [];

      setSearchResults(results);
      
      if (externalSearchTerm !== undefined && onSearchResults) {
        onSearchResults(results);
      } else {
        setShowSearchResults(true);
      }
    } catch (error) {
      setSearchResults([]);
    }
  };

  const filterCompanies = () => {
    let filtered = companies;

    // Apply dropdown filters
    if (activeFilters.tier) {
      filtered = filtered.filter(company => company.tier === activeFilters.tier);
    }
    if (activeFilters.technology) {
      filtered = filtered.filter(company => {
        const companyTech = Array.isArray(company.technology) ? company.technology : [company.technology];
        return companyTech.some(tech => tech && tech.toLowerCase().includes(activeFilters.technology.toLowerCase()));
      });
    }
    if (activeFilters.solutionType) {
      filtered = filtered.filter(company => {
        const companySolutions = Array.isArray(company.solutionType) ? company.solutionType : [company.solutionType];
        return companySolutions.some(solution => solution && solution.toLowerCase().includes(activeFilters.solutionType.toLowerCase()));
      });
    }

    setFilteredCompanies(filtered);
  };

  const formatWebsiteUrl = (url) => {
    if (!url) return url;
    const trimmedUrl = url.trim();
    
    // If already has protocol, return as-is (no additional formatting)
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }
    
    // Add https:// for URLs without protocol
    return `https://${trimmedUrl}`;
  };

  const handleAddCompany = async (e, skipSimilarCheck = false) => {
    e.preventDefault();
    
    // Validate required checkbox fields
    if (!companyForm.technology || companyForm.technology.length === 0) {
      alert('Please select at least one Technology.');
      return;
    }
    if (!companyForm.solutionType || companyForm.solutionType.length === 0) {
      alert('Please select at least one Solution Type.');
      return;
    }
    
    try {
      const sanitizedForm = {
        ...companyForm,
        name: sanitizeText(companyForm.name),
        technology: Array.isArray(companyForm.technology) ? companyForm.technology : [],
        solutionType: Array.isArray(companyForm.solutionType) ? companyForm.solutionType : [],
        website: formatWebsiteUrl(companyForm.website.trim())
      };
      
      // Check for similar deleted companies before creating new one
      if (!editingCompany && !skipSimilarCheck) {
        const hasSimilar = await checkSimilarCompanies(sanitizedForm.name, sanitizedForm.website);
        if (hasSimilar) {
          return; // Stop here and show similar companies modal
        }
      }
      
      if (editingCompany) {
        // Update existing company
        
        const response = await fetch('/api/companies', {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            id: editingCompany.id,
            changes: sanitizedForm,
            practiceGroupId
          })
        });
        
        if (response.ok) {
          const updatedCompanies = companies.map(c => 
            c.id === editingCompany.id ? { ...c, ...sanitizedForm } : c
          );
          setCompanies(updatedCompanies);
          if (selectedCompany?.id === editingCompany.id) {
            const newSelectedCompany = { ...selectedCompany, ...sanitizedForm };
            setSelectedCompany(newSelectedCompany);
          }
        }
      } else {
        // Add new company
        const response = await fetch('/api/companies', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            ...sanitizedForm,
            practiceGroupId,
            contactType,
            addedBy: user.email
          })
        });

        if (response.ok) {
          const data = await response.json();
          setCompanies([...companies, data.company]);
        }
      }
      
      setCompanyForm({
        name: '',
        msaSigned: '',
        tier: '',
        technology: [],
        solutionType: [],
        website: ''
      });
      setEditingCompany(null);
      setShowAddCompany(false);
    } catch (error) {
      // Error saving company - user will see no change
    }
  };

  const handleAddContact = async (e, skipSimilarCheck = false) => {
    e.preventDefault();
    
    // Check for phone validation errors
    const hasPhoneErrors = Object.values(phoneErrors).some(error => error);
    if (hasPhoneErrors) {
      alert('Please fix phone number validation errors before submitting.');
      return;
    }
    
    try {
      const sanitizedForm = {
        ...contactForm,
        name: sanitizeText(contactForm.name),
        email: contactForm.email.trim(),
        role: sanitizeText(contactForm.role),
        cellPhone: contactForm.cellPhone,
        officePhone: contactForm.officePhone,
        fax: contactForm.fax,
        notes: sanitizeText(contactForm.notes)
      };
      
      // Check for similar deleted contacts before creating new one
      if (!editingContact && !skipSimilarCheck) {
        const hasSimilar = await checkSimilarContacts(sanitizedForm.name, sanitizedForm.email);
        if (hasSimilar) {
          return; // Stop here and show similar contacts modal
        }
      }
      
      if (editingContact) {
        // Update existing contact
        const response = await fetch('/api/contacts', {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            id: editingContact.id,
            changes: sanitizedForm,
            practiceGroupId
          })
        });
        
        if (response.ok) {
          const updatedContacts = contacts.map(c => 
            c.id === editingContact.id ? { ...c, ...sanitizedForm } : c
          );
          setContacts(updatedContacts);
        }
      } else {
        // Add new contact
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            ...sanitizedForm,
            companyId: selectedCompany.id,
            addedBy: user.email
          })
        });

        if (response.ok) {
          const data = await response.json();
          setContacts([...contacts, data.contact]);
        }
      }
      
      setContactForm({
        name: '',
        email: '',
        role: '',
        cellPhone: '',
        officePhone: '',
        fax: '',
        notes: ''
      });
      setPhoneErrors({
        cellPhone: '',
        officePhone: '',
        fax: ''
      });
      setEditingContact(null);
      setShowAddContact(false);
    } catch (error) {
      // Error saving contact - user will see no change
    }
  };

  const selectCompany = (company) => {
    setSelectedCompany(company);
    fetchContacts(company.id);
  };

  const canEditDelete = () => {
    if (!user) return false;
    
    // Admins and executives can edit/delete all
    if (user.isAdmin || user.role === 'executive') return true;
    
    // Practice members, managers, and principals can edit/delete for their practices
    if (['practice_member', 'practice_manager', 'practice_principal'].includes(user.role)) {
      return true; // Simplified for now - can be enhanced with practice group checks
    }
    
    return false;
  };



  const handleEditCompany = (company) => {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name,
      msaSigned: company.msaSigned,
      tier: company.tier,
      technology: Array.isArray(company.technology) ? company.technology : (company.technology ? [company.technology] : []),
      solutionType: Array.isArray(company.solutionType) ? company.solutionType : (company.solutionType ? [company.solutionType] : []),
      website: company.website
    });
    setShowAddCompany(true);
  };

  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name,
      email: contact.email,
      role: contact.role,
      cellPhone: contact.cellPhone,
      officePhone: contact.officePhone || '',
      fax: contact.fax || '',
      notes: contact.notes || ''
    });
    setShowAddContact(true);
  };

  const handleDeleteCompany = async (company) => {
    if (!window.confirm(`Are you sure you want to delete ${company.name}? This will also delete all contacts in this company.`)) return;
    
    try {
      const response = await fetch(`/api/companies?id=${company.id}&practiceGroupId=${practiceGroupId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      
      if (response.ok) {
        setCompanies(companies.filter(c => c.id !== company.id));
        if (selectedCompany?.id === company.id) {
          setSelectedCompany(null);
          setContacts([]);
        }
      }
    } catch (error) {
      // Error deleting company - user will see no change
    }
  };

  const handleDeleteContact = async (contact) => {
    if (!window.confirm(`Are you sure you want to delete ${contact.name}?`)) return;
    
    try {
      const response = await fetch(`/api/contacts?id=${contact.id}&practiceGroupId=${practiceGroupId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      
      if (response.ok) {
        setContacts(contacts.filter(c => c.id !== contact.id));
      }
    } catch (error) {
      // Error deleting contact - user will see no change
    }
  };

  const fetchCompanyHistory = async (company) => {
    setLoadingHistory(true);
    try {
      // Use history data directly from the company object
      setCompanyHistory(company.history || []);
    } catch (error) {
      setCompanyHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchContactHistory = async (contact) => {
    setLoadingHistory(true);
    try {
      // Use history data directly from the contact object
      setContactHistory(contact.history || []);
    } catch (error) {
      setContactHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };



  const checkSimilarCompanies = async (name, website) => {
    try {
      const response = await fetch('/api/companies/similar', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name,
          website,
          practiceGroupId,
          contactType
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.companies && data.companies.length > 0) {
          setSimilarCompanies(data.companies);
          setShowSimilarCompanies(true);
          return true;
        }
      }
    } catch (error) {
      // Error checking similar companies
    }
    return false;
  };

  const checkSimilarContacts = async (name, email) => {
    try {
      const response = await fetch('/api/contacts/similar', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, email })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.contacts && data.contacts.length > 0) {
          setSimilarContacts(data.contacts);
          setShowSimilarContacts(true);
          return true;
        }
      }
    } catch (error) {
      // Error checking similar contacts
    }
    return false;
  };

  const handleRestoreCompany = async (company) => {
    try {
      const response = await fetch('/api/companies/deleted', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          id: company.id,
          practiceGroupId,
          newContactType: contactType
        })
      });
      
      if (response.ok) {
        fetchCompanies();
        setShowAddCompany(false);
        setCompanyForm({
          name: '',
          msaSigned: '',
          tier: '',
          technology: '',
          solutionType: '',
          website: ''
        });
      }
    } catch (error) {
      // Error restoring company
    }
  };

  const handleRestoreContact = async (contact) => {
    try {
      const response = await fetch('/api/contacts/deleted', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          id: contact.id,
          practiceGroupId
        })
      });
      
      if (response.ok) {
        fetchContacts(selectedCompany.id);
        setShowAddContact(false);
        setContactForm({
          name: '',
          email: '',
          role: '',
          cellPhone: '',
          officePhone: '',
          fax: '',
          notes: ''
        });
        setPhoneErrors({
          cellPhone: '',
          officePhone: '',
          fax: ''
        });
        setPhoneErrors({
          cellPhone: '',
          officePhone: '',
          fax: ''
        });
      }
    } catch (error) {
      // Error restoring contact
    }
  };



  return (
    <div className="space-y-6">
      {/* Filters and Add Company (when external filters not provided) */}
      {externalFilters === undefined && (
        <div className="card">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Filters */}
            <div className="flex gap-3">
              <select
                value={filters.tier}
                onChange={(e) => setFilters({...filters, tier: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Tiers</option>
                {fieldOptions.tier.filter(opt => opt !== 'Create your own options in Settings').map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              
              <select
                value={filters.technology}
                onChange={(e) => setFilters({...filters, technology: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Technology</option>
                {fieldOptions.technology.filter(opt => opt !== 'Create your own options in Settings').map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              
              <select
                value={filters.solutionType}
                onChange={(e) => setFilters({...filters, solutionType: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Solutions</option>
                {fieldOptions.solutionType.filter(opt => opt !== 'Create your own options in Settings').map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            
            {canAddCompaniesContacts && (
              <button
                onClick={() => setShowAddCompany(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Add Company
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Companies List */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Companies</h3>
            {canAddCompaniesContacts && (
              <button
                onClick={() => setShowAddCompany(true)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Add Company
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredCompanies.map(company => (
                <div
                  key={company.id}
                  className={`p-3 border rounded-md transition-colors ${
                    selectedCompany?.id === company.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => selectCompany(company)}
                    >
                      <h4 className="font-medium text-gray-900">{company.name}</h4>
                      <p className="text-sm text-gray-600 truncate">
                        <a 
                          href={formatWebsiteUrl(company.website)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.website}
                        </a>
                      </p>
                      {(company.lastEditedBy || company.addedBy) && (
                        <p className="text-xs text-gray-500 mt-1">
                          {company.lastEditedBy 
                            ? (() => {
                                const history = company.history || [];
                                const lastAction = history.length > 0 ? history[history.length - 1] : null;
                                const isRestored = lastAction?.action === 'restored';
                                const actionText = isRestored ? 'Restored' : 'Last edited';
                                return `${actionText} ${company.lastEditedAt ? new Date(company.lastEditedAt).toLocaleString() : ''} by ${company.lastEditedBy}`;
                              })()
                            : `Added ${company.dateAdded ? new Date(company.dateAdded).toLocaleString() : ''} by ${company.addedBy}`
                          }
                        </p>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="flex flex-wrap gap-1">
                        <span 
                          className={`px-2 py-1 text-xs rounded-full cursor-help ${
                            company.msaSigned === 'Yes' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}
                          title={`MSA Status: ${company.msaSigned}`}
                        >
                          {company.msaSigned === 'Yes' ? 'MSA' : 'No MSA'}
                        </span>
                        <span 
                          className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 cursor-help"
                          title={`Tier: ${company.tier}`}
                        >
                          Tier {company.tier}
                        </span>
                        {(() => {
                          const techArray = (Array.isArray(company.technology) ? company.technology : [company.technology]).filter(Boolean);
                          return techArray.length > 1 ? (
                            <span 
                              className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 cursor-help" 
                              title={`Technologies: ${techArray.join(', ')}`}
                            >
                              Multiple
                            </span>
                          ) : techArray.map((tech, idx) => (
                            <span 
                              key={idx} 
                              className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 cursor-help"
                              title={`Technology: ${tech}`}
                            >
                              {tech}
                            </span>
                          ));
                        })()}
                        {(() => {
                          const solutionArray = (Array.isArray(company.solutionType) ? company.solutionType : [company.solutionType]).filter(Boolean);
                          return solutionArray.length > 1 ? (
                            <span 
                              className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 cursor-help" 
                              title={`Solution Types: ${solutionArray.join(', ')}`}
                            >
                              Multiple
                            </span>
                          ) : solutionArray.map((solution, idx) => (
                            <span 
                              key={idx} 
                              className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 cursor-help"
                              title={`Solution Type: ${solution}`}
                            >
                              {solution}
                            </span>
                          ));
                        })()}
                      </div>
                      {canEditDelete() && (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCompany(company);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                            title="Edit company"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCompany(company);
                            }}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                            title="Delete company"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowCompanyHistory(company);
                              fetchCompanyHistory(company);
                            }}
                            className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                            title="View history"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredCompanies.length === 0 && !loading && (
                <p className="text-gray-500 text-center py-8">No companies found</p>
              )}
            </div>
          )}
        </div>

        {/* Contacts List */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedCompany ? `${selectedCompany.name} Contacts` : 'Select a Company'}
            </h3>
            {selectedCompany && canAddCompaniesContacts && (
              <button
                onClick={() => setShowAddContact(true)}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              >
                Add Contact
              </button>
            )}
          </div>
          
          {selectedCompany ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {contacts.map(contact => (
                <div key={contact.id} className="p-3 border border-gray-200 rounded-md">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{contact.name}</h4>
                      <p className="text-sm text-gray-600">{contact.role}</p>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>📧 {contact.email}</p>
                        <p>📱 <a href={createPhoneLink(contact.cellPhone)} className="text-blue-600 hover:text-blue-800 hover:underline">{formatPhoneNumber(contact.cellPhone)}</a></p>
                        {contact.officePhone && <p>📞 <a href={createPhoneLink(contact.officePhone)} className="text-blue-600 hover:text-blue-800 hover:underline">{formatPhoneNumber(contact.officePhone)}</a></p>}
                        {contact.fax && <p>📠 <a href={createPhoneLink(contact.fax)} className="text-blue-600 hover:text-blue-800 hover:underline">{formatPhoneNumber(contact.fax)}</a></p>}
                        {contact.notes && <p>📝 {contact.notes}</p>}
                        {(contact.lastEditedBy || contact.addedBy) && (
                          <p className="text-xs text-gray-500 mt-2">
                            {contact.lastEditedBy 
                              ? (() => {
                                  const history = contact.history || [];
                                  const lastAction = history.length > 0 ? history[history.length - 1] : null;
                                  const isRestored = lastAction?.action === 'restored';
                                  const actionText = isRestored ? 'Restored' : 'Last edited';
                                  return `${actionText} ${contact.lastEditedAt ? new Date(contact.lastEditedAt).toLocaleString() : ''} by ${contact.lastEditedBy}`;
                                })()
                              : `Added ${contact.dateAdded ? new Date(contact.dateAdded).toLocaleString() : ''} by ${contact.addedBy}`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                    {canEditDelete() && (
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => handleEditContact(contact)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                          title="Edit contact"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                          title="Delete contact"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setShowContactHistory(contact);
                            fetchContactHistory(contact);
                          }}
                          className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                          title="View history"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {contacts.length === 0 && (
                <p className="text-gray-500 text-center py-8">No contacts found</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Select a company to view contacts</p>
          )}
        </div>
      </div>

      {/* Add Company Modal */}
      {showAddCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Company</h3>
            
            <form id="company-form" onSubmit={handleAddCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({...companyForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MSA Signed *</label>
                <select
                  value={companyForm.msaSigned}
                  onChange={(e) => setCompanyForm({...companyForm, msaSigned: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select MSA Status</option>
                  {fieldOptions.msaSigned.map(option => (
                    <option key={option} value={option} disabled={option === 'Create your own options in Settings'}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tier *</label>
                <select
                  value={companyForm.tier}
                  onChange={(e) => setCompanyForm({...companyForm, tier: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Tier</option>
                  {fieldOptions.tier.map(option => (
                    <option key={option} value={option} disabled={option === 'Create your own options in Settings'}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="relative">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Technology *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const availableOptions = fieldOptions.technology.filter(opt => opt !== 'Create your own options in Settings');
                      const allSelected = availableOptions.every(opt => companyForm.technology.includes(opt));
                      setCompanyForm({...companyForm, technology: allSelected ? [] : availableOptions});
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    {fieldOptions.technology.filter(opt => opt !== 'Create your own options in Settings').every(opt => companyForm.technology.includes(opt)) ? 'Unselect All' : 'Select All'}
                  </button>
                </div>
                <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                  {fieldOptions.technology.filter(opt => opt !== 'Create your own options in Settings').map(option => (
                    <label key={option} className="flex items-center space-x-2 mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={companyForm.technology.includes(option)}
                        onChange={(e) => {
                          const newTech = e.target.checked
                            ? [...companyForm.technology, option]
                            : companyForm.technology.filter(t => t !== option);
                          setCompanyForm({...companyForm, technology: newTech});
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="relative">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Solution Type *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const availableOptions = fieldOptions.solutionType.filter(opt => opt !== 'Create your own options in Settings');
                      const allSelected = availableOptions.every(opt => companyForm.solutionType.includes(opt));
                      setCompanyForm({...companyForm, solutionType: allSelected ? [] : availableOptions});
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    {fieldOptions.solutionType.filter(opt => opt !== 'Create your own options in Settings').every(opt => companyForm.solutionType.includes(opt)) ? 'Unselect All' : 'Select All'}
                  </button>
                </div>
                <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                  {fieldOptions.solutionType.filter(opt => opt !== 'Create your own options in Settings').map(option => (
                    <label key={option} className="flex items-center space-x-2 mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={companyForm.solutionType.includes(option)}
                        onChange={(e) => {
                          const newSolutions = e.target.checked
                            ? [...companyForm.solutionType, option]
                            : companyForm.solutionType.filter(s => s !== option);
                          setCompanyForm({...companyForm, solutionType: newSolutions});
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Website *</label>
                <input
                  type="text"
                  placeholder="e.g., www.google.com"
                  value={companyForm.website}
                  onChange={(e) => setCompanyForm({...companyForm, website: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCompany(false);
                    setEditingCompany(null);
                    setCompanyForm({
                      name: '',
                      msaSigned: '',
                      tier: '',
                      technology: [],
                      solutionType: [],
                      website: ''
                    });
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingCompany ? 'Update Company' : 'Add Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Contact</h3>
            
            <form id="contact-form" onSubmit={handleAddContact} className="space-y-4">
              <input
                type="text"
                placeholder="Name *"
                value={contactForm.name}
                onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              
              <input
                type="email"
                placeholder="Email *"
                value={contactForm.email}
                onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              
              <input
                type="text"
                placeholder="Role *"
                value={contactForm.role}
                onChange={(e) => setContactForm({...contactForm, role: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cell Phone *</label>
                <PhoneInput
                  value={contactForm.cellPhone}
                  onChange={(value) => setContactForm({...contactForm, cellPhone: value})}
                  placeholder="Cell Phone"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Office Phone</label>
                <PhoneInput
                  value={contactForm.officePhone}
                  onChange={(value) => setContactForm({...contactForm, officePhone: value})}
                  placeholder="Office Phone"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fax</label>
                <PhoneInput
                  value={contactForm.fax}
                  onChange={(value) => setContactForm({...contactForm, fax: value})}
                  placeholder="Fax"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  placeholder="Additional notes (max 500 characters)"
                  value={contactForm.notes}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 500) {
                      setContactForm({...contactForm, notes: value});
                    }
                  }}
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {contactForm.notes.length}/500 characters
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddContact(false);
                    setEditingContact(null);
                    setContactForm({
                      name: '',
                      email: '',
                      role: '',
                      cellPhone: '',
                      officePhone: '',
                      fax: '',
                      notes: ''
                    });
                    setPhoneErrors({
                      cellPhone: '',
                      officePhone: '',
                      fax: ''
                    });
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  {editingContact ? 'Update Contact' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Company History Modal */}
      {showCompanyHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden border border-gray-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Company History
                  </h3>
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 font-medium block mb-1">Company Name</span>
                        <span className="text-gray-900 font-semibold">{showCompanyHistory.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium block mb-1">Website</span>
                        <span className="text-gray-900 font-semibold">{showCompanyHistory.website}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium block mb-1">Tier</span>
                        <span className="text-gray-900 font-semibold">Tier {showCompanyHistory.tier}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium block mb-1">Technology</span>
                        <span className="text-gray-900 font-semibold">{showCompanyHistory.technology}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowCompanyHistory(null)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-white hover:bg-opacity-50 rounded-full p-2 transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[65vh] bg-gray-50">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : companyHistory.length > 0 ? (
                <div className="space-y-6">
                  {companyHistory.map((entry, index) => {
                    const date = new Date(entry.timestamp || entry.changedAt);
                    const timeZoneAbbr = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
                    
                    return (
                      <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
                        {/* Entry Header */}
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                entry.action === 'created' ? 'bg-green-100' :
                                entry.action === 'updated' ? 'bg-blue-100' :
                                entry.action === 'deleted' ? 'bg-red-100' :
                                'bg-gray-100'
                              }`}>
                                {entry.action === 'created' && (
                                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                )}
                                {entry.action === 'updated' && (
                                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                )}
                                {entry.action === 'deleted' && (
                                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-3">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                                    entry.action === 'created' ? 'bg-green-100 text-green-800' :
                                    entry.action === 'updated' ? 'bg-blue-100 text-blue-800' :
                                    entry.action === 'deleted' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {entry.action ? entry.action.charAt(0).toUpperCase() + entry.action.slice(1) : 'Updated'}
                                  </span>
                                  <span className="text-lg font-semibold text-gray-900">{entry.user || entry.changedBy}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900">
                                {date.toLocaleDateString('en-US', { 
                                  weekday: 'short',
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </div>
                              <div className="text-sm text-gray-600">
                                {date.toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  second: '2-digit'
                                })} {timeZoneAbbr}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Entry Content */}
                        <div className="p-6">
                          {entry.action === 'created' && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                              <h4 className="text-lg font-semibold text-green-900 flex items-center gap-2 mb-2">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Company Created
                              </h4>
                              <p className="text-green-800">Initial company record was created.</p>
                            </div>
                          )}
                          
                          {entry.changes && entry.changes.length > 0 && (
                            <div className="space-y-4">
                              <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                {entry.user || entry.changedBy} made the following changes:
                              </h4>
                              <div className="grid gap-4">
                                {entry.changes.map((change, changeIndex) => (
                                  <div key={changeIndex} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                                    <div className="flex items-center gap-3 mb-3">
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-200 text-blue-900">
                                        {change.field}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      {change.from !== undefined && (
                                        <div className="flex-1">
                                          <div className="text-xs font-medium text-blue-700 mb-2">CHANGED FROM</div>
                                          <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                            <span className="text-red-800 font-medium">
                                              {change.from || '(empty)'}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                      {change.from !== undefined && change.to !== undefined && (
                                        <div className="flex-shrink-0 pt-6">
                                          <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                          </svg>
                                        </div>
                                      )}
                                      {change.to !== undefined && (
                                        <div className="flex-1">
                                          <div className="text-xs font-medium text-blue-700 mb-2">CHANGED TO</div>
                                          <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                            <span className="text-green-800 font-medium">
                                              {change.to || '(empty)'}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {entry.action === 'deleted' && (
                            <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-lg p-4 border border-red-200">
                              <h4 className="text-lg font-semibold text-red-900 flex items-center gap-2 mb-2">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                {entry.user || entry.changedBy} deleted this company
                              </h4>
                              <p className="text-red-800">The company was removed from active use but preserved in history.</p>
                            </div>
                          )}
                          
                          {!entry.changes && entry.action === 'updated' && (
                            <div className="text-center py-4">
                              <span className="text-gray-500 italic">{entry.user || entry.changedBy} updated this company (no specific changes recorded)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No History Available</h3>
                    <p className="text-gray-600">
                      This company was created before history tracking was implemented.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact History Modal */}
      {showContactHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden border border-gray-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Contact History
                  </h3>
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 font-medium block mb-1">Contact Name</span>
                        <span className="text-gray-900 font-semibold">{showContactHistory.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium block mb-1">Email</span>
                        <span className="text-gray-900 font-semibold">{showContactHistory.email}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium block mb-1">Role</span>
                        <span className="text-gray-900 font-semibold">{showContactHistory.role}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium block mb-1">Phone</span>
                        <span className="text-gray-900 font-semibold">{showContactHistory.cellPhone}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowContactHistory(null)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-white hover:bg-opacity-50 rounded-full p-2 transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[65vh] bg-gray-50">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : contactHistory.length > 0 ? (
                <div className="space-y-6">
                  {contactHistory.map((entry, index) => {
                    const date = new Date(entry.timestamp || entry.changedAt);
                    const timeZoneAbbr = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
                    
                    return (
                      <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
                        {/* Entry Header */}
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                entry.action === 'created' ? 'bg-green-100' :
                                entry.action === 'updated' ? 'bg-blue-100' :
                                entry.action === 'deleted' ? 'bg-red-100' :
                                'bg-gray-100'
                              }`}>
                                {entry.action === 'created' && (
                                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                )}
                                {entry.action === 'updated' && (
                                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                )}
                                {entry.action === 'deleted' && (
                                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-3">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                                    entry.action === 'created' ? 'bg-green-100 text-green-800' :
                                    entry.action === 'updated' ? 'bg-blue-100 text-blue-800' :
                                    entry.action === 'deleted' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {entry.action ? entry.action.charAt(0).toUpperCase() + entry.action.slice(1) : 'Updated'}
                                  </span>
                                  <span className="text-lg font-semibold text-gray-900">{entry.user || entry.changedBy}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900">
                                {date.toLocaleDateString('en-US', { 
                                  weekday: 'short',
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </div>
                              <div className="text-sm text-gray-600">
                                {date.toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  second: '2-digit'
                                })} {timeZoneAbbr}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Entry Content */}
                        <div className="p-6">
                          {entry.action === 'created' && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                              <h4 className="text-lg font-semibold text-green-900 flex items-center gap-2 mb-2">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Contact Created
                              </h4>
                              <p className="text-green-800">Initial contact record was created.</p>
                            </div>
                          )}
                          
                          {entry.changes && entry.changes.length > 0 && (
                            <div className="space-y-4">
                              <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                {entry.user || entry.changedBy} made the following changes:
                              </h4>
                              <div className="grid gap-4">
                                {entry.changes.map((change, changeIndex) => (
                                  <div key={changeIndex} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                                    <div className="flex items-center gap-3 mb-3">
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-200 text-blue-900">
                                        {change.field}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      {change.from !== undefined && (
                                        <div className="flex-1">
                                          <div className="text-xs font-medium text-blue-700 mb-2">CHANGED FROM</div>
                                          <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                            <span className="text-red-800 font-medium">
                                              {change.from || '(empty)'}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                      {change.from !== undefined && change.to !== undefined && (
                                        <div className="flex-shrink-0 pt-6">
                                          <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                          </svg>
                                        </div>
                                      )}
                                      {change.to !== undefined && (
                                        <div className="flex-1">
                                          <div className="text-xs font-medium text-blue-700 mb-2">CHANGED TO</div>
                                          <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                            <span className="text-green-800 font-medium">
                                              {change.to || '(empty)'}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {entry.action === 'deleted' && (
                            <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-lg p-4 border border-red-200">
                              <h4 className="text-lg font-semibold text-red-900 flex items-center gap-2 mb-2">
                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                {entry.user || entry.changedBy} deleted this contact
                              </h4>
                              <p className="text-red-800">The contact was removed from active use but preserved in history.</p>
                            </div>
                          )}
                          
                          {!entry.changes && entry.action === 'updated' && (
                            <div className="text-center py-4">
                              <span className="text-gray-500 italic">{entry.user || entry.changedBy} updated this contact (no specific changes recorded)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md mx-auto">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No History Available</h3>
                    <p className="text-gray-600">
                      This contact was created before history tracking was implemented.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Similar Companies Modal */}
      {showSimilarCompanies && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Similar Deleted Companies Found</h3>
            <p className="text-gray-600 mb-4">We found similar companies that were previously deleted. Would you like to restore one instead?</p>
            
            <div className="space-y-3 max-h-64 overflow-y-auto mb-6">
              {similarCompanies.map(company => (
                <div key={company.id} className="p-3 border border-gray-200 rounded-md">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{company.name}</h4>
                      <p className="text-sm text-gray-600">{company.website}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Deleted {new Date(company.deletedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        handleRestoreCompany(company);
                        setShowSimilarCompanies(false);
                        setSimilarCompanies([]);
                      }}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                    >
                      Restore This
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setShowSimilarCompanies(false);
                  setSimilarCompanies([]);
                  // Continue with original form submission, skipping similarity check
                  const event = { preventDefault: () => {} };
                  await handleAddCompany(event, true);
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Create New Instead
              </button>
              <button
                onClick={() => {
                  setShowSimilarCompanies(false);
                  setSimilarCompanies([]);
                  setShowAddCompany(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Similar Contacts Modal */}
      {showSimilarContacts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Similar Deleted Contacts Found</h3>
            <p className="text-gray-600 mb-4">We found similar contacts that were previously deleted. Would you like to restore one instead?</p>
            
            <div className="space-y-3 max-h-64 overflow-y-auto mb-6">
              {similarContacts.map(contact => (
                <div key={contact.id} className="p-3 border border-gray-200 rounded-md">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{contact.name}</h4>
                      <p className="text-sm text-gray-600">{contact.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Deleted {new Date(contact.deletedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        handleRestoreContact(contact);
                        setShowSimilarContacts(false);
                        setSimilarContacts([]);
                      }}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                    >
                      Restore This
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setShowSimilarContacts(false);
                  setSimilarContacts([]);
                  // Continue with original form submission, skipping similarity check
                  const event = { preventDefault: () => {} };
                  await handleAddContact(event, true);
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Create New Instead
              </button>
              <button
                onClick={() => {
                  setShowSimilarContacts(false);
                  setSimilarContacts([]);
                  setShowAddContact(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portal-rendered Search Results */}
      {showSearchResults && searchResults.length > 0 && typeof window !== 'undefined' &&
        createPortal(
          <div 
            className="fixed bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-y-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              zIndex: 9999
            }}
          >
            {searchResults.map((result, index) => (
              <div
                key={`${result.type}-${result.id}-${index}`}
                onClick={() => {
                  if (result.type === 'company') {
                    selectCompany(result);
                  } else {
                    // Find and select the company for this contact
                    const company = companies.find(c => c.name === result.companyName);
                    if (company) {
                      selectCompany(company);
                    }
                  }
                  setSearchTerm('');
                  setShowSearchResults(false);
                }}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    result.type === 'company' ? 'bg-blue-500' : 'bg-green-500'
                  }`}></div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {result.matchText}
                    </div>
                    <div className="text-sm text-gray-500">
                      {result.type === 'company' 
                        ? `${result.technology} • Tier ${result.tier}` 
                        : `${result.role} • ${result.email}`
                      }
                    </div>
                  </div>
                  <div className={`px-2 py-1 text-xs rounded-full ${
                    result.type === 'company' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {result.type === 'company' ? 'Company' : 'Contact'}
                  </div>
                </div>
              </div>
            ))}
          </div>,
          document.body
        )
      }
    </div>
  );
}