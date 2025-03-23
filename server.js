// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { CosmosClient } = require('@azure/cosmos');
const cloudinary = require('cloudinary').v2;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cosmos DB connection
const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_DB_CONNECTION_STRING);
const database = cosmosClient.database(process.env.DATABASE_ID);
const container = database.container(process.env.CONTAINER_ID);

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// JWT Authentication middleware
function authenticateJWT(req, res, next) {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) {
    return res.status(403).json({ message: 'Access Denied' });
  }
  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid Token' });
    }
    req.user = user;
    next();
  });
}

// Register User
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    username,
    password: hashedPassword,
  };

  // Save to Cosmos DB (users container)
  try {
    await container.items.create(user);
    res.json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Login User
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM c WHERE c.username = '${username}'`;
  
  try {
    const { resources } = await container.items.query(query).fetchAll();
    if (resources.length === 0) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const user = resources[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Login error' });
  }
});

// File upload to Cloudinary
app.post('/upload', authenticateJWT, upload.single('image'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const result = await cloudinary.uploader.upload_stream((error, result) => {
      if (error) {
        return res.status(500).json({ error: 'Cloudinary upload failed' });
      }
      res.json({ imageUrl: result.secure_url });
    }).end(file.buffer);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Save user swipe data to Cosmos DB
app.post('/swipe', authenticateJWT, async (req, res) => {
  const { action } = req.body;
  const item = {
    id: uuidv4(),
    userId: req.user.id,
    action,
    timestamp: new Date().toISOString(),
  };

  try {
    await container.items.create(item);
    res.json({ message: 'Swipe recorded', data: item });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Test API
app.get('/test', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});