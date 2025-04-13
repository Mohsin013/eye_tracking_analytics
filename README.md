# Eye Tracking Analytics

A modern web application that uses AWS Rekognition to track eye movements and head pose in real-time. This application is perfect for educational settings, research, or any scenario where monitoring attention and engagement is important.


## Features

- **Real-time Eye Tracking**: Monitor eye direction and head pose using your device's camera
- **AWS Rekognition Integration**: Leverages powerful AWS facial recognition capabilities
- **Customizable Settings**: Adjust tracking interval, confidence thresholds, and more
- **Data Export**: Save tracking data for later analysis
- **Responsive Design**: Works on desktop and mobile devices
- **Keyboard Shortcuts**: Quick access to common functions

## Prerequisites

- Node.js (v14 or higher)
- AWS Account with Rekognition service access
- Webcam or camera-enabled device

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/eye-tracking.git
   cd eye-tracking
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with your AWS credentials:
   ```
   AWS_ACCESS_KEY_ID=your_access_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_key_here
   AWS_REGION=your_preferred_region
   PORT=3000
   SAVE_IMAGES=false
   ```

4. Start the server:
   ```
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

### Basic Usage

1. Allow camera access when prompted
2. Click "Capture" to take a single photo and analyze it
3. Click "Start" to begin continuous tracking
4. Click "Stop" to end tracking

### Settings

- **Tracking Interval**: Adjust how frequently images are captured and analyzed (1-10 seconds)
- **Confidence Threshold**: Set the minimum confidence level for eye direction detection
- **Auto-start Camera**: Automatically initialize the camera when the page loads
- **Show Face Detection Overlay**: Toggle the face bounding box overlay
- **Save Tracking Data**: Enable to collect data for later analysis

### Keyboard Shortcuts

- **Space**: Capture a single image
- **Enter**: Start/Stop continuous tracking

## How It Works

The application uses the following technologies:

1. **Frontend**: HTML, CSS, JavaScript with Bootstrap for UI
2. **Backend**: Node.js with Express
3. **AWS Rekognition**: For facial analysis and eye tracking
4. **WebRTC**: For accessing the device camera

The process flow is:

1. The user's camera captures an image
2. The image is sent to the backend server
3. The server forwards the image to AWS Rekognition
4. AWS Rekognition analyzes the image and returns facial data
5. The server processes the data and sends it back to the frontend
6. The frontend displays the results and updates the UI

## API Endpoints

- `POST /api/analyze`: Analyze an image and return facial data
- `POST /api/save-data`: Save tracking data for later analysis
- `GET /api/tracking-data/:sessionId`: Retrieve saved tracking data
- `GET /api/health`: Health check endpoint

## Data Storage

Tracking data is stored in the `data` directory as JSON files. Each session creates a new file with a timestamp or custom session ID.

## Troubleshooting

### Common Issues

- **Camera Access Denied**: Make sure to allow camera access in your browser
- **AWS Credentials Error**: Verify your AWS credentials in the `.env` file
- **No Face Detected**: Ensure good lighting and that your face is clearly visible
- **High CPU Usage**: Reduce the tracking interval or close other resource-intensive applications

### Debugging

For debugging purposes, you can set `SAVE_IMAGES=true` in your `.env` file to save all analyzed images to the `data` directory.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- AWS Rekognition for providing powerful facial analysis capabilities
- Bootstrap for the responsive UI framework
- The open-source community for various tools and libraries

## Contact

Your Name - [Mohsin Iqbal](https://linkedin.com/in/mohsin-iqbal-424336237) - mohsiniqbal826635@gmail.com

Project Link: [https://github.com/mohsin013/eye-tracking](https://github.com/yourusername/eye-tracking) 