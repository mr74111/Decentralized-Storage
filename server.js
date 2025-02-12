require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Fix SSL verification issue (Use only if necessary)
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = express();
const port = process.env.PORT || 5000;

const s3 = new S3Client({
    region: "us-east-1",
    endpoint: process.env.STORJ_ENDPOINT,
    credentials: {
        accessKeyId: process.env.STORJ_ACCESS_KEY,
        secretAccessKey: process.env.STORJ_SECRET_KEY,
    },
    forcePathStyle: true,
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, "app")));

// List Files
app.get("/files", async (req, res) => {
    try {
        const params = { Bucket: process.env.STORJ_BUCKET };
        const command = new ListObjectsV2Command(params);
        const data = await s3.send(command);
        const files = data.Contents ? data.Contents.map(item => item.Key) : [];
        res.json(files);
    } catch (error) {
        console.error("List files error:", error);
        res.status(500).json({ error: "Failed to list files" });
    }
});

// File upload configuration
const upload = multer({ storage: multer.memoryStorage() });

// Upload File
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const uploadParams = {
            Bucket: process.env.STORJ_BUCKET,
            Key: req.file.originalname,
            Body: req.file.buffer,
        };

        await s3.send(new PutObjectCommand(uploadParams));
        res.json({ message: "File uploaded successfully", file: req.file.originalname });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Download File
app.get("/download/:filename", async (req, res) => {
    try {
        const params = {
            Bucket: process.env.STORJ_BUCKET,
            Key: req.params.filename,
        };

        const command = new GetObjectCommand(params);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

        res.json({ downloadUrl: url });
    } catch (error) {
        console.error("Download error:", error);
        res.status(404).json({ error: "File not found" });
    }
});

// Delete File
app.delete("/delete/:filename", async (req, res) => {
    try {
        const params = {
            Bucket: process.env.STORJ_BUCKET,
            Key: req.params.filename,
        };

        await s3.send(new DeleteObjectCommand(params));
        res.json({ message: "File deleted successfully" });
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ error: "Failed to delete file" });
    }
});

// Catch-all **AFTER** all API routes
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "app", "index.html"));
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});