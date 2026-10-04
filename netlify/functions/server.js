const serverless = require('serverless-http');
const express = require('express');
const path = require('path');
const app = express();

// Enable JSON body parsing & URL encoded body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve mock API responses & backend endpoints
app.all('*', (req, res) => {
  res.json({
    status: 'success',
    message: 'Netlify backend online',
    bizCode: 10000,
    path: req.path,
    timestamp: Date.now()
  });
});

module.exports.handler = serverless(app);
