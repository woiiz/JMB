require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { CosmosClient } = require("@azure/cosmos");
const cloudinary = require('cloudinary').v2;

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

// Test API
app.get('/test', (req, res) => {
  res.json({ message: "Backend is running!" });
});

// File upload to Cloudinary
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const result = await cloudinary.uploader.upload_stream((error, result) => {
      if (error) {
        return res.status(500).json({ error: "Cloudinary upload failed" });
      }
      res.json({ imageUrl: result.secure_url });
    }).end(file.buffer);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Save user swipe data to Cosmos DB
app.post('/swipe', async (req, res) => {
  try {
    const { userId, action } = req.body;
    if (!userId || !action) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const item = {
      id: uuidv4(),
      userId,
      action,
      timestamp: new Date().toISOString()
    };

    await container.items.create(item);
    res.json({ message: "Swipe recorded", data: item });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});