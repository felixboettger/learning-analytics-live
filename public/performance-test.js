const [video, image, canvasInput, canvasCropped, canvasLandmarkPlot, canvasCombinedPlot, ctx1, ctx2, ctx3, ctxc, cameraSelectBox] = getElements();
let debugging = true;
let showDetectedEmotion = false;
let showStatusVector = false;
let showRotationAngle = false;
let showNumberOfDetectedHogs = false;
let combinedPlot = false;
let interval;
const shiftDown = 0; // px to shift face image and landmarks down
let currentTime = new Date().getSeconds();
let runs = 1000;
let timeList = [];
let timeListStatusSuccessful = [];

document.getElementById("user-agent").value = navigator.userAgent;
document.getElementById("progress").max = runs;

let counterObj = {
    runs: 0,
    landmarks: 0,
    hogs: 0,
    emotions: 0,
}

let resultsObj = {
    runs: 0,
    landmarks: 0,
    hogs: 0,
    emotions: 0,
    timeList: [],
    timeListStatusSuccessful: [],
    minTime: 0,
    maxTime: 0,
    avgTime: 0,
    medianTime: 0,
    stdDev: 0,
    succMinTime: 0,
    succMaxTime: 0,
    succAvgTime: 0,
    succMedianTime: 0,
    succStdDev: 0,
    username: "",
    computerType: "",
    deviceName: "",
    os: "",
    cpu: "",
    gpu: "",
    ram: "",
    browser: "",
    webcam: "",
    userAgent: "",
}

startWebcam()
main()

function setLiveStatus(){

    const min = String(Math.floor((runs - counterObj.runs)/60)).padStart(2, '0');
    const sek = String((runs - counterObj.runs) % 60).padStart(2, '0');

    const remainingTime = `${min}:${sek}`

    document.getElementById("progress").value = counterObj.runs;
    document.getElementById("progress-text").innerHTML = `${counterObj.runs}/${runs} (Remaining Time: ${remainingTime})`

    document.getElementById("landmarks-percentage").innerHTML = `${(100 * counterObj.landmarks/counterObj.runs).toFixed(2)}% with landmarks`
    document.getElementById("hogs-percentage").innerHTML = `${(100 * counterObj.hogs/counterObj.runs).toFixed(2)}% with hogs`
    document.getElementById("emotions-percentage").innerHTML = `${(100 * counterObj.emotions/counterObj.runs).toFixed(2)}% with emotions`
}

function mean(arr) {
    const n = arr.length;
    return arr.reduce((a, b) => a + b) / n;
}

function standardDeviation(arr) {
    const n = arr.length;
    const currMean = mean(timeList);
    return Math.sqrt(arr.map(x => Math.pow(x - currMean, 2)).reduce((a, b) => a + b) / n)
}

