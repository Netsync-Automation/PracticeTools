'use client';

import { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function BoardSearch({ columns, onResultClick }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState([]);
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  // Search function
  const performSearch = (term) => {
    if (!term.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const searchResults = [];
    const lowerTerm = term.toLowerCase();

    columns.forEach(column => {
      // Search column titles
      if (column.title.toLowerCase().includes(lowerTerm)) {
        searchResults.push({
          type: 'column',
          id: column.id,
          title: column.title,
          match: 'Column Title',
          columnId: column.id
        });
      }

      // Search card titles and content
      column.cards.forEach(card => {
        const titleMatch = card.title.toLowerCase().includes(lowerTerm);
        const descriptionMatch = card.description?.toLowerCase().includes(lowerTerm);
        
        if (titleMatch || descriptionMatch) {
          searchResults.push({
            type: 'card',
            id: card.id,
            title: card.title,
            match: titleMatch ? 'Card Title' : 'Card Description',
            columnId: column.id,
            columnTitle: column.title,
            description: card.description
          });
        }
      });
    });

    setResults(searchResults);
    setShowResults(searchResults.length > 0);
  };

  // Handle search input
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    performSearch(value);
  };

  // Handle result click
  const handleResultClick = (result) => {
    setShowResults(false);
    setSearchTerm('');
    onResultClick(result);
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
    setResults([]);
    setShowResults(false);
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Highlight matching text
  const highlightMatch = (text, searchTerm) => {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div ref={searchRef} className="relative">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search columns and cards..."
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => searchTerm && setShowResults(results.length > 0)}
          className="block w-full pl-12 pr-12 py-4 border border-gray-300 rounded-xl text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm hover:shadow-md transition-all duration-200"
        />
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div 
          ref={resultsRef}
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-96 overflow-y-auto"
        >
          <div className="p-2">
            <div className="text-sm font-medium text-gray-600 px-4 py-3 border-b border-gray-100 bg-gray-50">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </div>
            
            {results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}-${index}`}
                onClick={() => handleResultClick(result)}
                className="w-full text-left px-4 py-4 hover:bg-blue-50 rounded-lg transition-colors border-b border-gray-100 last:border-b-0 group"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white mt-0.5 ${
                    result.type === 'column' ? 'bg-blue-500 group-hover:bg-blue-600' : 'bg-green-500 group-hover:bg-green-600'
                  }`}>
                    {result.type === 'column' ? 'C' : 'T'}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-base font-semibold text-gray-900 truncate">
                        {highlightMatch(result.title, searchTerm)}
                      </span>
                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                        result.type === 'column' 
                          ? 'bg-blue-100 text-blue-700 group-hover:bg-blue-200' 
                          : 'bg-green-100 text-green-700 group-hover:bg-green-200'
                      }`}>
                        {result.match}
                      </span>
                    </div>
                    
                    {result.type === 'card' && (
                      <div className="text-sm text-gray-500">
                        in <span className="font-semibold text-gray-700">{result.columnTitle}</span>
                        {result.description && result.match === 'Card Description' && (
                          <div className="mt-2 text-gray-600 text-sm leading-relaxed" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {highlightMatch(
                              result.description.length > 120 
                                ? result.description.substring(0, 120) + '...' 
                                : result.description, 
                              searchTerm
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Arrow */}
                  <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-500 mt-1 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}