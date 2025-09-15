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

async function seedProdViaAPI() {
  const baseUrl = 'https://practicetools.netsync.com'; // Update with actual prod URL
  
  console.log('Seeding PRODUCTION practice options via API...');
  console.log(`Target URL: ${baseUrl}`);
  
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
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('PRODUCTION API seeding completed');
}

seedProdViaAPI().catch(console.error);