import { useState, useEffect } from 'react';

export default function UserDisplay({ email, fallback = null }) {
  const [displayName, setDisplayName] = useState(fallback || email);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) {
      setDisplayName('Unknown User');
      setLoading(false);
      return;
    }

    const fetchUserName = async () => {
      try {
        const response = await fetch('/api/users/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        
        if (response.ok) {
          const data = await response.json();
          setDisplayName(data.name || email);
        } else {
          setDisplayName(email);
        }
      } catch (error) {
        setDisplayName(email);
      } finally {
        setLoading(false);
      }
    };

    fetchUserName();
  }, [email]);

  if (loading && !fallback) {
    return <span className="text-gray-400">Loading...</span>;
  }

  return <span>{displayName}</span>;
}