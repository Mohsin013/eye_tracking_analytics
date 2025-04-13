// DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture-btn');
const startTrackingBtn = document.getElementById('start-tracking-btn');
const stopTrackingBtn = document.getElementById('stop-tracking-btn');
const cameraOverlay = document.getElementById('camera-overlay');
const resultOverlay = document.getElementById('result-overlay');
const loader = document.getElementById('loader');
const resultsContainer = document.getElementById('results-container');
const rawData = document.getElementById('raw-data');
const toggleRawBtn = document.getElementById('toggle-raw');
const trackingLog = document.getElementById('tracking-log');
const trackingIndicator = document.getElementById('tracking-indicator');
const trackingStatusText = document.getElementById('tracking-status-text');
const canvasContainer = document.getElementById('canvas-container');

// Settings elements
const trackingIntervalInput = document.getElementById('tracking-interval');
const intervalValue = document.getElementById('interval-value');
const confidenceThresholdInput = document.getElementById('confidence-threshold');
const confidenceValue = document.getElementById('confidence-value');
const autoStartCheckbox = document.getElementById('auto-start');
const showOverlayCheckbox = document.getElementById('show-overlay');
const saveDataCheckbox = document.getElementById('save-data');

// Alert elements
const alertSuccess = document.getElementById('alert-success');
const alertWarning = document.getElementById('alert-warning');
const alertDanger = document.getElementById('alert-danger');
const warningReason = document.getElementById('warning-reason');
const dangerReason = document.getElementById('danger-reason');

// Result elements
const headYaw = document.getElementById('head-yaw');
const headPitch = document.getElementById('head-pitch');
const headRoll = document.getElementById('head-roll');
const eyeYaw = document.getElementById('eye-yaw');
const eyePitch = document.getElementById('eye-pitch');
const eyeConfidence = document.getElementById('eye-confidence');

// Configuration
const API_ENDPOINT = 'http://localhost:3000/api/analyze';
const ctx = canvas.getContext('2d');
let tracking = false;
let trackingInterval = null;
let TRACKING_INTERVAL_MS = 3000; // Default tracking interval
let CONFIDENCE_THRESHOLD = 70; // Default confidence threshold
let trackingData = []; // Array to store tracking data for analysis

// Initialize camera
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });
    
    video.srcObject = stream;
    
    // Set canvas dimensions to match video
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };
    
    addLogEntry('Camera initialized successfully', 'success');
    
    // Auto-start camera if enabled
    if (autoStartCheckbox.checked) {
      addLogEntry('Auto-starting camera...', 'info');
      // Wait a moment for the camera to stabilize
      setTimeout(() => {
        handleCapture();
      }, 1000);
    }
  } catch (error) {
    console.error('Error accessing camera:', error);
    addLogEntry('Error: Unable to access camera', 'danger');
    showAlert('danger', `Error accessing camera: ${error.message}`);
  }
}

// Take a snapshot from the video
function captureImage() {
  if (!video.videoWidth) {
    addLogEntry('Error: Video not ready', 'danger');
    return null;
  }
  
  // Draw the current video frame onto the canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Show the canvas container
  canvasContainer.style.display = 'block';
  
  // Convert canvas to blob to send to the server
  return new Promise(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', 0.9);
  });
}

// Send image to the backend for AWS Rekognition analysis
async function analyzeImage(imageBlob) {
  try {
    showLoader(true);
    
    const formData = new FormData();
    formData.append('image', imageBlob);
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    addLogEntry('Image analysis complete', 'success');
    return data;
  } catch (error) {
    console.error('Error analyzing image:', error);
    addLogEntry(`Error analyzing image: ${error.message}`, 'danger');
    throw error;
  } finally {
    showLoader(false);
  }
}

