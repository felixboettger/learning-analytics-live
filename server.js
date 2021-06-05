//jshint esversion:6

// ----------------------------------CONFIGS-------------------------------------

const portNr = 443;

// set below to false for server deploy, set to true to enable local testing
const localEnv = true;

// MongoDB URL. A MongoDB is required for running the server.
// const mongodbURL = "mongodb://localhost:27017/mmlaDB";
const mongodbURL = "mongodb+srv://server-admin:PmNpZDqNTxNzm82@mmla.p8d9g.mongodb.net/mmlaDB?retryWrites=true&w=majority";
// ----------------------------------REQUIRES------------------------------------

const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const https = require("https");
const http = require("http");
// const md5 = require('md5');

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
  age: Number,
  gender: String,
  objects: [String],
  looks: Boolean,
  attentionScore: Number,
  time: Date
};

const participantSchema = {
  participantId: Number,
  participantName: String,
  participantStatus: statusSchema
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

app.get("/participant/:sessionKey/:participantId/:participantName", function(req, res) {
  const sessionKey = req.params.sessionKey;
  const participantId = req.params.participantId;
  participantName = req.params.participantName;
  res.render("client", {
    sessionKey: sessionKey,
    participantId: participantId,
    participantName: participantName
  });
});

app.get("/about", function(req, res) {
  res.render("about");
});

app.get("/legal", function(req, res) {
  res.render("legal-notice");
});

// ----------------------------------POSTS---------------------------------------

app.post("/participant", function(req, res) {
  const sessionKey = req.body.sessionKey;
  const participantName = req.body.participantName === "" ? "Anonymous" : req.body.participantName;



  Session.findOne({
    sessionKey: sessionKey
  }, function(err, foundSession) {
    if (err) {
      console.log(err);
    } else if (foundSession == null) {
      console.log("Session does not exist");
      res.render("client-session-not-found", {sessionKey: sessionKey});
  } else {

      const nrOfUsers = foundSession.participants.length;

      const newStatus = new Status({
        emotion: "newUser",
        attentionScore: "50",
        time: new Date(),
      });

      const newParticipant = new Participant({
        participantId: nrOfUsers,
        participantName: participantName,
        participantStatus: newStatus
      });

      Session.findOneAndUpdate({
        sessionKey: sessionKey
      }, {
        "$addToSet": {
          "participants": newParticipant
        }
      }, {
        new: true
      }, (err, foundSession) => {
        if (err) {
          console.log(err);
        }
      });
      res.redirect("/participant/" + sessionKey + "/" + nrOfUsers + "/" + participantName)
    }
  })
});

// API to fetch data from users

app.post("/api/participant", (req, res) => {
  b = req.body;

  const newStatus = new Status({
    emotion: b.emotion,
    attentionScore: b.attentionScore,
    time: new Date(),
    age: b.age,
    looks: b.looks,
    gender: b.gender,
    objects: b.objects

  });

  const newParticipant = new Participant({
    participantId: b.userId,
    participantName: b.userName,
    participantStatus: newStatus
  });

  Session.findOneAndUpdate({
    sessionKey: b.sessionKey,
    "participants.participantId": b.userId
  }, {
    "$set": {
      "participants.$.participantStatus": newStatus
    }
  }, {
    new: true
  }, function(err, foundParticipant) {
    if (foundParticipant == null) {
      console.log("Session not found!");
      res.json({
        status: 0,
        userId: req.body.userId
      });
    } else if (foundParticipant.n == 0) {
      console.log("Participant not found!");
      res.json({
        status: 0,
        userId: req.body.userId
      });
    } else {
      res.json({
        status: 1,
        userId: req.body.userId
      });
    }
  });


});

app.post("/api/dashboard", (req, res) => {
  const requestIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  Session.findOneAndUpdate({
    sessionKey: req.body.sessionKey
  }, {
    "$set": {
      lastDashboardAccess: new Date()
    }
  });

  Session.findOne({
    sessionKey: req.body.sessionKey
  }, function(err, foundSession) {
    // console.log("Session Found");
    if (foundSession == null) {
      res.redirect("not-allowed");
    } else if (foundSession.hostIp === requestIp) {
      const responseVector = {
        status: 1,
        sessionKey: req.body.sessionKey,
        session: foundSession
      };
      res.json({
        headers: {
          'Content-Type': 'application/json'
        },
        response: responseVector
      });
    } else {
      console.log("No Permission!");
      res.json({
        headers: {
          'Content-Type': 'application/json'
        },
        response: "no access"
      });
    }
  });
});

sessionKeyList = [];
// I was removed from character list, as I and l are sometimes hard to tell apart
const characters = "ABCDEFGHJKLMNOPQRSTUVWXYZ"

function generateSessionKey() {
  var newKey = "";
  for (var i = 0; i < 3; i++) {
    for (var j = 0; j < 4; j++) {
      newKey += characters[Math.floor(Math.random() * 25)];
    }
    newKey += "-";
  }
  newKey = newKey.slice(0, 14);
  if (!sessionKeyList.includes(newKey)) {
    sessionKeyList.push(newKey);
    return newKey;
  } else {
    generateSessionKey();
  }
}

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
