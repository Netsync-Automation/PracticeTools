'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MultiAccountManagerSelector from './MultiAccountManagerSelector';
import MultiResourceSelector from './MultiResourceSelector';
import { PRACTICE_OPTIONS } from '../constants/practices';

export default function AssignResourceModal({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData = {}, 
  targetStatus = 'Assigned',
  saving = false,
  allUsers = []
}) {
  const [formData, setFormData] = useState({
    practice: [],
    am: [],
    region: '',
    saAssigned: [],
    dateAssigned: new Date().toISOString().split('T')[0],
    ...initialData
  });

  const [practiceError, setPracticeError] = useState('');

  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        practice: [],
        am: [],
        region: '',
        saAssigned: [],
        dateAssigned: new Date().toISOString().split('T')[0],
        ...initialData
      });
      setPracticeError('');
    }
  }, [isOpen, initialData]);

  // Auto-populate region when account managers are selected
  useEffect(() => {
    if (isOpen && !formData.region && formData.am && Array.isArray(formData.am) && formData.am.length > 0 && allUsers.length > 0) {
      const firstAM = allUsers.find(u => u.role === 'account_manager' && formData.am.includes(u.name));
      if (firstAM && firstAM.region) {
        setFormData(prev => ({...prev, region: firstAM.region}));
      }
    }
  }, [isOpen, formData.am, allUsers, formData.region]);

  const handleSave = async () => {
    const practices = Array.isArray(formData.practice) ? formData.practice : (formData.practice ? [formData.practice] : []);
    
    if (practices.length === 0) {
      setPracticeError('Please select at least one practice');
      return;
    }
    
    if (!formData.am || (Array.isArray(formData.am) && formData.am.length === 0)) {
      alert('Please select at least one account manager');
      return;
    }
    
    if (!formData.region) {
      alert('Please select a region');
      return;
    }
    
    if (targetStatus === 'Assigned' && (!formData.saAssigned || (Array.isArray(formData.saAssigned) && formData.saAssigned.length === 0))) {
      alert('Please assign at least one SA');
      return;
    }
    
    const updateData = {
      status: targetStatus,
      practice: practices.join(','),
      am: Array.isArray(formData.am) ? formData.am.join(',') : formData.am,
      region: formData.region
    };
    
    if (targetStatus === 'Assigned') {
      updateData.saAssigned = Array.isArray(formData.saAssigned) ? formData.saAssigned.join(',') : formData.saAssigned;
      updateData.dateAssigned = formData.dateAssigned;
    }
    
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
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Practice Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Practice Selection *
                </label>
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-2">
                    {PRACTICE_OPTIONS.filter(practice => practice !== 'Pending').map(practice => (
                      <label key={practice} className="flex items-center p-2 hover:bg-white rounded-lg transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Array.isArray(formData.practice) ? formData.practice.includes(practice) : formData.practice === practice}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const currentPractices = Array.isArray(formData.practice) ? formData.practice : (formData.practice ? [formData.practice] : []);
                              setFormData(prev => ({...prev, practice: [...currentPractices, practice]}));
                            } else {
                              const currentPractices = Array.isArray(formData.practice) ? formData.practice : (formData.practice ? [formData.practice] : []);
                              setFormData(prev => ({...prev, practice: currentPractices.filter(p => p !== practice)}));
                            }
                            setPracticeError('');
                          }}
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700 font-medium">{practice}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {practiceError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {practiceError}
                  </p>
                )}
              </div>

              {/* Account Manager Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Account Manager *
                </label>
                <MultiAccountManagerSelector
                  value={formData.am || []}
                  onChange={(managers) => setFormData(prev => ({...prev, am: managers}))}
                  placeholder="Select or type account manager names..."
                  required
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Region Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Region *
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData(prev => ({...prev, region: e.target.value}))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm font-medium"
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
              </div>

              {/* SA Assignment (only for Assigned status) */}
              {targetStatus === 'Assigned' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      SA Resources *
                    </label>
                    <MultiResourceSelector
                      value={formData.saAssigned || []}
                      onChange={(resources) => setFormData(prev => ({...prev, saAssigned: resources}))}
                      assignedPractices={Array.isArray(formData.practice) ? formData.practice : (formData.practice ? [formData.practice] : [])}
                      placeholder="Select or type SA names..."
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Date Assigned *
                    </label>
                    <input
                      type="date"
                      value={formData.dateAssigned}
                      onChange={(e) => setFormData(prev => ({...prev, dateAssigned: e.target.value}))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                      required
                    />
                  </div>
                </>
              )}
            </div>
          </div>
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
                disabled={saving || (Array.isArray(formData.practice) ? formData.practice.length === 0 : !formData.practice) || !formData.am || (Array.isArray(formData.am) && formData.am.length === 0) || !formData.region || (targetStatus === 'Assigned' && (!formData.saAssigned || (Array.isArray(formData.saAssigned) && formData.saAssigned.length === 0)))}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center gap-2"
              >
                {saving && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {saving ? 'Assigning...' : (targetStatus === 'Assigned' ? 'Assign Resource' : 'Assign to Practice')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}