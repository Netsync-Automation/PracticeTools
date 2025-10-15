'use client';

import { useState } from 'react';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const CUSTOMER_TYPES = [
  { value: 'public-sector', label: 'Public Sector' },
  { value: 'k12', label: 'K12' },
  { value: 'commercial', label: 'Commercial/Enterprise' }
];

const BILLING_TYPES = [
  { value: 'pre-paid', label: 'Pre-Paid' },
  { value: 'annual', label: 'Annual' }
];

const TERMS = [
  { value: '12', label: '12 Months' },
  { value: '36', label: '36 Months' },
  { value: '60', label: '60 Months' }
];

export default function OlympusQuoteWizard({ isOpen, onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    customerName: '',
    opportunityNumber: '',
    customerType: '',
    billingType: '',
    term: '',
    integrations: '',
    smallSites: '',
    mediumSites: '',
    largeSites: '',
    extraLargeSites: '',
    elementarySchools: '',
    middleSchools: '',
    highSchools: ''
  });

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = () => {
    const newErrors = {};
    
    if (currentStep === 1) {
      if (!formData.customerName.trim()) newErrors.customerName = 'Customer name is required';
      if (!formData.opportunityNumber.trim()) newErrors.opportunityNumber = 'Opportunity number is required';
      if (!formData.customerType) newErrors.customerType = 'Customer type is required';
      if (!formData.billingType) newErrors.billingType = 'Billing type is required';
      if (!formData.term) newErrors.term = 'Term is required';
    } else if (currentStep === 2) {
      if (!formData.integrations || formData.integrations === '') newErrors.integrations = 'Number of integrations is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    
    if (currentStep === 1) {
      setCurrentStep(2);
    } else {
      onComplete(formData);
    }
  };

  const prevStep = () => {
    setCurrentStep(1);
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return formData.customerName && formData.opportunityNumber && formData.customerType && formData.billingType && formData.term;
    }
    if (formData.customerType === 'public-sector' || formData.customerType === 'commercial') {
      return formData.integrations && formData.smallSites && formData.mediumSites && 
             formData.largeSites && formData.extraLargeSites;
    }
    if (formData.customerType === 'k12') {
      return formData.integrations && formData.elementarySchools && formData.middleSchools && 
             formData.highSchools;
    }
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
        
        <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] transform transition-all flex flex-col">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                New Olympus Quote
              </h3>
              <button onClick={onClose} className="text-white hover:text-gray-200 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mt-4 flex items-center space-x-4">
              {[1, 2].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    currentStep >= step 
                      ? 'bg-white text-blue-600 shadow-md' 
                      : 'bg-blue-500 text-white border-2 border-white border-opacity-50'
                  }`}>
                    {step}
                  </div>
                  {step < 2 && (
                    <div className={`w-12 h-0.5 mx-2 transition-all ${
                      currentStep > step ? 'bg-white' : 'bg-blue-400'
                    }`}></div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-2 text-blue-100 text-sm">
              Step {currentStep} of 2: {currentStep === 1 ? 'Basic Configuration' : 'Detailed Configuration'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {currentStep === 1 && (
              <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => updateFormData('customerName', e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      errors.customerName ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                    }`}
                    placeholder="Enter customer name"
                    required
                  />
                  {errors.customerName && <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Opportunity # <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.opportunityNumber}
                    onChange={(e) => updateFormData('opportunityNumber', e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      errors.opportunityNumber ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                    }`}
                    placeholder="Enter opportunity number"
                    required
                  />
                  {errors.opportunityNumber && <p className="mt-1 text-sm text-red-600">{errors.opportunityNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-4">
                    Customer Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid gap-3">
                    {CUSTOMER_TYPES.map((type) => (
                      <label key={type.value} className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-blue-50 ${
                        formData.customerType === type.value 
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : 'border-gray-200 hover:border-blue-300'
                      }`}>
                        <input
                          type="radio"
                          name="customerType"
                          value={type.value}
                          checked={formData.customerType === type.value}
                          onChange={(e) => updateFormData('customerType', e.target.value)}
                          className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                          required
                        />
                        <span className="ml-3 font-medium text-gray-800">{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-4">
                    Billing Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {BILLING_TYPES.map((type) => (
                      <label key={type.value} className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-blue-50 ${
                        formData.billingType === type.value 
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : 'border-gray-200 hover:border-blue-300'
                      }`}>
                        <input
                          type="radio"
                          name="billingType"
                          value={type.value}
                          checked={formData.billingType === type.value}
                          onChange={(e) => updateFormData('billingType', e.target.value)}
                          className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                          required
                        />
                        <span className="ml-3 font-medium text-gray-800">{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-4">
                    Term <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {TERMS.map((term) => (
                      <label key={term.value} className={`flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-blue-50 ${
                        formData.term === term.value 
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : 'border-gray-200 hover:border-blue-300'
                      }`}>
                        <input
                          type="radio"
                          name="term"
                          value={term.value}
                          checked={formData.term === term.value}
                          onChange={(e) => updateFormData('term', e.target.value)}
                          className="sr-only"
                          required
                        />
                        <span className="font-medium text-gray-800">{term.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (formData.customerType === 'public-sector' || formData.customerType === 'commercial') && (
              <div className="bg-white p-6 rounded-lg shadow-sm space-y-6">
                <h4 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                  {formData.customerType === 'public-sector' ? 'Public Sector Configuration' : 'Commercial/Enterprise Configuration'}
                </h4>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Number of Integrations <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.integrations}
                    onChange={(e) => updateFormData('integrations', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter number of integrations"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Number of Small Sites (0-200 Assets)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.smallSites}
                    onChange={(e) => updateFormData('smallSites', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter number of small sites"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Number of Medium Sites (201-500 Assets)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.mediumSites}
                    onChange={(e) => updateFormData('mediumSites', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter number of medium sites"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Number of Large Sites (501-1000 Assets)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.largeSites}
                    onChange={(e) => updateFormData('largeSites', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter number of large sites"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Number of Extra-Large Sites (1001+ Assets)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.extraLargeSites}
                    onChange={(e) => updateFormData('extraLargeSites', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter number of extra-large sites"
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && formData.customerType === 'k12' && (
              <div className="bg-white p-6 rounded-lg shadow-sm space-y-6">
                <h4 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">K12 Configuration</h4>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Number of Integrations <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.integrations}
                    onChange={(e) => updateFormData('integrations', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter number of integrations"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Number of Elementary Schools
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.elementarySchools}
                    onChange={(e) => updateFormData('elementarySchools', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter number of elementary schools"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Number of Middle Schools
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.middleSchools}
                    onChange={(e) => updateFormData('middleSchools', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter number of middle schools"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Number of High Schools
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.highSchools}
                    onChange={(e) => updateFormData('highSchools', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Enter number of high schools"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-6 bg-gray-50 border-t border-gray-200 rounded-b-xl">
            <button
              onClick={currentStep === 1 ? onClose : prevStep}
              className="flex items-center px-6 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
            >
              {currentStep === 1 ? (
                'Cancel'
              ) : (
                <>
                  <ChevronLeftIcon className="h-4 w-4 mr-2" />
                  Back
                </>
              )}
            </button>
            
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex items-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {currentStep === 2 ? 'Create Quote' : 'Continue'}
              {currentStep === 1 && <ChevronRightIcon className="h-4 w-4 ml-2" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}