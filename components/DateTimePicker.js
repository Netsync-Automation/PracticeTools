'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function DateTimePicker({ 
  isOpen, 
  onClose, 
  onSave, 
  title = "Set Dates & Reminders",
  subtitle = "Configure dates and notifications",
  initialData = {},
  showStartDate = true,
  showReminders = true,
  context = "card" // "card" or "checklist"
}) {
  const [startDate, setStartDate] = useState(initialData.startDate || '');
  const [dueDate, setDueDate] = useState(initialData.dueDate || '');
  const [dueTime, setDueTime] = useState(initialData.dueTime || '');
  const [reminderOption, setReminderOption] = useState(initialData.reminderOption || '');
  const [customReminderDate, setCustomReminderDate] = useState(initialData.customReminderDate || '');
  const [customReminderTime, setCustomReminderTime] = useState(initialData.customReminderTime || '');
  const [startDateInputMethod, setStartDateInputMethod] = useState('picker');
  const [dueDateInputMethod, setDueDateInputMethod] = useState('picker');

  useEffect(() => {
    if (isOpen) {
      setStartDate(initialData.startDate || '');
      setDueDate(initialData.dueDate || '');
      setDueTime(initialData.dueTime || '');
      setReminderOption(initialData.reminderOption || '');
      setCustomReminderDate(initialData.customReminderDate || '');
      setCustomReminderTime(initialData.customReminderTime || '');
    }
  }, [isOpen, initialData]);

  const handleSave = () => {
    if (context === 'checklist' && reminderOption && (!initialData.assignedUsers || initialData.assignedUsers.length === 0)) {
      alert('Cannot set reminders on unassigned checklist items. Please assign users first.');
      return;
    }
    
    const data = {
      startDate: showStartDate ? startDate : undefined,
      dueDate,
      dueTime,
      reminderOption: showReminders ? reminderOption : '',
      customReminderDate: showReminders ? customReminderDate : '',
      customReminderTime: showReminders ? customReminderTime : ''
    };
    onSave(data);
  };

  const handleClearAll = () => {
    setStartDate('');
    setDueDate('');
    setDueTime('');
    setReminderOption('');
    setCustomReminderDate('');
    setCustomReminderTime('');
    setStartDateInputMethod('picker');
    setDueDateInputMethod('picker');
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '';
    }
  };

  const parseDateInput = (value, setter) => {
    if (!value) {
      setter('');
      return;
    }
    
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setter(date.toISOString().split('T')[0]);
      }
    } catch {
      // Invalid date, don't update
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-600">{subtitle}</p>
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
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-6">
            {/* Date & Time Section */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h4 className="text-lg font-semibold text-gray-800">Dates & Times</h4>
              </div>
              
              {/* Start Date */}
              {showStartDate && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-gray-800">Start Date</label>
                    <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                      <button
                        onClick={() => setStartDateInputMethod('picker')}
                        className={`px-3 py-1 text-xs rounded-md transition-all ${startDateInputMethod === 'picker' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
                      >
                        Calendar
                      </button>
                      <button
                        onClick={() => setStartDateInputMethod('manual')}
                        className={`px-3 py-1 text-xs rounded-md transition-all ${startDateInputMethod === 'manual' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
                      >
                        Manual
                      </button>
                    </div>
                  </div>
                  {startDateInputMethod === 'picker' ? (
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white font-medium"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="MM/DD/YYYY"
                      value={formatDateForInput(startDate)}
                      onChange={(e) => parseDateInput(e.target.value, setStartDate)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white font-medium"
                    />
                  )}
                </div>
              )}
              
              {/* Due Date & Time */}
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-800">Due Date & Time</label>
                  <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                    <button
                      onClick={() => setDueDateInputMethod('picker')}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${dueDateInputMethod === 'picker' ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:text-gray-800'}`}
                    >
                      Calendar
                    </button>
                    <button
                      onClick={() => setDueDateInputMethod('manual')}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${dueDateInputMethod === 'manual' ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:text-gray-800'}`}
                    >
                      Manual
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {dueDateInputMethod === 'picker' ? (
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white font-medium"
                      />
                    ) : (
                      <input
                        type="text"
                        placeholder="MM/DD/YYYY"
                        value={formatDateForInput(dueDate)}
                        onChange={(e) => parseDateInput(e.target.value, setDueDate)}
                        className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white font-medium"
                      />
                    )}
                  </div>
                  <div>
                    <input
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white font-medium"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Set when this {context === 'checklist' ? 'item' : 'task'} should be completed</p>
              </div>
            </div>
            
            {/* Reminder Section */}
            {showReminders && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 17H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V11" />
                  </svg>
                  <h4 className="text-lg font-semibold text-gray-800">Reminder Settings</h4>
                </div>
                
                {context === 'checklist' && (!initialData.assignedUsers || initialData.assignedUsers.length === 0) ? (
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-amber-800">Cannot Set Reminders</p>
                        <p className="text-sm text-amber-700 mt-1">This checklist item has no assigned users. Please assign users first before setting reminders.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                    <label className="block text-sm font-semibold text-gray-800 mb-3">When to remind</label>
                    <select
                      value={reminderOption}
                      onChange={(e) => setReminderOption(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-white font-medium text-gray-800"
                    >
                      <option value="">No reminder</option>
                      <option value="1day">1 day before due date</option>
                      <option value="1hour">1 hour before due date</option>
                      <option value="15min">15 minutes before due date</option>
                      <option value="custom">Custom date & time</option>
                    </select>
                    
                    {reminderOption === 'custom' && (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">Reminder Date</label>
                          <input
                            type="date"
                            value={customReminderDate}
                            onChange={(e) => setCustomReminderDate(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">Reminder Time</label>
                          <input
                            type="time"
                            value={customReminderTime}
                            onChange={(e) => setCustomReminderTime(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-white text-sm"
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-4 p-3 bg-blue-100 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-blue-800">
                          <strong>Reminder notifications</strong> will be sent via Webex to all assigned users and followers.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClearAll}
              className="px-4 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 font-medium"
            >
              Clear All
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
              >
                Save {showReminders ? 'Dates & Reminders' : 'Dates'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}