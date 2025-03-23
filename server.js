require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { CosmosClient } = require("@azure/cosmos");
const cloudinary = require('cloudinary').v2;

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Azure Cosmos DB setup
const cosmosClient = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
const database = cosmosClient.database("jalangmalayDB");
const container = database.container("Swipes");

// Cloudinary setup for image uploads
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer storage setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Default route (check if backend is working)
app.get('/', (req, res) => {
    res.json({ message: "Backend is working!" });
});

// Upload image route
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const result = await cloudinary.uploader.upload_stream({ resource_type: "image" }, (error, uploadResult) => {
            if (error) return res.status(500).json({ error: "Upload failed" });
            res.json({ imageUrl: uploadResult.secure_url });
        }).end(req.file.buffer);

    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

// Swipe action route
app.post('/swipe', async (req, res) => {
    const { userId, targetUserId, action } = req.body;

    if (!userId || !targetUserId || !action) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const swipeData = {
        id: uuidv4(),
        userId,
        targetUserId,
        action,
        timestamp: new Date().toISOString()
    };

    try {
        await container.items.create(swipeData);
        res.json({ success: true, data: swipeData });
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

// Get all swipes
app.get('/swipes', async (req, res) => {
    try {
        const { resources } = await container.items.readAll().fetchAll();
        res.json(resources);
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});