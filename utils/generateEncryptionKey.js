// filepath: /workspaces/sendertest/utils/generateEncryptionKey.js
const crypto = require('crypto');

const generateEncryptionKey = () => {
    return crypto.randomBytes(32).toString('hex'); // Generates a 32-character encryption key
};

console.log('Generated Encryption Key:', generateEncryptionKey());