function median(arr) {
    const mid = Math.floor(arr.length / 2),
        nums = [...arr].sort((a, b) => a - b);
    return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

function download(content, fileName, contentType) {
    var a = document.createElement("a");
    var file = new Blob([content], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

function fillResultsObj() {
    // counter objects
    resultsObj.runs = counterObj.runs;
    resultsObj.landmarks = counterObj.landmarks;
    resultsObj.hogs = counterObj.hogs;
    resultsObj.emotions = counterObj.emotions;


    // time and metrics for time
    resultsObj.timeList = timeList;
    resultsObj.timeListStatusSuccessful = timeListStatusSuccessful;
    resultsObj.successfulTimeList = filterSuccessfulTimes(timeList, timeListStatusSuccessful)
    resultsObj.minTime = Math.min(...timeList);
    resultsObj.maxTime = Math.max(...timeList);
    resultsObj.avgTime = mean(timeList);
    resultsObj.medianTime = median(timeList);
    resultsObj.stdDev = standardDeviation(timeList);
    resultsObj.succMinTime = Math.min(...resultsObj.successfulTimeList);
    resultsObj.succMaxTime = Math.max(...resultsObj.successfulTimeList);
    resultsObj.succAvgTime = mean(resultsObj.successfulTimeList);
    resultsObj.succMedianTime = median(resultsObj.successfulTimeList);
    resultsObj.succStdDev = standardDeviation(resultsObj.successfulTimeList);

    // form data
    resultsObj.username = document.getElementById('input-username').value
    resultsObj.computerType = document.getElementById('input-laptop-desktop').value
    resultsObj.deviceName = document.getElementById('input-device-name').value
    resultsObj.os = document.getElementById('input-os').value
    resultsObj.cpu = document.getElementById('input-cpu').value
    resultsObj.gpu = document.getElementById('input-gpu').value
    resultsObj.ram = document.getElementById('input-ram').value
    resultsObj.browser = document.getElementById('input-browser').value
    resultsObj.webcam = document.getElementById('input-webcam').value

    // automatic form data

    resultsObj.userAgent = navigator.userAgent;

}

async function main() {
    // Load face-api neural networks
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models/face-api');
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models/face-api');
    await faceapi.nets.faceExpressionNet.loadFromUri('/models/face-api');

    document.getElementById("start-measurement").addEventListener("click", function () {
        interval = setInterval(triggerStatusGeneration, 250);
        document.getElementById("progress-text").style.display = "block"
        document.getElementById("progress").style.display = "block"
        document.getElementById("hogs-percentage").style.display = "block"
        document.getElementById("landmarks-percentage").style.display = "block"
        document.getElementById("emotions-percentage").style.display = "block"
        window.scrollTo(0,document.body.scrollHeight);
        document.getElementById("start-measurement").innerHTML = "Measurement is running..."

    })
};

function filterSuccessfulTimes(timeList, timeListStatusSuccessful){
    const successfulArray = [];
    for (let i = 0; i < runs; i++){
        if (timeListStatusSuccessful[i] == 1){
            successfulArray.push(timeList[i])
        }
    }
    return successfulArray
}

function triggerStatusGeneration() {
    
    setLiveStatus()

    if (counterObj.runs == runs) {
        clearInterval(interval);
        fillResultsObj();
        download(JSON.stringify(resultsObj), `results ${resultsObj.username} ${resultsObj.deviceName}.txt`, 'text/plain');
        document.getElementById("start-measurement").innerText = "Download again"
    } else {
        if (currentTime != new Date().getSeconds()) {
            currentTime = new Date().getSeconds();
            counterObj.runs += 1
            ctx1.clearRect(0, 0, canvasInput.width, canvasInput.height); // clear canvas
            ctx1.drawImage(video, 0, 0, video.width, video.height); // capturing still image from video feed and saving it to canvasInput      
            const t0 = performance.now();
            generateStatus().then(statusVector => {
                const t1 = performance.now();
                const timeToComplete = t1 - t0;
                timeList.push(timeToComplete);
                if (statusVector.e != "not detected" && statusVector.lm.length != 0 && statusVector.h.length !=0){
                    timeListStatusSuccessful.push(1);
                    console.log("1");
                } else {
                    timeListStatusSuccessful.push(0);
                    console.log("0");
                }
                
            })
        }
    }
}

async function generateStatus() {
    let statusVector = {
        err: "", // error string
        e: "not detected", // emotion
        t: new Date(),
        lm: [], // list of lists of length 2 of length 68
        h: [] // list of 5408 
    };

    const displaySize = { width: canvasInput.width, height: canvasInput.height }
    const detections = await faceapi.detectSingleFace(canvasInput).withFaceLandmarks().withFaceExpressions(); // check without tinyfacedetector

    if (typeof detections != "undefined") {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const det = resizedDetections.detection._box;
        const use = det;   // define here the bounding box that we are using

        const useSide = "long"; // long: resize to fit bigger side in canvasCropped, short: resize to let smaller side fill canvasCropped

        if (typeof use != "undefined") {
            if (checkFullFaceInPicture(use._x, use._y, use._width, use._height)) {
                if (typeof resizedDetections.unshiftedLandmarks != "undefined") {
                    const resizedLandmarks = resizeLandmarks(resizedDetections.landmarks._positions, use, useSide);
                    statusVector.lm = rotateLandmarks(resizedLandmarks, resizedDetections.angle.roll);
                    counterObj.landmarks += 1;
                } else {
                    console.log("Landmarks not detected, returning without landmarks.");
                }
                if (typeof resizedDetections.expressions != "undefined") {
                    statusVector.e = Object.keys(resizedDetections.expressions).reduce((a, b) => resizedDetections.expressions[a] > resizedDetections.expressions[b] ? a : b);
                    counterObj.emotions += 1;
                } else {
                    console.log("Emotion not detected, returning without emotion.");
                }
                if (statusVector.lm.length === 68) {
                    cropRotateFace(use._x, use._y, use._width, use._height, resizedDetections.angle.roll, useSide);
                    maskFaceNew(statusVector.lm);
                    plotFace(statusVector.lm);
                    statusVector.h = await getHogs();
                    counterObj.hogs += 1;


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

function resizeLandmarks(landmarks, use, useSide) {
    const landmarkList = [];
    for (let i = 0; i < landmarks.length; i++) {
        landmarkList.push(getNewCoords(landmarks[i]._x, landmarks[i]._y, use._x, use._y, use._width, use._height, useSide));
    }
    return landmarkList;
}

function getNewCoords(x, y, boundingBoxUpperLeftX, boundingBoxUpperLeftY, width, height, useSide) {
    x = x - boundingBoxUpperLeftX;
    y = y - boundingBoxUpperLeftY;
    const smallSide = Math.min(width, height);
    const bigSide = Math.max(width, height);
    const scaleSide = (useSide === "long") ? bigSide : smallSide;
    const ratio = (112 / scaleSide);
    const newX = x * ratio;
    const newY = y * ratio;
    return [newX.toFixed(3), newY.toFixed(3)];
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
    tctx1.drawImage(canvasInput, x, y, width, height, 0, 0, width * scale, height * scale);

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
        if (i < 8) {
            currentX += marginX;
        } else if (i > 19) {
            currentX -= marginX;
        }

        currentY = currentCoordinate[1];
        ctx2.lineTo(currentX, currentY);
    }
    // Brows Right
    for (let i = 26; i > 24; i--) {
        currentCoordinate = faceLandmarks[i];
        currentX = currentCoordinate[0];
        currentY = currentCoordinate[1] - marginY;
        ctx2.lineTo(currentX, currentY);
    }
    // Brows Left
    for (let i = 18; i > 16; i--) {
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

cameraSelectBox.click()
navigator.mediaDevices.enumerateDevices().then(gotDevices);