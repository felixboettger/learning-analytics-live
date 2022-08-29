//jshint esversion:6

const [sessionKey, secret, id, participantName] = getCookieValues();
const [video, image, canvasInput, canvasCropped, canvasLandmarkPlot, canvasCombinedPlot, ctx1, ctx2, ctx3, ctxc, cameraSelectBox] = getElements();
let debugging = false;
let showDetectedEmotion = false;
let showStatusVector = false;
let showRotationAngle = false;
let showNumberOfDetectedHogs = false;
let combinedPlot = false;
let fileUpload = document.getElementById('fileUpload');
let folderUpload = document.getElementById('folder-upload'); // we store the identifier that allowa us to access this element 
let interval;
let errorAmount = 0;
let videoHideTimePassed = false;

const shiftDown = 0; // px to shift face image and landmarks down

let currentTime = new Date().getSeconds(); // to check if new second elapsed

startWebcam()

let surveyURL = "";
let goodbyeText = "";

// Hide video and info tiles card and display thank you card
const hideVideo = setTimeout(function () {
  document.getElementById("video-card").style.display = "none";
  document.getElementById("info-tiles-card").style.display = "none";
  document.getElementById("thank-you-card").style.display = "block";
  videoHideTimePassed = true;
}, 60000);

main()

async function main() {
  // Load face-api neural networks
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models/face-api');
  await faceapi.nets.ssdMobilenetv1.loadFromUri('/models/face-api');
  await faceapi.nets.faceExpressionNet.loadFromUri('/models/face-api');
  // auModel = await tf.loadLayersModel("/models/Krist/model.json");

  // create websocket connection
  webSocket = createWebSocket(sessionKey, id, secret);

  webSocket.onopen = function () {
    console.log("WebSocket connection to server established!");
    console.log("Sending 'ready' message to server.");
    webSocket.send(JSON.stringify({
      datatype: "ready"
    }));
  };

  window.addEventListener("beforeunload", function (e) {
    const Http = new XMLHttpRequest();
    const url = window.location.origin + "/register_close/" + id;
    Http.open("GET", url);
    Http.send();
    return null;
  });

  webSocket.addEventListener("message", function (event) {
    const messageJSON = JSON.parse(event.data);
    const datatype = messageJSON.datatype;
    if (datatype === "start") {
      console.log("Server sent START signal!");
      interval = setInterval(sendIfSecondElapsed, 250);
    } else if (datatype === "end") {
      console.log("Server sent STOP signal!")
      document.cookie = "goodbyetext=" + messageJSON.goodbyeText
      document.cookie = "surveyurl=" + messageJSON.surveyURL
      const url = window.location;
      url.replace(url.protocol + "//" + url.host + "/thank-you")
    }
  });

  webSocket.onclose = function () {
    alert("Session has ended unexpectedly. Click ok to go back to the homepage.");
    const url = window.location;
    url.replace(url.protocol + "//" + url.host + "/");
  };
}

/**
 * getStatus - Function that generates the statusVector object.
 *
 * @return {object} statusVector object that contains the current status of the participant.
 */
