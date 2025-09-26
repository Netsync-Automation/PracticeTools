import { useState, useEffect } from 'react';

export function usePracticeBoardFollow(cardId, practiceId, columnId) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cardId || !practiceId || !columnId) return;
    
    const checkFollowStatus = async () => {
      console.log('🔍 Frontend: Checking follow status for card:', cardId);
      
      try {
        const url = `/api/practice-boards/cards/${cardId}/follow?practiceId=${practiceId}&columnId=${columnId}`;
        console.log('📡 Frontend: GET request to:', url);
        
        const response = await fetch(url);
        console.log('📡 Frontend: GET response status:', response.status);
        
        const data = await response.json();
        console.log('📊 Frontend: Follow status result:', data);
        
        setFollowing(data.following);
      } catch (error) {
        console.error('❌ Frontend: Error checking follow status:', error);
      }
    };

    checkFollowStatus();
  }, [cardId, practiceId, columnId]);

  const toggleFollow = async () => {
    if (loading) return;
    
    console.log('🔄 Frontend: Toggling follow for card:', cardId, 'practice:', practiceId, 'column:', columnId);
    
    setLoading(true);
    try {
      const response = await fetch(`/api/practice-boards/cards/${cardId}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, columnId })
      });
      
      console.log('📡 Frontend: API response status:', response.status);
      
      const data = await response.json();
      console.log('✅ Frontend: Follow toggle response:', data);
      
      if (data.success) {
        setFollowing(data.following);
      }
    } catch (error) {
      console.error('❌ Frontend: Error toggling follow:', error);
    } finally {
      setLoading(false);
    }
  };

  return { following, toggleFollow, loading };
}