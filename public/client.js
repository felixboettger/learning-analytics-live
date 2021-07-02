//jshint esversion:6

const secret = document.getElementById("secret").textContent;
const userId = parseInt(document.getElementById("participant-id").textContent);
const userName = document.getElementById("participant-name").textContent;
const sessionKey = document.getElementById("session-key").textContent;

var cocoSsdModel;
var blazefaceModel;
var lastEmotion;

// last 20 emotions stored here
const recentEmotionsArray = [];

main();

async function main() {

  // Start webcam

  const canvasElement = document.getElementById("canvas");
  const webcamElement = document.getElementById("webcam");
  const webcam = new Webcam(webcamElement, 'user', canvasElement);
  webcam.stream();

  // Load ML models

  blazefaceModel = await blazeface.load();
  cocoSsdModel = await cocoSsd.load();
  await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
  await faceapi.nets.faceExpressionNet.loadFromUri("/models");
  await faceapi.nets.ageGenderNet.loadFromUri("/models");

  // Connect to socket

  const webSocket = new WebSocket("ws://localhost:443/?sessionKey=" + sessionKey + "&userId=" + userId + "&secret=" + secret + "&type=client", "echo-protocol");

  // Button event listeners

  document.getElementById("send-comment-btn").addEventListener("click", function() {
    const comment = document.getElementById("input-comment").value;
    const timeStampId = parseInt(document.getElementById("timestamp-id").innerHTML);
    document.getElementById("input-comment").value = "";
    webSocket.send(JSON.stringify({datatype:"comment", data: {text: comment, timeStampId: timeStampId}}));
  });

  // Websocket event listener

  webSocket.addEventListener("message", function(event){
    const messageJSON = JSON.parse(event.data);
    const datatype = messageJSON.datatype;
    if (datatype === "request") {
      const timeStampId = messageJSON.id;
      document.getElementById("timestamp-id").innerHTML = timeStampId;
      document.getElementById("working-idle").setAttribute('class', 'material-icons icon-red');
      const t0 = performance.now();
      const picture = webcam.snap();
      getStatus(timeStampId).then(statusVector => {
        // check nach undefined -> sendet nur falls gesicht erkannt. Sollte am besten immer senden?!
        if (!(statusVector === undefined)){
          webSocket.send(JSON.stringify({datatype: "status", data: statusVector}));
        }
        const t1 = performance.now();
        const timeToComplete = Math.round(t1 - t0);
        console.log(timeToComplete)
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
  const image = await document.querySelector("canvas");
  const faceDetection = await faceapi
    .detectSingleFace(image)
    .withFaceExpressions()
    .withAgeAndGender();
  const objectDetections = await cocoSsdModel.detect(image);
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

/*

async function counterDiffCalc(emotion){
  if (lastEmotion === undefined){
    const diffObj = {};
    diffObj[emotion] = 1;
    lastEmotion = emotion;
    return diffObj;
  }
  if (lastEmotion === emotion) {
    return {};
  } else {
    const diffObj = {};
    diffObj[lastEmotion] = -1;
    diffObj[emotion] = 1;
    lastEmotion = emotion;
    return diffObj;
  }
}

*/


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
