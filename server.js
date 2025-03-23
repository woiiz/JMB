const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());

// Sambungan ke Azure Cosmos DB
const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const database = cosmosClient.database(process.env.DATABASE_ID);
const container = database.container(process.env.CONTAINER_ID);

// API untuk menyimpan data swipe
app.post("/swipe", async (req, res) => {
  try {
    const { userId, targetUserId, action } = req.body;
    const { resource: createdItem } = await container.items.create({
      userId,
      targetUserId,
      action,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: createdItem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mulakan server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