async function generateStatus() {

  let statusVector = {
    err: "", // error string
    e: "not detected", // emotion
    t: new Date(),
    lm: [], // list of lists of length 2 of length 68
    h: [], // list of 5408 
    au: [], // list of active AUs
  };

  const displaySize = { width: canvasInput.width, height: canvasInput.height }
  // still image is in canvasInput

  const detections = await faceapi.detectSingleFace(canvasInput).withFaceLandmarks().withFaceExpressions(); // check without tinyfacedetector

  if (typeof detections != "undefined") {
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    const alr = resizedDetections.alignedRect._box;
    const det = resizedDetections.detection._box;
    const use = det;   // define here the bounding box that we are using


    const useSide = "long"; // long: resize to fit bigger side in canvasCropped, short: resize to let smaller side fill canvasCropped


    //console.log(resizedDetections);
    if (debugging && combinedPlot){
      ctxc.clearRect(0, 0, canvasCombinedPlot.width, canvasCombinedPlot.height);
      ctxc.drawImage(canvasInput, 0, 0, canvasInput.width, canvasInput.height);
      faceapi.draw.drawFaceLandmarks(canvasCombinedPlot, resizedDetections);
      // faceapi.draw.drawDetections(canvasCombinedPlot, resizedDetections);
      faceapi.draw.drawFaceExpressions(canvasCombinedPlot, resizedDetections);
      ctxc.strokeStyle = "red";
      ctxc.strokeRect(det._x, det._y, det._width, det._height);
      ctxc.strokeStyle = "blue";
      ctxc.strokeRect(alr._x, alr._y, alr._width, alr._height);
      ctxc.strokeStyle = "green";
      ctxc.strokeRect(use._x, use._y, use._width, use._height);
    }

    if (typeof use != "undefined") {
      if (checkFullFaceInPicture(use._x, use._y, use._width, use._height)) {
        if (typeof resizedDetections.unshiftedLandmarks != "undefined") {
          const resizedLandmarks = resizeLandmarks(resizedDetections.landmarks._positions, use, useSide);
          statusVector.lm = rotateLandmarks(resizedLandmarks, resizedDetections.angle.roll);
        } else {
          console.log("Landmarks not detected, returning without landmarks.");
        }
        if (typeof resizedDetections.expressions != "undefined") {
          statusVector.e = Object.keys(resizedDetections.expressions).reduce((a, b) => resizedDetections.expressions[a] > resizedDetections.expressions[b] ? a : b);
          debugging && showDetectedEmotion ? console.log("Emotion: ", statusVector.e) : "";
        } else {
          console.log("Emotion not detected, returning without emotion.");
        }
        if (statusVector.lm.length === 68) {
          cropRotateFace(use._x, use._y, use._width, use._height, resizedDetections.angle.roll, useSide);
          maskFaceNew(statusVector.lm);
          plotFace(statusVector.lm);
          statusVector.h = await getHogs();
          debugging && showNumberOfDetectedHogs ? console.log("# Detected Hogs: ", statusVector.h.length) : "";
          if (debugging && combinedPlot){
            const box = { x: 0, y: 0, width: 0, height: 0 }
            const drawOptions = {
              label: '# Landmarks: ' + statusVector.lm.length + ", # Hogs: " + statusVector.h.length,
              lineWidth: 0
            }
            const drawBox = new faceapi.draw.DrawBox(box, drawOptions)
            drawBox.draw(document.getElementById('canvas-combined-plot'));
          } 
        } else {
          debugging ? console.log("No hogs were calculated as landmarks are missing.") : "";
        }
      } else {
        debugging ? console.log("Face not completely in picture") : "";
        statusVector.err += "face not in picture"
      }
    } else {
      debugging ? console.log("Face was not detected") : "";
    }
  } else {
    debugging ? console.log("Face was not detected") : "";
  }
  
  debugging && showStatusVector ? console.log("Status Vector to send: ", statusVector) : "";
  return statusVector;
}

/**
 * sendStatus - Generates a status, then sends it to server via WebSocket.
 *
 */
function sendStatus() {

  ctx1.clearRect(0, 0, canvasInput.width, canvasInput.height); // clear canvas
  ctx1.drawImage(video, 0, 0, video.width, video.height); // capturing still image from video feed and saving it to canvasInput

  newGenerateStatus().then(statusVector => {

    statusJSON = JSON.stringify({
      datatype: "status",
      data: statusVector
    })
    webSocket.send(statusJSON)
  });
};

function checkFullFaceInPicture(x, y, faceWidth, faceHeight) {
  if ((x < 0) || (y < 0) || (x + faceWidth > canvasInput.width) || (y + faceHeight > canvasInput.height)) {
    return false;
  } else {
    return true;
  }
}

async function getHogs() {
  var options = {
    cellSize: 8,    // length of cell in px
    blockSize: 2,   // length of block in number of cells
    blockStride: 1, // number of cells to slide block window by (block overlap)
    bins: 8,        // bins per histogram (=orientations)
    norm: 'L2-hys'      // block normalization method (=standard in hog())
  }
  var curr_image = await IJS.Image.load(canvasCropped.toDataURL())
  hogs = extractHOG(curr_image, options);
  hogs = hogs.map(function (x) {
    return Number(x.toFixed(3));
  });
  return hogs;
}

function resizeLandmarks(landmarks,  use, useSide) {
  const landmarkList = [];
  for (let i = 0; i < landmarks.length; i++) {
    landmarkList.push(getNewCoords(landmarks[i]._x, landmarks[i]._y, use._x, use._y, use._width, use._height, useSide));
  }
  return landmarkList;
}

// function getNewCoords(x, y, upperLeftX, upperLeftY, lowerRightX, lowerRightY){
//   sizeX = lowerRightX - upperLeftX;
//   sizeY = lowerRightY - upperLeftY;

