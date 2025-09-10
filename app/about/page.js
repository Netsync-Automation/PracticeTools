'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import SidebarLayout from '../../components/SidebarLayout';
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
      
      <SidebarLayout user={user}>
        <div className="p-8">
        <Breadcrumb items={[
          { label: 'About' }
        ]} />
        
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">About Practice Tools</h1>
            <p className="text-lg text-gray-600">Empowering practice teams with collaborative information management</p>
          </div>

          <div className="space-y-8">
            {/* Mission */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
              <p className="text-gray-700 leading-relaxed">
                To provide practice teams with an intuitive, collaborative platform for organizing and managing 
                practice-specific information. We believe that effective information management and team collaboration 
                are essential for practice success and operational excellence.
              </p>
            </section>

            {/* What We Do */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What We Do</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Practice Tools is a collaborative information management platform designed for practice teams. 
                Our solution provides Kanban-style boards with real-time collaboration features, 
                making it easier than ever to organize, track, and manage practice information efficiently.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">📋 Practice Boards</h3>
                  <p className="text-blue-800 text-sm">Kanban-style boards for organizing practice information</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">🔄 Real-time Updates</h3>
                  <p className="text-green-800 text-sm">Live collaboration with instant synchronization</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-900 mb-2">💬 Team Collaboration</h3>
                  <p className="text-purple-800 text-sm">Comments, attachments, and team communication</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="font-semibent text-orange-900 mb-2">🏷️ Topic Organization</h3>
                  <p className="text-orange-800 text-sm">Multiple topics per practice for better organization</p>
                </div>
              </div>
            </section>

            {/* Complete Feature Showcase */}
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Complete Feature Showcase</h2>
              <p className="text-gray-600 mb-8">Discover all the powerful features that make practice information management effortless and efficient.</p>
              
              <div className="grid gap-8 md:grid-cols-2">
                {/* Issue Management Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-xl border border-blue-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-blue-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">📋</span>
                    </div>
                    <h3 className="text-xl font-bold text-blue-900">Practice Board Management</h3>
                  </div>
                  <ul className="space-y-2 text-blue-800">
                    <li className="flex items-start"><span className="text-blue-600 mr-2 font-bold">•</span>Kanban-style boards with customizable columns</li>
                    <li className="flex items-start"><span className="text-blue-600 mr-2 font-bold">•</span>Drag-and-drop cards between columns</li>
                    <li className="flex items-start"><span className="text-blue-600 mr-2 font-bold">•</span>Rich card descriptions with file attachments</li>
                    <li className="flex items-start"><span className="text-blue-600 mr-2 font-bold">•</span>Practice-specific boards for different teams</li>
                    <li className="flex items-start"><span className="text-blue-600 mr-2 font-bold">•</span>Custom backgrounds and visual themes</li>
                  </ul>
                </div>

                {/* Workflow Card */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-xl border border-green-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-green-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">🏷️</span>
                    </div>
                    <h3 className="text-xl font-bold text-green-900">Topic Organization</h3>
                  </div>
                  <ul className="space-y-2 text-green-800">
                    <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">•</span>Multiple topics per practice board for organization</li>
                    <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">•</span>Protected Main Topic with additional custom topics</li>
                    <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">•</span>Topic-specific content with shared settings</li>
                    <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">•</span>User preferences remember last selected topic</li>
                    <li className="flex items-start"><span className="text-green-600 mr-2 font-bold">•</span>Easy topic creation, renaming, and deletion</li>
                  </ul>
                </div>

                {/* Real-time Communication Card */}
                <div className="bg-gradient-to-br from-purple-50 to-violet-100 p-6 rounded-xl border border-purple-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-purple-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">💬</span>
                    </div>
                    <h3 className="text-xl font-bold text-purple-900">Team Collaboration</h3>
                  </div>
                  <ul className="space-y-2 text-purple-800">
                    <li className="flex items-start"><span className="text-purple-600 mr-2 font-bold">•</span>Real-time commenting on cards</li>
                    <li className="flex items-start"><span className="text-purple-600 mr-2 font-bold">•</span>File attachments with drag-and-drop support</li>
                    <li className="flex items-start"><span className="text-purple-600 mr-2 font-bold">•</span>Live updates across all connected users</li>
                    <li className="flex items-start"><span className="text-purple-600 mr-2 font-bold">•</span>Role-based permissions for editing and viewing</li>
                    <li className="flex items-start"><span className="text-purple-600 mr-2 font-bold">•</span>Practice-specific access control</li>
                  </ul>
                </div>

                {/* Real-time Updates Card */}
                <div className="bg-gradient-to-br from-yellow-50 to-amber-100 p-6 rounded-xl border border-yellow-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-yellow-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">⚡</span>
                    </div>
                    <h3 className="text-xl font-bold text-yellow-900">Real-Time Synchronization</h3>
                  </div>
                  <ul className="space-y-2 text-yellow-800">
                    <li className="flex items-start"><span className="text-yellow-600 mr-2 font-bold">•</span>Instant updates across all connected users</li>
                    <li className="flex items-start"><span className="text-yellow-600 mr-2 font-bold">•</span>Live board changes with Server-Sent Events</li>
                    <li className="flex items-start"><span className="text-yellow-600 mr-2 font-bold">•</span>Automatic reconnection for reliability</li>
                    <li className="flex items-start"><span className="text-yellow-600 mr-2 font-bold">•</span>Seamless collaboration without page refreshes</li>
                    <li className="flex items-start"><span className="text-yellow-600 mr-2 font-bold">•</span>Conflict-free concurrent editing</li>
                  </ul>
                </div>

                {/* WebEx Integration Card */}
                <div className="bg-gradient-to-br from-cyan-50 to-blue-100 p-6 rounded-xl border border-cyan-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-cyan-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">🎨</span>
                    </div>
                    <h3 className="text-xl font-bold text-cyan-900">Customization</h3>
                  </div>
                  <ul className="space-y-2 text-cyan-800">
                    <li className="flex items-start"><span className="text-cyan-600 mr-2 font-bold">•</span>Custom board backgrounds and themes</li>
                    <li className="flex items-start"><span className="text-cyan-600 mr-2 font-bold">•</span>Predefined gradient backgrounds</li>
                    <li className="flex items-start"><span className="text-cyan-600 mr-2 font-bold">•</span>Upload custom background images</li>
                    <li className="flex items-start"><span className="text-cyan-600 mr-2 font-bold">•</span>Practice-specific visual identity</li>
                    <li className="flex items-start"><span className="text-cyan-600 mr-2 font-bold">•</span>Persistent settings across sessions</li>
                  </ul>
                </div>

                {/* User Experience Card */}
                <div className="bg-gradient-to-br from-rose-50 to-pink-100 p-6 rounded-xl border border-rose-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-rose-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">👤</span>
                    </div>
                    <h3 className="text-xl font-bold text-rose-900">User Experience</h3>
                  </div>
                  <ul className="space-y-2 text-rose-800">
                    <li className="flex items-start"><span className="text-rose-600 mr-2 font-bold">•</span>Personalized topic preferences per practice</li>
                    <li className="flex items-start"><span className="text-rose-600 mr-2 font-bold">•</span>Intuitive drag-and-drop interface</li>
                    <li className="flex items-start"><span className="text-rose-600 mr-2 font-bold">•</span>Responsive design for all devices</li>
                    <li className="flex items-start"><span className="text-rose-600 mr-2 font-bold">•</span>Quick card creation and editing</li>
                    <li className="flex items-start"><span className="text-rose-600 mr-2 font-bold">•</span>Seamless practice board switching</li>
                  </ul>
                </div>

                {/* Search & Organization Card */}
                <div className="bg-gradient-to-br from-teal-50 to-cyan-100 p-6 rounded-xl border border-teal-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-teal-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">🔧</span>
                    </div>
                    <h3 className="text-xl font-bold text-teal-900">Board Management</h3>
                  </div>
                  <ul className="space-y-2 text-teal-800">
                    <li className="flex items-start"><span className="text-teal-600 mr-2 font-bold">•</span>Create and customize columns for workflow</li>
                    <li className="flex items-start"><span className="text-teal-600 mr-2 font-bold">•</span>Rename and delete columns as needed</li>
                    <li className="flex items-start"><span className="text-teal-600 mr-2 font-bold">•</span>Add detailed cards with descriptions</li>
                    <li className="flex items-start"><span className="text-teal-600 mr-2 font-bold">•</span>Move cards between columns with drag-and-drop</li>
                    <li className="flex items-start"><span className="text-teal-600 mr-2 font-bold">•</span>Track card creation dates and authors</li>
                  </ul>
                </div>

                {/* Admin Dashboard Card */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-100 p-6 rounded-xl border border-indigo-200">
                  <div className="flex items-center mb-4">
                    <div className="bg-indigo-600 p-3 rounded-lg mr-4">
                      <span className="text-white text-2xl">⚙️</span>
                    </div>
                    <h3 className="text-xl font-bold text-indigo-900">Administration</h3>
                  </div>
                  <ul className="space-y-2 text-indigo-800">
                    <li className="flex items-start"><span className="text-indigo-600 mr-2 font-bold">•</span>User management with role-based permissions</li>
                    <li className="flex items-start"><span className="text-indigo-600 mr-2 font-bold">•</span>Practice board creation and management</li>
                    <li className="flex items-start"><span className="text-indigo-600 mr-2 font-bold">•</span>Practice assignment and access control</li>
                    <li className="flex items-start"><span className="text-indigo-600 mr-2 font-bold">•</span>System settings and configuration</li>
                    <li className="flex items-start"><span className="text-indigo-600 mr-2 font-bold">•</span>Automated practice board initialization</li>
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
                      <span className="text-white text-2xl">🔐</span>
                    </div>
                    <h3 className="text-xl font-bold text-orange-900">Access Control</h3>
                  </div>
                  <ul className="space-y-2 text-orange-800">
                    <li className="flex items-start"><span className="text-orange-600 mr-2 font-bold">•</span>Role-based permissions (Admin, Manager, Principal, Member)</li>
                    <li className="flex items-start"><span className="text-orange-600 mr-2 font-bold">•</span>Practice-specific access control</li>
                    <li className="flex items-start"><span className="text-orange-600 mr-2 font-bold">•</span>Granular editing and viewing permissions</li>
                    <li className="flex items-start"><span className="text-orange-600 mr-2 font-bold">•</span>Secure authentication and session management</li>
                    <li className="flex items-start"><span className="text-orange-600 mr-2 font-bold">•</span>Protected Main Topic prevents accidental changes</li>
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
                practice information management experience.
              </p>
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-2">Support</h4>
                    <p className="text-blue-800 text-sm">Contact your system administrator for technical support</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-2">Feedback</h4>
                    <p className="text-blue-800 text-sm">Share suggestions with your practice manager or admin</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Version Info */}
            <section className="border-t pt-6">
              <div className="text-center text-sm text-gray-500">
                <p>© 2025 Practice Tools. All rights reserved.</p>
                <p className="mt-1 flex items-center justify-center gap-2">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    v{version}
                  </span>
                  - Built with ❤️ for better practice collaboration
                </p>
              </div>
            </section>
          </div>
        </div>
        </div>
      </SidebarLayout>
    </div>
  );
}