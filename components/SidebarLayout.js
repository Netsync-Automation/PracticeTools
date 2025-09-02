'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Bars3Icon, 
  XMarkIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  CogIcon,
  HomeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  MinusIcon,
  InformationCircleIcon,
  FolderIcon
} from '@heroicons/react/24/outline';

const menuItems = [
  {
    id: 'practice-information',
    name: 'Practice Information',
    href: '/practice-information',
    icon: InformationCircleIcon,
    description: 'View practice details and information'
  },
  {
    id: 'practice-issues',
    name: 'Practice Issues',
    href: '/practice-issues',
    icon: ClipboardDocumentListIcon,
    description: 'View and manage all practice issues',
    submenu: [
      {
        id: 'practice-leadership',
        name: 'Leadership View',
        href: '/practice-issues-leadership',
        description: 'Leadership view for practice management',
        leadershipOnly: true
      }
    ]
  },
  {
    id: 'projects',
    name: 'Projects',
    href: '/projects',
    icon: FolderIcon,
    description: 'Manage projects and resources',
    submenu: [
      {
        id: 'resource-assignments',
        name: 'Resource Assignments',
        href: '/projects/resource-assignments',
        description: 'Manage project resource assignments'
      }
    ]
  },
  {
    id: 'analytics',
    name: 'Analytics',
    href: '/analytics',
    icon: ChartBarIcon,
    description: 'View practice analytics and reports'
  },
  {
    id: 'admin-dashboard',
    name: 'Admin',
    href: '/admin',
    icon: CogIcon,
    description: 'Administrative tools and management',
    adminOnly: true,
    submenu: [
      {
        id: 'settings',
        name: 'Settings',
        href: '/admin/settings',
        description: 'Configure application settings'
      }
    ]
  }
];

export default function SidebarLayout({ children, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarExpandedMenus');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const router = useRouter();
  const pathname = usePathname();

  const filteredMenuItems = menuItems.filter(item => {
    if (item.adminOnly && !user?.isAdmin && user?.role !== 'practice_manager' && user?.role !== 'practice_principal') return false;
    if (item.leadershipOnly && !user?.isAdmin && user?.role !== 'practice_manager' && user?.role !== 'practice_principal') return false;
    return true;
  });

  // Auto-expand menus with accessible submenus on first load
  useEffect(() => {
    const saved = localStorage.getItem('sidebarExpandedMenus');
    if (!saved) {
      const autoExpanded = {};
      filteredMenuItems.forEach(item => {
        if (hasAccessToAnySubmenu(item)) {
          autoExpanded[item.id] = true;
        }
      });
      setExpandedMenus(autoExpanded);
    }
  }, [user]);

  // Save expanded state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarExpandedMenus', JSON.stringify(expandedMenus));
    }
  }, [expandedMenus]);

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  const hasAccessToSubmenu = (submenuItem) => {
    if (submenuItem.adminOnly && !user?.isAdmin) return false;
    if (submenuItem.leadershipOnly && !user?.isAdmin && user?.role !== 'practice_manager' && user?.role !== 'practice_principal') return false;
    return true;
  };

  const hasAccessToAnySubmenu = (menuItem) => {
    if (!menuItem.submenu) return false;
    return menuItem.submenu.some(hasAccessToSubmenu);
  };

  const expandAllMenus = () => {
    const allExpanded = {};
    filteredMenuItems.forEach(item => {
      if (hasAccessToAnySubmenu(item)) {
        allExpanded[item.id] = true;
      }
    });
    setExpandedMenus(allExpanded);
  };

  const collapseAllMenus = () => {
    setExpandedMenus({});
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={expandAllMenus}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Expand all menus"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
              <button
                onClick={collapseAllMenus}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Collapse all menus"
              >
                <MinusIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {/* Dashboard/Home */}
            <button
              onClick={() => router.push('/')}
              className={`
                w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                ${isActive('/') && pathname === '/' 
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm' 
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <HomeIcon className="h-5 w-5 mr-3 flex-shrink-0" />
              <div className="text-left">
                <div className="font-medium">Dashboard</div>
                <div className="text-xs text-gray-500 mt-0.5">Overview and quick access</div>
              </div>
            </button>

            {/* Menu Items */}
            {filteredMenuItems.map((item) => (
              <div key={item.id}>
                <div className="relative">
                  <button
                    onClick={() => router.push(item.href)}
                    className={`
                      w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 group
                      ${isActive(item.href) && !expandedMenus[item.id]
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm' 
                        : expandedMenus[item.id]
                        ? 'bg-gray-100 text-gray-800'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <item.icon className="h-5 w-5 mr-3 flex-shrink-0" />
                    <div className="text-left flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                    </div>
                  </button>
                  {item.submenu && hasAccessToAnySubmenu(item) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMenu(item.id);
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-200 transition-colors"
                    >
                      {expandedMenus[item.id] ? (
                        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                      )}
                    </button>
                  )}
                </div>
                
                {/* Submenu */}
                {item.submenu && expandedMenus[item.id] && (
                  <div className="mt-2 ml-6 border-l-2 border-gray-200 pl-4 space-y-1">
                    {item.submenu.filter(hasAccessToSubmenu).map((subItem) => (
                      <button
                        key={subItem.id}
                        onClick={() => router.push(subItem.href)}
                        className={`
                          w-full flex items-center px-3 py-2.5 text-sm rounded-md transition-all duration-200 group relative
                          ${isActive(subItem.href)
                            ? 'bg-blue-100 text-blue-800 shadow-sm border-l-3 border-blue-500'
                            : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                          }
                        `}
                      >
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-3 transition-colors ${
                            isActive(subItem.href) ? 'bg-blue-500' : 'bg-gray-300 group-hover:bg-blue-400'
                          }`}></div>
                          <div className="text-left">
                            <div className="font-medium text-sm">{subItem.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{subItem.description}</div>
                          </div>
                        </div>
                        {isActive(subItem.href) && (
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              Practice Management System
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Practice Tools</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}