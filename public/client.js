//jshint esversion:6

const [sessionKey, secret, id, name] = getCookieValues();
displayParticipantInfo(name, sessionKey, id);
const [video, image, canvasInput, canvasCropped, ctx1, ctx2, idle] = getElements();
startWebcam();

var cocoSsdModel;
var blazefaceModel;
var emotionModel;

const recentEmotionsArray = [];
const emotionWeights = {
  'angry': 0.25,
  'disgust': 0.2,
  'fear': 0.3,
  'happy': 0.6,
  'sad': 0.3,
  'surprise': 0.6,
  'neutral': 0.9
};

main();

// --- Other Event Listeners ---

// Buttons

document.getElementById("send-comment-btn").addEventListener("click", function() {
  const comment = document.getElementById("input-comment").value;
  document.getElementById("input-comment").value = "";
  webSocket.send(JSON.stringify({
    datatype: "comment",
    data: comment
  }));
});

// --- Function Definitions ---


/**
 * main - Main function (needed because await is not supported outside a function)
 *
 */
async function main(){
  blazefaceModel = await blazeface.load();
  cocoSsdModel = await cocoSsd.load();
  emotionModel = await tf.loadLayersModel("/models/Ufuk/model.json");
  webSocket = createWebSocket(sessionKey, id, secret);

  // --- WebSocket Event Listeners ---

  webSocket.onopen = function() {
    console.log("WebSocket connection to server established!");
    console.log("Sending 'ready' message to server.")
    webSocket.send(JSON.stringify({
      datatype: "ready"
    }));
  };

  webSocket.addEventListener("message", function(event) {
    const messageJSON = JSON.parse(event.data);
    const datatype = messageJSON.datatype;
    if (datatype === "start") {
      console.log("Server sent start signal!");
      setInterval(sendStatus, messageJSON.interval);
    };
  });

  webSocket.onclose = function() {
    alert("Session has ended. Click ok to go back to the homepage.");
    const url = window.location;
    url.replace(url.protocol + "//" + url.host + "/");
  };


  /**
   * sendStatus - Generates a status, then sends it to server via WebSocket.
   *
   */
  function sendStatus(){
    idle.setAttribute('class', 'material-icons icon-red');
    ctx1.drawImage(video, 0, 0, video.width, video.height);
    image.src = canvasInput.toDataURL("image/png");
    const t0 = performance.now(); // Start performance measurement
    getStatus().then(statusVector => {
      const t1 = performance.now();
      const timeToComplete = Math.round(t1 - t0);
      setPerformanceTile(timeToComplete);
      idle.setAttribute('class', 'material-icons icon-green');
      if (!(statusVector === undefined)) {
        webSocket.send(JSON.stringify({
          datatype: "status",
          data: statusVector
        }));
      };
    });
  };
};

/**
 * checkIfLookingAtCamera - Function to estimate if participant is looking into camera using blazeface predictions
 *
 * @param  {object} blazefacePredictions Return of blazeface.estimateFaces.
 * @return {boolean} Estimation if participant is looking into the camera.
 */
function checkIfLookingAtCamera(blazefacePredictions) {
  if (blazefacePredictions.length === 0) {
    return false;
  } else {
    const height = blazefacePredictions[0]["bottomRight"][1] - blazefacePredictions[0]["topLeft"][1]
    const width = blazefacePredictions[0]["bottomRight"][0] - blazefacePredictions[0]["topLeft"][0]
    const rightEyeX = blazefacePredictions[0]["landmarks"][0][0];
    const leftEyeX = blazefacePredictions[0]["landmarks"][1][0];
    const noseY = blazefacePredictions[0]["landmarks"][2][1];
    const mouthY = blazefacePredictions[0]["landmarks"][3][1];
    const distanceBetweenEyes = Math.abs(leftEyeX - rightEyeX);
    const distanceBetweenNoseAndMouth = Math.abs(noseY - mouthY);
    const factor = Math.max(height, width);
    const gazeQuotient1 = distanceBetweenEyes / factor;
    const gazeQuotient2 = distanceBetweenNoseAndMouth / factor;
    if ((0.42 > gazeQuotient1) && (gazeQuotient1 > 0.36) && (0.21 > gazeQuotient2) && (gazeQuotient2 > 0.15)) {
      return true;
    } else {
      return false;
    };
  };
};


