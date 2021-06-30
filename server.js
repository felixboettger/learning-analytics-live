//jshint esversion:6

// ----------------------------------CONFIGS-------------------------------------
const updateInterval = 1000;
const portNr = 443;
const socketDict = {}; // Running sockets are stored in this object

// set below to false for server deploy, set to true to enable local testing
const localEnv = true;

// MongoDB URL. A MongoDB is required for running the server.
const mongodbURL = localEnv ? "mongodb+srv://server-admin:PmNpZDqNTxNzm82@mmla.p8d9g.mongodb.net/mmlaDB?retryWrites=true&w=majority" : "mongodb://localhost:27017/mmlaDB";

// ----------------------------------REQUIRES------------------------------------

const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const https = require("https");
const http = require("http");
const crypto = require("crypto");
const WebSocketServer = require("websocket").server;

// ------------------------------------------------------------------------------

const app = express();

// ------------------------------------------------------------------------------

app.set("view engine", "ejs");

// ------------------------------------------------------------------------------

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);
app.use(express.static("public"));
app.use(
  express.json({
    limit: "1mb"
  })
);

// ------------------------------------------------------------------------------

// Establising connection with the MongoDB
mongoose
  .connect(mongodbURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true, // check if any errors occur...
    useFindAndModify: false
  })
  .then(function() {
    console.log("Connected to DB: " + mongodbURL);
  });

// Schemas for database entries are being defined

const statusSchema = {
  emotion: String,
  objects: [String],
  looks: Boolean,
  happinessScore: Number,
  id: Number
};

const participantSchema = {
  participantId: Number,
  participantName: String,
  secret: String,
  inactive: Boolean,
  participantStatus: [statusSchema]
};

const remarkSchema = {
  remarkText: String,
  remarkTime: Date,
  timeId: Number
}

const sessionSchema = {
  sessionKey: String,
  secret: String,
  remarks: [remarkSchema],
  // statistics: [statisticSchema],
  participants: [participantSchema]
};



// end of unused


// Monogoose models are being created using above schemas

const Participant = mongoose.model("Participant", participantSchema);
const Session = mongoose.model("Session", sessionSchema);
const Status = mongoose.model("Status", statusSchema);
const Remark = mongoose.model("Remark", remarkSchema);

// -----------------------------------GETS---------------------------------------

app.get("/", function(req, res) {
  res.render("home");
});

app.get("/participant", function(req, res) {
  res.render("participant", {sessionKey: ""});
});

// Join with direct link
app.get("/join/:sessionKey", function(req, res) {
  res.render("participant", {sessionKey: req.params.sessionKey});
});

app.get("/about", function(req, res) {
  res.render("about");
});

app.get("/legal", function(req, res) {
  res.render("legal-notice");
});

app.get("/host", function(req, res) {
  const newSession = createSession();
  const url = req.protocol + "://" + req.get("host") + "/join/" + newSession.sessionKey;
  res.render("dashboard", {
    sessionKey: newSession.sessionKey,
    secret: newSession.secret,
    url: url
  });
});


// ----------------------------------API---------------------------------------

// API: Creation of new participant
app.post("/participant", function(req, res) {
  const b = req.body;

  Session.findOne({sessionKey: b.sessionKey}, function(err, foundSession) {
    if (err) {
      console.log(err);
    } else if (foundSession == null) {
      console.log("Session " + b.sessionKey + "does not exist.");
      res.render("client-session-not-found", {sessionKey: b.sessionKey});
    } else {
      const newStatus = new Status({
        time: new Date()
      });
      const participantId = foundSession.participants.length;
      const secret = crypto.randomBytes(4).toString("hex");
      const newParticipant = new Participant({
        participantId: participantId,
        participantName: b.participantName,
        secret: secret,
        inactive: false,
        participantStatus: [newStatus]
      });
      Session.findOneAndUpdate(
        {sessionKey: b.sessionKey},
        {$addToSet: {participants: newParticipant}},
        {new: true},
        function(err, foundSession) {
          // console.log("New participant created");
        }
      );
      res.render("client", {
        sessionKey: b.sessionKey,
        participantName: b.participantName,
        participantId: participantId,
        secret: secret
      });
    }
  });
});


// API: Allow data download at end of session
app.get("/api/dashboard/download", (req, res) => {
  validateSecret(req).then(isValid => {
    if (isValid) {
      getSessionData(req.query.sessionKey).then(exportData =>
        res.send(exportData)
      );
    } else {
      res.send(
        "The session key is not valid or you are not allowed to access the session"
      );
    }
  });
});

// ------------------------------------------------------------------------------

// Helper functions

