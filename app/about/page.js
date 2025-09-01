'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Breadcrumb from '../../components/Breadcrumb';
import { useAuth } from '../../hooks/useAuth';

export default function AboutPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [version, setVersion] = useState('2.3.0');

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const response = await fetch('/api/version');
        const data = await response.json();
        setVersion(data.version);
      } catch (error) {
        console.error('Error loading version:', error);
      }
    };
    loadVersion();
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={logout} />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb items={[
          { label: 'About' }
        ]} />
        
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">About Netsync Issues Tracker</h1>
            <p className="text-lg text-gray-600">Streamlining issue management and collaboration</p>
          </div>

          <div className="space-y-8">
            {/* Mission */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
              <p className="text-gray-700 leading-relaxed">
                To provide organizations with a powerful, intuitive issue tracking system that enhances 
                collaboration, improves transparency, and accelerates problem resolution. We believe that 
                effective issue management is the foundation of successful project delivery and customer satisfaction.
              </p>
            </section>

            {/* What We Do */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What We Do</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Netsync Issues Tracker is a comprehensive issue management platform designed for modern teams. 
                Our solution combines traditional ticketing functionality with real-time collaboration features, 
                making it easier than ever to track, manage, and resolve issues efficiently.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">🎯 Issue Management</h3>
                  <p className="text-blue-800 text-sm">Complete lifecycle management from creation to resolution</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">🔄 Real-time Updates</h3>
                  <p className="text-green-800 text-sm">Instant notifications and live status updates</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-900 mb-2">💬 Team Collaboration</h3>
                  <p className="text-purple-800 text-sm">Integrated messaging and file sharing capabilities</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-orange-900 mb-2">📊 Analytics & Reporting</h3>
                  <p className="text-orange-800 text-sm">Comprehensive insights and performance metrics</p>
                </div>
              </div>
            </section>

            {/* Complete Feature Showcase */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Complete Feature Showcase</h2>
              <p className="text-gray-600 mb-8">Discover all the powerful features that make issue tracking effortless and efficient.</p>
              
              <div className="grid gap-8 md:grid-cols-2">
                {/* Issue Management Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-xl border border-blue-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-blue-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">📝</span>
                    </div>
                    <h3 className="text-xl font-bold text-blue-900">Smart Issue Management</h3>
                  </div>
                  <ul className="space-y-2 text-blue-800">
                    <li className="flex items-start"><span className="text-blue-600 mr-2 font-bold">•</span>AI-powered duplicate detection prevents redundant issues</li>
                    <li className="flex items-start"><span className="text-blue-600 mr-2 font-bold">•</span>Three issue types: Bug Reports, Feature Requests, Questions</li>
                    <li className="flex items-start"><span className="text-blue-600 mr-2 font-bold">•</span>Rich file attachments with drag-and-drop support</li>
                    <li className="flex items-start"><span className="text-blue-600 mr-2 font-bold">•</span>Sequential numbering for easy reference and tracking</li>
                    <li className="flex items-start"><span className="text-blue-600 mr-2 font-bold">•</span>Edit your own issues anytime after creation</li>
                  </ul>
                </div>

                {/* Workflow Card */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-xl border border-green-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-green-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">🔄</span>
                    </div>
                    <h3 className="text-xl font-bold text-green-900">Intelligent Workflow</h3>
                  </div>
                  <ul className="space-y-2 text-green-800">
                    <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">•</span>Guided status progression: Open → In Progress → Testing → Closed</li>
                    <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">•</span>Admin assignment required before status changes</li>
                    <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">•</span>Mandatory resolution comments ensure closure quality</li>
                    <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">•</span>Complete audit trail tracks every status change</li>
                    <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">•</span>Backlog and rejection options for comprehensive management</li>
                  </ul>
                </div>

                {/* Real-time Communication Card */}
                <div className="bg-gradient-to-br from-purple-50 to-violet-100 p-6 rounded-xl border border-purple-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-purple-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">💬</span>
                    </div>
                    <h3 className="text-xl font-bold text-purple-900">Live Collaboration</h3>
                  </div>
                  <ul className="space-y-2 text-purple-800">
                    <li className="flex items-start"><span className="text-purple-600 mr-2 font-bold">•</span>Real-time commenting with instant notifications</li>
                    <li className="flex items-start"><span className="text-purple-600 mr-2 font-bold">•</span>Paste screenshots directly from clipboard</li>
                    <li className="flex items-start"><span className="text-purple-600 mr-2 font-bold">•</span>Emoji picker for expressive communication</li>
                    <li className="flex items-start"><span className="text-purple-600 mr-2 font-bold">•</span>Admin comments highlighted for authority</li>
                    <li className="flex items-start"><span className="text-purple-600 mr-2 font-bold">•</span>Auto-scroll to new content keeps you updated</li>
                  </ul>
                </div>

                {/* Real-time Updates Card */}
                <div className="bg-gradient-to-br from-yellow-50 to-amber-100 p-6 rounded-xl border border-yellow-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-yellow-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">⚡</span>
                    </div>
                    <h3 className="text-xl font-bold text-yellow-900">Lightning-Fast Updates</h3>
                  </div>
                  <ul className="space-y-2 text-yellow-800">
                    <li className="flex items-start"><span className="text-yellow-600 mr-2 font-bold">•</span>Instant notifications for all issue activity</li>
                    <li className="flex items-start"><span className="text-yellow-600 mr-2 font-bold">•</span>Live upvote counts update in real-time</li>
                    <li className="flex items-start"><span className="text-yellow-600 mr-2 font-bold">•</span>Browser tab alerts when you're away</li>
                    <li className="flex items-start"><span className="text-yellow-600 mr-2 font-bold">•</span>Pleasant audio notifications for new activity</li>
                    <li className="flex items-start"><span className="text-yellow-600 mr-2 font-bold">•</span>Automatic reconnection ensures you never miss updates</li>
                  </ul>
                </div>

                {/* WebEx Integration Card */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-100 p-6 rounded-xl border border-cyan-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-cyan-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">📱</span>
                    </div>
                    <h3 className="text-xl font-bold text-cyan-900">WebEx Integration</h3>
                  </div>
                  <ul className="space-y-2 text-cyan-800">
                    <li className="flex items-start"><span className="text-cyan-600 mr-2 font-bold">•</span>Beautiful adaptive cards for new issues and updates</li>
                    <li className="flex items-start"><span className="text-cyan-600 mr-2 font-bold">•</span>Direct messages to issue creators on status changes</li>
                    <li className="flex items-start"><span className="text-cyan-600 mr-2 font-bold">•</span>Follower notifications keep everyone informed</li>
                    <li className="flex items-start"><span className="text-cyan-600 mr-2 font-bold">•</span>Rich cards with issue details and quick actions</li>
                    <li className="flex items-start"><span className="text-cyan-600 mr-2 font-bold">•</span>Automatic user synchronization</li>
                  </ul>
                </div>

                {/* User Experience Card */}
                <div className="bg-gradient-to-br from-rose-50 to-pink-100 p-6 rounded-xl border border-rose-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-rose-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">👤</span>
                    </div>
                    <h3 className="text-xl font-bold text-rose-900">Personalized Experience</h3>
                  </div>
                  <ul className="space-y-2 text-rose-800">
                    <li className="flex items-start"><span className="text-rose-600 mr-2 font-bold">•</span>Upvote issues you agree with or are experiencing</li>
                    <li className="flex items-start"><span className="text-rose-600 mr-2 font-bold">•</span>Follow issues to get notifications on updates</li>
                    <li className="flex items-start"><span className="text-rose-600 mr-2 font-bold">•</span>Auto-follow issues you create or comment on</li>
                    <li className="flex items-start"><span className="text-rose-600 mr-2 font-bold">•</span>Personal filters: My Issues, My Follows, My Upvotes</li>
                    <li className="flex items-start"><span className="text-rose-600 mr-2 font-bold">•</span>Choose between table and card view modes</li>
                  </ul>
                </div>

                {/* Search & Organization Card */}
                <div className="bg-gradient-to-br from-teal-50 to-cyan-100 p-6 rounded-xl border border-teal-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-teal-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">🔍</span>
                    </div>
                    <h3 className="text-xl font-bold text-teal-900">Powerful Search & Filters</h3>
                  </div>
                  <ul className="space-y-2 text-teal-800">
                    <li className="flex items-start"><span className="text-teal-600 mr-2 font-bold">•</span>Advanced search across titles, descriptions, and creators</li>
                    <li className="flex items-start"><span className="text-teal-600 mr-2 font-bold">•</span>Multi-criteria filtering by type, status, and assignment</li>
                    <li className="flex items-start"><span className="text-teal-600 mr-2 font-bold">•</span>Flexible sorting by date, upvotes, or relevance</li>
                    <li className="flex items-start"><span className="text-teal-600 mr-2 font-bold">•</span>Smart pagination for large issue collections</li>
                    <li className="flex items-start"><span className="text-teal-600 mr-2 font-bold">•</span>One-click clear buttons for easy filter reset</li>
                  </ul>
                </div>

                {/* Admin Dashboard Card */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-100 p-6 rounded-xl border border-indigo-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-indigo-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">⚙️</span>
                    </div>
                    <h3 className="text-xl font-bold text-indigo-900">Admin Command Center</h3>
                  </div>
                  <ul className="space-y-2 text-indigo-800">
                    <li className="flex items-start"><span className="text-indigo-600 mr-2 font-bold">•</span>Comprehensive dashboard with system analytics</li>
                    <li className="flex items-start"><span className="text-indigo-600 mr-2 font-bold">•</span>Dedicated assigned issues management interface</li>
                    <li className="flex items-start"><span className="text-indigo-600 mr-2 font-bold">•</span>Complete user management with role assignment</li>
                    <li className="flex items-start"><span className="text-indigo-600 mr-2 font-bold">•</span>System maintenance tools and issue renumbering</li>
                    <li className="flex items-start"><span className="text-indigo-600 mr-2 font-bold">•</span>Automated versioning and release notes generation</li>
                  </ul>
                </div>

                {/* Security Card */}
                <div className="bg-gradient-to-br from-gray-50 to-slate-100 p-6 rounded-xl border border-gray-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-gray-700 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">🔒</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Enterprise Security</h3>
                  </div>
                  <ul className="space-y-2 text-gray-800">
                    <li className="flex items-start"><span className="text-gray-600 mr-2 font-bold">•</span>SAML SSO integration for enterprise authentication</li>
                    <li className="flex items-start"><span className="text-gray-600 mr-2 font-bold">•</span>Local authentication option with encrypted passwords</li>
                    <li className="flex items-start"><span className="text-gray-600 mr-2 font-bold">•</span>Role-based access control with granular permissions</li>
                    <li className="flex items-start"><span className="text-gray-600 mr-2 font-bold">•</span>Secure file storage with access controls</li>
                    <li className="flex items-start"><span className="text-gray-600 mr-2 font-bold">•</span>CSRF protection and input validation</li>
                  </ul>
                </div>

                {/* Automation Card */}
                <div className="bg-gradient-to-br from-orange-50 to-red-100 p-6 rounded-xl border border-orange-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-orange-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">🤖</span>
                    </div>
                    <h3 className="text-xl font-bold text-orange-900">Smart Automation</h3>
                  </div>
                  <ul className="space-y-2 text-orange-800">
                    <li className="flex items-start"><span className="text-orange-600 mr-2 font-bold">•</span>Automated semantic versioning based on changes</li>
                    <li className="flex items-start"><span className="text-orange-600 mr-2 font-bold">•</span>Dynamic release notes generation</li>
                    <li className="flex items-start"><span className="text-orange-600 mr-2 font-bold">•</span>Auto-generated help documentation</li>
                    <li className="flex items-start"><span className="text-orange-600 mr-2 font-bold">•</span>Intelligent duplicate detection and merging</li>
                    <li className="flex items-start"><span className="text-orange-600 mr-2 font-bold">•</span>Automatic follow relationships for creators and commenters</li>
                  </ul>
                </div>

                {/* File Management Card */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-100 p-6 rounded-xl border border-emerald-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-emerald-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">📁</span>
                    </div>
                    <h3 className="text-xl font-bold text-emerald-900">Advanced File Management</h3>
                  </div>
                  <ul className="space-y-2 text-emerald-800">
                    <li className="flex items-start"><span className="text-emerald-600 mr-2 font-bold">•</span>Drag-and-drop file uploads with progress indicators</li>
                    <li className="flex items-start"><span className="text-emerald-600 mr-2 font-bold">•</span>Support for images, PDFs, documents, and archives</li>
                    <li className="flex items-start"><span className="text-emerald-600 mr-2 font-bold">•</span>Inline image previews and file download links</li>
                    <li className="flex items-start"><span className="text-emerald-600 mr-2 font-bold">•</span>Secure cloud storage with AWS S3 integration</li>
                    <li className="flex items-start"><span className="text-emerald-600 mr-2 font-bold">•</span>File validation and size limits for security</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Technology */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Technology Stack</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Built with modern, scalable technologies to ensure reliability, performance, and security:
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-gray-900">Frontend</h4>
                  <p className="text-sm text-gray-600 mt-1">Next.js, React, Tailwind CSS</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-gray-900">Backend</h4>
                  <p className="text-sm text-gray-600 mt-1">Node.js, AWS DynamoDB</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-gray-900">Infrastructure</h4>
                  <p className="text-sm text-gray-600 mt-1">AWS App Runner, S3</p>
                </div>
              </div>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get in Touch</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Have questions, feedback, or need support? We're here to help you make the most of your 
                issue tracking experience.
              </p>
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-2">Support</h4>
                    <p className="text-blue-800 text-sm">Create an issue in the system for technical support</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-2">Feedback</h4>
                    <p className="text-blue-800 text-sm">Use the feature request option to suggest improvements</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Version Info */}
            <section className="border-t pt-6">
              <div className="text-center text-sm text-gray-500">
                <p>© 2025 Netsync Issues Tracker. All rights reserved.</p>
                <p className="mt-1 flex items-center justify-center gap-2">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    v{version}
                  </span>
                  - Built with ❤️ for better issue management
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}