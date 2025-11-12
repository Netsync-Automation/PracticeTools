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
  FolderIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { useApp } from '../contexts/AppContext';
import GlobalChatNPT from './GlobalChatNPT';

const menuItems = [
  {
    id: 'practice-information',
    name: 'Practice Information',
    icon: InformationCircleIcon,
    description: 'Practice information and tools',
    submenu: [
      {
        id: 'practice-boards',
        name: 'Practice Boards',
        href: '/practice-information',
        description: 'Manage practice boards and workflows'
      },
      {
        id: 'contact-information',
        name: 'Contact Information',
        href: '/contact-information',
        description: 'View practice contact information'
      },
      {
        id: 'training-certs',
        name: 'Training & Certs',
        href: '/practice-information/training-certs',
        description: 'Manage training and certifications'
      }
    ]
  },
  {
    id: 'practice-issues',
    name: 'Practice Issues',
    icon: ClipboardDocumentListIcon,
    description: 'View and manage all practice issues',
    submenu: [
      {
        id: 'practice-issues-main',
        name: 'Practice Issues',
        href: '/practice-issues',
        description: 'View and manage all practice issues'
      },
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
    id: 'pre-sales',
    name: 'Pre-Sales',
    icon: ChartBarIcon,
    description: 'Manage pre-sales activities and assignments',
    submenu: [
      {
        id: 'sa-to-am-mapping',
        name: 'SA to AM Mapping',
        href: '/pre-sales/sa-to-am-mapping',
        description: 'Manage SA to AM mapping relationships'
      },
      {
        id: 'sa-assignments',
        name: 'SA Assignments',
        href: '/projects/sa-assignments',
        description: 'Manage SA assignments and allocations'
      },
      {
        id: 'quoting-tools',
        name: 'Quoting Tools',
        href: '/pre-sales/quoting-tools',
        description: 'Manage quoting tools and processes'
      }
    ]
  },
  {
    id: 'projects',
    name: 'Post-Sales',
    href: '/projects',
    icon: FolderIcon,
    description: 'Manage post-sales activities and resources',
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
    id: 'leadership',
    name: 'Leadership',
    icon: ChartBarIcon,
    description: 'Leadership tools and management',
    leadershipOnly: true,
    submenu: [
      {
        id: 'analytics',
        name: 'Analytics',
        href: '/leadership/analytics',
        description: 'View analytics and insights'
      }
    ]
  },
  {
    id: 'company-education',
    name: 'Company Education',
    icon: AcademicCapIcon,
    description: 'Training and educational resources',
    submenu: [
      {
        id: 'webex-recordings',
        name: 'WebEx Recordings',
        href: '/company-education/webex-recordings',
        description: 'WebEx meeting recordings and transcripts'
      },
      {
        id: 'webex-messages',
        name: 'WebEx Messages',
        href: '/company-education/webex-messages',
        description: 'WebEx messages from monitored rooms'
      },
      {
        id: 'documentation',
        name: 'Documentation',
        href: '/company-education/documentation',
        description: 'Training documentation and resources'
      }
    ]
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
        href: '/admin/settings/general-settings',
        description: 'Configure application settings'
      }
    ]
  }
];

