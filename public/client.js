//jshint esversion:6

// Extracting data from cookies
const cookieValues = document.cookie.split('; ');
const secret = cookieValues.find(row => row.startsWith('psecret=')).split('=')[1];
const userId = cookieValues.find(row => row.startsWith('participantId=')).split('=')[1];
const userName = cookieValues.find(row => row.startsWith('participantName=')).split('=')[1];
const sessionKey = cookieValues.find(row => row.startsWith('sessionKey=')).split('=')[1];

const video = document.getElementById("video-input");
const image = document.getElementById('image-input');
const sessionKeyElements = document.getElementsByClassName("session-key");
const canvasInput = document.getElementById("canvas-input");
const ctx1 = canvasInput.getContext("2d");
const canvasCropped = document.getElementById("canvas-cropped");
const ctx2 = canvasCropped.getContext("2d");

[].slice.call(sessionKeyElements).forEach((sessionKeyElement) => sessionKeyElement.innerHTML = sessionKey);
document.getElementById("user-id-name").innerHTML = userId + ": " + (userName || "Anonymous");

var cocoSsdModel;
var blazefaceModel;
var lastEmotion;
var emotionModel;

// last 20 emotions stored here
const recentEmotionsArray = [];

main();

async function main() {
  startWebcam();

  // Load ML models

  blazefaceModel = await blazeface.load();
  cocoSsdModel = await cocoSsd.load();
  // Emotion model uses a pretrained model created by Ufuk Cetinkaya
  emotionModel = await tf.loadLayersModel("/models/Ufuk/model.json");

  // Connect to socket

  const webSocketProtocol = (window.location.protocol === "https:") ? "wss://" : "ws://";
  const webSocket = new WebSocket(webSocketProtocol + document.domain + ":" + location.port + "/?sessionKey=" + sessionKey + "&userId=" + userId + "&psecret=" + secret + "&type=client", "echo-protocol");

  // Button event listeners

  document.getElementById("send-comment-btn").addEventListener("click", function() {
    const comment = document.getElementById("input-comment").value;
    document.getElementById("input-comment").value = "";
    webSocket.send(JSON.stringify({datatype:"comment", data: {te: comment}}));
  });

  webSocket.onopen = function(){
    console.log("WebSocket connection to server established!");
    console.log("Protocol: " + webSocketProtocol);
    console.log("Sending 'ready' message to server.")
    webSocket.send(JSON.stringify({datatype: "ready"}));
  }

  // Websocket event listener

  webSocket.addEventListener("message", function(event){
    const messageJSON = JSON.parse(event.data);
    const datatype = messageJSON.datatype;
    if (datatype === "start") {
      console.log("Server sent start signal!");
      setInterval(sendStatus, messageJSON.interval);
    }
  });

  webSocket.onclose = function(){
    alert("Session has ended. Click ok to go back to the homepage.");
    const url = window.location;
    url.replace(url.protocol + "//" + url.host + "/");
  }

  function sendStatus(){
    document.getElementById("working-idle").setAttribute('class', 'material-icons icon-red');
    const t0 = performance.now();
    //const picture = webcam.snap();
    getStatus().then(statusVector => {
      if (!(statusVector === undefined)){
        webSocket.send(JSON.stringify({datatype: "status", data: statusVector}));
      }
      const t1 = performance.now();
      const timeToComplete = Math.round(t1 - t0);
      setPerformanceTile(timeToComplete);
      document.getElementById("working-idle").setAttribute('class', 'material-icons icon-green');
    })
  }
}

// Helper functions

async function getStatus(){
  const [faceDetection, objectDetections, blazefacePredictions] = await performML();
  const lookingAtCamera = checkLookingAtCamera(blazefacePredictions);
  const emotion = (faceDetection === undefined) ? "none" : faceDetection;
  recentEmotionsArray.push(emotion);
  const detectedObjectsArray = objectDetections.map(object => object.class);
  setInfoTiles(emotion, lookingAtCamera, detectedObjectsArray);
  const statusVector = {
    e: emotion.substring(0,2), // emotion
    hs: getHappinessScore(), // happiness score
    l: lookingAtCamera, // looking bool
    o: detectedObjectsArray // objects
  };
  return statusVector;
}

