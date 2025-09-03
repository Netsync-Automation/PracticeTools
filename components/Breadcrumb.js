'use client';

import { useRouter } from 'next/navigation';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';

export default function Breadcrumb({ items }) {
  const router = useRouter();

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
      >
        <HomeIcon className="h-4 w-4" />
        Home
      </button>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          <ChevronRightIcon className="h-4 w-4" />
          {item.href ? (
            <button
              onClick={() => router.push(item.href)}
              className="hover:text-blue-600 transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-gray-900 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}