//   centerX = (lowerRightX + upperLeftX)/2;
//   centerY = (lowerRightY + upperLeftY)/2;
  
//   offsetX = (centerX-sizeX/2)*112/sizeX;
//   offsetY = (centerY-sizeY/2)*112/sizeY;

//   x = x * 112/sizeX - offsetX;
//   y = y * 112/sizeY - offsetY;

  
//   return [x.toFixed(3), (y + shiftDown).toFixed(3)];
// }

function getNewCoords(x, y, boundingBoxUpperLeftX, boundingBoxUpperLeftY, width, height, useSide){
  x = x - boundingBoxUpperLeftX;
  y = y - boundingBoxUpperLeftY;
  const smallSide = Math.min(width, height);
  const bigSide = Math.max(width, height);
  const scaleSide = (useSide === "long") ? bigSide : smallSide;
  const ratio = (112/scaleSide);
  const newX = x * ratio;
  const newY = y * ratio;
  return [newX.toFixed(3), newY.toFixed(3)];
}


/**
 * createWebSocket - Function that creates a WebSocket and connects to the server.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {int} participantId Unique ID for the participant in respect to their session.
 * @param  {string} secret Secret that is used to authenticate the participant.
 * @return {object}
 */
function createWebSocket(sessionKey, id, secret) {
  const wl = window.location;
  const webSocketProtocol = (wl.protocol === "https:") ? "wss://" : "ws://";
  const domain = document.domain;
  const port = location.port;
  const webSocketAddress = webSocketProtocol + domain + ":" + port;
  const sessionKeyParam = "/?sessionKey=" + sessionKey;
  const participantParam = "&participantId=" + id;
  const secretParam = "&psecret=" + secret;
  const typeParam = "&type=client";
  const webSocketURL = webSocketAddress + sessionKeyParam + secretParam + participantParam + typeParam;
  return new WebSocket(webSocketURL, "echo-protocol");
}

/**
 * getCookieValues - Function that reads cookies.
 *
 * @return {array} Array containing sessionKey, secret, id and name as saved in cookies.
 */
function getCookieValues() {
  const cookieValues = document.cookie.split('; ');
  const sessionKey = cookieValues.find(row => row.startsWith('sessionKey=')).split('=')[1];
  const secret = cookieValues.find(row => row.startsWith('psecret=')).split('=')[1];
  const id = cookieValues.find(row => row.startsWith('participantId=')).split('=')[1];
  const participantName = cookieValues.find(row => row.startsWith('participantName=')).split('=')[1];
  return [sessionKey, secret, id, participantName];
};

/**
 * getElements - Function that returns references for some HTML Objects.
 *
 * @return {array} Array of references to HTML Objects.
 */
function getElements() {
  const video = document.getElementById("video-input");
  const image = document.getElementById('image-input');
  const canvasInput = document.getElementById("canvas-input");
  const ctx1 = canvasInput.getContext("2d");
  const canvasCropped = document.getElementById("canvas-cropped");
  const ctx2 = canvasCropped.getContext("2d");
  const cameraSelectBox = document.getElementById("camera-select-box");
  const canvasLandmarkPlot = document.getElementById("canvas-landmark-plot");
  const canvasCombinedPlot = document.getElementById("canvas-combined-plot");
  const ctx3 = canvasLandmarkPlot.getContext("2d");
  const ctxc = canvasCombinedPlot.getContext("2d");
  return [video, image, canvasInput, canvasCropped, canvasLandmarkPlot, canvasCombinedPlot, ctx1, ctx2, ctx3, ctxc, cameraSelectBox];
}

function plotFace(landmarkList) {

  ctx3.clearRect(0, 0, 112, 112);
  ctx3.drawImage(canvasCropped, 0, 0);
  ctx3.strokeStyle = "orange";

  for (let i = 0; i < landmarkList.length; i++) {
    x = landmarkList[i][0];
    y = landmarkList[i][1];

    ctx3.strokeRect(x, y, 1, 1);
    ctx3.fillRect(x, y, 1, 1);
  }
}

/**
 * startWebcam - Function that starts the webcam and displays it in the "video" object.
 *
 */
