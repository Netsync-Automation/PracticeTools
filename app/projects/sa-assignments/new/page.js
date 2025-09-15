'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SidebarLayout from '../../../../components/SidebarLayout';
import AccessCheck from '../../../../components/AccessCheck';
import Breadcrumb from '../../../../components/Breadcrumb';
import PracticeSelector from '../../../../components/PracticeSelector';
import MultiResourceSelector from '../../../../components/MultiResourceSelector';
import RegionSelector from '../../../../components/RegionSelector';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';

export default function NewSaAssignmentPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    practice: 'Pending',
    status: 'Pending',
    projectNumber: '',
    requestDate: new Date().toISOString().split('T')[0],
    eta: '',
    customerName: '',
    projectDescription: '',
    region: '',
    am: '',
    pm: '',
    saAssigned: '',
    dateAssigned: '',
    notes: ''
  });
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check-session');
        if (response.ok) {
          const sessionData = await response.json();
          if (sessionData.user) {
            setUser(sessionData.user);
            localStorage.setItem('user', JSON.stringify(sessionData.user));
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
      
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
        setLoading(false);
        return;
      }
      
      router.push('/login');
    };
    
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('user');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('user');
      router.push('/login');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const submitData = new FormData();
      
      Object.keys(formData).forEach(key => {
        if (key === 'practice' && Array.isArray(formData[key])) {
          submitData.append(key, formData[key].join(','));
        } else if (key === 'saAssigned' && Array.isArray(formData[key])) {
          submitData.append(key, formData[key].join(','));
        } else {
          submitData.append(key, formData[key]);
        }
      });

      attachments.forEach(file => {
        submitData.append('attachments', file);
      });

      const response = await fetch('/api/sa-assignments', {
        method: 'POST',
        body: submitData
      });

      const result = await response.json();

      if (result.success) {
        router.push('/projects/sa-assignments');
      } else {
        alert('Failed to create SA assignment: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating SA assignment:', error);
      alert('Error creating SA assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AccessCheck user={user}>
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={handleLogout} />
        
        <SidebarLayout user={user}>
          <div className="p-8">
            <Breadcrumb items={[
              { label: 'Projects', href: '/projects' },
              { label: 'SA Assignments', href: '/projects/sa-assignments' },
              { label: 'New SA Assignment' }
            ]} />
            
            <div className="mb-8 text-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-3">
                New SA Assignment
              </h1>
              <p className="text-blue-600/80 text-lg">Create a new SA assignment request</p>
            </div>

            <form onSubmit={handleSubmit} className="card max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Practice *
                  </label>
                  <PracticeSelector
                    value={formData.practice}
                    onChange={(practice) => setFormData({...formData, practice})}
                    placeholder="Select practice..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="input-field"
                    required
                  >
                    <option value="Pending">Pending</option>
                    <option value="Unassigned">Unassigned</option>
                    <option value="Assigned">Assigned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Number *
                  </label>
                  <input
                    type="text"
                    value={formData.projectNumber}
                    onChange={(e) => setFormData({...formData, projectNumber: e.target.value})}
                    className="input-field"
                    placeholder="Enter project number"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Request Date *
                  </label>
                  <input
                    type="date"
                    value={formData.requestDate}
                    onChange={(e) => setFormData({...formData, requestDate: e.target.value})}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="input-field"
                    placeholder="Enter customer name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Region
                  </label>
                  <RegionSelector
                    value={formData.region}
                    onChange={(region) => setFormData({...formData, region})}
                    placeholder="Select region..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Manager
                  </label>
                  <input
                    type="text"
                    value={formData.am}
                    onChange={(e) => setFormData({...formData, am: e.target.value})}
                    className="input-field"
                    placeholder="Enter account manager name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Manager
                  </label>
                  <input
                    type="text"
                    value={formData.pm}
                    onChange={(e) => setFormData({...formData, pm: e.target.value})}
                    className="input-field"
                    placeholder="Enter project manager name"
                  />
                </div>

                {formData.status === 'Assigned' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SA Assigned
                      </label>
                      <MultiResourceSelector
                        value={formData.saAssigned}
                        onChange={(sas) => setFormData({...formData, saAssigned: sas})}
                        assignedPractices={Array.isArray(formData.practice) ? formData.practice : (formData.practice ? [formData.practice] : [])}
                        placeholder="Select or type SA name..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date Assigned
                      </label>
                      <input
                        type="date"
                        value={formData.dateAssigned}
                        onChange={(e) => setFormData({...formData, dateAssigned: e.target.value})}
                        className="input-field"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Description *
                </label>
                <textarea
                  value={formData.projectDescription}
                  onChange={(e) => setFormData({...formData, projectDescription: e.target.value})}
                  className="input-field"
                  rows="4"
                  placeholder="Describe the project and SA requirements..."
                  required
                />
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="input-field"
                  rows="3"
                  placeholder="Additional notes or requirements..."
                />
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attachments
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="input-field"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.xls"
                />
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => router.push('/projects/sa-assignments')}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 ${saving ? 'btn-disabled' : 'btn-primary'}`}
                >
                  {saving ? 'Creating...' : 'Create SA Assignment'}
                </button>
              </div>
            </form>
          </div>
        </SidebarLayout>
      </div>
    </AccessCheck>
  );
}