const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function runTests() {
  try {
    console.log('Starting API tests...');
    
    // Wait for backend to be ready
    await waitForBackend();
    
    // Test 1: Get users (should be empty initially)
    console.log('Test 1: GET /api/users');
    const getResponse = await axios.get(`${BACKEND_URL}/api/users`);
    console.log('✓ GET users successful');
    
    // Test 2: Create a user
    console.log('Test 2: POST /api/users');
    const postResponse = await axios.post(`${BACKEND_URL}/api/users`, {
      name: 'Test User',
      email: 'test@example.com'
    });
    console.log('✓ POST user successful');
    
    // Test 3: Verify user was created
    console.log('Test 3: Verify user creation');
    const verifyResponse = await axios.get(`${BACKEND_URL}/api/users`);
    if (verifyResponse.data.length > 0) {
      console.log('✓ User verification successful');
    } else {
      throw new Error('User not found after creation');
    }
    
    console.log('All tests passed!');
    process.exit(0);
    
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

async function waitForBackend() {
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(`${BACKEND_URL}/api/users`);
      console.log('Backend is ready');
      return;
    } catch (error) {
      console.log(`Waiting for backend... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Backend not ready after maximum retries');
}

runTests();
