// Role color mapping for consistent UI display
export const getRoleColor = (role) => {
  const roleColors = {
    'account_manager': 'bg-red-50 text-red-700',
    'admin': 'bg-purple-100 text-purple-800',
    'executive': 'bg-teal-100 text-teal-800',
    'isr': 'bg-orange-100 text-orange-800',
    'netsync_employee': 'bg-gray-100 text-gray-800',
    'practice_manager': 'bg-yellow-100 text-yellow-800',
    'practice_member': 'bg-green-100 text-green-800',
    'practice_principal': 'bg-indigo-100 text-indigo-800'
  };
  
  return roleColors[role] || 'bg-gray-100 text-gray-800';
};