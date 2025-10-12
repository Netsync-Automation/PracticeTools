'use client';

import { useState, useRef } from 'react';
import { XMarkIcon, CogIcon, PhotoIcon, PaintBrushIcon } from '@heroicons/react/24/outline';

export default function CardSettingsModal({ 
  isOpen, 
  onClose, 
  card, 
  onUpdateCard,
  getHeaders 
}) {
  const [activeTab, setActiveTab] = useState('appearance');
  const [backgroundImage, setBackgroundImage] = useState(card?.settings?.backgroundImage || '');
  const [backgroundColor, setBackgroundColor] = useState(card?.settings?.backgroundColor || '#ffffff');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'appearance',
      name: 'Card Appearance',
      icon: PaintBrushIcon,
      description: 'Customize header background'
    }
  ];

  const handleImageUpload = async (file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('cardImage', file);

      const response = await fetch('/api/files/upload-card-image', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        const imageUrl = `/api/files/${result.s3Key}`;
        setBackgroundImage(imageUrl);
        setHasChanges(true);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image');
    } finally {
      setUploading(false);
    }
  };

  const saveCardSettings = async () => {
    setSaving(true);
    try {
      const updatedSettings = {
        backgroundImage,
        backgroundColor
      };

      await onUpdateCard({ settings: updatedSettings });
      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Error saving card settings:', error);
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = (color) => {
    setBackgroundColor(color);
    setHasChanges(true);
  };

  const removeBackgroundImage = () => {
    setBackgroundImage('');
    setHasChanges(true);
  };

  const renderAppearanceTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Header Background</h3>
        
        {/* Background Color */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Background Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
            />
            <div className="flex-1">
              <input
                type="text"
                value={backgroundColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="#ffffff"
              />
            </div>
            <button
              onClick={() => handleColorChange('#ffffff')}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Background Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Background Image</label>
          
          {backgroundImage ? (
            <div className="space-y-3">
              <div className="relative">
                <img
                  src={backgroundImage}
                  alt="Card background"
                  className="w-full h-32 object-cover rounded-lg border border-gray-300"
                />
                <button
                  onClick={removeBackgroundImage}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  title="Remove image"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Change Image'}
              </button>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <PhotoIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">
                {uploading ? 'Uploading...' : 'Click to upload background image'}
              </p>
              <p className="text-xs text-gray-500">
                Images will be automatically resized to 400×200px. Max 5MB.
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleImageUpload(file);
              }
            }}
            className="hidden"
          />
        </div>

        {/* Preview */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Preview</label>
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <div 
              className="h-20 flex items-center px-4 relative"
              style={{
                backgroundColor,
                backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <div className="bg-white bg-opacity-90 px-3 py-1.5 rounded-md shadow-sm">
                <h4 className="font-medium text-gray-900 text-sm">{card.title}</h4>
              </div>
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full opacity-75"></div>
                <div className="w-3 h-3 bg-gray-400 rounded-full opacity-75"></div>
                <div className="w-3 h-3 bg-red-400 rounded-full opacity-75"></div>
              </div>
            </div>
            <div className="p-4 bg-white">
              <p className="text-sm text-gray-600 mb-2">Card description text would appear here...</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Created today</span>
                <div className="flex items-center gap-2">
                  <span>📎 2</span>
                  <span>💬 3</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Images are automatically resized to 400×200px and centered to fit the header area.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <CogIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Card Settings</h2>
                <p className="text-sm text-gray-600">Customize "{card.title}"</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-white hover:shadow-md transition-all duration-200"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex h-[calc(90vh-200px)]">
          {/* Left Sidebar */}
          <div className="w-80 bg-gray-50 border-r border-gray-200 p-6">
            <nav className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                      activeTab === item.id
                        ? 'bg-blue-100 text-blue-700 shadow-sm'
                        : 'text-gray-700 hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      activeTab === item.id ? 'bg-blue-200' : 'bg-gray-200'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs opacity-75">{item.description}</div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Content */}
          <div className="flex-1 p-8 overflow-y-auto">
            {activeTab === 'appearance' && renderAppearanceTab()}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-8 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {hasChanges && <span className="text-orange-600">• Unsaved changes</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveCardSettings}
              disabled={!hasChanges || saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}