// generates counters (used for API requests)
function generateCounterElements(sessionData) {
  var counterElements = {
    activeParticipantCounter: 0,
    emotionCounters: {
      happy: 0,
      sad: 0,
      neutral: 0,
      disgusted: 0,
      fearful: 0,
      surprised: 0,
      angry: 0
    },
    lookingAtCamera: 0
  };
  sessionData.participants.forEach(function(participant) {
    const currentStatus = participant.participantStatus.pop();
    const currentEmotion = currentStatus.emotion;
    console.log(currentEmotion);
    if (!participant.inactive) {
      counterElements.emotionCounters[currentEmotion] += 1;
      counterElements.activeParticipantCounter += 1;
      if (currentStatus.looks) {
        counterElements.lookingAtCamera += 1;
      }
    }
  });
  console.log(counterElements);
  return counterElements;
}

/*

// Check if timestamp is more than 30 seconds ago
function isInactive(time) {
  return new Date().getTime() - new Date(time).getTime() < 30000 ? false : true;
  // 3000 is 1000 (ms in a s) * 30 (30 second timeout)
}

*/

// Checks if request ip matches session host ip
async function validateIp(req) {
  const requestIp =
  //  req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  req.origin;
  return await Session.exists({
    sessionKey: req.query.sessionKey,
    hostIp: requestIp
  });
}

async function validateSecret(req){
  const secret = req.query.secret;
  const sessionKey = req.query.sessionKey;
  return await Session.exists({
    sessionKey: sessionKey,
    secret: secret
  });
}

function deleteSession(sessionKey){
  Session.deleteOne(
    {
      sessionKey: sessionKey
    },
    function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log(
          "Session " +
            sessionKey +
            " has been deleted as it is not active anymore."
        );
      }
    });
    delete socketDict[sessionKey];
};

function updateParticipantStatus(sessionKey, userId, statusVector, id){
  const newStatus = new Status({
    emotion: statusVector.e,
    happinessScore: statusVector.hs,
    id: statusVector.id,
    looks: statusVector.l,
    objects: statusVector.o
  });
  Session.findOneAndUpdate(
    {
      sessionKey: sessionKey,
      "participants.participantId": userId
    },
    {$addToSet: {"participants.$.participantStatus": newStatus}},
    {new: true},
    function(err){
      if (err) {
        console.log(err);
      }
    }
  );
};

// Generates a 14 digit session key
function generateSessionKey() {
  const characters = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
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
async function getSessionData(sessionKey) {
  return await Session.findOne(
    {
      sessionKey: sessionKey
    },
    {'_id': false, 'secret': false, '__v': false, 'participants._id': false, 'participants.secret': false, 'participants.participantStatus._id': false}
  );
}

// generates a list of participants
function generateParticipants(sessionData) {
  participants = [];
  sessionData.participants.forEach(function(participant) {
    participants.push({
      id: participant.participantId,
      n: participant.participantName, // participant name
      i: participant.inactive, // participant inactive bool
      s:
        participant.participantStatus[
          participant.participantStatus.length - 1
          ]
      });
    })

  return participants;
};


async function checkSocketConnectDashboard(req){
  return await Session.exists({
    sessionKey: req.resourceURL.query.sessionKey,
    secret: req.resourceURL.query.secret
  });
}

async function checkSocketConnectParticipant(req){
  return await Session.exists({
    sessionKey: req.resourceURL.query.sessionKey,
    "participants.participantId": req.resourceURL.query.userId,
    "participants.secret": req.resourceURL.query.secret
  });
}

async function markParticipantAsInactive(sessionKey, userId){
  Session.findOneAndUpdate(
    {
      sessionKey: sessionKey,
      "participants.participantId": userId
    },
    {$set: {"participants.$.inactive": true}},
    {new: true},
    function(err){
      if (err) {
        console.log(err);
      }
    });
    Session.findOne({
      sessionKey: sessionKey,
      "participants.participantId": userId
    }, function(err){
      if (err) {
        console.log(err);
      }
    })
};

async function updateRemarks(remark, time, timeId, sessionKey){
  Session.findOneAndUpdate(
    {
      sessionKey: sessionKey
    },
    {$addToSet: new Remark({
      remarkText: remark,
      remarkTime: time,
      timeId: timeId
    })},
    {new: true},
    function(err){
      if (err) {
        console.log(err);
      }
    });
};

function createSession(){
  const newKey = generateSessionKey();
  const secret = crypto.randomBytes(4).toString("hex");
  const newSession = new Session({
    sessionKey: newKey,
    secret: secret,
    remarks: [],
    participants: []
  });
  Session.insertMany([newSession], function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log("New Session " + newSession.sessionKey + " was successfully created.");
    }
  });
  return newSession;
}

function closeClientSockets(sessionKey){
  const clientSockets = socketDict[sessionKey].clients;
  clientSockets.forEach(clientSocket => clientSocket.close());
}


// ------------------------------------------------------------------------------

// Running server as actual server, with security etc

