'use client';

import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import SidebarLayout from '../../components/SidebarLayout';
import Breadcrumb from '../../components/Breadcrumb';
import { MagnifyingGlassIcon, ChevronRightIcon, QuestionMarkCircleIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';

export default function HelpPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [helpContent, setHelpContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchResults, setSearchResults] = useState([]);

  // Load dynamic help content
  useEffect(() => {
    const loadHelpContent = async () => {
      try {
        const response = await fetch('/api/help');
        const data = await response.json();
        setHelpContent(data);
        // Set first category as default
        const firstCategory = Object.keys(data.helpCategories)[0];
        setSelectedCategory(firstCategory);
      } catch (error) {
        console.error('Error loading help content:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      loadHelpContent();
    }
  }, [user]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery || !helpContent) {
      setSearchResults([]);
      return;
    }

    const results = [];
    Object.entries(helpContent.helpCategories).forEach(([categoryKey, category]) => {
      category.articles.forEach(article => {
        if (
          article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          category.title.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          results.push({
            ...article,
            categoryKey,
            categoryTitle: category.title,
            categoryIcon: category.icon
          });
        }
      });
    });

    // Also search FAQ
    helpContent.faqData.forEach((faq, index) => {
      if (
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        results.push({
          id: `faq-${index}`,
          title: faq.question,
          content: faq.answer,
          categoryKey: 'faq',
          categoryTitle: 'FAQ',
          categoryIcon: '❓'
        });
      }
    });

    setSearchResults(results);
  }, [searchQuery, helpContent]);

  const renderContent = (content) => {
    if (!content) return null;
    
    return content.split('\n').map((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('# ')) {
        return <h1 key={index} className="text-3xl font-bold text-gray-900 mb-6">{trimmedLine.substring(2)}</h1>;
      } else if (trimmedLine.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-semibold text-gray-900 mb-4 mt-8">{trimmedLine.substring(3)}</h2>;
      } else if (trimmedLine.startsWith('- **') && trimmedLine.includes('**:')) {
        const match = trimmedLine.match(/- \*\*(.+?)\*\*: (.+)/);
        if (match) {
          return (
            <div key={index} className="mb-3">
              <span className="font-semibold text-blue-700">{match[1]}</span>
              <span className="text-gray-700">: {match[2]}</span>
            </div>
          );
        }
      } else if (trimmedLine.startsWith('- ')) {
        return <li key={index} className="ml-6 mb-2 text-gray-700 list-disc">{trimmedLine.substring(2)}</li>;
      } else if (trimmedLine === '') {
        return <div key={index} className="mb-4"></div>;
      } else if (trimmedLine.match(/^\d+\./)) {
        return <li key={index} className="ml-6 mb-2 text-gray-700 list-decimal">{trimmedLine.replace(/^\d+\.\s*/, '')}</li>;
      } else {
        return <p key={index} className="text-gray-700 mb-3 leading-relaxed">{trimmedLine}</p>;
      }
    });
  };

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading help content...</p>
        </div>
      </div>
    );
  }

  if (!helpContent) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={logout} />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <QuestionMarkCircleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Help Content Unavailable</h1>
          <p className="text-gray-600">Unable to load help content. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={logout} />
      
      <SidebarLayout user={user}>
        <div className="p-8">
        <Breadcrumb items={[{ label: 'Help Center' }]} />
        
        {/* Header */}
        <div className="text-center mb-12">
          <BookOpenIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Help Center</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Find answers and learn how to use Practice Tools effectively
          </p>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <MagnifyingGlassIcon className="h-6 w-6 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search practice board guides, topics, and FAQ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            />
          </div>
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Search Results ({searchResults.length})
            </h2>
            {searchResults.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {searchResults.map((result, index) => (
                  <button
                    key={`${result.categoryKey}-${result.id}-${index}`}
                    onClick={() => {
                      if (result.categoryKey === 'faq') {
                        setSelectedCategory('faq');
                        setSelectedArticle(null);
                      } else {
                        setSelectedCategory(result.categoryKey);
                        setSelectedArticle(result.id);
                      }
                      setSearchQuery('');
                    }}
                    className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">{result.categoryIcon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2">{result.title}</h3>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{result.content}</p>
                        <span className="text-xs text-blue-600 font-medium">{result.categoryTitle}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No results found for "{searchQuery}"</p>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        {!searchQuery && (
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
                <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
                <nav className="space-y-2">
                  {Object.entries(helpContent.helpCategories).map(([key, category]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedCategory(key);
                        setSelectedArticle(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedCategory === key
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <span className="mr-3">{category.icon}</span>
                      {category.title}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setSelectedCategory('faq');
                      setSelectedArticle(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === 'faq'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <span className="mr-3">❓</span>
                    FAQ
                  </button>
                </nav>
              </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                {selectedArticle && selectedCategory !== 'faq' ? (
                  <div className="prose max-w-none">
                    {renderContent(helpContent.articleContent[selectedArticle])}
                  </div>
                ) : selectedCategory === 'faq' ? (
                  <div>
                    <div className="flex items-center mb-8">
                      <QuestionMarkCircleIcon className="h-8 w-8 text-blue-600 mr-3" />
                      <h2 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h2>
                    </div>
                    <div className="space-y-6">
                      {helpContent.faqData.map((faq, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-6">
                          <h3 className="font-semibold text-gray-900 mb-3">{faq.question}</h3>
                          <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedCategory && helpContent.helpCategories[selectedCategory] ? (
                  <div>
                    <div className="flex items-center mb-8">
                      <span className="text-4xl mr-4">{helpContent.helpCategories[selectedCategory].icon}</span>
                      <h2 className="text-3xl font-bold text-gray-900">{helpContent.helpCategories[selectedCategory].title}</h2>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      {helpContent.helpCategories[selectedCategory].articles.map((article) => (
                        <button
                          key={article.id}
                          onClick={() => setSelectedArticle(article.id)}
                          className="text-left p-6 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 mb-2">{article.title}</h3>
                              <p className="text-sm text-gray-600">{article.content}</p>
                            </div>
                            <ChevronRightIcon className="h-5 w-5 text-gray-400 ml-4 flex-shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BookOpenIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Category</h3>
                    <p className="text-gray-600">Choose a category from the sidebar to get started</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </SidebarLayout>
    </div>
  );
}