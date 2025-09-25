'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import MultiAccountManagerSelector from './MultiAccountManagerSelector';
import { PRACTICE_OPTIONS } from '../constants/practices';

// Color palette for practice-SA pairings
const COLOR_PALETTE = [
  { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  { bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-200' },
  { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
  { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' }
];

// Component for individual practice assignment with SA selection
function PracticeAssignmentCard({ practice, index, assignedSAs, onSAChange, allUsers }) {
  const colors = COLOR_PALETTE[index % COLOR_PALETTE.length];
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);
  
  // DSR: Show all users, prioritize practice users first
  const practiceUsers = (allUsers || []).filter(user => 
    user && user.practices && user.practices.includes(practice)
  );
  
  const otherUsers = (allUsers || []).filter(user => 
    user && (!user.practices || !user.practices.includes(practice))
  );
  
  // Combine with practice users first, then others
  const allAvailableUsers = [...practiceUsers, ...otherUsers];
  
  const filteredUsers = allAvailableUsers.filter(user =>
    user && 
    !assignedSAs.some(sa => sa.includes(user.email || '')) &&
    (searchTerm.length === 0 || 
     user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     user.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (showDropdown) {
      const handleScroll = () => {
        if (showDropdown) {
          updateDropdownPosition();
        }
      };
      
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [showDropdown]);

  const handleAddSA = (user) => {
    const saEntry = `${user.name} <${user.email}>`;
    if (!assignedSAs.includes(saEntry)) {
      onSAChange([...assignedSAs, saEntry]);
    }
    setSearchTerm('');
    setShowDropdown(false);
  };
  
  const handleRemoveSA = (saToRemove) => {
    onSAChange(assignedSAs.filter(sa => sa !== saToRemove));
  };
  
  const extractFriendlyName = (saEntry) => {
    const match = saEntry.match(/^(.+?)\s*<[^>]+>/);
    return match ? match[1].trim() : saEntry;
  };
  
  return (
    <div className={`${colors.bg} rounded-lg border ${colors.border} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-white/20">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${colors.text.replace('text-', 'bg-')}`}></div>
          <h3 className={`font-semibold ${colors.text}`}>{practice}</h3>
          <div className={`ml-auto px-2 py-1 rounded-full text-xs font-semibold ${
            assignedSAs.length > 0 ? 'bg-emerald-500 text-white' : 'bg-gray-400 text-white'
          }`}>
            {assignedSAs.length} SA{assignedSAs.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
      
      <div className="p-4 space-y-3">
        {/* Assigned SAs */}
        {assignedSAs.length > 0 && (
          <div className="space-y-2">
            {assignedSAs.map((sa, saIndex) => (
              <div key={saIndex} className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="bg-gray-200 rounded-full p-1">
                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-900 text-sm">{extractFriendlyName(sa)}</span>
                </div>
                <button
                  onClick={() => handleRemoveSA(sa)}
                  className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Add SA Section */}
        <div className="relative">
          <div ref={inputRef} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search and add SAs..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                updateDropdownPosition();
                setShowDropdown(true);
              }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="flex-1 text-sm border-0 focus:ring-0 p-0"
            />
          </div>
          
          {showDropdown && createPortal(
            <div 
              className="bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] max-h-60 overflow-y-auto"
              style={{
                position: 'fixed',
                top: dropdownPosition.top + 4,
                left: dropdownPosition.left,
                width: dropdownPosition.width
              }}
            >
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const isPracticeUser = user.practices && user.practices.includes(practice);
                  return (
                    <button
                      key={user.email}
                      onClick={() => handleAddSA(user)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm border-b border-gray-100 last:border-b-0"
                    >
                      <div className={`rounded-full p-1 ${
                        isPracticeUser ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        <svg className={`w-3 h-3 ${
                          isPracticeUser ? 'text-green-600' : 'text-blue-600'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-gray-500 text-xs flex items-center gap-1">
                          {user.email}
                          {isPracticeUser && (
                            <span className="bg-green-100 text-green-800 px-1 py-0.5 rounded text-xs font-medium">
                              {practice}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center text-gray-500 text-sm">
                  {searchTerm ? 'No users found matching search' : 'Start typing to search users'}
                </div>
              )}
            </div>,
            document.body
          )}
        </div>
        
        {assignedSAs.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-4 text-center border-2 border-dashed border-gray-200">
            <div className="bg-gray-100 rounded-full p-2 w-8 h-8 mx-auto mb-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium text-sm">No SAs assigned</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssignResourceModal({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData = {}, 
  targetStatus = 'Assigned',
  saving = false,
  allUsers = [],
  saAssignment = null
}) {
  const [formData, setFormData] = useState({
    practice: [],
    am: [],
    region: '',
    dateAssigned: new Date().toISOString().split('T')[0],
    ...initialData
  });
  const [practiceAssignments, setPracticeAssignments] = useState({});
  const [practiceError, setPracticeError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (isOpen) {
      // Load existing practice assignments from saAssignment
      let existingPracticeAssignments = {};
      
      if (saAssignment?.practiceAssignments) {
        try {
          existingPracticeAssignments = JSON.parse(saAssignment.practiceAssignments);
        } catch (e) {
          console.error('Error parsing practiceAssignments:', e);
        }
      }
      
      setPracticeAssignments(existingPracticeAssignments);
      
      // Set initial form data
      const baseFormData = {
        practice: [],
        am: [],
        region: '',
        dateAssigned: new Date().toISOString().split('T')[0],
        ...initialData
      };
      
      // DSR: Always derive region from account manager, override initialData region
      if (baseFormData.am && Array.isArray(baseFormData.am) && baseFormData.am.length > 0 && allUsers.length > 0) {
        const firstAM = allUsers.find(u => u.role === 'account_manager' && baseFormData.am.includes(u.name));
        if (firstAM && firstAM.region) {
          baseFormData.region = firstAM.region;
        } else {
          baseFormData.region = ''; // Clear if AM has no region
        }
      }
      
      setFormData(baseFormData);
      setPracticeError('');
      setValidationErrors({});
    }
  }, [isOpen, initialData, saAssignment, allUsers]);

  // Auto-populate region when account manager changes
  useEffect(() => {
    if (isOpen && formData.am && Array.isArray(formData.am) && formData.am.length > 0 && allUsers.length > 0) {
      const firstAM = allUsers.find(u => u.role === 'account_manager' && formData.am.includes(u.name));
      if (firstAM && firstAM.region) {
        setFormData(prev => ({...prev, region: firstAM.region}));
      } else {
        setFormData(prev => ({...prev, region: ''}));
      }
    } else if (formData.am && Array.isArray(formData.am) && formData.am.length === 0) {
      setFormData(prev => ({...prev, region: ''}));
    }
  }, [formData.am, allUsers, isOpen]);

  const handleSave = async () => {
    const practices = Array.isArray(formData.practice) ? formData.practice : (formData.practice ? [formData.practice] : []);
    const errors = {};
    
    // Validation
    if (practices.length === 0) {
      errors.practice = 'Please select at least one practice';
    }
    
    if (!formData.am || (Array.isArray(formData.am) && formData.am.length === 0)) {
      errors.am = 'Please select at least one account manager';
    }
    
    if (!formData.region) {
      errors.region = 'Please select a region';
    }
    
    // DSR: Validate practice assignments for Assigned status
    if (targetStatus === 'Assigned') {
      const hasUnassignedPractices = practices.some(practice => 
        !practiceAssignments[practice] || practiceAssignments[practice].length === 0
      );
      
      if (hasUnassignedPractices) {
        errors.practiceAssignments = 'All selected practices must have at least one SA assigned';
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setPracticeError(errors.practice || '');
      return;
    }
    
    // DSR: Ensure region comes from account manager
    const selectedAMs = Array.isArray(formData.am) ? formData.am : [formData.am];
    const amWithRegion = allUsers.find(u => u.role === 'account_manager' && selectedAMs.includes(u.name) && u.region === formData.region);
    if (!amWithRegion && formData.region && allUsers.length > 0) {
      const amUser = allUsers.find(u => u.role === 'account_manager' && selectedAMs.includes(u.name));
      if (!amUser) {
        alert('Selected account manager not found in system. Please select a valid account manager.');
        return;
      } else if (!amUser.region) {
        const confirmed = confirm('The selected account manager does not have a region set. The region will be manually assigned. Continue?');
        if (!confirmed) return;
      }
    }
    
    // DSR: Update practiceAssignments to reflect selected practices
    const updatedPracticeAssignments = { ...practiceAssignments };
    
    // Remove practices that are no longer selected
    Object.keys(updatedPracticeAssignments).forEach(practice => {
      if (!practices.includes(practice)) {
        delete updatedPracticeAssignments[practice];
      }
    });
    
    // Add new practices with empty SA arrays
    practices.forEach(practice => {
      if (!updatedPracticeAssignments[practice]) {
        updatedPracticeAssignments[practice] = [];
      }
    });
    
    // DSR: Create legacy saAssigned field from practice assignments for backward compatibility
    const allAssignedSAs = [];
    Object.values(updatedPracticeAssignments).forEach(saList => {
      allAssignedSAs.push(...saList);
    });
    
    const updateData = {
      status: targetStatus,
      practice: practices.join(','),
      am: Array.isArray(formData.am) ? formData.am.join(',') : formData.am,
      region: formData.region,
      practiceAssignments: JSON.stringify(updatedPracticeAssignments),
      saAssigned: allAssignedSAs.join(', '), // Legacy field for backward compatibility
      dateAssigned: targetStatus === 'Assigned' ? formData.dateAssigned : ''
    };
    
    await onSave(updateData);
  };

  if (!isOpen) return null;

  const modalTitle = targetStatus === 'Assigned' ? 'Assign Resource' : 'Assign to Practice';
  const modalDescription = targetStatus === 'Assigned' 
    ? 'Please assign this request to a practice, region, and resource.' 
    : 'Please assign this request to one or more practices.';

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">{modalTitle}</h3>
                <p className="text-blue-100 text-sm">{modalDescription}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Practice Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="font-semibold text-gray-800">Practice Selection *</span>
              </div>
              <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded-full">
                {Array.isArray(formData.practice) ? formData.practice.length : (formData.practice ? 1 : 0)} selected
              </span>
            </div>
            
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border border-gray-200 p-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {PRACTICE_OPTIONS.filter(practice => practice !== 'Pending').map((practice, index) => {
                  const isSelected = Array.isArray(formData.practice) ? formData.practice.includes(practice) : formData.practice === practice;
                  const practiceColor = COLOR_PALETTE[index % COLOR_PALETTE.length];
                  
                  return (
                    <label 
                      key={practice} 
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all group ${
                        isSelected 
                          ? `${practiceColor.bg} ${practiceColor.border} shadow-sm` 
                          : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                      title={practice}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const currentPractices = Array.isArray(formData.practice) ? formData.practice : (formData.practice ? [formData.practice] : []);
                            const newPractices = [...currentPractices, practice];
                            setFormData(prev => ({...prev, practice: newPractices}));
                            if (!practiceAssignments[practice]) {
                              setPracticeAssignments(prev => ({...prev, [practice]: []}));
                            }
                          } else {
                            const currentPractices = Array.isArray(formData.practice) ? formData.practice : (formData.practice ? [formData.practice] : []);
                            const newPractices = currentPractices.filter(p => p !== practice);
                            setFormData(prev => ({...prev, practice: newPractices}));
                            setPracticeAssignments(prev => {
                              const updated = {...prev};
                              delete updated[practice];
                              return updated;
                            });
                          }
                          setPracticeError('');
                          setValidationErrors(prev => ({...prev, practice: ''}));
                        }}
                        className="sr-only"
                      />
                      
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected 
                          ? `${practiceColor.text} border-current` 
                          : 'border-gray-300 group-hover:border-blue-400'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      
                      <span className={`text-xs font-medium transition-colors truncate ${
                        isSelected ? practiceColor.text : 'text-gray-700 group-hover:text-blue-700'
                      }`}>
                        {practice}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            
            {(practiceError || validationErrors.practice) && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-2 bg-red-50 p-2 rounded-lg border border-red-200">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {practiceError || validationErrors.practice}
              </p>
            )}
          </div>

          {/* Practice Assignments Section */}
          {formData.practice && Array.isArray(formData.practice) && formData.practice.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <label className="block text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  Practice Assignments {targetStatus === 'Assigned' && '*'}
                </label>
                <div className="text-sm text-gray-500">
                  {Object.values(practiceAssignments).reduce((total, saList) => total + saList.length, 0)} total SAs assigned
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {formData.practice.map((practice, index) => (
                  <PracticeAssignmentCard
                    key={practice}
                    practice={practice}
                    index={index}
                    assignedSAs={practiceAssignments[practice] || []}
                    onSAChange={(newSAs) => {
                      setPracticeAssignments(prev => ({
                        ...prev,
                        [practice]: newSAs
                      }));
                      setValidationErrors(prev => ({...prev, practiceAssignments: ''}));
                    }}
                    allUsers={allUsers}
                  />
                ))}
              </div>
              
              {validationErrors.practiceAssignments && (
                <p className="mt-3 text-sm text-red-600 flex items-center gap-2 bg-red-50 p-3 rounded-lg border border-red-200">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.practiceAssignments}
                </p>
              )}
            </div>
          )}

          {/* Account Manager & Region Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Account Manager *
              </label>
              <div className={`bg-white rounded-xl border p-1 ${
                validationErrors.am ? 'border-red-300' : 'border-gray-200'
              }`}>
                <MultiAccountManagerSelector
                  value={formData.am || []}
                  onChange={(managers) => {
                    setFormData(prev => ({...prev, am: managers}));
                    setValidationErrors(prev => ({...prev, am: ''}));
                  }}
                  placeholder="Select or type account manager names..."
                  required
                  allUsers={allUsers}
                  onCreateUser={async (userData) => {
                    try {
                      const response = await fetch('/api/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          ...userData,
                          role: 'account_manager'
                        })
                      });
                      if (response.ok) {
                        const usersResponse = await fetch('/api/admin/users');
                        if (usersResponse.ok) {
                          const usersData = await usersResponse.json();
                          if (window.refreshUsers) window.refreshUsers(usersData.users || []);
                        }
                        return true;
                      }
                      return false;
                    } catch (error) {
                      console.error('Error creating user:', error);
                      return false;
                    }
                  }}
                />
              </div>
              {validationErrors.am && (
                <p className="mt-2 text-sm text-red-600">{validationErrors.am}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Region *
              </label>
              <select
                value={formData.region}
                onChange={(e) => {
                  setFormData(prev => ({...prev, region: e.target.value}));
                  setValidationErrors(prev => ({...prev, region: ''}));
                }}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm font-medium shadow-sm hover:border-gray-400 transition-colors ${
                  validationErrors.region ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              >
                <option value="">Select Region</option>
                <option value="CA-LAX">CA-LAX</option>
                <option value="CA-SAN">CA-SAN</option>
                <option value="CA-SFO">CA-SFO</option>
                <option value="FL-MIA">FL-MIA</option>
                <option value="FL-NORT">FL-NORT</option>
                <option value="KY-KENT">KY-KENT</option>
                <option value="LA-STATE">LA-STATE</option>
                <option value="OK-OKC">OK-OKC</option>
                <option value="OTHERS">OTHERS</option>
                <option value="TN-TEN">TN-TEN</option>
                <option value="TX-CEN">TX-CEN</option>
                <option value="TX-DAL">TX-DAL</option>
                <option value="TX-HOU">TX-HOU</option>
                <option value="TX-SOUT">TX-SOUT</option>
                <option value="US-FED">US-FED</option>
                <option value="US-SP">US-SP</option>
              </select>
              {validationErrors.region && (
                <p className="mt-2 text-sm text-red-600">{validationErrors.region}</p>
              )}
            </div>
          </div>

          {/* Date Assigned Section (only for Assigned status) */}
          {targetStatus === 'Assigned' && (
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                Date Assigned *
              </label>
              <input
                type="date"
                value={formData.dateAssigned}
                onChange={(e) => setFormData(prev => ({...prev, dateAssigned: e.target.value}))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium shadow-sm hover:border-gray-400 transition-colors"
                required
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              * Required fields
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || 
                  (Array.isArray(formData.practice) ? formData.practice.length === 0 : !formData.practice) || 
                  !formData.am || 
                  (Array.isArray(formData.am) && formData.am.length === 0) || 
                  !formData.region ||
                  (targetStatus === 'Assigned' && formData.practice && Array.isArray(formData.practice) && 
                    formData.practice.some(practice => !practiceAssignments[practice] || practiceAssignments[practice].length === 0)
                  )
                }
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center gap-2"
              >
                {saving && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}