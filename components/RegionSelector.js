'use client';

import { useState, useEffect } from 'react';

export default function RegionSelector({ value, onChange, placeholder = "Select region...", required = false }) {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const response = await fetch('/api/regions');
        if (response.ok) {
          const data = await response.json();
          setRegions(data.regions || []);
        }
      } catch (error) {
        console.error('Error fetching regions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRegions();
  }, []);

  if (loading) {
    return (
      <select className="input-field" disabled>
        <option>Loading regions...</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-field"
      required={required}
    >
      <option value="">{placeholder}</option>
      {regions.map(region => (
        <option key={region.code} value={region.code}>
          {region.name}
        </option>
      ))}
    </select>
  );
}