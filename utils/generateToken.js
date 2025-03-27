// filepath: /workspaces/sendertest/utils/generateToken.js
const jwt = require('jsonwebtoken');

const generateToken = (payload, secret, expiresIn = '1h') => {
    return jwt.sign(payload, secret, { expiresIn });
};

// Example usage
const secret = 'your_jwt_secret_key'; // Replace with a secure key
const payload = { userId: '12345', role: 'admin' }; // Customize the payload as needed
const token = generateToken(payload, secret);

console.log('Generated JWT Token:', token);