async function performML(){
  const objectDetections = await cocoSsdModel.detect(image);
  const blazefacePredictions = await blazefaceModel.estimateFaces(image, false);
  const faceDetection = await getEmotion(blazefacePredictions);
  return [faceDetection, objectDetections, blazefacePredictions]
}

function startWebcam(){
  navigator.mediaDevices.getUserMedia({video:true, audio: false})
  .then(function(stream) {
    video.srcObject = stream;
    video.play();
  })
  .catch(function(err){
    console.log("An error with video recording occured! " + err);
  });
}

function setInfoTiles(emotion, lookingAtCamera, detectedObjectsArray){
  document.getElementById("current-emotion").innerHTML = emotion;
  document.getElementById("looking-at-camera").innerHTML = lookingAtCamera;
  document.getElementById("detected-objects").innerHTML = detectedObjectsArray;
}

function setPerformanceTile(timeToComplete){
  document.getElementById("request-completion-time").innerHTML = timeToComplete;
}

function checkLookingAtCamera(blazefacePredictions){
  if (blazefacePredictions.length === 0) {
    return false;
  } else {
    const height = blazefacePredictions[0]["bottomRight"][1] - blazefacePredictions[0]["topLeft"][1]
    const rightEyeX = blazefacePredictions[0]["landmarks"][0][0];
    const leftEyeX = blazefacePredictions[0]["landmarks"][1][0];
    const noseY = blazefacePredictions[0]["landmarks"][2][1];
    const mouthY = blazefacePredictions[0]["landmarks"][3][1];
    const distanceBetweenEyes = Math.abs(leftEyeX - rightEyeX);
    // const distanceBetweenNoseAndMouth = Math.abs(noseY - mouthY);

    const attentionQuotient = distanceBetweenEyes / height;
    console.log(attentionQuotient);
    if (attentionQuotient > 0.43) {
      return true;
    } else {
      return false;
    }
  }
}

function getHappinessScore() {
  (recentEmotionsArray.length > 20) ? recentEmotionsArray.shift() : "";
  var happinessScore = 0;
  recentEmotionsArray.forEach(emotion => {
    if (emotion == "happy") {
      happinessScore += 100;
    } else if (
      emotion === "sad" ||
      emotion === "fear" ||
      emotion === "disgust"
    ) {
      happinessScore += 0;
    } else {
      happinessScore += 50;
    }
  });
  if (recentEmotionsArray.length > 0) {
    happinessScore = Math.floor(happinessScore / recentEmotionsArray.length);
  }
  return happinessScore;
}

async function getEmotion(blazefacePredictions){
  ctx1.drawImage(video, 0, 0, video.width, video.height);
  image.src = canvasInput.toDataURL();
  const bfp = await blazefacePredictions;
  if (bfp[0] != undefined){
    const p1 = bfp[0];
    const p1TL = p1["topLeft"];
    const p1BR = p1["bottomRight"];
    const width = p1BR[0] - p1TL[0];
    const height = p1BR[1] - p1TL[1];
    const dx = p1TL[0];
    const dy = p1TL[1];
    ctx1.strokeStyle = "red";
    ctx1.strokeRect(dx, dy, width, height);
    ctx2.drawImage(image, dx, dy, width, height, 0, 0, 48, 48);
    var inputImage = tf.browser.fromPixels(canvasCropped)
    .mean(2)
    .toFloat()
    .expandDims(0)
    .expandDims(-1);
    inputImage = tf.image.resizeBilinear(inputImage, [48, 48]).div(tf.scalar(255))
    const predictions = emotionModel.predict(inputImage).arraySync()[0];
    const emotionArray = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']
    return emotionArray[predictions.indexOf(Math.max.apply(null, predictions))];
  }
}
