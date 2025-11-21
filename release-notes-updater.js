#!/usr/bin/env node

/**
 * Release Notes Page Updater
 * Updates the /release-notes page with industry standard format
 */

import { db } from './lib/dynamodb.js';
import { readFileSync } from 'fs';

export class ReleaseNotesUpdater {
  static async updateReleaseNotesPage(environment, newVersion, releaseNotes) {
    try {
      // Read the current page file to preserve its structure
      const pagePath = 'app/release-notes/page.js';
      const currentPageContent = readFileSync(pagePath, 'utf8');
      
      // The page loads releases dynamically from the API, so we don't need to modify it
      // Just return the current content as-is since releases are stored in the database
      return currentPageContent;
      
    } catch (error) {
      console.error('Error updating release notes page:', error);
      throw error;
    }
  }
  
  // This method is deprecated - page now loads releases dynamically from database
  static generateReleaseNotesPageContent(releases, environment) {
    const envTitle = environment === 'prod' ? 'Production' : 'Development';
    
    return `'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '../../components/SidebarLayout';
import Navbar from '../../components/Navbar';
import Breadcrumb from '../../components/Breadcrumb';

export default function ReleaseNotes() {
  const router = useRouter();
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [user, setUser] = useState(null);
  const [environment, setEnvironment] = useState('dev');

  useEffect(() => {
    fetchEnvironment();
    fetchReleases();
    fetchTimezone();
    checkUserSession();
  }, []);
  
  const fetchEnvironment = async () => {
    try {
      const response = await fetch('/api/environment');
      const data = await response.json();
      setEnvironment(data.environment);
    } catch (error) {
      console.error('Error fetching environment:', error);
    }
  };
  
  const checkUserSession = async () => {
    try {
      const response = await fetch('/api/auth/check-session');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };
  
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const fetchReleases = async () => {
    try {
      const response = await fetch('/api/releases');
      const data = await response.json();
      
      // Server already filtered releases by environment
      setReleases(data);
      if (data.length > 0) {
        setSelectedVersion(data[0]);
      }
    } catch (error) {
      console.error('Error fetching releases:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchTimezone = async () => {
    try {
      const response = await fetch('/api/timezone');
      const data = await response.json();
      if (data.timezone) {
        setTimezone(data.timezone);
      }
    } catch (error) {
      console.error('Error fetching timezone:', error);
      // Keep default timezone
    }
  };

  const formatReleaseNotes = (notes) => {
    if (!notes) return '';
    
    return notes
      .replace(/^# /gm, '')
      .replace(/^## (.*)/gm, '<h3 class="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">$1</h3>')
      .replace(/^### (.*)/gm, '<h4 class="text-lg font-medium text-gray-800 mb-2">$1</h4>')
      .replace(/^- (.*)/gm, '<li class="text-gray-700 mb-1">$1</li>')
      .replace(/\\n\\n/g, '</div><div class="mb-4">')
      .replace(/\\n/g, '<br/>');
  };

  const getVersionBadgeColor = (version) => {
    if (version.includes('-dev.')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (version.startsWith('1.')) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (version.startsWith('2.') || version.startsWith('3.')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    return 'bg-purple-100 text-purple-800 border-purple-200';
  };

  const getReleaseTypeIcon = (type) => {
    if (type?.includes('Major')) return '🚀';
    if (type?.includes('Feature')) return '✨';
    if (type?.includes('Bug Fix')) return '🐛';
    return '🔧';
  };
  
  const formatTimestampWithTimezone = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      
      // Get formatted time
      const timeString = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(date);
      
      // Get timezone abbreviation
      const timeZoneAbbr = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short'
      }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value || 'UTC';
      
      return \`\${timeString} (\${timeZoneAbbr})\`;
    } catch (error) {
      console.error('Timestamp formatting error:', error);
      return new Date(timestamp).toLocaleTimeString();
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50">
        <Navbar user={user} onLogout={handleLogout} />
        <SidebarLayout user={user}>
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </SidebarLayout>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <Navbar user={user} onLogout={handleLogout} />
      <SidebarLayout user={user}>
        <div className="container mx-auto px-4 py-6">
        <Breadcrumb 
          items={[
            { label: 'Release Notes', href: '/release-notes' }
          ]} 
        />
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              📋 {environment === 'prod' ? 'Production' : 'Development'} Release Notes
            </h1>
            <p className="text-blue-100 mt-1">
              Track all updates, features, and improvements
            </p>
          </div>
          
          <div className="flex h-[calc(100vh-200px)]">
            {/* Sidebar */}
            <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900 mb-2">Versions ({releases.length})</h2>
                <div className="text-sm text-gray-600">
                  Latest: {releases[0]?.version || 'None'}
                </div>
              </div>
              
              <div className="p-2">
                {releases.map((release) => (
                  <button
                    key={release.version}
                    onClick={() => setSelectedVersion(release)}
                    className={\`w-full text-left p-3 rounded-lg mb-2 transition-all duration-200 \${
                      selectedVersion?.version === release.version
                        ? 'bg-blue-100 border-2 border-blue-300 shadow-sm'
                        : 'bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }\`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={\`px-2 py-1 rounded-full text-xs font-medium border \${getVersionBadgeColor(release.version)}\`}>
                        {release.version}
                      </span>
                      <span className="text-lg">
                        {getReleaseTypeIcon(release.type)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      {release.type || 'Release'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(release.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                      {release.timestamp && (
                        <div className="text-xs text-gray-400 mt-1">
                          {formatTimestampWithTimezone(release.timestamp)}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
                
                {releases.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📝</div>
                    <div>No releases yet</div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
              {selectedVersion ? (
                <div className="p-6">
                  <div className="mb-6">
                    <div className="flex items-center gap-4 mb-4">
                      <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        {getReleaseTypeIcon(selectedVersion.type)}
                        Version {selectedVersion.version}
                      </h2>
                      <span className={\`px-3 py-1 rounded-full text-sm font-medium border \${getVersionBadgeColor(selectedVersion.version)}\`}>
                        {selectedVersion.type || 'Release'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-gray-600 mb-6">
                      <div className="flex items-center gap-2">
                        📅 Released: {new Date(selectedVersion.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                        {selectedVersion.timestamp && (
                          <span className="text-sm text-gray-500 ml-2">
                            at {formatTimestampWithTimezone(selectedVersion.timestamp)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="prose prose-lg max-w-none">
                    <div 
                      className="release-notes-content"
                      dangerouslySetInnerHTML={{ 
                        __html: formatReleaseNotes(selectedVersion.notes) 
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📋</div>
                    <div className="text-xl">Select a version to view release notes</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{\`
        .release-notes-content h3 {
          @apply text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2;
        }
        .release-notes-content h4 {
          @apply text-lg font-medium text-gray-800 mb-2;
        }
        .release-notes-content ul {
          @apply list-none space-y-1 mb-4;
        }
        .release-notes-content li {
          @apply text-gray-700 mb-1 pl-0;
        }
        .release-notes-content li:before {
          content: "•";
          @apply text-blue-500 font-bold mr-2;
        }
      \`}</style>
      </SidebarLayout>
    </div>
  );
}`;
  }
  
  // Deprecated: Kept for backward compatibility but not used
  // Page now loads releases dynamically from /api/releases
  
  static compareVersions(a, b) {
    const parseVersion = (v) => {
      const [base, dev] = v.split('-dev.');
      const [major, minor, patch] = base.split('.').map(Number);
      return { major, minor, patch, dev: dev ? parseInt(dev) : null };
    };
    
    const vA = parseVersion(a);
    const vB = parseVersion(b);
    
    if (vA.major !== vB.major) return vA.major - vB.major;
    if (vA.minor !== vB.minor) return vA.minor - vB.minor;
    if (vA.patch !== vB.patch) return vA.patch - vB.patch;
    
    if (vA.dev === null && vB.dev === null) return 0;
    if (vA.dev === null) return 1;
    if (vB.dev === null) return -1;
    
    return vA.dev - vB.dev;
  }
}