function startWebcam() {
  cameraSelectBox.addEventListener('click', event => {
    if (typeof currentStream !== 'undefined') {
      stopMediaTracks(currentStream);
    }
    const videoConstraints = {};
    if (cameraSelectBox.value === '') {
      videoConstraints.facingMode = 'environment';
    } else {
      videoConstraints.deviceId = { exact: cameraSelectBox.value };
    }
    const constraints = {
      video: videoConstraints,
      audio: false
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(stream => {
        currentStream = stream;
        video.srcObject = stream;
        return navigator.mediaDevices.enumerateDevices();
      })
      .then(gotDevices)
      .catch(error => {
        console.error(error);
      });
  });
}

function gotDevices(mediaDevices) {
  cameraSelectBox.innerHTML = '<option value="" disabled selected>Click to change webcam</option>';
  cameraSelectBox.appendChild(document.createElement('option'));
  let count = 1;
  mediaDevices.forEach(mediaDevice => {
    if (mediaDevice.kind === 'videoinput') {
      const option = document.createElement('option');
      option.value = mediaDevice.deviceId;
      const label = mediaDevice.label || `Camera ${count++}`;
      const textNode = document.createTextNode(label);
      option.appendChild(textNode);
      cameraSelectBox.appendChild(option);
    }
  });
}

function cropRotateFace(x, y, width, height, angle, useSide) {  // x,y = topleft x,y
  debugging && showRotationAngle ? console.log("Rotation angle:", angle.toFixed(3), "rad") : "";
  const tempCanvas1 = document.createElement("canvas");
  const tctx1 = tempCanvas1.getContext("2d");
  tempCanvas1.height = tempCanvas1.width = 112;
  tctx1.fillRect(0, 0, tempCanvas1.width, tempCanvas1.height);
  //tctx1.strokeRect(tempCanvas1.width / 2, tempCanvas1.height / 2, 1, 1); //center of rotation
  tctx1.translate(tempCanvas1.width / 2, tempCanvas1.height / 2);
  tctx1.strokeStyle = "orange";
  tctx1.rotate(angle);
  tctx1.translate(-tempCanvas1.width / 2, -tempCanvas1.height / 2);
  const longSideScale = Math.min(tempCanvas1.width / width, tempCanvas1.height / height);
  const shortSideScale = Math.max(tempCanvas1.width / width, tempCanvas1.height / height);
  let scale = (useSide === "long") ? longSideScale : shortSideScale;
  tctx1.drawImage(canvasInput, x, y, width, height, 0,0, width*scale, height*scale);

  ctx2.clearRect(0, 0, 112, 112);
  ctx2.drawImage(tempCanvas1, 0, shiftDown);
}

// Stop all camera feeds once camera selection changes
function stopMediaTracks(stream) {
  stream.getTracks().forEach(track => {
    track.stop();
  });
}

function rotateLandmarks(landmarks, angle) {
  const rotatedLandmarks = []
  cosAlpha = Math.cos(angle);
  sinAlpha = Math.sin(angle);

  for (let i = 0; i < landmarks.length; i++) {
    currentX = landmarks[i][0] - 56;
    currentY = landmarks[i][1] - 56;

    newX = currentX * cosAlpha - currentY * sinAlpha;
    newY = currentX * sinAlpha + currentY * cosAlpha;

    rotatedLandmarks.push([newX + 56, newY + 56]);
  }
  return rotatedLandmarks;
}

function maskFace(faceLandmarks) {
  const margin = 0;
  ctx2.beginPath();
  const fistCoordinateX = faceLandmarks[0][0] - margin;
  const fistCoordinateY = faceLandmarks[0][1];
  ctx2.moveTo(fistCoordinateX, fistCoordinateY);
  for (let i = 1; i < 17; i++) {
    currentCoordinate = faceLandmarks[i];
    currentX = currentCoordinate[0];
    currentX = i < 8 ? currentX - margin : currentX + margin;
    currentY = currentCoordinate[1];
    ctx2.lineTo(currentX, currentY);
  }

  const rightBrowRightX = faceLandmarks[26][0];
  const rightBrowRightY = faceLandmarks[26][1];
  ctx2.lineTo(rightBrowRightX + 10, rightBrowRightY - 3);

  const rightBrowMiddleX = faceLandmarks[20][0];
  const rightBrowMiddleY = faceLandmarks[20][1] - 8;
  ctx2.lineTo(rightBrowMiddleX, rightBrowMiddleY - 3);

  const leftBrowMiddleX = faceLandmarks[25][0];
  const leftBrowMiddleY = faceLandmarks[25][1] - 8;
  ctx2.lineTo(leftBrowMiddleX, leftBrowMiddleY - 3);

  const leftBrowLeftX = faceLandmarks[18][0];
  const leftBrowLeftY = faceLandmarks[18][1];
  ctx2.lineTo(leftBrowLeftX - 10, leftBrowLeftY - 3);

  ctx2.lineTo(fistCoordinateX, fistCoordinateY);
  ctx2.lineTo(0, fistCoordinateY)
  ctx2.lineTo(0, 0);
  ctx2.lineTo(112, 0);
  ctx2.lineTo(112, 112);
  ctx2.lineTo(0, 112);
  ctx2.lineTo(0, fistCoordinateY);

  ctx2.closePath();
  ctx2.fill();
}

function maskFaceNew(faceLandmarks) {
  const marginX = 0;
  // c = sqrt((x_a - x_b)^2 + (y_a - y_b)^2)
  const eyeEyeBrowDistance = Math.sqrt(Math.pow((faceLandmarks[37][0] - faceLandmarks[19][0]), 2) + Math.pow((faceLandmarks[37][1] - faceLandmarks[19][1]), 2));
  // In pyfeat paper, 1.5 * eyeEyeBrowDistance was used, change rotation to not have white parts in special cases
  const marginY = eyeEyeBrowDistance;
  ctx2.beginPath();
  const fistCoordinateX = faceLandmarks[0][0] += marginX;
  const fistCoordinateY = faceLandmarks[0][1];
  ctx2.moveTo(fistCoordinateX, fistCoordinateY);
  for (let i = 1; i < 17; i++) {
    currentCoordinate = faceLandmarks[i];
    currentX = currentCoordinate[0];
    if (i < 8){
      currentX += marginX;
    } else if (i > 19){
      currentX -= marginX;
    }
    
    currentY = currentCoordinate[1];
    ctx2.lineTo(currentX, currentY);
  }
  // Brows Right
  for (let i = 26; i > 24; i--){
    currentCoordinate = faceLandmarks[i];
    currentX = currentCoordinate[0];
    currentY = currentCoordinate[1] - marginY;
    ctx2.lineTo(currentX, currentY);
  }
  // Brows Left
  for (let i = 18; i > 16; i--){
    currentCoordinate = faceLandmarks[i];
    currentX = currentCoordinate[0];
    currentY = currentCoordinate[1] - marginY;
    ctx2.lineTo(currentX, currentY);
  }

  ctx2.lineTo(fistCoordinateX, fistCoordinateY);
  ctx2.lineTo(0, fistCoordinateY)
  ctx2.lineTo(0, 0);
  ctx2.lineTo(112, 0);
  ctx2.lineTo(112, 112);
  ctx2.lineTo(0, 112);
  ctx2.lineTo(0, fistCoordinateY);

  ctx2.closePath();
  ctx2.fill();
}


function debug() {
  debugging = true;
  clearTimeout(hideVideo);

  document.getElementById("video-card").style.display = "block";
  document.getElementById("info-tiles-card").style.display = "block";
  document.getElementById('secret-menu-card').style.display = "block";
  
  secretMenu();

  return "Debugging enabled";
}

function sendIfSecondElapsed() {
  if (errorAmount > 10) {
    document.getElementById("video-card").style.display = "block";
    document.getElementById("thank-you-card").style.display = "none";
    document.getElementById("error-card").style.display = "block";
  } else if (errorAmount == 0){
    if (videoHideTimePassed == true) {
      document.getElementById("video-card").style.display = "none";
    }
    
    document.getElementById("thank-you-card").style.display = "block";
    document.getElementById("error-card").style.display = "none";
  }
  // console.log("Check if elapsed");
  if (currentTime != new Date().getSeconds()) {
    // console.log("Elapsed");
    currentTime = new Date().getSeconds();
    sendStatus();
  }
}

function secretMenu(){

  document.getElementById("debug-combined-plot").addEventListener("change", function(){
    combinedPlot = this.checked;
    if (this.checked){
      document.getElementById("video-input").style.display = "none";
      document.getElementById("canvas-combined-plot").style.display = "block";
    } else {
      document.getElementById("video-input").style.display = "block";
      document.getElementById("canvas-combined-plot").style.display = "none";
    };
  });

  document.getElementById("debug-emotion").addEventListener("change", function(){
    showDetectedEmotion = this.checked;
  });

  document.getElementById("debug-status-vector").addEventListener("change", function(){
    showStatusVector = this.checked;
  });

  document.getElementById("debug-rotation-angle").addEventListener("change", function(){
    showRotationAngle = this.checked;
  });

  document.getElementById("debug-nr-hogs").addEventListener("change", function(){
    showNumberOfDetectedHogs = this.checked;
  });

  document.getElementById("debug-canvas-cropped").addEventListener("change", function(){
    if (this.checked){
      document.getElementById("canvas-cropped").style.display = "inline-block";
    } else {
      document.getElementById("canvas-cropped").style.display = "none";
    }
  })

  document.getElementById("debug-landmark-plot").addEventListener("change", function(){
    if (this.checked){
      document.getElementById("canvas-landmark-plot").style.display = "inline-block";
    } else {
      document.getElementById("canvas-landmark-plot").style.display = "none";
    }
  })

  document.getElementById("download-sample-btn").addEventListener("click", function(){
    downloadSample();
  })
}

function downloadSample(){
  filename = prompt("Filename: ");
  generateStatus().then(statusVector => downloadStatusVector(statusVector, filename));  // excecute the function 
}

//function to open a folder and load the image
function generateSampleFolderData(){
  let i = 0;
  clearInterval(interval);
  const generatingInterval = setInterval(next, 1500);
  const files = this.files;

  function next(){
    const file = files[i];
    let img = new Image();
    img.onload = function(){  
      ctx1.clearRect(0,0,canvasInput.width, canvasInput.height );
      var scale = Math.min(canvasInput.width / img.width, canvasInput.height / img.height);
      var x = (canvasInput.width / 2) - (img.width / 2) * scale;
      var y = (canvasInput.height / 2) - (img.height / 2) * scale;
      ctx1.drawImage(img, x, y, img.width * scale, img.height * scale);
      generateStatus().then(statusVector => {
        downloadStatusVector(statusVector, file.name.split(".")[0]);
        i += 1;
        if (i == files.length){
          clearInterval(generatingInterval);
        }
      });
    };
    img.src = URL.createObjectURL(file);
  }
} 


function downloadStatusVector(statusVector, filename){
  console.log("Downloading: ", filename);
  const downloadHogs = document.createElement("a");
  downloadHogs.setAttribute("download", filename + "_hogs");
  downloadHogs.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(statusVector.h));
  const downloadBig = document.createElement("a");
  downloadBig.setAttribute("download", filename + "_big");
  downloadBig.setAttribute("href", document.getElementById('canvas-input').toDataURL());
  const downloadSmall = document.createElement("a");
  downloadSmall.setAttribute("download", filename + "_small");
  downloadSmall.setAttribute("href", document.getElementById('canvas-cropped').toDataURL());
  const downloadLandmarks = document.createElement("a");
  downloadLandmarks.setAttribute("download", filename +"_landmarks");
  downloadLandmarks.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(statusVector.lm));
  downloadHogs.click();
  downloadBig.click();
  downloadSmall.click();
  downloadLandmarks.click();
}

