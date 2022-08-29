

async function newGenerateStatus(){
    let startTime = new Date().getTime();

    let statusVector = {
        err: "", // error string
        e: "", // emotion
        t: new Date(), // time
        pt: -1, // processing time
        au: [], // list of active AUs
    }

    const imageDims = 256;
    const displaySize = { width: canvasInput.width, height: canvasInput.height }
    const detections = await faceapi.detectSingleFace(canvasInput).withFaceLandmarks().withFaceExpressions();

    if (typeof detections != "undefined"){ // a face was detected
        // const canvasCropped = canvas.createCanvas(imageDims, imageDims);

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const alr = resizedDetections.alignedRect._box;
        const det = resizedDetections.detection._box;
        const use = det; // bounding box that is used
        const useSide = "long"; // long: resize to fit bigger side in canvasCropped, short: resize to let smaller side fill canvasCropped

        const rollAngle = detections.angle.roll;
        const resizedLandmarks = resizeLandmarks(detections.landmarks._positions, detections.detection._box, useSide);
        const rotatedLandmarks = rotateLandmarks(resizedLandmarks, rollAngle);
        // console.log(use, useSide, canvasInput, canvasCropped, rotatedLandmarks, rollAngle);
        cropMaskImage(use, useSide, canvasInput, canvasCropped, rotatedLandmarks, rollAngle); // canvasCropped now contains masked and cropped image

        // var inputImage = tf.browser.fromPixels(canvasCropped)
        //   .mean(2)
        //   .toFloat()
        //   .expandDims(0)
        //   .expandDims(-1);
        // const predictedAUs = await emotionModel.predict(inputImage).arraySync()[0];

        statusVector.e = Object.keys(resizedDetections.expressions).reduce((a, b) => resizedDetections.expressions[a] > resizedDetections.expressions[b] ? a : b);
        // statusVector.au = predictedAUs;
        errorAmount = 0;
    } else {
        errorAmount += 1;
        console.log("No face recognized");
        statusVector.err = "No face in picture";
    }
    currentTime = new Date().getTime();
    let timePassed = currentTime - startTime;
    statusVector.pt = timePassed;
    console.log("Time passed: " + statusVector.pt + "ms");
    return statusVector;

}   



function resizeLandmarks(landmarks,  use, useSide) {
    const landmarkList = [];
    for (let i = 0; i < landmarks.length; i++) {
      landmarkList.push(getNewCoords(landmarks[i]._x, landmarks[i]._y, use._x, use._y, use._width, use._height, useSide));
    }
    return landmarkList;
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

function cropRotateFace(x, y, width, height, angle, useSide, canvasInput, canvasCropped) {  // x,y = topleft x,y
    const ctx2 = canvasCropped.getContext("2d");
    const tempCanvas1 = canvas.createCanvas()
    const tctx1 = tempCanvas1.getContext("2d");
    tempCanvas1.height = tempCanvas1.width = imageDims;
    tctx1.fillRect(0, 0, tempCanvas1.width, tempCanvas1.height);
    tctx1.translate(tempCanvas1.width / 2, tempCanvas1.height / 2);
    tctx1.strokeStyle = "orange";
    tctx1.rotate(angle);
    tctx1.translate(-tempCanvas1.width / 2, -tempCanvas1.height / 2);
    const longSideScale = Math.min(tempCanvas1.width / width, tempCanvas1.height / height);
    const shortSideScale = Math.max(tempCanvas1.width / width, tempCanvas1.height / height);
    let scale = (useSide === "long") ? longSideScale : shortSideScale;
    tctx1.drawImage(canvasInput, x, y, width, height, 0,0, width*scale, height*scale);
  
    ctx2.clearRect(0, 0, imageDims, imageDims);
    ctx2.drawImage(tempCanvas1, 0, shiftDown);
    let imgData = ctx2.getImageData(0, 0, ctx2.canvas.width, ctx2.canvas.height);
    let pixels = imgData.data;
    for (var i = 0; i < pixels.length; i += 4) {

      let lightness = parseInt((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);

      pixels[i] = lightness;
      pixels[i + 1] = lightness;
      pixels[i + 2] = lightness;
    }
    ctx2.putImageData(imgData, 0, 0);
}

function maskFaceNew(faceLandmarks, canvasCropped) {
    const ctx2 = canvasCropped.getContext("2d");

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
    ctx2.lineTo(imageDims, 0);
    ctx2.lineTo(imageDims, imageDims);
    ctx2.lineTo(0, imageDims);
    ctx2.lineTo(0, fistCoordinateY);
  
    ctx2.closePath();
    ctx2.fill();
}

function cropMaskImage(use, useSide, canvasInput, canvasCropped, rotatedLandmarks, rollAngle){
    cropRotateFace(use._x, use._y, use._width, use._height, rollAngle, useSide, canvasInput, canvasCropped);
    maskFaceNew(rotatedLandmarks, canvasCropped);

}