// Display analysis results on the UI
function displayResults(results) {
  resultsContainer.style.display = 'block';
  
  // Clear previous overlays
  resultOverlay.innerHTML = '';
  
  // Hide all alerts initially
  alertSuccess.style.display = 'none';
  alertWarning.style.display = 'none';
  alertDanger.style.display = 'none';
  
  // If no faces detected
  if (results.processed.facesDetected === 0) {
    alertDanger.style.display = 'block';
    dangerReason.textContent = 'No face detected in the image.';
    clearMetrics();
    addLogEntry('No face detected', 'danger');
    return;
  }
  
  // Get the first face (for simplicity)
  const face = results.processed.faces[0];
  
  // Display raw data
  rawData.textContent = JSON.stringify(results.raw, null, 2);
  
  // Display face bounding box if overlay is enabled
  if (showOverlayCheckbox.checked && face.boundingBox) {
    const { Width, Height, Left, Top } = face.boundingBox;
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.width = `${Width * 100}%`;
    marker.style.height = `${Height * 100}%`;
    marker.style.left = `${Left * 100}%`;
    marker.style.top = `${Top * 100}%`;
    resultOverlay.appendChild(marker);
  }
  
  // Display head pose metrics
  if (face.headPose) {
    headYaw.textContent = `${face.headPose.Yaw.toFixed(2)}° (±25° threshold)`;
    headPitch.textContent = `${face.headPose.Pitch.toFixed(2)}° (±20° threshold)`;
    headRoll.textContent = `${face.headPose.Roll.toFixed(2)}°`;
    
    // Color code based on values
    headYaw.style.color = Math.abs(face.headPose.Yaw) > 25 ? 'red' : 'green';
    headPitch.style.color = Math.abs(face.headPose.Pitch) > 20 ? 'red' : 'green';
  } else {
    clearHeadPoseMetrics();
  }
  
  // Display eye direction metrics
  if (face.eyeDirection) {
    eyeYaw.textContent = `${face.eyeDirection.Yaw.toFixed(2)}° (±15° threshold)`;
    eyePitch.textContent = `${face.eyeDirection.Pitch.toFixed(2)}° (±15° threshold)`;
    eyeConfidence.textContent = `${face.eyeDirection.Confidence.toFixed(2)}%`;
    
    // Color code based on values and confidence threshold
    const isEyeConfidenceLow = face.eyeDirection.Confidence < CONFIDENCE_THRESHOLD;
    eyeYaw.style.color = isEyeConfidenceLow ? 'orange' : 
                         (Math.abs(face.eyeDirection.Yaw) > 15 ? 'red' : 'green');
    eyePitch.style.color = isEyeConfidenceLow ? 'orange' : 
                          (Math.abs(face.eyeDirection.Pitch) > 15 ? 'red' : 'green');
    eyeConfidence.style.color = isEyeConfidenceLow ? 'orange' : 'green';
  } else {
    clearEyeDirectionMetrics();
  }
  
  // Display interpretation
  const interpretation = face.interpretation;
  if (interpretation) {
    if (interpretation.confidence === 'low') {
      alertWarning.style.display = 'block';
      warningReason.textContent = interpretation.reasons[0] || 'Low confidence in detection';
      addLogEntry(`Warning: ${interpretation.reasons[0] || 'Low confidence'}`, 'warning');
    } else if (!interpretation.isLookingAtScreen) {
      alertDanger.style.display = 'block';
      dangerReason.textContent = interpretation.reasons.join('. ');
      addLogEntry(`Not looking at screen: ${interpretation.reasons.join('. ')}`, 'danger');
    } else {
      alertSuccess.style.display = 'block';
      addLogEntry('Looking at screen', 'success');
    }
  }
  
  // Save tracking data if enabled
  if (saveDataCheckbox.checked) {
    saveTrackingData(face);
  }
}

// Save tracking data for analysis
function saveTrackingData(face) {
  const timestamp = new Date().toISOString();
  const dataPoint = {
    timestamp,
    headPose: face.headPose ? {
      yaw: face.headPose.Yaw,
      pitch: face.headPose.Pitch,
      roll: face.headPose.Roll
    } : null,
    eyeDirection: face.eyeDirection ? {
      yaw: face.eyeDirection.Yaw,
      pitch: face.eyeDirection.Pitch,
      confidence: face.eyeDirection.Confidence
    } : null,
    isLookingAtScreen: face.interpretation ? face.interpretation.isLookingAtScreen : null
  };
  
  trackingData.push(dataPoint);
  
  // Limit the amount of data stored to prevent memory issues
  if (trackingData.length > 1000) {
    trackingData = trackingData.slice(-1000);
  }
  
  // Log data saved
  if (trackingData.length % 10 === 0) {
    addLogEntry(`Saved ${trackingData.length} data points for analysis`, 'info');
  }
}

// Clear metrics display
function clearMetrics() {
  clearHeadPoseMetrics();
  clearEyeDirectionMetrics();
}

function clearHeadPoseMetrics() {
  headYaw.textContent = '-';
  headPitch.textContent = '-';
  headRoll.textContent = '-';
  headYaw.style.color = '';
  headPitch.style.color = '';
  headRoll.style.color = '';
}

function clearEyeDirectionMetrics() {
  eyeYaw.textContent = '-';
  eyePitch.textContent = '-';
  eyeConfidence.textContent = '-';
  eyeYaw.style.color = '';
  eyePitch.style.color = '';
  eyeConfidence.style.color = '';
}

// Toggle loader
function showLoader(show) {
  loader.style.display = show ? 'block' : 'none';
}

// Add entry to the tracking log
function addLogEntry(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  
  const timeSpan = document.createElement('span');
  timeSpan.className = 'log-timestamp';
  timeSpan.textContent = timestamp;
  
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  
  logEntry.appendChild(timeSpan);
  logEntry.appendChild(messageSpan);
  
  trackingLog.prepend(logEntry);
  
  // Limit the number of log items
  if (trackingLog.children.length > 50) {
    trackingLog.removeChild(trackingLog.lastChild);
  }
}

