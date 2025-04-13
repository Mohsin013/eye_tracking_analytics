const express = require('express');
const { RekognitionClient, DetectFacesCommand } = require('@aws-sdk/client-rekognition');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Configure middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public'));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Initialize AWS Rekognition client
const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Validate AWS credentials
async function validateAwsCredentials() {
  try {
    // Simple check to see if credentials are valid
    const command = new DetectFacesCommand({
      Image: {
        Bytes: Buffer.from('dummy')
      }
    });
    
    await rekognition.send(command);
    console.log('AWS credentials validated successfully');
    return true;
  } catch (error) {
    if (error.name === 'ValidationException') {
      console.log('AWS credentials validated successfully (validation error expected for dummy data)');
      return true;
    }
    
    console.error('AWS credentials validation failed:', error.message);
    return false;
  }
}

// API endpoint to analyze image
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    // Validate request
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No image provided',
        details: 'Please provide an image file in the request'
      });
    }

    // Get image data from request
    const imageBuffer = req.file.buffer;
    
    // Validate image size
    if (imageBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({
        error: 'Image too large',
        details: 'Maximum image size is 5MB'
      });
    }

    // Setup params for Rekognition
    const params = {
      Image: {
        Bytes: imageBuffer
      },
      Attributes: ['ALL'] // Request all attributes including EyeDirection
    };

    // Call AWS Rekognition
    const command = new DetectFacesCommand(params);
    const response = await rekognition.send(command);

    // Process and return the relevant results
    const results = {
      raw: response,
      processed: {
        facesDetected: response.FaceDetails.length,
        faces: response.FaceDetails.map(face => ({
          confidence: face.Confidence,
          boundingBox: face.BoundingBox,
          headPose: face.Pose,
          eyeDirection: face.EyeDirection,
          // Simplified interpretation of results
          interpretation: interpretResults(face)
        }))
      }
    };

    // Save image for debugging if needed
    if (process.env.SAVE_IMAGES === 'true') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const imagePath = path.join(dataDir, `image-${timestamp}.jpg`);
      fs.writeFileSync(imagePath, imageBuffer);
      console.log(`Saved image to ${imagePath}`);
    }

    res.json(results);
  } catch (error) {
    console.error('Error analyzing image:', error);
    
    // Handle specific AWS errors
    if (error.name === 'InvalidImageFormatException') {
      return res.status(400).json({ 
        error: 'Invalid image format', 
        details: 'The provided image is not in a supported format' 
      });
    }
    
    if (error.name === 'ImageTooLargeException') {
      return res.status(400).json({ 
        error: 'Image too large', 
        details: 'The provided image exceeds the maximum size limit' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to analyze image', 
      details: error.message 
    });
  }
});

// API endpoint to save tracking data
app.post('/api/save-data', (req, res) => {
  try {
    const { data, sessionId } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        error: 'Invalid data format',
        details: 'Data must be an array of tracking points'
      });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const id = sessionId || timestamp;
    const filePath = path.join(dataDir, `tracking-data-${id}.json`);
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({
      success: true,
      message: 'Data saved successfully',
      filePath
    });
  } catch (error) {
    console.error('Error saving tracking data:', error);
    res.status(500).json({
      error: 'Failed to save tracking data',
      details: error.message
    });
  }
});

// API endpoint to get tracking data
app.get('/api/tracking-data/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const filePath = path.join(dataDir, `tracking-data-${sessionId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Data not found',
        details: `No tracking data found for session ${sessionId}`
      });
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error retrieving tracking data:', error);
    res.status(500).json({
      error: 'Failed to retrieve tracking data',
      details: error.message
    });
  }
});

// Helper function to interpret results in human-readable format
function interpretResults(face) {
  let interpretation = {
    isLookingAtScreen: true,
    confidence: 'high',
    reasons: []
  };

  // Check if face confidence is high enough
  if (face.Confidence < 90) {
    interpretation.confidence = 'low';
    interpretation.reasons.push(`Face detection confidence is low (${face.Confidence.toFixed(2)}%)`);
  }

  // Check head pose
  if (face.Pose) {
    const { Yaw, Pitch } = face.Pose;
    const YAW_THRESHOLD = 25;
    const PITCH_THRESHOLD = 20;

    if (Math.abs(Yaw) > YAW_THRESHOLD) {
      interpretation.isLookingAtScreen = false;
      interpretation.reasons.push(`Head turned too far horizontally (${Yaw.toFixed(2)}°)`);
    }

    if (Math.abs(Pitch) > PITCH_THRESHOLD) {
      interpretation.isLookingAtScreen = false;
      interpretation.reasons.push(`Head tilted too far vertically (${Pitch.toFixed(2)}°)`);
    }
  }

  // Check eye direction
  if (face.EyeDirection && face.EyeDirection.Confidence >= 70) {
    const { Yaw, Pitch } = face.EyeDirection;
    const EYE_YAW_THRESHOLD = 15;
    const EYE_PITCH_THRESHOLD = 15;

    if (Math.abs(Yaw) > EYE_YAW_THRESHOLD) {
      interpretation.isLookingAtScreen = false;
      interpretation.reasons.push(`Eyes looking too far left/right (${Yaw.toFixed(2)}°)`);
    }

    if (Math.abs(Pitch) > EYE_PITCH_THRESHOLD) {
      interpretation.isLookingAtScreen = false;
      interpretation.reasons.push(`Eyes looking too far up/down (${Pitch.toFixed(2)}°)`);
    }
  } else if (face.EyeDirection) {
    interpretation.confidence = 'medium';
    interpretation.reasons.push(`Eye direction confidence is low (${face.EyeDirection.Confidence.toFixed(2)}%)`);
  }

  return interpretation;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    awsRegion: process.env.AWS_REGION || 'us-east-1'
  });
});

// Start server
app.listen(port, async () => {
  console.log(`Server running on http://localhost:${port}`);
  
  // Validate AWS credentials on startup
  const credentialsValid = await validateAwsCredentials();
  if (!credentialsValid) {
    console.warn('WARNING: AWS credentials validation failed. The application may not work correctly.');
  }
  
  // Create a simple .env file guide in the console
  console.log(`
To use this server, create a .env file with the following variables:
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=your_preferred_region (default: us-east-1)
PORT=3000 (optional)
SAVE_IMAGES=false (optional, set to true to save analyzed images for debugging)
`);
});