fileUpload.onchange = readImage;

function readImage() {
  if ( this.files && this.files[0] ) {
      var FR= new FileReader();
      FR.onload = function(e) {
         var img = new Image();
         img.onload = function() {
          console.log("Stopped data transmission for manual upload, reload page to continue transmitting data.");
          clearInterval(interval);
          document.getElementById("canvas-input").style.display = "block";
          ctx1.clearRect(0, 0, canvasInput.width, canvasInput.height);
          var scale = Math.min(canvasInput.width / img.width, canvasInput.height / img.height);
          var x = (canvasInput.width / 2) - (img.width / 2) * scale;
          var y = (canvasInput.height / 2) - (img.height / 2) * scale;
          ctx1.drawImage(img, x, y, img.width * scale, img.height * scale);
         };
         img.src = e.target.result;
      };       
      FR.readAsDataURL( this.files[0] );
  }
}

document.getElementById("take-picture-btn").addEventListener("click", function(){
  document.getElementById("canvas-input").style.display = "block";
  console.log("Stopped data transmission for manual upload, reload page to continue transmitting data.");
  clearInterval(interval);
  ctx1.clearRect(0, 0, canvasInput.width, canvasInput.height); // clear canvas
  ctx1.drawImage(video, 0, 0, video.width, video.height); // capturing still image from video feed and saving it to canvasInput
})

document.getElementById("generate-status-btn").addEventListener("click", function(){
  generateStatus();
})

folderUpload.onchange = generateSampleFolderData;

cameraSelectBox.click()

// Check for all available cameras and run gotDevices function
navigator.mediaDevices.enumerateDevices().then(gotDevices);

