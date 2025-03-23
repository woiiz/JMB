const express = require('express');
const multer = require('multer');
const { uploadImage } = require('../controllers/imageController');

const router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Temporary folder for storing uploads

router.post('/upload', upload.single('image'), uploadImage);

module.exports = router;
