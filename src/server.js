import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { generatePost } from './services/geminiService.js';
import { getProfile, publishPost } from './services/linkedinService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Ensure temp_uploads folder exists
const tempUploadsDir = path.join(__dirname, '../temp_uploads');
if (!fs.existsSync(tempUploadsDir)) {
  fs.mkdirSync(tempUploadsDir, { recursive: true });
}

// Serve front-end static files
app.use(express.static(path.join(__dirname, '../public')));
// Serve local temporary uploads
app.use('/temp_uploads', express.static(tempUploadsDir));

/**
 * Endpoint to check system and credentials status
 */
app.get('/api/status', async (req, res) => {
  const localGeminiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
  const localLinkedinToken = req.headers['x-linkedin-token'] || process.env.LINKEDIN_ACCESS_TOKEN;

  const status = {
    geminiConfigured: !!localGeminiKey,
    linkedinConfigured: !!localLinkedinToken,
    linkedinProfile: null,
    isMockMode: !localLinkedinToken
  };

  if (localLinkedinToken) {
    try {
      const profile = await getProfile(localLinkedinToken);
      status.linkedinProfile = profile;
      status.isMockMode = profile.isMock;
    } catch (error) {
      console.warn("Could not fetch active profile for status API:", error.message);
      // Don't crash, just show LinkedIn is not fully authenticated or token expired
      status.linkedinConfigured = false;
    }
  } else {
    // Return mock profile by default so UI has visual profile info
    try {
      const mockProfile = await getProfile(null);
      status.linkedinProfile = mockProfile;
    } catch (e) {}
  }

  res.json(status);
});

/**
 * Endpoint to generate post text and image prompts
 */
app.post('/api/generate-post', async (req, res) => {
  const { topic, type } = req.body;
  const apiKey = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;

  if (!topic) {
    return res.status(400).json({ error: "Post topic is required." });
  }

  if (!['text', 'image'].includes(type)) {
    return res.status(400).json({ error: "Post type must be 'text' or 'image'." });
  }

  try {
    const result = await generatePost(topic, type, apiKey);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Download image stream and save to path
 */
async function downloadImage(url, destPath) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 15000 // 15 seconds timeout
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', (err) => {
      fs.unlink(destPath, () => {}); // clean up partial file
      reject(err);
    });
  });
}

/**
 * Endpoint to prepare post images (extract from URL or generate)
 */
app.post('/api/prepare-image', async (req, res) => {
  const { imageUrl, imagePrompt } = req.body;
  
  const filename = `image_${Date.now()}.png`;
  const destPath = path.join(tempUploadsDir, filename);

  try {
    let sourceUrl = imageUrl;

    if (!sourceUrl) {
      if (!imagePrompt) {
        return res.status(400).json({ error: "Either imageUrl or imagePrompt is required to prepare an image." });
      }
      
      // Call Pollinations.ai for AI generation
      // Add a random seed to avoid cached duplicates and get a fresh generation
      const seed = Math.floor(Math.random() * 1000000);
      sourceUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1024&height=1024&nologo=true&private=true&seed=${seed}`;
      console.log(`Generating image via Pollinations.ai: ${sourceUrl}`);
    } else {
      console.log(`Downloading external image from: ${sourceUrl}`);
    }

    await downloadImage(sourceUrl, destPath);

    // Return the relative URL path that Express serves
    res.json({
      localUrl: `/temp_uploads/${filename}`,
      imagePath: destPath
    });
  } catch (error) {
    console.error("Failed to prepare image:", error.message);
    res.status(500).json({ error: `Image preparation failed: ${error.message}` });
  }
});

/**
 * Endpoint to publish the draft post to LinkedIn
 */
app.post('/api/publish-post', async (req, res) => {
  const { postText, imagePath } = req.body;
  const token = req.headers['x-linkedin-token'] || process.env.LINKEDIN_ACCESS_TOKEN;

  if (!postText) {
    return res.status(400).json({ error: "Post text content is required to publish." });
  }

  // Check if target file exists before trying to upload it
  if (imagePath && !fs.existsSync(imagePath)) {
    return res.status(400).json({ error: "Configured image file was not found on the server. Please regenerate." });
  }

  try {
    const result = await publishPost({
      token,
      postText,
      imagePath
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 LinkedIn Post Manager Server running locally at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`==================================================`);
});
