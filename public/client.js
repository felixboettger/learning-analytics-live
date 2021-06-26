//jshint esversion:6

const secret = document.getElementById("secret").textContent;
const userId = parseInt(document.getElementById("participantId").textContent);
const userName = document.getElementById("participantName").textContent;
const sessionKey = document.getElementById("sessionKey").textContent;

var cocoSsdModel;
var blazefaceModel;

main();

async function main() {
  // Start webcam
  const canvasElement = document.getElementById("canvas");
  const webcamElement = document.getElementById("webcam");
  const webcam = new Webcam(webcamElement, 'user', canvasElement);
  webcam.start();

  // Load ML models
  blazefaceModel = await blazeface.load();
  cocoSsdModel = await cocoSsd.load();
  await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
  await faceapi.nets.faceExpressionNet.loadFromUri("/models");
  await faceapi.nets.ageGenderNet.loadFromUri("/models");

  // Connect to socket
  const webSocket = new WebSocket("ws://localhost:8081/?sessionKey=" + sessionKey + "&userId=" + userId + "&secret=" + secret, "echo-protocol");

  // Button event listeners
  document.getElementById("send-remark-btn").addEventListener("click", function() {
    const remark = document.getElementById("input-remark").value;
    document.getElementById("input-remark").value = "";
    webSocket.send(JSON.stringify({datatype:"remark", data: remark}));
  });

  // Websocket event listener
  webSocket.addEventListener("message", function(event){
    if (event.data === "request") {
      const picture = webcam.snap();
      getStatus().then(statusVector => {
        // check nach undefined -> sendet nur falls gesicht erkannt. Sollte am besten immer senden?!
        if (!(statusVector === undefined)){
          webSocket.send(JSON.stringify({datatype: "status", data: statusVector}));
        }
      });
    }
  });
}



async function getStatus(){
  const [faceDetection, objectDetections, blazefacePredictions] = await performML();
  const lookingAtCamera = await checkLookingAtCamera(blazefacePredictions);
  const emotion = (faceDetection === undefined) ? "none" : await getMostProminentEmotion(faceDetection);
  recentEmotionsArray.push(emotion);
  const detectedObjectsArray = objectDetections.map(object => object.class);
  console.log(detectedObjectsArray);
  const statusVector = {
    emotion: emotion,
    looks: lookingAtCamera,
    objects: detectedObjectsArray,
    emotionScore: getEmotionScore()
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

// REWORK:

const recentEmotionsArray = [];

function getMaxKey(obj){
  const array = Object.keys(obj).map(i => obj[i])
  const maxIndex = array.indexOf(Math.max.apply(null, array));
  return Object.keys(obj)[maxIndex];
}

async function getMostProminentEmotion(faceDetection){
  const e = faceDetection.expressions;
  return getMaxKey(e);
}

function getEmotionScore() {
  const elementsInArray = recentEmotionsArray.length;
  if (elementsInArray > 20) {
    recentEmotionsArray.shift();
  }

  var emotionScore = 0;

  recentEmotionsArray.forEach(emotion => {
    if (emotion == "happy") {
      emotionScore += 100;
    } else if (
      emotion === "sad" ||
      emotion === "fearful" ||
      emotion === "disgusted"
    ) {
      emotionScore += 0;
    } else {
      emotionScore += 50;
    }
  });

  if (elementsInArray > 0) {
    emotionScore = Math.floor(emotionScore / elementsInArray);
  } else {
    emotionScore = 50;
  }

  // e.g.  emotionScore = (emotionScore + screenLookScore) /2
  return emotionScore;
}
