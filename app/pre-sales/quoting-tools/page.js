'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CalculatorIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import SidebarLayout from '../../../components/SidebarLayout';
import Breadcrumb from '../../../components/Breadcrumb';
import AccessCheck from '../../../components/AccessCheck';
import { useAuth } from '../../../hooks/useAuth';

const quotingTools = [
  {
    id: 'olympus',
    name: 'Olympus',
    description: 'Advanced quoting tool for complex project estimates',
    icon: CalculatorIcon,
    status: 'active',
    category: 'Primary Tools'
  }
];

export default function QuotingToolsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedTool, setSelectedTool] = useState(null);

  const handleToolSelect = (tool) => {
    setSelectedTool(tool);
    router.push(`/pre-sales/quoting-tools/${tool.id}`);
  };

  const breadcrumbItems = [
    { label: 'Pre-Sales', href: '/pre-sales' },
    { label: 'Quoting Tools', href: '/pre-sales/quoting-tools' }
  ];

  return (
    <AccessCheck>
      <SidebarLayout user={user}>
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <Breadcrumb items={breadcrumbItems} />
            
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Quoting Tools</h1>
              <p className="text-gray-600">Select a quoting tool to begin creating estimates and proposals</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {quotingTools.map((tool) => (
                <div
                  key={tool.id}
                  onClick={() => handleToolSelect(tool)}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <tool.icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{tool.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{tool.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {tool.status}
                    </span>
                    <span className="text-xs text-gray-500">{tool.category}</span>
                  </div>
                </div>
              ))}
            </div>

            {quotingTools.length === 0 && (
              <div className="text-center py-12">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No quoting tools available</h3>
                <p className="mt-1 text-sm text-gray-500">Contact your administrator to configure quoting tools.</p>
              </div>
            )}
          </div>
        </div>
      </SidebarLayout>
    </AccessCheck>
  );
}