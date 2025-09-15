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

export default function CompleteStatusModal({ 
  isOpen, 
  onClose, 
  saAssignment, 
  user, 
  onComplete 
}) {
  const [practiceAssignments, setPracticeAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [selectedSA, setSelectedSA] = useState('');
  const [showSASelector, setShowSASelector] = useState(false);
  const [completionStatus, setCompletionStatus] = useState({});

  useEffect(() => {
    if (isOpen && saAssignment) {
      loadPracticeAssignments();
    }
  }, [isOpen, saAssignment]);

  const loadPracticeAssignments = async () => {
    if (!saAssignment?.practice) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      
      if (data.users) {
        const practiceList = saAssignment.practice.split(',').map(p => p.trim());
        const saList = saAssignment.saAssigned ? saAssignment.saAssigned.split(',').map(s => s.trim()) : [];
        const assignments = [];
        
        let colorIndex = 0;
        practiceList.forEach((p) => {
          const colors = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
          
          // Find SAs assigned to this practice
          const assignedSAs = saList.filter(saName => {
            const saUser = data.users.find(u => u.name === saName);
            return saUser && saUser.practices && saUser.practices.includes(p);
          });
          
          // Create separate entry for each SA or one entry if no SAs
          if (assignedSAs.length === 0) {
            assignments.push({
              practice: p,
              assignedSAs: [],
              colors: colors
            });
          } else {
            assignedSAs.forEach(sa => {
              assignments.push({
                practice: p,
                assignedSAs: [sa],
                colors: colors
              });
            });
          }
          colorIndex++;
        });
        
        setPracticeAssignments(assignments);
        
        // Initialize completion status (in a real implementation, this would come from the database)
        const status = {};
        assignments.forEach(assignment => {
          assignment.assignedSAs.forEach(sa => {
            status[sa] = saAssignment.status === 'Complete' && saAssignment.completedBy === sa;
          });
        });
        setCompletionStatus(status);
      }
    } catch (error) {
      console.error('Error loading practice assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const canMarkComplete = () => {
    if (!user || !saAssignment) return false;
    
    // Admins can always mark complete
    if (user.isAdmin) return true;
    
    // Assigned SAs can mark their own work complete
    if (saAssignment.saAssigned) {
      const assignedSAs = saAssignment.saAssigned.split(',').map(s => s.trim());
      return assignedSAs.some(sa => sa.toLowerCase() === user.name.toLowerCase());
    }
    
    return false;
  };

  const isUserAssignedSA = () => {
    if (!user || !saAssignment?.saAssigned) return false;
    const assignedSAs = saAssignment.saAssigned.split(',').map(s => s.trim());
    return assignedSAs.some(sa => sa.toLowerCase() === user.name.toLowerCase());
  };

  const getAvailableSAs = () => {
    if (!saAssignment?.saAssigned) return [];
    return saAssignment.saAssigned.split(',').map(s => s.trim());
  };

  const handleComplete = async () => {
    if (!canMarkComplete()) return;
    
    setCompleting(true);
    
    try {
      let targetSA = user.name;
      
      // If user is admin and not an assigned SA, show SA selector
      if (user.isAdmin && !isUserAssignedSA()) {
        const availableSAs = getAvailableSAs();
        if (availableSAs.length > 1) {
          setShowSASelector(true);
          setCompleting(false);
          return;
        } else if (availableSAs.length === 1) {
          targetSA = availableSAs[0];
        }
      }
      
      // Mark the SA as complete
      await onComplete(targetSA);
      
      // Update local completion status
      setCompletionStatus(prev => ({ ...prev, [targetSA]: true }));
      
      // Check if all SAs are complete
      const allSAs = getAvailableSAs();
      const completedCount = Object.values(completionStatus).filter(Boolean).length + 1; // +1 for the one we just completed
      const isFullyComplete = completedCount >= allSAs.length;
      
      if (isFullyComplete) {
        onClose();
      } else {
        // Show success message but keep modal open
        alert(`Successfully marked ${targetSA} as complete. The assignment will be fully complete when all SAs finish their portions.`);
      }
      
    } catch (error) {
      console.error('Error marking complete:', error);
      alert('Failed to mark assignment as complete. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const handleSASelection = async () => {
    if (!selectedSA) return;
    
    setCompleting(true);
    setShowSASelector(false);
    
    try {
      await onComplete(selectedSA);
      
      // Update local completion status
      setCompletionStatus(prev => ({ ...prev, [selectedSA]: true }));
      
      // Check if all SAs are complete
      const allSAs = getAvailableSAs();
      const completedCount = Object.values(completionStatus).filter(Boolean).length + 1; // +1 for the one we just completed
      const isFullyComplete = completedCount >= allSAs.length;
      
      if (isFullyComplete) {
        onClose();
      } else {
        alert(`Successfully marked ${selectedSA} as complete. The assignment will be fully complete when all SAs finish their portions.`);
      }
      
    } catch (error) {
      console.error('Error marking SA complete:', error);
      alert('Failed to mark SA as complete. Please try again.');
    } finally {
      setCompleting(false);
      setSelectedSA('');
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
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Practices & SA Assignments</h4>
                <div className="space-y-4">
                  {practiceAssignments.map((assignment, index) => {
                    const practiceComplete = assignment.assignedSAs.length > 0 && assignment.assignedSAs.every(sa => completionStatus[sa]);
                    
                    return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className={`inline-flex items-center px-3 py-1.5 ${assignment.colors.bg} ${assignment.colors.text} text-xs rounded-full border ${assignment.colors.border} font-medium flex-shrink-0 shadow-sm`}>
                          {assignment.practice}
                        </span>
                        <span className={`text-xs font-medium mt-1 text-left ${
                          practiceComplete ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {practiceComplete ? '✅ Complete' : '🔄 In Progress'}
                        </span>
                      </div>
                      <div className="flex-1 flex items-center">
                        <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-gray-200"></div>
                        <div className="mx-2">
                          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-gray-300"></div>
                      </div>
                      <div className="flex-shrink-0">
                        {assignment.assignedSAs.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-end">
                            {assignment.assignedSAs.map((sa, saIndex) => (
                              <div key={saIndex} className="flex flex-col items-end">
                                <span className={`inline-flex items-center px-3 py-1.5 ${assignment.colors.bg} ${assignment.colors.text} text-xs rounded-lg border ${assignment.colors.border} shadow-sm font-medium`}>
                                  {sa}
                                </span>
                                {/* Show completion status */}
                                <span className={`text-xs font-medium mt-1 text-right ${
                                  completionStatus[sa] ? 'text-green-600' : 'text-orange-600'
                                }`}>
                                  {completionStatus[sa] ? '✅ Complete' : '🔄 In Progress'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 bg-gray-50 text-gray-600 text-xs rounded-lg border border-gray-200 shadow-sm font-medium">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              {canMarkComplete() && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-blue-900 mb-1">Ready to Complete</h5>
                      <p className="text-sm text-blue-700">
                        {isUserAssignedSA() 
                          ? "You can mark your portion of this assignment as complete."
                          : "As an admin, you can mark any SA's portion as complete."
                        }
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
                    onClick={handleComplete}
                    disabled={completing}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {completing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Completing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Complete
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* SA Selection Modal */}
      {showSASelector && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select SA to Mark Complete</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose which SA you want to mark as complete for this assignment.
              </p>
              
              <div className="space-y-2 mb-6">
                {getAvailableSAs().map(sa => (
                  <label key={sa} className="flex items-center">
                    <input
                      type="radio"
                      name="selectedSA"
                      value={sa}
                      checked={selectedSA === sa}
                      onChange={(e) => setSelectedSA(e.target.value)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{sa}</span>
                  </label>
                ))}
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowSASelector(false);
                    setSelectedSA('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSASelection}
                  disabled={!selectedSA || completing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}