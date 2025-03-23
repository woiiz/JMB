const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Simpan gambar dalam Cloudinary (atau guna file storage lain)
const cloudinary = require("cloudinary").v2;
cloudinary.config({
    cloud_name: "YOUR_CLOUD_NAME",
    api_key: "YOUR_API_KEY",
    api_secret: "YOUR_API_SECRET"
});

// Upload gambar endpoint
app.post("/upload", upload.single("image"), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload_stream(
            { resource_type: "image" },
            (error, result) => {
                if (error) return res.status(500).json({ error: "Upload failed" });
                res.json({ imageUrl: result.secure_url });
            }
        ).end(req.file.buffer);
    } catch (error) {
        res.status(500).json({ error: "Something went wrong" });
    }
});

// Jalankan server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
