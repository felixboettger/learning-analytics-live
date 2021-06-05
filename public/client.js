//jshint esversion:6

const interval = 500; // interval in milliseconds
const path = location.pathname.split("/");
const userId = path[3];
const userName = path[4];
const sessionKey = path[2];
const recentStatusArray = [];

var blazefaceModel;
var cocoSsdModel;

const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');

const webcam = new Webcam(webcamElement, 'user', canvasElement);
webcam.start();

(async () => {
  blazefaceModel = await blazeface.load();
  cocoSsdModel = await cocoSsd.load();
  await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
  await faceapi.nets.faceExpressionNet.loadFromUri("/models");
  await faceapi.nets.ageGenderNet.loadFromUri("/models");
})().then(function (){
  setInterval(function(){
    const snap = webcam.snap();
    updateStatus();
  }, interval)
});

var detectedObjects = {
  "cell phone": 0,
  "laptop": 0,
  "cat": 0,
  "dog": 0,
  "sports ball": 0,
  "bottle": 0,
  "wine glass": 0,
  "cup": 0,
  "pizza": 0,
  "tv": 0,
  "remote": 0,
  "book": 0,
  "scissors": 0,
  "teddy bear": 0
};

async function updateStatus(){
  const image = await document.querySelector('canvas');
  const faceDetection = await faceapi.detectSingleFace(image).withFaceExpressions().withAgeAndGender();
  const resizedDimensions = faceapi.resizeResults(faceDetection, {width: 640, height: 480});

  // console.log(resizedDimensions);

  const predictions = await cocoSsdModel.detect(image);
  predictions.forEach(prediction => {
    var currentItem = prediction.class;
    if (prediction.class in detectedObjects) {
      detectedObjects[prediction.class] = 1;
    }
  });

  const blazefacePredictions = await blazefaceModel.estimateFaces(image, false);

  var lookingAtCamera = false;

  if (!(blazefacePredictions.length === 0)){
    lookingAtCamera = checkIfLookingAtCamera(blazefacePredictions);
  }

  var detectedObjectsArray = [];

  Object.keys(detectedObjects).forEach(key => {
    if (detectedObjects[key] === 1){
    detectedObjectsArray.push(key);
  }
  });

  if (!(typeof resizedDimensions.expressions === undefined)){
    const expressions = resizedDimensions.expressions;
    // console.log(resizedDimensions);
    const e = expressions; // shortcut to make code below more readable
    const expressionArray = [e.neutral, e.happy, e.sad, e.fearful, e.angry, e.disgusted, e.surprised];
    const expressionArrayTranslate = ["neutral", "happy", "sad", "fearful", "angry", "disgusted", "surprised"]

    var arrayMaxIndex = function(array) {
      return array.indexOf(Math.max.apply(null, array));
    };

    var emotion = expressionArrayTranslate[arrayMaxIndex(expressionArray)];

    const statusVector = {
      userId: userId,
      userName: userName,
      sessionKey: sessionKey,
      emotion: emotion,
      age: Math.round(resizedDimensions.age),
      looks: lookingAtCamera,
      gender: resizedDimensions.gender,
      objects: detectedObjectsArray,
      emotionScore: getEmotionScore()
    }

    sendStatusVector(statusVector);
    recentStatusArray.push(statusVector);

  }

  resetDetectedObjects();

};

function getEmotionScore() {
  const elementsInArray = recentStatusArray.length;
  if (elementsInArray > 20) {
    recentStatusArray.shift();
  }

  var emotionScore = 0;

  recentStatusArray.forEach(statusVector => {
    if (statusVector.emotion == "happy"){
      emotionScore += 100;
    } else if (statusVector.emotion == "sad") {
      emotionScore += 0;
    } else {
      emotionScore += 50;
    }
  });

  if (elementsInArray > 0) {
    emotionScore = Math.floor(emotionScore/elementsInArray);
  } else {
    emotionScore = 50;
  }

  // e.g.  emotionScore = (emotionScore + screenLookScore) /2
  return emotionScore;

}

// Function that sends a status vector to the server
function sendStatusVector(statusVector){
  const fetchOptions = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: "POST",
    body: JSON.stringify(statusVector)
  }
  fetch("/api/participant", fetchOptions).then(res => {
      res.json().then(function(data){
      if (data.status === 1){
        // console.log("Response OK");
      } else {
        if (confirm("Error: Please join the session through the Participant page")){
          location = "/participant"
        };
        throw new Error("Repsonse NOT OK. Terminating Client");
      }
    });
  }).catch((error) => {
        if (confirm("Error: The server is not responding. Please try again later")){

        };
        throw new Error("Repsonse NOT OK. Terminating Client");
      })}



function checkIfLookingAtCamera(blazefacePredictions){
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

function resetDetectedObjects(){
  detectedObjects = {
    "cell phone": 0,
    "laptop": 0,
    "cat": 0,
    "dog": 0,
    "sports ball": 0,
    "bottle": 0,
    "wine glass": 0,
    "cup": 0,
    "pizza": 0,
    "tv": 0,
    "remote": 0,
    "book": 0,
    "scissors": 0,
    "teddy bear": 0
  };
}