if (!localEnv) {
  // https server for running the actual communication, serving the website etc.
  https
    .createServer(
      {
        key: fs.readFileSync("/etc/letsencrypt/live/mmlatool.de/privkey.pem"),
        cert: fs.readFileSync("/etc/letsencrypt/live/mmlatool.de/cert.pem"),
        ca: fs.readFileSync("/etc/letsencrypt/live/mmlatool.de/chain.pem")
      },
      app
    )
    .listen(portNr, function() {
      console.log("Server started on Port: " + portNr);
    });

  // This Server is used to forward incoming http requests to https to enable encrypted data transfer
  http
    .createServer(function(req, res) {
      res.writeHead(301, {
        Location: "https://" + req.headers["host"] + req.url
      });
      res.end();
    })
    .listen(80);
}

// This Server is used for WebSockets (Dashboard)
wsServerDashboard = http
  .createServer(function(req, res) {
    console.log("Web Socket Server Started on ")
  }).listen(8080);

// This Server is used for WebSockets (Participant)
wsServerParticipant = http
  .createServer(function(req, res) {
    console.log("Web Socket Server Started on ")
  }).listen(8081);


// Running the server locally for development or testing, no security etc.

if (localEnv) {
  app.listen(3000, function() {
    console.log("Server started on Port: " + 3000);
  });
}

// -----------------------------Web Socket Server-----------------------------------

webSocketServerDashboard = new WebSocketServer({
  httpServer: wsServerDashboard,
  autoAcceptConnections: false
});

webSocketServerParticipant = new WebSocketServer({
  httpServer: wsServerParticipant,
  autoAcceptConnections: false
});

webSocketServerParticipant.on("request", function(req, err){
  if (err) {
    console.log(err);
  } else {
  checkSocketConnectParticipant(req).then(isValid => {
    if (!(isValid)) {
      console.log("Connection from " + req.origin + " rejected");
      req.reject();
      return;
    } else {
      console.log("Connection from " + req.origin + " accepted");
      const connection = req.accept('echo-protocol', req.origin);
      const sessionKey = req.resourceURL.query.sessionKey;
      const userId = req.resourceURL.query.userId;
      const indexOfSocket = socketDict[sessionKey].clients.push(connection) - 1;
      connection.on("message", function(message){
        const messageJSON = JSON.parse(message.utf8Data);
        const datatype = messageJSON.datatype;
        if (datatype === "status"){
          const statusVector = messageJSON.data;
          updateParticipantStatus(sessionKey, userId, statusVector);
        } else if (datatype === "remark") {
          const remark = messageJSON.data.text;
          const timeStampId = messageJSON.data.timeStampId;
          const time = new Date().getTime();
          socketDict[sessionKey].host.send(JSON.stringify({datatype: "remark", data: {text: remark, timeStampId: timeStampId}}));
          updateRemarks(remark, time, timeStampId, sessionKey);
        }
      })
      connection.on("close", function(){
        if (socketDict[sessionKey]){
          socketDict[sessionKey].clients.splice(indexOfSocket, 1);
        }
        markParticipantAsInactive(sessionKey, userId);
      });
      }
    });
}
});


webSocketServerDashboard.on("request", function(req, err){
  if (err) {
    console.log(err);
  } else {
  checkSocketConnectDashboard(req).then(isValid => {
    if (!(isValid)) {
      console.log("Connection from " + req.origin + " rejected");
      req.reject();
      return;
    } else {
      console.log("Connection from " + req.origin + " accepted");
      const sessionKey = req.resourceURL.query.sessionKey;
      const connection = req.accept('echo-protocol', req.origin);
      socketDict[sessionKey] = {host: connection, clients: []};
      var timeStampId = 0;
      const refreshIntervalId = setInterval(function(){
        timeStampId ++;
        getSessionData(sessionKey).then(sessionData => {
          connection.send(JSON.stringify({datatype: "counters", data: generateCounterElements(sessionData)}));
        });
        getSessionData(sessionKey).then(sessionData => {
          connection.send(JSON.stringify({datatype: "participants", data: generateParticipants(sessionData)}));
        });

        socketDict[sessionKey].clients.forEach(clientSocket => {
          clientSocket.send(JSON.stringify({datatype: "request", id: timeStampId}));
        })
      }, updateInterval)

    connection.on("message", function(message){
      if (message.type === 'utf8') {
          const request = message.utf8Data;
          if (request === "download"){
            getSessionData(sessionKey
            ).then(exportData => {
              connection.send(JSON.stringify({datatype: "download", data: exportData}));
            });
          }
      }
    });

    connection.on("close", function(){
      clearInterval(refreshIntervalId);
      closeClientSockets(sessionKey);
      deleteSession(sessionKey);
      console.log("Connection closed!");
    });
  }})}});
