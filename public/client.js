//jshint esversion:6

const secret = document.getElementById("secret").textContent;
const userId = parseInt(document.getElementById("participantId").textContent);
const userName = document.getElementById("participantName").textContent;
const sessionKey = document.getElementById("sessionKey").textContent;
const recentEmotionsArray = [];

// Webcam

const canvasElement = document.getElementById("canvas");
const webcamElement = document.getElementById("webcam");
const webcam = new Webcam(webcamElement, 'user', canvasElement);
webcam.start();

var blazefaceModel;
var cocoSsdModel;

(async () => {
  blazefaceModel = await blazeface.load();
  cocoSsdModel = await cocoSsd.load();
  await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
  await faceapi.nets.faceExpressionNet.loadFromUri("/models");
  await faceapi.nets.ageGenderNet.loadFromUri("/models");
})().then(function() {
  const webSocket = new WebSocket("ws://localhost:8081/?sessionKey=" + sessionKey + "&userId=" + userId + "&secret=" + secret, "echo-protocol");

  document.getElementById("sendRemarkBtn").addEventListener("click", function() {
   const remark = document.getElementById("input-remark").value;
   webSocket.send(JSON.stringify({datatype:"remark", data: remark}));
  });

  webSocket.addEventListener("message", function(event){
    console.log(event.data);
    if (event.data === "request") {
      const picture = webcam.snap();
      updateStatus().then(statusVector => {
        // check nach undefined -> sendet nur falls gesicht erkannt. Sollte am besten immer senden?!
        if (!(statusVector === undefined)){
          webSocket.send(JSON.stringify({datatype: "status", data: statusVector}));

        }
      });

    }
  });
});



async function updateStatus() {
  const image = await document.querySelector("canvas");
  const faceDetection = await faceapi
    .detectSingleFace(image)
    .withFaceExpressions()
    .withAgeAndGender();
  const objectDetections = await cocoSsdModel.detect(image);
  const blazefacePredictions = await blazefaceModel.estimateFaces(image, false);

  var detectedObjects = {
    "cell phone": 0,
    laptop: 0,
    cat: 0,
    dog: 0,
    "sports ball": 0,
    bottle: 0,
    "wine glass": 0,
    cup: 0,
    pizza: 0,
    tv: 0,
    remote: 0,
    book: 0,
    scissors: 0,
    "teddy bear": 0
  };

  objectDetections.forEach(detection => {
    var currentItem = detection.class;
    if (detection.class in detectedObjects) {
      detectedObjects[detection] = 1;
    }
  });

  var lookingAtCamera = false;

  if (!(blazefacePredictions.length === 0)) {
    lookingAtCamera = checkIfLookingAtCamera(blazefacePredictions);
  }

  var detectedObjectsArray = [];

  Object.keys(detectedObjects).forEach(key => {
    if (detectedObjects[key] === 1) {
      detectedObjectsArray.push(key);
    }
  });

  if (!(faceDetection === undefined)) {
    const expressions = faceDetection.expressions;
    // console.log(resizedDimensions);
    const e = expressions; // shortcut to make code below more readable
    const expressionArray = [
      e.neutral,
      e.happy,
      e.sad,
      e.fearful,
      e.angry,
      e.disgusted,
      e.surprised
    ];
    const expressionArrayTranslate = [
      "neutral",
      "happy",
      "sad",
      "fearful",
      "angry",
      "disgusted",
      "surprised"
    ];

    var arrayMaxIndex = function(array) {
      return array.indexOf(Math.max.apply(null, array));
    };

    var emotion = expressionArrayTranslate[arrayMaxIndex(expressionArray)];
    recentEmotionsArray.push(emotion);

    const statusVector = {
      emotion: emotion,
      looks: lookingAtCamera,
      objects: detectedObjectsArray,
      emotionScore: getEmotionScore()
    };
    return statusVector;
  }
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

function checkIfLookingAtCamera(blazefacePredictions) {
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