export default function SidebarLayout({ children, user }) {
  const { appName } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved === 'true';
    }
    return false;
  });
  const [expandedMenus, setExpandedMenus] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarExpandedMenus');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    // Default to all submenus expanded
    const defaultExpanded = {};
    menuItems.forEach(item => {
      if (item.submenu) {
        defaultExpanded[item.id] = true;
      }
    });
    return defaultExpanded;
  });
  const router = useRouter();
  const pathname = usePathname();

  const filteredMenuItems = menuItems.filter(item => {
    if (item.adminOnly && !user?.isAdmin && user?.role !== 'practice_manager' && user?.role !== 'practice_principal') return false;
    if (item.leadershipOnly && !user?.isAdmin && user?.role !== 'executive' && user?.role !== 'practice_manager' && user?.role !== 'practice_principal') return false;
    return true;
  });

  // Initialize expanded menus for new users
  useEffect(() => {
    if (user && filteredMenuItems.length > 0) {
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
    }
  }, [user, filteredMenuItems.length]);

  // Save expanded state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarExpandedMenus', JSON.stringify(expandedMenus));
    }
  }, [expandedMenus]);

  // Save collapsed state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
    }
  }, [isCollapsed]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    if (!isCollapsed) {
      setExpandedMenus({}); // Collapse all menus when sidebar collapses
    }
  };

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const isExactActive = (href) => {
    return pathname === href;
  };

  const isParentActive = (item) => {
    if (!item.submenu) return isActive(item.href);
    // Check if any submenu item is active
    return item.submenu.some(subItem => isActive(subItem.href));
  };

  const shouldHighlightParent = (item) => {
    if (!item.submenu) return isActive(item.href);
    // Only highlight parent if no submenu is expanded and parent href matches
    if (expandedMenus[item.id]) return false;
    // Check if current path matches parent href but not any submenu item
    if (!item.href) return false;
    const matchesParent = isActive(item.href);
    const matchesSubmenu = item.submenu.some(subItem => isActive(subItem.href));
    return matchesParent && !matchesSubmenu;
  };

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  const hasAccessToSubmenu = (submenuItem) => {
    if (submenuItem.adminOnly && !user?.isAdmin) return false;
    if (submenuItem.leadershipOnly && !user?.isAdmin && user?.role !== 'executive' && user?.role !== 'practice_manager' && user?.role !== 'practice_principal') return false;
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
    <div className="flex min-h-screen bg-gray-50">
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
        fixed inset-y-0 left-0 z-50 bg-white shadow-xl transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 border-r border-gray-200 flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed ? 'w-16 min-w-16' : 'w-64 min-w-64'}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between h-16 px-4">
              {!isCollapsed && (
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3">
                    <HomeIcon className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">{appName || 'Practice Tools'}</h2>
                </div>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-white/60 transition-all duration-200 shadow-sm"
                  title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <Bars3Icon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-white/60 transition-all"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            {!isCollapsed && (
              <div className="flex items-center justify-center gap-2 pb-3">
                <button
                  onClick={expandAllMenus}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-white/60 rounded-lg transition-all duration-200"
                  title="Expand all menus"
                >
                  <PlusIcon className="h-3 w-3" />
                  Expand All
                </button>
                <button
                  onClick={collapseAllMenus}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-white/60 rounded-lg transition-all duration-200"
                  title="Collapse all menus"
                >
                  <MinusIcon className="h-3 w-3" />
                  Collapse All
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className={`flex-1 pt-4 space-y-1 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-3'}`}>
            {/* Dashboard/Home */}
            <button
              onClick={() => router.push('/')}
              className={`
                w-full flex items-center rounded-xl transition-all duration-200 group relative
                ${isCollapsed ? 'p-3 justify-center' : 'px-3 py-2.5'}
                ${isActive('/') && pathname === '/' 
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
              title={isCollapsed ? 'Dashboard' : ''}
            >
              <HomeIcon className={`h-5 w-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && (
                <div className="text-left flex-1">
                  <div className="font-medium text-sm">Dashboard</div>
                </div>
              )}
              {isActive('/') && pathname === '/' && (
                <div className="absolute right-2 w-2 h-2 bg-white rounded-full opacity-80"></div>
              )}
            </button>

            {/* Menu Items */}
            {filteredMenuItems.map((item) => (
              <div key={item.id}>
                <div className="relative">
                  <button
                    onClick={() => {
                      if (isCollapsed && item.submenu && hasAccessToAnySubmenu(item)) {
                        setIsCollapsed(false);
                        setExpandedMenus(prev => ({ ...prev, [item.id]: true }));
                      } else if (item.submenu && hasAccessToAnySubmenu(item)) {
                        toggleMenu(item.id);
                      } else if (item.href) {
                        router.push(item.href);
                      }
                    }}
                    className={`
                      w-full flex items-center rounded-xl transition-all duration-200 group relative
                      ${isCollapsed ? 'p-3 justify-center' : 'px-3 py-2.5'}
                      ${shouldHighlightParent(item)
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25' 
                        : expandedMenus[item.id] && !isCollapsed
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                    title={isCollapsed ? item.name : ''}
                  >
                    <item.icon className={`h-5 w-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                    {!isCollapsed && (
                      <div className="text-left flex-1">
                        <div className="font-medium text-sm">{item.name}</div>
                      </div>
                    )}
                    {!isCollapsed && item.submenu && hasAccessToAnySubmenu(item) && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMenu(item.id);
                        }}
                        className="p-1 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                      >
                        {expandedMenus[item.id] ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </div>
                    )}
                    {shouldHighlightParent(item) && (
                      <div className="absolute right-2 w-2 h-2 bg-white rounded-full opacity-80"></div>
                    )}
                  </button>
                </div>
                
                {/* Submenu */}
                {!isCollapsed && item.submenu && expandedMenus[item.id] && (
                  <div className="mt-1 ml-8 space-y-1">
                    {item.submenu.filter(hasAccessToSubmenu).map((subItem) => (
                      <button
                        key={subItem.id}
                        onClick={() => router.push(subItem.href)}
                        className={`
                          w-full flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200 group relative
                          ${isExactActive(subItem.href)
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                          }
                        `}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full mr-3 transition-colors ${
                          isExactActive(subItem.href) ? 'bg-white' : 'bg-gray-300 group-hover:bg-gray-400'
                        }`}></div>
                        <div className="text-left flex-1">
                          <div className="font-medium">{subItem.name}</div>
                        </div>
                        {isExactActive(subItem.href) && (
                          <div className="w-2 h-2 bg-white rounded-full opacity-80"></div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          {!isCollapsed && (
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <div className="text-xs text-gray-400 text-center font-medium">
                {appName ? `${appName} Management` : 'Practice Management'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{appName || 'Practice Tools'}</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>

      {/* Global ChatNPT Widget */}
      <GlobalChatNPT user={user} />
    </div>
  );
}