/**
 * displayParticipantInfo - Function that updates the info tiles on participant page with session info.
 *
 * @param  {string} name Name of the participant.
 * @param  {string} sessionKey Session key of the current session.
 * @param  {int} id ID (participantId) of the participant.
 */
function displayParticipantInfo(name, sessionKey, id){
  const sessionKeyElements = document.getElementsByClassName("session-key");
  [].slice.call(sessionKeyElements).forEach((sessionKeyElement) => sessionKeyElement.innerHTML = sessionKey);
  document.getElementById("participant-id-name").innerHTML = id + ": " + (name || "Anonymous");
}

/**
 * getElements - Function that returns references for some HTML Objects.
 *
 * @return {array} Array of references to HTML Objects.
 */
function getElements(){
  const video = document.getElementById("video-input");
  const image = document.getElementById('image-input');
  const sessionKeyElements = document.getElementsByClassName("session-key");
  const canvasInput = document.getElementById("canvas-input");
  const ctx1 = canvasInput.getContext("2d");
  const canvasCropped = document.getElementById("canvas-cropped");
  const ctx2 = canvasCropped.getContext("2d");
  const idle = document.getElementById("working-idle");
  return [video, image, canvasInput, canvasCropped, ctx1, ctx2, idle];
}


/**
 * getConcentrationIndex - Function that calculates the concentration index, based on past emotions.
 *
 * @return {int}  Concentration score (value between 0 and 100).
 */
function getConcentrationIndex() {
  (recentEmotionsArray.length > 20) ? recentEmotionsArray.shift(): "";
  let score = 0;
  if (recentEmotionsArray.length > 0) {
    recentEmotionsArray.forEach(emotion => {
      score += emotionWeights[emotion[0]] * emotion[1];
    });
    score = score / recentEmotionsArray.length;
    return Math.round((score / 0.9) * 100);
  };
  return 0;
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
  const name = cookieValues.find(row => row.startsWith('participantName=')).split('=')[1];
  return [sessionKey, secret, id, name];
};


/**
 * performML - Function that performs machine learning algorithms and returns the results.
 *
 * @return {array} Array containing machine learning results from all three networks.
 */
async function performML(){
  const objectDetections = await cocoSsdModel.detect(image);
  const blazefacePredictions = await blazefaceModel.estimateFaces(image, false);
  const emotionDetection = await getEmotion(blazefacePredictions);
  return [emotionDetection, objectDetections, blazefacePredictions];
};


/**
 * getStatus - Function that generates the statusVector object.
 *
 * @return {object} statusVector object that contains the current status of the participant.
 */
async function getStatus(){
  const [emotionDetection, objectDetections, blazefacePredictions] = await performML();
  const detectedObjectsArray = generateDetectedObjectsArray(objectDetections);
  const lookingAtCamera = checkIfLookingAtCamera(blazefacePredictions);
  const emotion = (emotionDetection === undefined) ? "none" : emotionDetection[0];
  addToRecentEmotionsArray(emotionDetection);
  setInfoTiles(emotion, lookingAtCamera, detectedObjectsArray);
  const statusVector = {
    e: emotion.substring(0, 2), // emotion
    cs: getConcentrationIndex(), // happiness score
    l: lookingAtCamera, // looking bool
    o: detectedObjectsArray // objects
  };
  return statusVector;
};


/**
 * generateDetectedObjectsArray - Function that converts cocoSSD prediction object into array.
 *
 * @param  {object} objectDetections Return of the cocoSSD model.
 * @return {array} Array of strings containing names of all detected objects.
 */
function generateDetectedObjectsArray(objectDetections){
  const detectedObjectsArray = objectDetections.map(object => object.class);
  return detectedObjectsArray;
}

