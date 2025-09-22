'use client';

import { useState, useEffect, useRef } from 'react';
import { COUNTRY_CODES, validatePhoneNumber, normalizePhoneNumber, formatPhoneNumber } from '../lib/phone-utils.js';

export default function PhoneInput({ 
  value = '', 
  onChange, 
  placeholder = 'Phone number', 
  required = false,
  className = '',
  countryCode = 'US'
}) {
  const [selectedCountry, setSelectedCountry] = useState(countryCode);
  const [phoneValue, setPhoneValue] = useState('');
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Initialize phone value from prop - format for display if it's in E.164
    if (value) {
      if (value.startsWith('+')) {
        // It's already normalized, format for display
        const formatted = formatPhoneNumber(value, 'NATIONAL');
        setPhoneValue(formatted);
      } else {
        setPhoneValue(value);
      }
    }
  }, [value]);

  const handlePhoneChange = (e) => {
    const inputValue = e.target.value;
    setPhoneValue(inputValue);
    setError('');

    if (inputValue.trim()) {
      const validation = validatePhoneNumber(inputValue, selectedCountry);
      if (!validation.isValid) {
        setError(validation.error);
      } else {
        // Normalize and pass back to parent
        const normalized = normalizePhoneNumber(inputValue, selectedCountry);
        if (normalized) {
          onChange(normalized);
        } else {
          onChange(inputValue); // Pass raw value if normalization fails
        }
      }
    } else {
      onChange('');
    }
  };

  const handleCountryChange = (e) => {
    const newCountry = e.target.value;
    setSelectedCountry(newCountry);
    setError('');

    // Re-validate with new country if phone number exists
    if (phoneValue.trim()) {
      const validation = validatePhoneNumber(phoneValue, newCountry);
      if (!validation.isValid) {
        setError(validation.error);
      } else {
        const normalized = normalizePhoneNumber(phoneValue, newCountry);
        if (normalized) {
          onChange(normalized);
        } else {
          onChange(phoneValue); // Pass raw value if normalization fails
        }
      }
    }
  };

  const selectedCountryData = COUNTRY_CODES.find(c => c.code === selectedCountry);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-center flex items-center justify-center min-w-fit"
            style={{ width: `${(selectedCountryData?.callingCode?.length || 2) * 0.6 + 3}rem` }}
          >
            {selectedCountryData?.callingCode}
            <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isOpen ? "M19 15l-7-7-7 7" : "M19 9l-7 7-7-7"} />
            </svg>
          </button>
          {isOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[200px]">
              {COUNTRY_CODES.map(country => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => {
                    setSelectedCountry(country.code);
                    setIsOpen(false);
                    handleCountryChange({ target: { value: country.code } });
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between ${
                    selectedCountry === country.code ? 'bg-blue-50 text-blue-600' : ''
                  }`}
                >
                  <span>{country.callingCode} {country.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="tel"
          value={phoneValue}
          onChange={handlePhoneChange}
          placeholder={placeholder}
          required={required}
          className={`flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : ''} ${className}`}
        />
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}