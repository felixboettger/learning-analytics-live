// Derived from https://github.com/image-js/hog
// Original License: https://github.com/image-js/hog/blob/master/LICENSE

const PI_RAD = 180 / Math.PI;

function extractHOG(image, options = {}) {
    const {
      blockSize = 2,
      blockStride = blockSize / 2,
      norm = 'L2'
    } = options;
  
    var histograms = extractHistograms(image, options);
  
    var blocks = [];
    var blocksHigh = histograms.length - blockSize + 1;
    var blocksWide = histograms[0].length - blockSize + 1;
  
    for (var y = 0; y < blocksHigh; y += blockStride) {
      for (var x = 0; x < blocksWide; x += blockStride) {
        var block = getBlock(histograms, x, y, blockSize);
        normalize(block, norm);
        blocks.push(block);
      }
    }
    return Array.prototype.concat.apply([], blocks);
  }

  function extractHistograms(image, options = {}) {
    var vectors = gradientVectors(image);
  
    var cellSize = options.cellSize || 4;
    var bins = options.bins || 6;
  
    var cellsWide = Math.floor(vectors[0].length / cellSize);
    var cellsHigh = Math.floor(vectors.length / cellSize);
  
    var histograms = new Array(cellsHigh);
  
    for (var i = 0; i < cellsHigh; i++) {
      histograms[i] = new Array(cellsWide);
  
      for (var j = 0; j < cellsWide; j++) {
        histograms[i][j] = getHistogram(vectors, j * cellSize, i * cellSize,
          cellSize, bins);
      }
    }
    return histograms;
  }

  function getBlock(matrix, x, y, length) {
  var square = [];
  for (var i = y; i < y + length; i++) {
    for (var j = x; j < x + length; j++) {
      square.push(matrix[i][j]);
    }
  }
  return Array.prototype.concat.apply([], square);
}

function normalize(vector, norm) {
  var epsilon = 0.00001;
  var sum, denom, i;
  if (norm === 'L1') {
    sum = 0;
    for (i = 0; i < vector.length; i++) {
      sum += Math.abs(vector[i]);
    }
    denom = sum + epsilon;

    for (i = 0; i < vector.length; i++) {
      vector[i] /= denom;
    }
  } else if (norm === 'L1-sqrt') {
    sum = 0;
    for (i = 0; i < vector.length; i++) {
      sum += Math.abs(vector[i]);
    }
    denom = sum + epsilon;

    for (i = 0; i < vector.length; i++) {
      vector[i] = Math.sqrt(vector[i] / denom);
    }
  } else { // i.e norm === "L2"
    sum = 0;
    for (i = 0; i < vector.length; i++) {
      sum += vector[i] * vector[i];
    }
    denom = Math.sqrt(sum + epsilon);
    for (i = 0; i < vector.length; i++) {
      vector[i] /= denom;
    }
  }
}

function gradientVectors(image) {
  return _gradientVectors(intensities(image));
}

function _gradientVectors(intensities) {
  const height = intensities.height;
  const width = intensities.width;
  const maxValue = intensities.maxValue;

  const vectors = new Array(height);

  for (var y = 0; y < height; y++) {
    vectors[y] = new Array(width);
    for (var x = 0; x < width; x++) {
      var prevX = x === 0 ? 0 : intensities.getValueXY(x - 1, y, 0) / maxValue;
      var nextX = x === width - 1 ? 0 : intensities.getValueXY(x + 1, y, 0) / maxValue;
      var prevY = y === 0 ? 0 : intensities.getValueXY(x, y - 1, 0) / maxValue;
      var nextY = y === height - 1 ? 0 : intensities.getValueXY(x, y + 1, 0) / maxValue;

      // kernel [-1, 0, 1]
      var gradX = -prevX + nextX;
      var gradY = -prevY + nextY;

      vectors[y][x] = {
        mag: Math.sqrt(Math.pow(gradX, 2) + Math.pow(gradY, 2)),
        orient: Math.atan2(gradY, gradX)
      };
    }
  }
  return vectors;
}

function getHistogram(elements, x, y, size, bins) {
  var histogram = new Array(bins).fill(0);

  for (var i = 0; i < size; i++) {
    for (var j = 0; j < size; j++) {
      var vector = elements[y + i][x + j];
      var bin = binFor(vector.orient, bins);
      histogram[bin] += vector.mag;
    }
  }
  return histogram;
}

function intensities(image) {
  if (image.components === 1) {
    return image;
  } else {
    return image.grey({ algorithm: 'luma601' });
  }
}

function binFor(radians, bins) {
  var angle = radians * (PI_RAD);
  if (angle < 0) {
    angle += 180;
  }

  // center the first bin around 0
  angle += 90 / bins;
  angle %= 180;

  return Math.floor(angle / 180 * bins);
}