/**
 * getEmotion - Function that prepares inputs for the emotion model of Ufuk Cetinkaya and then returns the emotion.
 *
 * @param  {object} blazefacePredictions Return of the blazeface model.
 * @return {array} Returns array with two values: [0]: Name of the most prominent emotion, [1]: Model's confidence for this emotion.
 */
async function getEmotion(blazefacePredictions) {
  const bfp = await blazefacePredictions;
  if (bfp[0] != undefined) {
    const p1 = bfp[0];
    const p1TL = p1["topLeft"];
    const p1BR = p1["bottomRight"];
    const dx = p1TL[0];
    const dy = p1TL[1];
    const width = p1BR[0] - dx;
    const height = p1BR[1] - dy;
    const fullFaceInPicture = (dx > 0) && (dy > 0) && (dx + width < canvasInput.height) && (dy + height < canvasInput.height);
    if (fullFaceInPicture){
      ctx1.strokeStyle = "red";
      ctx1.strokeRect(dx, dy, width, height);
      ctx2.drawImage(image, dx, dy, width, height, 0, 0, 48, 48);
      var inputImage = tf.browser.fromPixels(canvasCropped)
          .mean(2)
          .toFloat()
          .expandDims(0)
          .expandDims(-1);
      inputImage = tf.image.resizeBilinear(inputImage, [48, 48]).div(tf.scalar(255));
      const predictions = emotionModel.predict(inputImage).arraySync()[0];
      const emotionArray = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']
      const emotionIndex = predictions.indexOf(Math.max.apply(null, predictions));
      return [emotionArray[emotionIndex], predictions[emotionIndex]];
    };
  };
};


/**
 * addToRecentEmotionsArray - Function that appends the last emotionDetection to the recentEmotionsArray
 *
 * @param  {array} emotionDetection Return of the getEmotion() function.
 */
function addToRecentEmotionsArray(emotionDetection){
  if (emotionDetection) {
    recentEmotionsArray.push(emotionDetection);
  };
}

/**
 * setInfoTiles - Function that displays current status info in the info tiles.
 *
 * @param  {string} emotion Most prominent emotion as detected by getEmotion()
 * @param  {boolean} lookingAtCamera Boolean if participant is looking into the camera.
 * @param  {array} detectedObjectsArray Array with names of all detected objects.
 */
function setInfoTiles(emotion, lookingAtCamera, detectedObjectsArray) {
  document.getElementById("current-emotion").innerHTML = emotion;
  document.getElementById("looking-at-camera").innerHTML = lookingAtCamera;
  document.getElementById("detected-objects").innerHTML = detectedObjectsArray;
};


/**
 * setPerformanceTile - Function that set's the performance tile (that displays status generation time)
 *
 * @param  {int} timeToComplete Time that was needed to generate the status.
 */
function setPerformanceTile(timeToComplete) {
  document.getElementById("request-completion-time").innerHTML = timeToComplete;
};


/**
 * startWebcam - Function that starts the webcam and displays it in the "video" object.
 *
 */
function startWebcam() {
  navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    })
    .then(function(stream) {
      video.srcObject = stream;
      video.play();
    })
    .catch(function(err) {
      console.log("An error with video recording occured! " + err);
    });
}


/**
 * createWebSocket - Function that creates a WebSocket and connects to the server.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {int} participantId Unique ID for the participant in respect to their session.
 * @param  {string} secret Secret that is used to authenticate the participant.
 * @return {object}
 */
function createWebSocket(sessionKey, participantId, secret){
  const wl = window.location;
  const webSocketProtocol = (wl.protocol === "https:") ? "wss://" : "ws://";
  const domain = document.domain;
  const port = location.port;
  const webSocketAddress = webSocketProtocol + domain + ":" + port;
  const sessionKeyParam = "/?sessionKey=" + sessionKey;
  const participantParam = "&participantId=" + participantId;
  const secretParam = "&psecret=" + secret;
  const typeParam = "&type=client";
  const webSocketURL = webSocketAddress + sessionKeyParam + secretParam + participantParam + typeParam;
  return new WebSocket(webSocketURL, "echo-protocol");
}
