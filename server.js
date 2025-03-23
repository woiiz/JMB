require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { CosmosClient } = require('@azure/cosmos');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(express.json()); 

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cosmos DB connection
const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_DB_CONNECTION_STRING);
const database = cosmosClient.database(process.env.DATABASE_ID);
const container = database.container(process.env.CONTAINER_ID);

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// JWT Secret
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

// Registration route
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists in Cosmos DB
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.username = @username',
      parameters: [
        {
          name: '@username',
          value: username
        }
      ]
    };
    
    const { resources } = await container.items.query(querySpec).fetchAll();
    
    if (resources.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      id: uuidv4(),
      username,
      password: hashedPassword
    };

    // Save the user to Cosmos DB
    await container.items.create(user);

    res.json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error registering user' });
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find the user in Cosmos DB
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.username = @username',
      parameters: [
        {
          name: '@username',
          value: username
        }
      ]
    };
    
    const { resources } = await container.items.query(querySpec).fetchAll();
    
    if (resources.length === 0) {
      return res.status(400).json({ error: 'User not found' });
    }

    const user = resources[0];

    // Compare the hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET_KEY, { expiresIn: '1h' });

    res.json({ message: 'Login successful', token });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in user' });
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Access denied, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
};

// Test API to verify if JWT is working
app.get('/test', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Endpoint to upload images (protected route)
app.post('/upload', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload_stream(
      { resource_type: 'auto', folder: 'jalang_malay' },
      async (error, result) => {
        if (error) {
          return res.status(500).json({ error: 'Image upload failed' });
        }

        const imageUrl = result.secure_url;

        // Save image URL in Cosmos DB or perform other actions here

        res.json({ message: 'Image uploaded successfully', imageUrl });
      }
    );

    req.pipe(result);
  } catch (error) {
    res.status(500).json({ error: 'Error uploading image' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});