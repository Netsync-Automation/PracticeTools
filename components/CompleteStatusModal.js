'use client';

import { useState, useEffect } from 'react';

// Color palette for practice-SA pairings (matching existing pattern)
const COLOR_PALETTE = [
  { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  { bg: 'bg-pink-50', text: 'text-pink-800', border: 'border-pink-200' },
  { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
  { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' }
];

// Utility function to extract friendly name from "Name <email>" format
const extractFriendlyName = (nameWithEmail) => {
  if (!nameWithEmail) return '';
  const match = nameWithEmail.match(/^(.+?)\s*<[^>]+>/);
  return match ? match[1].trim() : nameWithEmail.trim();
};

export default function CompleteStatusModal({ 
  isOpen, 
  onClose, 
  saAssignment, 
  user, 
  onComplete 
}) {
  const [practiceGroups, setPracticeGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (isOpen && saAssignment) {
      loadPracticeGroups();
    }
  }, [isOpen, saAssignment]);

  const loadPracticeGroups = async () => {
    if (!saAssignment?.practice) {
      setLoading(false);
      return;
    }

    try {
      const practiceList = saAssignment.practice.split(',').map(p => p.trim());
      const saCompletions = JSON.parse(saAssignment?.saCompletions || '{}');
      
      let practiceAssignmentsData = {};
      if (saAssignment?.practiceAssignments) {
        try {
          practiceAssignmentsData = JSON.parse(saAssignment.practiceAssignments);
        } catch (e) {
          console.error('Error parsing practiceAssignments:', e);
        }
      }
      
      const groups = practiceList.map((practiceName, index) => {
        const colors = COLOR_PALETTE[index % COLOR_PALETTE.length];
        const assignedSAs = practiceAssignmentsData[practiceName] || [];
        
        // Calculate practice status
        let practiceStatus = 'In Progress';
        if (assignedSAs.length > 0) {
          const allApprovedComplete = assignedSAs.every(saEntry => {
            const practiceKey = `${saEntry}::${practiceName}`;
            const completion = saCompletions[practiceKey] || saCompletions[saEntry];
            return completion && (completion.status === 'Approved' || completion.status === 'Complete' || completion.status === 'Approved/Complete' || completion.completedAt);
          });
          const allPendingApproval = assignedSAs.every(saEntry => {
            const practiceKey = `${saEntry}::${practiceName}`;
            const completion = saCompletions[practiceKey] || saCompletions[saEntry];
            return completion && completion.status === 'Pending Approval';
          });
          
          if (allApprovedComplete) {
            practiceStatus = 'Approved/Complete';
          } else if (allPendingApproval) {
            practiceStatus = 'Pending Approval';
          }
        }
        
        // Process SAs for this practice
        const saDetails = assignedSAs.map(saEntry => {
          const saName = extractFriendlyName(saEntry);
          const practiceKey = `${saEntry}::${practiceName}`;
          const completion = saCompletions[practiceKey] || saCompletions[saEntry];
          
          let currentStatus = 'In Progress';
          if (completion?.status === 'Approved' || completion?.status === 'Complete' || completion?.status === 'Approved/Complete') currentStatus = 'Approved/Complete';
          else if (completion?.status) currentStatus = completion.status;
          else if (completion?.completedAt) currentStatus = 'Approved/Complete';
          
          return {
            name: saName,
            entry: saEntry,
            status: currentStatus,
            revisionNumber: completion?.revisionNumber
          };
        });
        
        return {
          practice: practiceName,
          colors,
          status: practiceStatus,
          sas: saDetails
        };
      });
      
      setPracticeGroups(groups);
    } catch (error) {
      console.error('Error loading practice groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const canMarkComplete = () => {
    if (!user || !saAssignment) return false;
    return user.isAdmin;
  };

  const handleCompleteAll = async () => {
    if (!canMarkComplete()) return;
    
    const confirmed = confirm('This will mark ALL individual SA statuses as "Approved/Complete" across all practices. Are you sure?');
    if (!confirmed) return;
    
    setCompleting(true);
    
    try {
      // Get all SA entries that need to be marked complete
      const updates = [];
      console.log('DEBUG: Practice groups:', practiceGroups);
      
      practiceGroups.forEach(group => {
        console.log('DEBUG: Processing group:', group.practice, 'with SAs:', group.sas);
        group.sas.forEach(sa => {
          console.log('DEBUG: SA status check:', sa.name, 'current status:', sa.status, 'needs update:', sa.status !== 'Approved/Complete');
          if (sa.status !== 'Approved/Complete') {
            updates.push({
              targetSA: sa.entry,
              targetPractice: group.practice,
              saStatus: 'Approved/Complete'
            });
          }
        });
      });
      
      console.log('DEBUG: Updates to be made:', updates);
      
      if (updates.length === 0) {
        // All SAs are already complete, but overall status might not be - force update
        console.log('DEBUG: All SAs already complete, updating overall status to Complete');
        
        const response = await fetch(`/api/sa-assignments/${saAssignment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Complete',
            completedAt: new Date().toISOString(),
            completedBy: 'All SAs'
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update overall status: ${errorText}`);
        }
        
        alert('SA Assignment marked as Complete!');
        onClose();
        return;
      }
      
      // Send batch update to mark all SAs complete
      let successCount = 0;
      for (const update of updates) {
        console.log('DEBUG: Sending update:', update);
        
        const response = await fetch(`/api/sa-assignments/${saAssignment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updateSAStatus: true,
            targetSA: update.targetSA,
            saStatus: update.saStatus,
            targetPractice: update.targetPractice
          })
        });
        
        console.log('DEBUG: Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('DEBUG: Response error:', errorText);
          throw new Error(`Failed to update ${update.targetSA}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('DEBUG: Response result:', result);
        successCount++;
      }
      
      console.log('DEBUG: Successfully updated', successCount, 'SAs');
      alert(`Successfully marked ${successCount} SAs as complete.`);
      onClose();
      
    } catch (error) {
      console.error('Error marking all SAs complete:', error);
      alert(`Failed to mark all SAs as complete: ${error.message}`);
    } finally {
      setCompleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Complete SA Assignment</h3>
              <p className="text-blue-100 mt-1">SA Assignment #{saAssignment?.sa_assignment_number}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Practice & SA Assignment Status</h4>
                <div className="space-y-4">
                  {practiceGroups.map((group, index) => (
                    <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      {/* Practice Header */}
                      <div className={`${group.colors.bg} px-4 py-3 border-b border-white/20`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${group.colors.text.replace('text-', 'bg-')}`}></div>
                            <h3 className={`font-semibold ${group.colors.text}`}>{group.practice}</h3>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            group.status === 'Approved/Complete' ? 'bg-emerald-500 text-white' :
                            group.status === 'Pending Approval' ? 'bg-amber-500 text-white' :
                            'bg-orange-500 text-white'
                          }`}>
                            {group.status === 'Approved/Complete' ? '✅ Complete' :
                             group.status === 'Pending Approval' ? '⏳ Pending Approval' :
                             '🔄 In Progress'}
                          </div>
                        </div>
                      </div>
                      
                      {/* SAs for this practice */}
                      <div className="p-4">
                        {group.sas.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {group.sas.map((sa, saIndex) => (
                              <div key={saIndex} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="bg-gray-200 rounded-full p-1">
                                      <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-gray-900 text-sm truncate">{sa.name}</p>
                                      {sa.status === 'Pending Approval' && sa.revisionNumber && (
                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded border border-amber-200 mt-1">
                                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          Rev: {sa.revisionNumber}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex-shrink-0">
                                    <div className={`text-xs font-semibold px-2 py-1 rounded text-center min-w-[120px] ${
                                      sa.status === 'Pending Approval' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                      sa.status === 'Approved/Complete' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                      'bg-orange-100 text-orange-800 border border-orange-200'
                                    }`}>
                                      {sa.status === 'Pending Approval' ? '⏳ Pending Approval' :
                                       sa.status === 'Approved/Complete' ? '✅ Complete' :
                                       '🔄 In Progress'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-gray-50 rounded-lg p-4 text-center border-2 border-dashed border-gray-200">
                            <p className="text-gray-500 font-medium text-sm">No SAs assigned</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {canMarkComplete() && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-green-900 mb-1">Complete Entire SA Assignment</h5>
                      <p className="text-sm text-green-700">
                        This will mark ALL individual SA statuses as "Approved/Complete" across all practices and set the overall assignment status to "Complete".
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  disabled={completing}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                {canMarkComplete() && (
                  <button
                    onClick={handleCompleteAll}
                    disabled={completing}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {completing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Completing All...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Complete All SAs
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>


    </div>
  );
}