// Show alert message
function showAlert(type, message) {
  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type} alert-dismissible fade show`;
  alertElement.role = 'alert';
  
  alertElement.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Add to the top of the page
  document.querySelector('.container').prepend(alertElement);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    alertElement.classList.remove('show');
    setTimeout(() => {
      alertElement.remove();
    }, 150);
  }, 5000);
}

// Handle capture button click
async function handleCapture() {
  try {
    addLogEntry('Capturing image...', 'info');
    const imageBlob = await captureImage();
    
    if (!imageBlob) {
      addLogEntry('Failed to capture image', 'danger');
      return;
    }
    
    const results = await analyzeImage(imageBlob);
    displayResults(results);
  } catch (error) {
    console.error('Error in capture flow:', error);
    addLogEntry(`Error: ${error.message}`, 'danger');
    showLoader(false);
  }
}

// Start continuous tracking
function startTracking() {
  if (tracking) return;
  
  tracking = true;
  startTrackingBtn.disabled = true;
  stopTrackingBtn.disabled = false;
  trackingIndicator.classList.remove('status-inactive');
  trackingIndicator.classList.add('status-active');
  trackingStatusText.textContent = 'Tracking Active';
  addLogEntry('Continuous tracking started', 'success');
  
  // Immediately perform first capture
  handleCapture();
  
  // Set interval for continuous captures
  trackingInterval = setInterval(handleCapture, TRACKING_INTERVAL_MS);
}

// Stop continuous tracking
function stopTracking() {
  if (!tracking) return;
  
  tracking = false;
  startTrackingBtn.disabled = false;
  stopTrackingBtn.disabled = true;
  trackingIndicator.classList.remove('status-active');
  trackingIndicator.classList.add('status-inactive');
  trackingStatusText.textContent = 'Tracking Inactive';
  clearInterval(trackingInterval);
  addLogEntry('Continuous tracking stopped', 'warning');
}

// Update tracking interval
function updateTrackingInterval() {
  TRACKING_INTERVAL_MS = parseInt(trackingIntervalInput.value);
  intervalValue.textContent = `${(TRACKING_INTERVAL_MS / 1000).toFixed(1)}s`;
  
  // If tracking is active, restart with new interval
  if (tracking) {
    clearInterval(trackingInterval);
    trackingInterval = setInterval(handleCapture, TRACKING_INTERVAL_MS);
    addLogEntry(`Tracking interval updated to ${(TRACKING_INTERVAL_MS / 1000).toFixed(1)}s`, 'info');
  }
}

// Update confidence threshold
function updateConfidenceThreshold() {
  CONFIDENCE_THRESHOLD = parseInt(confidenceThresholdInput.value);
  confidenceValue.textContent = `${CONFIDENCE_THRESHOLD}%`;
  addLogEntry(`Confidence threshold updated to ${CONFIDENCE_THRESHOLD}%`, 'info');
}

// Toggle overlay visibility
function toggleOverlay() {
  if (!showOverlayCheckbox.checked) {
    resultOverlay.innerHTML = '';
  }
  addLogEntry(`Face detection overlay ${showOverlayCheckbox.checked ? 'enabled' : 'disabled'}`, 'info');
}

// Export tracking data
function exportTrackingData() {
  if (trackingData.length === 0) {
    showAlert('warning', 'No tracking data to export');
    return;
  }
  
  const dataStr = JSON.stringify(trackingData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `eye-tracking-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  addLogEntry(`Exported ${trackingData.length} data points`, 'success');
}

// Event listeners
captureBtn.addEventListener('click', handleCapture);
startTrackingBtn.addEventListener('click', startTracking);
stopTrackingBtn.addEventListener('click', stopTracking);
toggleRawBtn.addEventListener('click', () => {
  rawData.style.display = rawData.style.display === 'none' ? 'block' : 'none';
});

// Settings event listeners
trackingIntervalInput.addEventListener('input', updateTrackingInterval);
confidenceThresholdInput.addEventListener('input', updateConfidenceThreshold);
showOverlayCheckbox.addEventListener('change', toggleOverlay);

// Initialize application
window.addEventListener('load', () => {
  initCamera();
  addLogEntry('Application initialized', 'info');
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Space to capture
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      handleCapture();
    }
    
    // Enter to start/stop tracking
    if (e.code === 'Enter' && !e.repeat) {
      e.preventDefault();
      if (tracking) {
        stopTracking();
      } else {
        startTracking();
      }
    }
  });
  
  // Add export button to the UI
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-sm btn-outline-secondary mt-2';
  exportBtn.innerHTML = '<i class="bi bi-download"></i> Export Data';
  exportBtn.addEventListener('click', exportTrackingData);
  document.querySelector('.card-body').appendChild(exportBtn);
});