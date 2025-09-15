const PRACTICE_OPTIONS = [
  'Audio/Visual',
  'Collaboration',
  'Contact Center',
  'CX',
  'Cyber Security',
  'Data Center',
  'Enterprise Networking',
  'IoT',
  'Pending',
  'Physical Security',
  'Project Management',
  'WAN/Optical',
  'Wireless'
];

async function seedViaAPI() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('Seeding practice options via API...');
  
  for (const practice of PRACTICE_OPTIONS) {
    try {
      const response = await fetch(`${baseUrl}/api/practice-options`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: practice })
      });
      
      if (response.ok) {
        console.log(`✓ Added practice: ${practice}`);
      } else {
        const errorText = await response.text();
        console.log(`✗ Failed to add practice ${practice}: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.log(`✗ Failed to add practice ${practice}: ${error.message}`);
    }
    
    // Small delay to prevent overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('API seeding completed');
}

seedViaAPI().catch(console.error);