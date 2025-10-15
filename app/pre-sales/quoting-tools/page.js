'use client';

import { useRouter } from 'next/navigation';
import SidebarLayout from '../../../components/SidebarLayout';
import Breadcrumb from '../../../components/Breadcrumb';
import AccessCheck from '../../../components/AccessCheck';
import { useAuth } from '../../../hooks/useAuth';

export default function QuotingToolsPage() {
  const router = useRouter();
  const { user } = useAuth();

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
              <p className="text-gray-600">Professional quoting and estimation tools for pre-sales activities</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Quoting Tools Coming Soon</h3>
                <p className="text-gray-500">Advanced quoting and estimation tools are being developed to help streamline your pre-sales process.</p>
              </div>
            </div>
          </div>
        </div>
      </SidebarLayout>
    </AccessCheck>
  );
}