'use client';

import { useState, useEffect } from 'react';

export default function RegionSelector({ value, onChange, placeholder = "Select region...", required = false }) {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);

  console.log('RegionSelector DEBUG:', {
    value,
    regionsCount: regions.length,
    loading,
    onChangeType: typeof onChange
  });

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        console.log('RegionSelector: Fetching regions...');
        const response = await fetch('/api/regions');
        if (response.ok) {
          const data = await response.json();
          console.log('RegionSelector: Regions fetched:', data.regions);
          setRegions(data.regions || []);
        } else {
          console.error('RegionSelector: Failed to fetch regions:', response.status);
        }
      } catch (error) {
        console.error('RegionSelector: Error fetching regions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRegions();
  }, []);

  // Validate region exists in available regions
  useEffect(() => {
    if (regions.length > 0 && value && !regions.find(r => r.code === value)) {
      console.log('RegionSelector: Invalid region detected, resetting:', {
        currentValue: value,
        availableRegions: regions.map(r => r.code)
      });
      onChange('');
    }
  }, [regions, value, onChange]);

  if (loading) {
    return (
      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" disabled>
        <option>Loading regions...</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        console.log('RegionSelector: onChange triggered:', {
          newValue: e.target.value,
          oldValue: value
        });
        onChange(e.target.value);
      }}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      required={required}
    >
      <option key="empty" value="">{placeholder}</option>
      {regions.map((region, index) => (
        <option key={region.code || `region-${index}`} value={region.code}>
          {region.name}
        </option>
      ))}
    </select>
  );
}