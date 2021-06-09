//jshint esversion:6

// ----------------------------------CONFIGS-------------------------------------

const portNr = 443;

// set below to false for server deploy, set to true to enable local testing
const localEnv = true;

// MongoDB URL. A MongoDB is required for running the server.

var mongodbURL;

if (localEnv) {
  mongodbURL = "mongodb+srv://server-admin:PmNpZDqNTxNzm82@mmla.p8d9g.mongodb.net/mmlaDB?retryWrites=true&w=majority";
} else {
  mongodbURL = "mongodb://localhost:27017/mmlaDB";
}

// ----------------------------------REQUIRES------------------------------------

const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const https = require("https");
const http = require("http");
const crypto = require("crypto");

// ------------------------------------------------------------------------------

const app = express();

// ------------------------------------------------------------------------------

app.set('view engine', 'ejs');

// ------------------------------------------------------------------------------

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));
app.use(express.json({
  limit: "1mb"
}));

// ------------------------------------------------------------------------------

// Establising connection with the MongoDB
mongoose.connect(mongodbURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true, // check if any errors occur...
  useFindAndModify: false
}).then(function() {
  console.log("Connected to DB: " + mongodbURL);
});

// Schemas for database entries are being defined

const statusSchema = {
  emotion: String,
  objects: [String],
  looks: Boolean,
  emotionScore: Number,
  time: Date
};

const participantSchema = {
  participantId: Number,
  participantName: String,
  participantSecret: String,
  participantStatus: [statusSchema]
};

const sessionSchema = {
  sessionKey: String,
  lastDashboardAccess: Date,
  hostIp: String,
  participants: [participantSchema]
};

// Monogoose models are being created using above schemas

const Participant = mongoose.model("Participant", participantSchema);
const Session = mongoose.model("Session", sessionSchema);
const Status = mongoose.model("Status", statusSchema);

// -----------------------------------GETS---------------------------------------

app.get("/", function(req, res) {
  res.render("home");
});

app.get("/participant", function(req, res) {
  res.render("participant");
});

app.get("/about", function(req, res) {
  res.render("about");
});

app.get("/legal", function(req, res) {
  res.render("legal-notice");
});

// This doubles as API request and delivery of host site. Possibly separate
app.get("/host", function(req, res) {
  const newKey = generateSessionKey();
  const allowedIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const newSession = new Session({
    lastDashboardAccess: new Date(),
    sessionKey: newKey,
    hostIp: allowedIp,
    participants: []
  });
  Session.insertMany([newSession], function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log("New Session " + newKey + " was successfully created.");
    }
  })
  res.render("host", {
    sessionKey: newKey
  });
});

app.get("/dashboard/:sessionKey", function(req, res) {
  const requestIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  Session.find({
    sessionKey: req.params.sessionKey
  }, function(err, foundSession) {
    if (err) {
      console.log(err);
      res.render("host-session-not-found", {
        sessionKey: req.params.sessionKey
      });
    } else if (foundSession.length === 0) {
      res.render("host-session-not-found", {
        sessionKey: req.params.sessionKey
      });
    } else {
      if (foundSession[0].hostIp === requestIp) {
        res.render("dashboard", {
          sessionKey: req.params.sessionKey
        });
      } else {
        res.render("not-allowed", {
          sessionKey: req.params.sessionKey
        });
      }
    }
  });
});

// ----------------------------------API---------------------------------------

// API: Creation of new participant
app.post("/participant", function(req, res) {
  const b = req.body;

  Session.findOne({sessionKey: b.sessionKey}, function(err, foundSession){
    if (err) {
      console.log(err);
    } else if (foundSession == null) {
      console.log("Session " + b.sessionKey + "does not exist.");
      res.render("client-session-not-found", {sessionKey: b.sessionKey});
    } else {
      const newStatus = new Status({
        time: new Date(),
      });
      const participantId = foundSession.participants.length;
      const participantSecret = crypto.randomBytes(4).toString('hex');
      const newParticipant = new Participant({
        participantId: participantId,
        participantName: b.participantName,
        participantSecret: participantSecret,
        participantStatus: [newStatus]
      });
      Session.findOneAndUpdate({sessionKey: b.sessionKey}, {"$addToSet": {"participants": newParticipant}},
      {new: true}, function(err, foundSession){
        // console.log("New participant created");
      });
      res.render("client", {sessionKey: b.sessionKey, participantName: b.participantName, participantId: participantId, participantSecret: participantSecret});
    }
  });
});

// API: Allow data download at end of session
app.get("/api/dashboard/download", (req, res) => {
  validateIp(req).then(isValid => {
    if (isValid) {
      getSessionData(req.query.sessionKey).then(exportData => res.send(exportData));
  } else {
    res.send("The session key is not valid or you are not allowed to access the session");
  }
});
});

// API: Get current counters for session
app.get("/api/dashboard/counters", (req, res) => {
  validateIp(req).then(isValid => {
    if (isValid) {
      getSessionData(req.query.sessionKey).then(sessionData => res.send(generateCounterElements(sessionData)));
  } else {
    res.send("The session key is not valid or you are not allowed to access the session");
  }
});
});

// API: Get all participants + their current status
app.get("/api/dashboard/participants", (req, res) => {
  validateIp(req).then(isValid => {
    if (isValid) {
      getSessionData(req.query.sessionKey).then(sessionData => res.send(generateParticipants(sessionData)));
  } else {
    res.send("The session key is not valid or you are not allowed to access the session");
  }
});
});

