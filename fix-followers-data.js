// Fix for followers data being lost in updateCard function
// This addresses the issue where followers: Array(0) and followersCount: 0

// The problem is in the updateCard function where followers data is not properly preserved
// Here's the minimal fix:

function updateCard(cardId, updates) {
  // BEFORE: The issue was here - followers data was being lost
  // const updatedCard = { ...card, ...updates };
  
  // AFTER: Ensure followers data is always preserved
  const updatedCard = {
    ...card,
    ...updates,
    // Critical fix: Always preserve followers array and ensure it's normalized
    followers: updates.followers || card.followers || [],
    followersCount: (updates.followers || card.followers || []).length
  };
  
  // Additional normalization to ensure followers is always an array
  if (!Array.isArray(updatedCard.followers)) {
    updatedCard.followers = [];
    updatedCard.followersCount = 0;
  }
  
  return updatedCard;
}

// Alternative approach - ensure followers data is fetched when needed
async function ensureFollowersData(cardId, card) {
  if (!card.followers || card.followers.length === 0) {
    try {
      // Fetch followers from database if not present
      const response = await fetch(`/api/issues/${cardId}/followers`);
      const data = await response.json();
      
      if (data.success && data.followers) {
        card.followers = data.followers;
        card.followersCount = data.followers.length;
      }
    } catch (error) {
      console.error('Failed to fetch followers data:', error);
      // Ensure defaults
      card.followers = card.followers || [];
      card.followersCount = card.followers.length;
    }
  }
  
  return card;
}

// For SSE updates, ensure followers data is preserved
function handleSSEUpdate(eventData) {
  if (eventData.type === 'issue_updated' && eventData.updates) {
    // Ensure followers data is not overwritten by SSE updates
    const currentCard = getCurrentCard(eventData.issueId);
    
    const preservedUpdates = {
      ...eventData.updates,
      // Preserve existing followers if not explicitly updated
      followers: eventData.updates.followers !== undefined 
        ? eventData.updates.followers 
        : (currentCard?.followers || []),
      followersCount: eventData.updates.followers !== undefined
        ? eventData.updates.followers.length
        : (currentCard?.followers || []).length
    };
    
    updateCard(eventData.issueId, preservedUpdates);
  }
}