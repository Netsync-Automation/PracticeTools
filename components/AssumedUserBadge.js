import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { UserPlusIcon } from '@heroicons/react/24/outline';

export default function AssumedUserBadge({ user, onUserCreated, type = 'user', fieldType }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const getDefaultRole = () => {
    switch (fieldType) {
      case 'am': return 'account_manager';
      case 'isr': return 'isr';
      case 'submittedBy': return 'practice_member';
      default: return 'practice_member';
    }
  };

  const normalizeUserName = (name) => {
    if (!name) return name;
    return name.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: getDefaultRole(),
    region: ''
  });

  if (!user?.isAssumed) {
    return <span>{user?.name || 'Unknown'}</span>;
  }

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          practices: [],
          region: formData.region || null
        })
      });

      if (response.ok) {
        const result = await response.json();
        setIsModalOpen(false);
        if (onUserCreated) {
          onUserCreated({ name: formData.name, email: formData.email }, user);
        }
      }
    } catch (error) {
      console.error('Error creating user:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
        className="px-2 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-md hover:bg-red-200 transition-colors cursor-pointer border border-red-300"
        title="Assumed user - not found in database. Click to create user."
      >
        {user.name}
      </button>

      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg p-6 w-full max-w-md">
            <Dialog.Title className="text-lg font-semibold mb-4">Create User</Dialog.Title>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  onBlur={(e) => setFormData({...formData, name: normalizeUserName(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="practice_member">Practice Member</option>
                  <option value="practice_manager">Practice Manager</option>
                  <option value="practice_principal">Practice Principal</option>
                  <option value="account_manager">Account Manager</option>
                  <option value="isr">ISR</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({...formData, region: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select region</option>
                  <option value="TX-DAL">TX-DAL</option>
                  <option value="TX-HOU">TX-HOU</option>
                  <option value="TX-AUS">TX-AUS</option>
                  <option value="TX-SA">TX-SA</option>
                  <option value="OK-OKC">OK-OKC</option>
                  <option value="OK-TUL">OK-TUL</option>
                  <option value="AR-LR">AR-LR</option>
                  <option value="LA-NO">LA-NO</option>
                  <option value="LA-BR">LA-BR</option>
                  <option value="LA-SHV">LA-SHV</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}