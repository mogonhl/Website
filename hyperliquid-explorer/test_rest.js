const axios = require('axios');

async function testAPI() {
    try {
        // Test the block details endpoint with a simpler format
        console.log('\nTesting block details...');
        const blockResponse = await axios.post('https://api.hyperliquid.xyz/info', {
            type: "blockDetails",
            block: 12345  // Simplified format
        });
        console.log('Block Response:', JSON.stringify(blockResponse.data, null, 2));

        // Test the tx details with a simpler format
        console.log('\nTesting transaction details...');
        const txResponse = await axios.post('https://api.hyperliquid.xyz/info', {
            type: "txDetails",
            hash: "0xf94afe652b34cc43d688040cb9571100001ca826f770b3adb1358e2c82d59be8"  // Simplified format
        });
        console.log('Transaction Response:', JSON.stringify(txResponse.data, null, 2));

        // Test the user details with a simpler format
        console.log('\nTesting user details...');
        const userResponse = await axios.post('https://api.hyperliquid.xyz/info', {
            type: "userDetails",
            user: "0x25c32751bc8de15e282919ba3946def63c044dea"  // Simplified format
        });
        console.log('User Response:', JSON.stringify(userResponse.data, null, 2));

    } catch (error) {
        if (error.response?.data) {
            console.error('API Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testAPI(); 