const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
};

module.exports = authenticate;

// filepath: /workspaces/sendertest/server.js
const authenticate = require('./middleware/auth');

// Protect sensitive routes
app.post('/api/smtp/config', authenticate, (req, res) => { /*...existing code...*/ });
app.delete('/api/smtp/config', authenticate, (req, res) => { /*...existing code...*/ });
app.post('/api/smtp/test', authenticate, async (req, res) => { /*...existing code...*/ });