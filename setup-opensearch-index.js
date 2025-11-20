import { createVectorIndex } from './lib/opensearch-setup.js';

async function setupIndex() {
  try {
    await createVectorIndex();
    console.log('Vector index setup complete');
  } catch (error) {
    console.error('Error setting up index:', error);
  }
}

setupIndex();