// API: Update status of existing participant
app.put("/api/participant", (req, res) => {
  b = req.body;

  const newStatus = new Status({
    emotion: b.emotion,
    emotionScore: b.emotionScore,
    time: new Date(),
    looks: b.looks,
    objects: b.objects
  });

  Session.findOneAndUpdate({sessionKey: b.sessionKey, "participants.participantId": b.userId, "participants.participantSecret": b.participantSecret},
  {"$addToSet": {"participants.$.participantStatus": newStatus}}, {new: true}, function(err, foundParticipant) {
    if (foundParticipant == null) {
      console.log("Session for sessionKey " + b.sessionKey +" not found!");
      res.json({status: 0, userId: b.userId});
    } else if (foundParticipant.n == 0) {
      console.log("Participant with ID" + b.userId + "not found in session with sessionKey" + b.sessionKey + "!");
      res.json({status: 0, userId: b.userId});
    } else {
      res.json({status: 1, userId: b.userId});
    }
  }
);
});

// Cleaning Routine is executed every 10 minutes, deletes every session that had no access in last 10 minutes before running.
// Therefore inactive sessions will be deleted after at max. 20 Minutes
setInterval(cleaningRoutine, 600000);

// ------------------------------------------------------------------------------

// Running server as actual server, with security etc

if (!(localEnv)) {

  // https server for running the actual communication, serving the website etc.
  https.createServer({
    key: fs.readFileSync("/etc/letsencrypt/live/mmlatool.de/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/mmlatool.de/cert.pem"),
    ca: fs.readFileSync("/etc/letsencrypt/live/mmlatool.de/chain.pem")
  }, app).listen(portNr, function() {
    console.log("Server started on Port: " + portNr);
  });

  // This Server is used to forward incoming http requests to https to enable encrypted data transfer
  http.createServer(function(req, res) {
    res.writeHead(301, {
      "Location": "https://" + req.headers["host"] + req.url
    });
    res.end();
  }).listen(80);
}

// Running the server locally for development or testing, no security etc.

if (localEnv) {

  app.listen(3000, function() {
    console.log("Server started on Port: " + 3000);
  });
}

// ------------------------------------------------------------------------------

// Helper functions

// generates counters (used for API requests)
function generateCounterElements(sessionData){
  var counterElements = {
    activeParticipantCounter: 0,
    emotionCounters: {"happy": 0, "sad": 0, "neutral": 0, "disgusted": 0, "fearful": 0, "surprised": 0, "angry": 0},
    lookingAtCamera: 0
  }
  sessionData.participants.forEach(function(participant){
    const currentStatus = participant.participantStatus.pop();
    const currentEmotion = currentStatus.emotion;
    if (!isInactive(currentStatus.time)){
      counterElements.emotionCounters[currentEmotion] += 1;
      counterElements.activeParticipantCounter += 1;
      if (currentStatus.looks){counterElements.lookingAtCamera += 1;}
    }
  });
  return counterElements;
}

// Check if timestamp is more than 30 seconds ago
function isInactive(time) {
  return new Date().getTime() - new Date(time).getTime() < 30000 ? false : true;
  // 3000 is 1000 (ms in a s) * 30 (30 second timeout)
}

// Checks if request ip matches session host ip
async function validateIp(req){
  const requestIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  return await Session.exists({sessionKey: req.query.sessionKey, hostIp: requestIp});
};

// Deletes all sessions from database that have not been accessed in the last 10 minutes
function cleaningRoutine() {
  console.log("Cleaning routine initiated!");
  Session.find({}, function(err, foundSessions) {
    if (err) {
      console.log(err);
    } else {
      foundSessions.forEach(function(foundSession) {
        lastDashboardAccess = foundSession.lastDashboardAccess;
        // Check if last session access more than 10 minutes ago
        const willBeDeleted = new Date().getTime() - new Date(lastDashboardAccess).getTime() > 600000 ? true : false;
        if (willBeDeleted) {
          Session.deleteOne({
            sessionKey: foundSession.sessionKey
          }, function(err) {
            if (err) {
              console.log(err);
            } else {
              console.log("Session " + foundSession.sessionKey + " has been deleted due to inactivity.");
            }
          })
        }
      })
    }
  })
}

// Generates a 14 digit session key
function generateSessionKey() {
  const characters = "ABCDEFGHJKLMNOPQRSTUVWXYZ"
  var newKey = "";
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 4; j++) {
      newKey += characters[Math.floor(Math.random() * 25)];
    }
    newKey += "-";
  }
  newKey = newKey.slice(0, 14);
  return newKey;
}

// returns session data and updates last dashboard access parameter for this session
async function getSessionData(sessionKey){
  return await Session.findOneAndUpdate({
    sessionKey: sessionKey
  }, {"$set": {
    lastDashboardAccess: new Date()
  }});
};

// generates a list of active participants
function generateParticipants(sessionData){
  participants = [];
  sessionData.participants.forEach(function(participant){
    const time = participant.participantStatus[participant.participantStatus.length - 1].time;
    if (!isInactive(time)) {
      participants.push({id: participant.participantId, name: participant.participantName, status: participant.participantStatus[participant.participantStatus.length - 1]});
    }
  });
  return participants;
};
