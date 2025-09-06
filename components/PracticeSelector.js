'use client';

import { useState, useEffect, useRef } from 'react';
import { PRACTICE_OPTIONS } from '../constants/practices';

export default function PracticeSelector({ 
  value = [], 
  onChange, 
  placeholder = "Select practices...",
  className = "",
  required = false,
  excludePending = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const practices = excludePending ? PRACTICE_OPTIONS.filter(p => p !== 'Pending') : PRACTICE_OPTIONS;
  const selectedPractices = Array.isArray(value) ? value : (value ? value.split(',').map(p => p.trim()) : []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPractices = practices.filter(practice =>
    practice.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePracticeToggle = (practice) => {
    const newSelection = selectedPractices.includes(practice)
      ? selectedPractices.filter(p => p !== practice)
      : [...selectedPractices, practice];
    
    onChange(newSelection);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const displayText = selectedPractices.length === 0 
    ? placeholder 
    : selectedPractices.length === 1 
    ? selectedPractices[0] 
    : `${selectedPractices.length} practices selected`;

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? searchTerm : displayText}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer ${className}`}
        required={required && selectedPractices.length === 0}
        readOnly={!isOpen}
      />
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredPractices.length === 0 ? (
            <div className="p-3 text-center text-gray-500">
              No practices found
            </div>
          ) : (
            <>
              <div className="p-2 border-b border-gray-200">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onChange(practices)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              
              {filteredPractices.map(practice => (
                <label
                  key={practice}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPractices.includes(practice)}
                    onChange={() => handlePracticeToggle(practice)}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-900">{practice}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
      
      {selectedPractices.length > 0 && !isOpen && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedPractices.map(practice => (
            <span
              key={practice}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
            >
              {practice}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePracticeToggle(practice);
                }}
                className="hover:bg-blue-200 rounded-full p-0.5"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}