//jshint esversion:6

const [sessionKey, secret, id, participantName] = getCookieValues();
const [video, image, canvasInput, canvasCropped, ctx1, ctx2, cameraSelectBox] = getElements();
startWebcam()

let surveyURL = "";
let goodbyeText = "";

// Hide video and info tiles card and display thank you card
setTimeout(function() {
    // document.getElementById("video-card").style.display = "none";
    document.getElementById("info-tiles-card").style.display = "none";
    document.getElementById("thank-you-card").style.display = "block";
}, 180000);

main()

async function main(){
    // Load face-api neural networks
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models/face-api');
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models/face-api'); // TODO: check if non-tiny model performs better
    await faceapi.nets.faceExpressionNet.loadFromUri('/models/face-api')

    // create websocket connection
    webSocket = createWebSocket(sessionKey, id, secret);

    webSocket.onopen = function() {
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

    webSocket.addEventListener("message", function(event) {
        const messageJSON = JSON.parse(event.data);
        const datatype = messageJSON.datatype;
        if (datatype === "start") {
          console.log("Server sent START signal!");
          setInterval(sendStatus, messageJSON.interval);
        } else if (datatype === "end"){
          console.log("Server sent STOP signal!")
          document.cookie = "goodbyetext=" + messageJSON.goodbyeText
          document.cookie = "surveyurl=" + messageJSON.surveyURL
          const url = window.location;
          url.replace(url.protocol + "//" + url.host + "/thank-you")
        }
      });

      webSocket.onclose = function() {
        alert("Session has ended unexpectedly. Click ok to go back to the homepage.");
        const url = window.location;
        url.replace(url.protocol + "//" + url.host + "/");
      };

      /**
   * sendStatus - Generates a status, then sends it to server via WebSocket.
   *
   */
  function sendStatus(){

    ctx1.clearRect(0, 0, canvasInput.width, canvasInput.height); // clear canvas
    ctx1.drawImage(video, 0, 0, video.width, video.height); // capturing still image from video feed and saving it to canvasInput

    generateStatus().then(statusVector => {
      
      // console.log("Status Vector to send: ", statusVector);

      statusJSON = JSON.stringify({
        datatype: "status",
        data: statusVector
      })

      webSocket.send(statusJSON)
      
    });
  };

  /**
 * getStatus - Function that generates the statusVector object.
 *
 * @return {object} statusVector object that contains the current status of the participant.
 */
async function generateStatus(){

  let statusVector = {
    err: "", // error string
    e: "not detected", // emotion
    t: new Date(),
    lm: [], // list of lists of length 2 of length 68
    h: [] // list of 5408 
  };

  const displaySize = { width: canvasInput.width, height: canvasInput.height }
  // still image is in canvasInput

  const detections = await faceapi.detectSingleFace(canvasInput, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions(); // check without tinyfacedetector

  if (typeof detections != "undefined"){
    const resizedDetections = faceapi.resizeResults(detections, displaySize);

    // ctx1.fillStyle = 'black';
    const det = resizedDetections.detection._box;
    // const rect = resizedDetections.alignedRect._box;

    // ctx1.strokeStyle = 'black';
    // ctx1.strokeRect(det._x,det._y,det._width,det._height);
    // ctx1.strokeStyle = 'orange';
    // ctx1.strokeRect(rect._x,rect._y,rect._width,rect._height);

    // TODO: Check if full face is in canvas
    // const fullFaceInPicture = (dx > 0) && (dy > 0) && (dx + width < canvasInput.height) && (dy + height < canvasInput.height);

    // console.log(resizedDetections.angle.roll);
    // plotFace(resizedDetections.unshiftedLandmarks._positions, det._x,det._y,det._width,det._height);

    if (typeof resizedDetections.unshiftedLandmarks != "undefined"){
      statusVector.lm = resizeLandmarks(resizedDetections.unshiftedLandmarks._positions, det._x,det._y,det._width,det._height);
    } else {
      console.log("Landmarks not detected, returning without landmarks.");
    }
    if (typeof resizedDetections.expressions != "undefined"){
      statusVector.e = Object.keys(resizedDetections.expressions).reduce((a, b) => resizedDetections.expressions[a] > resizedDetections.expressions[b] ? a : b);
    } else {
      console.log("Emotion not detected, returning without emotion.");
    }
    if (statusVector.lm.length === 68){
      // canvasWidth = canvasInput.width;
      // canvasHeight = canvasInput.height;
      // ctx1.translate(canvasWidth/2, canvasWidth/2);
      // ctx1.rotate(resizedDetections.angle.roll);
      // ctx1.translate(-canvasWidth/2, -canvasWidth/2);
      ctx2.drawImage(canvasInput, det._x,det._y,det._width,det._height, 0, 0, 112, 112);
      // ctx1.clearRect(0, 0, canvasInput.width, canvasInput.height); // clear canvas
      statusVector.h = await getHogs()
      //ctx2.clearRect(0, 0, canvasInput.width, canvasInput.height); // clear canvas
    } else {
      console.log("No hogs were calculated as landmarks are missing.")
    } 
  } else {
      console.log("Face not detected, returning statusVector with just the time")
  }
  return statusVector;
};

async function getHogs(){
  var options = {
    cellSize: 8,    // length of cell in px
    blockSize: 2,   // length of block in number of cells
    blockStride: 1, // number of cells to slide block window by (block overlap)
    bins: 8,        // bins per histogram
    norm: 'L2'      // block normalization method
  }
  var curr_image = await IJS.Image.load(canvasCropped.toDataURL())
  hogs = extractHOG(curr_image, options);
  hogs = hogs.map(function(x){
    return Number(x.toFixed(3));
  });
  return hogs
}

function resizeLandmarks(landmarks, x, y, width, height){
  landmarkList = [];
  sizeMax = Math.max(width, height)
  centerX = width/2;
  centerY = height/2;
  offsetX = (centerX-sizeMax/2)*112/sizeMax;
  offsetY = (centerY-sizeMax/2)*112/sizeMax;

  for (let i = 0; i < landmarks.length; i++){
    x = landmarks[i]._x;
    y = landmarks[i]._y;
    x = x * 112/sizeMax - offsetX;
    y = y * 112/sizeMax - offsetY;
    
    landmarkList.push([x, y]);
  }
  return landmarkList;
}



}

/**
 * createWebSocket - Function that creates a WebSocket and connects to the server.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {int} participantId Unique ID for the participant in respect to their session.
 * @param  {string} secret Secret that is used to authenticate the participant.
 * @return {object}
 */
 function createWebSocket(sessionKey, id, secret){
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
 function getElements(){
    const video = document.getElementById("video-input");
    const image = document.getElementById('image-input');
    const canvasInput = document.getElementById("canvas-input");
    const ctx1 = canvasInput.getContext("2d");
    const canvasCropped = document.getElementById("canvas-cropped");
    const ctx2 = canvasCropped.getContext("2d");
    const cameraSelectBox = document.getElementById("camera-select-box");
    return [video, image, canvasInput, canvasCropped, ctx1, ctx2, cameraSelectBox];
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

// Stop all camera feeds once camera selection changes
function stopMediaTracks(stream) {
  stream.getTracks().forEach(track => {
    track.stop();
  });
}

cameraSelectBox.click()

// Check for all available cameras and run gotDevices function
navigator.mediaDevices.enumerateDevices().then(gotDevices);