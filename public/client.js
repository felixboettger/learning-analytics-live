//jshint esversion:6

const secret = document.getElementById("secret").textContent;
const userId = parseInt(document.getElementById("participant-id").textContent);
const userName = document.getElementById("participant-name").textContent;
const sessionKey = document.getElementById("session-key").textContent;

var cocoSsdModel;
//var mobilenetModel
var blazefaceModel;
var lastEmotion;

// last 20 emotions stored here
const recentEmotionsArray = [];

main();

async function main() {

  const video = document.getElementById("video-input");
  navigator.mediaDevices.getUserMedia({video:true, audio: false})
  .then(function(stream) {
    video.srcObject = stream;
    video.play();
  })
  .catch(function(err){
    console.log("An error with video recording occured! " + err);
  })

  // Load ML models

  blazefaceModel = await blazeface.load();
  cocoSsdModel = await cocoSsd.load();
  //mobilenetModel = await mobilenet.load();

  await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
  await faceapi.nets.faceExpressionNet.loadFromUri("/models");

  // Connect to socket

  const webSocketProtocol = (window.location.protocol === "https:") ? "wss://" : "ws://";
  const webSocket = new WebSocket(webSocketProtocol + document.domain + ":" + location.port + "/?sessionKey=" + sessionKey + "&userId=" + userId + "&secret=" + secret + "&type=client", "echo-protocol");

  // Button event listeners

  document.getElementById("send-comment-btn").addEventListener("click", function() {
    const comment = document.getElementById("input-comment").value;
    const timeStampId = parseInt(document.getElementById("timestamp-id").innerHTML);
    document.getElementById("input-comment").value = "";
    webSocket.send(JSON.stringify({datatype:"comment", data: {te: comment, id: timeStampId}}));
  });

  webSocket.onopen = function(){
    console.log("WebSocket connection to server established!");
    console.log("Protocol: " + webSocketProtocol);
  }

  // Websocket event listener

  webSocket.addEventListener("message", function(event){
    const messageJSON = JSON.parse(event.data);
    const datatype = messageJSON.datatype;
    if (datatype === "request") {
      const timeStampId = messageJSON.id;
      document.getElementById("timestamp-id").innerHTML = timeStampId;
      document.getElementById("working-idle").setAttribute('class', 'material-icons icon-red');
      const t0 = performance.now();
      //const picture = webcam.snap();
      getStatus(timeStampId).then(statusVector => {
        // check nach undefined -> sendet nur falls gesicht erkannt. Sollte am besten immer senden?!
        if (!(statusVector === undefined)){
          webSocket.send(JSON.stringify({datatype: "status", data: statusVector}));
        }
        const t1 = performance.now();
        const timeToComplete = Math.round(t1 - t0);
        document.getElementById("request-completion-time").innerHTML = timeToComplete;
        document.getElementById("working-idle").setAttribute('class', 'material-icons icon-green');
      });
    }
  });

  webSocket.onclose = function(){
    alert("Session has ended. Click ok to go back to the homepage.");
    const url = window.location;
    url.replace(url.protocol + "//" + url.host + "/");
  }
}

// Helper functions

async function getStatus(timeStampId){
  const [faceDetection, objectDetections, blazefacePredictions] = await performML();
  /*
  // Getting Grayscale

  const src = cv.imread("canvas");
  const dst = new cv.Mat();
  cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
  cv.imshow("canvas-output", dst);
  src.delete();
  dst.delete();

  // Crop

  const bfp = blazefacePredictions;
  const dx = bfp[0].topLeft[0];
  const dy = bfp[0].topLeft[1];
  const dWidth = bfp[0].bottomRight[1] - bfp[0].topLeft[1];
  const dHeight = bfp[0].topLeft[0] - bfp[0].bottomRight[0];
  const canvasCropped = document.getElementById("canvas-cropped");
  const contex = canvasCropped.getContext("2d");
  const imgGreyScale = document.getElementById("canvas");
  contex.drawImage(imgGreyScale, dx, dy, dWidth, dHeight);

  */

  const lookingAtCamera = await checkLookingAtCamera(blazefacePredictions);
  const emotion = (faceDetection === undefined) ? "none" : await getMostProminentEmotion(faceDetection);
  recentEmotionsArray.push(emotion);
  document.getElementById("current-emotion").innerHTML = emotion;

  const detectedObjectsArray = objectDetections.map(object => object.class);
  const statusVector = {
    e: emotion, // emotion
    id: timeStampId, // id
    l: lookingAtCamera, // looking bool
    o: detectedObjectsArray, // objects
    hs: getHappinessScore() // happiness score
  };
  return statusVector;
}

async function performML(){

  const image = document.getElementById("video-input");
  const faceDetection = await faceapi
    .detectSingleFace(image)
    .withFaceExpressions()
  const objectDetections = await cocoSsdModel.detect(image);
  // console.log(objectDetections)
  const blazefacePredictions = await blazefaceModel.estimateFaces(image, false);
  return [faceDetection, objectDetections, blazefacePredictions]
}

async function checkLookingAtCamera(blazefacePredictions){
  if (blazefacePredictions.length === 0) {
    return false;
  } else {
    const rightEyeX = blazefacePredictions[0]["landmarks"][0][0];
    const leftEyeX = blazefacePredictions[0]["landmarks"][1][0];
    const noseY = blazefacePredictions[0]["landmarks"][2][1];
    const mouthY = blazefacePredictions[0]["landmarks"][3][1];
    const distanceBetweenEyes = Math.abs(leftEyeX - rightEyeX);
    const distanceBetweenNoseAndMouth = Math.abs(noseY - mouthY);
    const attentionQuotient = distanceBetweenEyes / distanceBetweenNoseAndMouth;
    if (attentionQuotient > 2.3) {
      return true;
    } else {
      return false;
    }
  }
}


function getMaxKey(obj){
  const array = Object.keys(obj).map(i => obj[i])
  const maxIndex = array.indexOf(Math.max.apply(null, array));
  return Object.keys(obj)[maxIndex];
}

async function getMostProminentEmotion(faceDetection){
  const e = faceDetection.expressions;
  return getMaxKey(e);
}

function getHappinessScore() {
  (recentEmotionsArray.length > 20) ? recentEmotionsArray.shift() : "";
  var happinessScore = 0;
  recentEmotionsArray.forEach(emotion => {
    if (emotion == "happy") {
      happinessScore += 100;
    } else if (
      emotion === "sad" ||
      emotion === "fearful" ||
      emotion === "disgusted"
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
