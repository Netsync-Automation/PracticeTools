'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bars3Icon, XMarkIcon, PlusIcon, UserCircleIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { getRoleColor } from '../utils/roleColors';

function NavbarLogo() {
  const [logoSrc, setLogoSrc] = useState('/company-logo.png');
  
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('/api/settings/general');
        const data = await response.json();
        if (data.navbarLogo) {
          setLogoSrc(data.navbarLogo);
        }
      } catch (error) {
        console.error('Error loading navbar logo:', error);
      }
    };
    loadLogo();
  }, []);
  
  return (
    <img 
      src={logoSrc} 
      alt="Logo" 
      className="h-8 w-auto"
    />
  );
}

export default function Navbar({ user, onLogout }) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [version, setVersion] = useState('2.3.0');
  const [appName, setAppName] = useState('');

  const dropdownRef = useRef(null);

  // Load version from API
  useEffect(() => {
    const loadVersion = async () => {
      try {
        console.log('[NAVBAR-DEBUG] Fetching version from API...');
        const response = await fetch('/api/version');
        const data = await response.json();
        console.log('[NAVBAR-DEBUG] Version API response:', data);
        console.log('[NAVBAR-DEBUG] Version value:', data.version);
        console.log('[NAVBAR-DEBUG] Version type:', typeof data.version);
        console.log('[NAVBAR-DEBUG] Version length:', data.version?.length);
        setVersion(data.version);
      } catch (error) {
        console.error('[NAVBAR-DEBUG] Error loading version:', error);
      }
    };
    
    const processPendingReleases = async () => {
      try {
        console.log('Attempting to process pending releases...');
        const response = await fetch('/api/process-releases', { method: 'POST' });
        const data = await response.json();
        console.log('Process releases response:', data);
        if (data.success) {
          setTimeout(loadVersion, 1000);
        }
      } catch (error) {
        console.error('Error processing pending releases:', error);
      }
    };
    
    // Load application name from settings
    const loadAppName = async () => {
      try {
        const response = await fetch('/api/settings/general');
        if (response.ok) {
          const data = await response.json();
          setAppName(data.appName || '');
        }
      } catch (error) {
        console.error('Error loading app name:', error);
        setAppName('');
      }
    };
    
    loadVersion();
    loadAppName();
    setTimeout(processPendingReleases, 2000);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [profileDropdownOpen]);

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => router.push('/')}
                    className="flex items-center space-x-3 hover:opacity-80 transition-opacity duration-200"
                  >
                    <NavbarLogo />
                    <div className="text-left">
                      <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                        Netsync
                      </div>
                      <div className="text-xs text-blue-600 font-medium -mt-1">
                        {appName}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {version}
                    </span>
                    <Link
                      href="/release-notes"
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      What's new?
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    profileDropdownOpen 
                      ? 'text-blue-600 bg-blue-50' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <UserCircleIcon className="h-6 w-6" />
                  <span>{user?.name}</span>
                  <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${
                    profileDropdownOpen ? 'rotate-180' : ''
                  }`} />
                </button>
                
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 animate-in slide-in-from-top-2 duration-200">
                    <div className="py-1">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="font-medium text-gray-900">{user?.name}</div>
                        <div className="text-sm text-gray-500">{user?.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user?.role)}`}>
                            {user?.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'User'}
                          </span>
                          {user?.isAdmin && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                      {user?.auth_method === 'local' && (
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            router.push('/change-password');
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                        >
                          Change Password
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          router.push('/help');
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                      >
                        Help
                      </button>
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          router.push('/about');
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                      >
                        About
                      </button>
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          onLogout();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-600 hover:text-gray-900 p-2"
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <div className="px-3 py-2 border-t border-gray-100 mt-2">
                <div className="text-sm font-medium text-gray-900">{user?.name}</div>
                <div className="text-xs text-gray-500">{user?.email}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user?.role)}`}>
                    {user?.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'User'}
                  </span>
                  {user?.isAdmin && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                      Admin
                    </span>
                  )}
                </div>
              </div>
              {user?.auth_method === 'local' && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push('/change-password');
                  }}
                  className="block w-full text-left px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg"
                >
                  Change Password
                </button>
              )}
              <button
                onClick={onLogout}
                className="block w-full text-left px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}