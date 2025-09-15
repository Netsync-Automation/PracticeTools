// SA Assignment validation utility for server-side use
export const validatePracticeCoverage = async (practices, assignedSas) => {
  if (!practices || !assignedSas) return { valid: false, uncoveredPractices: [] };
  
  try {
    // Import fetch for server-side use
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/users`);
    const data = await response.json();
    
    if (!data.users) return { valid: false, uncoveredPractices: [] };
    
    const practiceList = practices.split(',').map(p => p.trim());
    const saList = assignedSas.split(',').map(s => s.trim());
    const coveredPractices = new Set();
    
    saList.forEach(saName => {
      const user = data.users.find(u => u.name === saName);
      if (user && user.practices) {
        user.practices.forEach(practice => {
          if (practiceList.includes(practice)) {
            coveredPractices.add(practice);
          }
        });
      }
    });
    
    const uncoveredPractices = practiceList.filter(p => !coveredPractices.has(p));
    return { valid: uncoveredPractices.length === 0, uncoveredPractices };
  } catch (error) {
    console.error('Error validating practice coverage:', error);
    return { valid: false, uncoveredPractices: [] };
  }
};