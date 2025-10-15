'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeftIcon,
  CalculatorIcon,
  DocumentDuplicateIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import SidebarLayout from '../../../../components/SidebarLayout';
import Breadcrumb from '../../../../components/Breadcrumb';
import AccessCheck from '../../../../components/AccessCheck';
import OlympusQuoteWizard from '../../../../components/OlympusQuoteWizard';
import { useAuth } from '../../../../hooks/useAuth';

export default function OlympusPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('new-quote');
  const [showWizard, setShowWizard] = useState(false);

  const handleCreateQuote = () => {
    setShowWizard(true);
  };

  const handleWizardComplete = (quoteData) => {
    console.log('Quote data:', quoteData);
    setShowWizard(false);
    // TODO: Process quote data and navigate to quote builder
  };

  const handleWizardClose = () => {
    setShowWizard(false);
  };

  const breadcrumbItems = [
    { label: 'Pre-Sales', href: '/pre-sales' },
    { label: 'Quoting Tools', href: '/pre-sales/quoting-tools' },
    { label: 'Olympus', href: '/pre-sales/quoting-tools/olympus' }
  ];

  const tabs = [
    { id: 'new-quote', name: 'New Quote', icon: PlusIcon },
    { id: 'saved-quotes', name: 'Saved Quotes', icon: DocumentDuplicateIcon }
  ];

  return (
    <AccessCheck>
      <SidebarLayout user={user}>
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <Breadcrumb items={breadcrumbItems} />
            
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center">
                <button
                  onClick={() => router.back()}
                  className="mr-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div className="flex items-center">
                  <div className="p-3 bg-blue-50 rounded-lg mr-4">
                    <CalculatorIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Olympus Quoting Tool</h1>
                    <p className="text-gray-600">Advanced project estimation and proposal generation</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <tab.icon className="h-5 w-5 mr-2" />
                      {tab.name}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'new-quote' && (
                  <div className="space-y-6">
                    <div className="text-center py-12">
                      <CalculatorIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Create New Quote</h3>
                      <p className="text-gray-600 mb-6">Start building your project estimate with Olympus</p>
                      <button 
                        onClick={handleCreateQuote}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Start New Quote
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'saved-quotes' && (
                  <div className="space-y-6">
                    <div className="text-center py-12">
                      <DocumentDuplicateIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Saved Quotes</h3>
                      <p className="text-gray-600">Your saved quotes will appear here</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <OlympusQuoteWizard 
          isOpen={showWizard}
          onClose={handleWizardClose}
          onComplete={handleWizardComplete}
        />
      </SidebarLayout>
    </AccessCheck>
  );
}