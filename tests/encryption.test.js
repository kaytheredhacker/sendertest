// filepath: /workspaces/sendertest/tests/encryption.test.js
const { encrypt, decrypt } = require('../utils/encryption');

const text = 'password123';

const encrypted = encrypt(text);
console.log('Encrypted:', encrypted);

const decrypted = decrypt(encrypted);
console.log('Decrypted:', decrypted);