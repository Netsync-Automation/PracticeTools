/**
 * Get visibility text for Leadership Question issues
 * @param {Object} issue - The issue object
 * @param {Object} user - The current user object
 * @param {Object} visibilityData - Data from leadership visibility API (optional)
 * @returns {string|null} - Visibility text or null if not a Leadership Question
 */
export function getLeadershipVisibilityText(issue, user, visibilityData = null) {
  if (issue.issue_type !== 'Leadership Question') {
    return null;
  }
  
  const isCreator = issue.email === user?.email;
  const isPracticeLeadership = user && (user.role === 'practice_manager' || user.role === 'practice_principal') && 
    user.practices && user.practices.includes(issue.practice);
  
  if (isPracticeLeadership && !isCreator && visibilityData?.creator) {
    return `(Only viewable by Practice Leadership and ${visibilityData.creator.name})`;
  }
  
  if (isCreator && visibilityData?.practiceLeaders?.length > 0) {
    const leaderNames = visibilityData.practiceLeaders.map(leader => leader.name).join(', ');
    return `(Only visible by you and ${leaderNames})`;
  }
  
  if (isCreator) {
    return `(Only visible by you and ${issue.practice} practice leadership)`;
  }
  
  // Default fallback
  return `(Only visible by you and ${issue.practice} practice leadership)`;
}

/**
 * Fetch visibility data for a Leadership Question
 * @param {Object} issue - The issue object
 * @returns {Promise<Object|null>} - Visibility data or null
 */
export async function fetchLeadershipVisibilityData(issue) {
  if (issue.issue_type !== 'Leadership Question') {
    return null;
  }
  
  try {
    const response = await fetch('/api/leadership-visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueId: issue.id,
        practice: issue.practice,
        creatorEmail: issue.email
      })
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Error fetching leadership visibility data:', error);
  }
  
  return null;
}