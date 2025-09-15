'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCsrf } from '../hooks/useCsrf';
import { sanitizeText } from '../lib/sanitize';

export default function ContactManagementSystem({ practiceGroupId, contactType, user, refreshTrigger, canAddCompaniesContacts }) {
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
    technology: '',
    solutionType: '',
    website: ''
  });

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    role: '',
    cellPhone: '',
    officePhone: '',
    fax: ''
  });

  useEffect(() => {
    if (practiceGroupId && contactType) {
      fetchCompanies();
    }
  }, [practiceGroupId, contactType]);

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
  }, [companies, searchTerm, filters]);

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
      return;
    }

    updateDropdownPosition();

    const searchLower = term.toLowerCase();
    const results = [];

    // Search companies
    companies.forEach(company => {
      if (Object.values(company).some(value => 
        value.toString().toLowerCase().includes(searchLower)
      )) {
        results.push({
          ...company,
          type: 'company',
          matchText: company.name
        });
      }
    });

    // Search contacts
    const allContacts = await getAllContacts();
    allContacts.forEach(contact => {
      if (Object.values(contact).some(value => 
        value.toString().toLowerCase().includes(searchLower)
      )) {
        results.push({
          ...contact,
          type: 'contact',
          matchText: `${contact.name} (${contact.companyName})`
        });
      }
    });

    setSearchResults(results.slice(0, 10)); // Limit to 10 results
    setShowSearchResults(true);
  };

  const filterCompanies = () => {
    let filtered = companies;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(company =>
        Object.values(company).some(value =>
          value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply dropdown filters
    if (filters.tier) {
      filtered = filtered.filter(company => company.tier === filters.tier);
    }
    if (filters.technology) {
      filtered = filtered.filter(company => company.technology === filters.technology);
    }
    if (filters.solutionType) {
      filtered = filtered.filter(company => company.solutionType === filters.solutionType);
    }

    setFilteredCompanies(filtered);
  };

  const formatWebsiteUrl = (url) => {
    if (!url) return url;
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }
    return `https://${trimmedUrl}`;
  };

  const handleAddCompany = async (e) => {
    e.preventDefault();
    try {
      const sanitizedForm = {
        ...companyForm,
        name: sanitizeText(companyForm.name),
        technology: sanitizeText(companyForm.technology),
        solutionType: sanitizeText(companyForm.solutionType),
        website: formatWebsiteUrl(sanitizeText(companyForm.website))
      };
      
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
        setCompanyForm({
          name: '',
          msaSigned: '',
          tier: '',
          technology: '',
          solutionType: '',
          website: ''
        });
        setShowAddCompany(false);
      }
    } catch (error) {
      // Error adding company - user will see no change
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      const sanitizedForm = {
        ...contactForm,
        name: sanitizeText(contactForm.name),
        email: contactForm.email.trim(),
        role: sanitizeText(contactForm.role),
        cellPhone: sanitizeText(contactForm.cellPhone),
        officePhone: sanitizeText(contactForm.officePhone),
        fax: sanitizeText(contactForm.fax)
      };
      
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
        setContactForm({
          name: '',
          email: '',
          role: '',
          cellPhone: '',
          officePhone: '',
          fax: ''
        });
        setShowAddContact(false);
      }
    } catch (error) {
      // Error adding contact - user will see no change
    }
  };

  const selectCompany = (company) => {
    setSelectedCompany(company);
    fetchContacts(company.id);
  };



  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search companies and contacts..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                performSearch(e.target.value);
              }}
              onFocus={() => {
                if (searchTerm) {
                  updateDropdownPosition();
                  setShowSearchResults(true);
                }
              }}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Companies List */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Companies</h3>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredCompanies.map(company => (
                <div
                  key={company.id}
                  onClick={() => selectCompany(company)}
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedCompany?.id === company.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900">{company.name}</h4>
                      <p className="text-sm text-gray-600 truncate">
                        <a 
                          href={company.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.website}
                        </a>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 ml-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        company.msaSigned === 'Yes' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {company.msaSigned === 'Yes' ? 'MSA' : 'No MSA'}
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                        Tier {company.tier}
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {company.technology}
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                        {company.solutionType}
                      </span>
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
                  <h4 className="font-medium text-gray-900">{contact.name}</h4>
                  <p className="text-sm text-gray-600">{contact.role}</p>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>📧 {contact.email}</p>
                    <p>📱 {contact.cellPhone}</p>
                    {contact.officePhone && <p>📞 {contact.officePhone}</p>}
                    {contact.fax && <p>📠 {contact.fax}</p>}
                    {contact.dateAdded && (
                      <p className="text-xs text-gray-500 mt-2">
                        Added {new Date(contact.dateAdded).toLocaleDateString()} by {contact.addedBy}
                      </p>
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
            
            <form onSubmit={handleAddCompany} className="space-y-4">
              <input
                type="text"
                placeholder="Company Name *"
                value={companyForm.name}
                onChange={(e) => setCompanyForm({...companyForm, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              
              <select
                value={companyForm.msaSigned}
                onChange={(e) => setCompanyForm({...companyForm, msaSigned: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">MSA Signed? *</option>
                {fieldOptions.msaSigned.map(option => (
                  <option key={option} value={option} disabled={option === 'Create your own options in Settings'}>
                    {option}
                  </option>
                ))}
              </select>
              
              <select
                value={companyForm.tier}
                onChange={(e) => setCompanyForm({...companyForm, tier: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Tier *</option>
                {fieldOptions.tier.map(option => (
                  <option key={option} value={option} disabled={option === 'Create your own options in Settings'}>
                    {option}
                  </option>
                ))}
              </select>
              
              <select
                value={companyForm.technology}
                onChange={(e) => setCompanyForm({...companyForm, technology: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Technology *</option>
                {fieldOptions.technology.map(option => (
                  <option key={option} value={option} disabled={option === 'Create your own options in Settings'}>
                    {option}
                  </option>
                ))}
              </select>
              
              <select
                value={companyForm.solutionType}
                onChange={(e) => setCompanyForm({...companyForm, solutionType: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Solution Type *</option>
                {fieldOptions.solutionType.map(option => (
                  <option key={option} value={option} disabled={option === 'Create your own options in Settings'}>
                    {option}
                  </option>
                ))}
              </select>
              
              <input
                type="text"
                placeholder="Company Website * (e.g., www.google.com)"
                value={companyForm.website}
                onChange={(e) => setCompanyForm({...companyForm, website: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddCompany(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Company
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
            
            <form onSubmit={handleAddContact} className="space-y-4">
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
              
              <input
                type="tel"
                placeholder="Cell Phone *"
                value={contactForm.cellPhone}
                onChange={(e) => setContactForm({...contactForm, cellPhone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              
              <input
                type="tel"
                placeholder="Office Phone"
                value={contactForm.officePhone}
                onChange={(e) => setContactForm({...contactForm, officePhone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <input
                type="tel"
                placeholder="Fax"
                value={contactForm.fax}
                onChange={(e) => setContactForm({...contactForm, fax: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddContact(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Add Contact
                </button>
              </div>
            </form>
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