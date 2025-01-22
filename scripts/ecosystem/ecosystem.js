const { spawn } = require('child_process');
const path = require('path');

// Redis configuration
const REDIS_URL = "https://witty-dassie-40050.upstash.io";
const REDIS_TOKEN = "AZxyAAIjcDE3Mzk2MTJkNzJjMDg0Yzk0ODMyZWE3YmRjOGRmZTQxZHAxMA";

async function runScript(scriptName) {
    return new Promise((resolve, reject) => {
        console.log(`Running ${scriptName}...`);
        const scriptPath = path.join(__dirname, scriptName);
            
        const childProcess = spawn('node', [scriptPath], {
            stdio: 'inherit',
            env: {
                ...process.env,
                UPSTASH_REDIS_REST_URL: REDIS_URL,
                UPSTASH_REDIS_REST_TOKEN: REDIS_TOKEN
            }
        });

        childProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`${scriptName} completed successfully`);
                resolve();
            } else {
                console.error(`${scriptName} failed with code ${code}`);
                reject(new Error(`Script failed with code ${code}`));
            }
        });
    });
}

async function main() {
    try {
        // Run update_spot.js to fetch and store spot data
        await runScript('update_spot.js');
        

        console.log('All ecosystem scripts completed successfully');
    } catch (error) {
        console.error('Error running ecosystem scripts:', error);
        process.exit(1);
    }
}

main(); 