const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const generateKeys = () => {
    const encryptionKey = crypto.randomBytes(32).toString('hex'); // 32-character encryption key
    const jwtSecret = crypto.randomBytes(16).toString('hex'); // 16-character JWT secret

    const configContent = `
JWT_SECRET=${jwtSecret}
ENCRYPTION_KEY=${encryptionKey}
    `;

    const envPath = path.join(__dirname, '../.env');
    fs.writeFileSync(envPath, configContent.trim());
    console.log('Keys generated and saved to .env file!');
    console.log(`JWT_SECRET: ${jwtSecret}`);
    console.log(`ENCRYPTION_KEY: ${encryptionKey}`);
};

generateKeys();