//jshint esversion:6

// This module includes all functions that directly manipulate the database

// --- Imports---

const dotenv = require("dotenv").config({path: `../.env`});
const mongoose = require("mongoose");

// --- Config ---

// Set localEnv to false for server deploy, set to true to enable local testing
const localEnv = ("true" === process.env.LOCAL_ENV) ? true : false;

// --- Mongoose & Database Setup

// MongoDB URL. A MongoDB is required for running the server.
const mongodbURL = localEnv ? process.env.DB_HOST_LOCAL : process.env.DB_HOST;

// Starting cleaning Routine (run every hour)
setInterval(cleaningRoutine, 3600000);

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

const commentSchema = {
  commentText: String,
  commentTime: Date,
  timeId: Number
}

const sessionSchema = {
  lastDashboardAccess: Date,
  sessionKey: String,
  secret: String,
  comments: [commentSchema],
  participants: [participantSchema]
};

// Monogoose models creation using above schemas
const Participant = mongoose.model("Participant", participantSchema);
const Session = mongoose.model("Session", sessionSchema);
const Status = mongoose.model("Status", statusSchema);
const Comment = mongoose.model("Comment", commentSchema);


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
};

// returns session data
async function getSessionData(sessionKey) {
  return await Session.findOneAndUpdate(
    {
      sessionKey: sessionKey
    },
    {lastDashboardAccess: new Date()}
  );
}

// returns session data without unnecessary information for export
async function exportSessionData(sessionKey) {
  return await Session.findOne(
    {
      sessionKey: sessionKey
    },
    {'_id': false, 'secret': false, '__v': false, 'participants._id': false, 'participants.secret': false, 'participants.participantStatus._id': false}
  );
}

function addParticipantToSession(participantId, name, secret, sessionKey){
  const newParticipant = new Participant({
      participantId: participantId,
      participantName: name,
      secret: secret,
      inactive: false,
      participantStatus: []
  });
  Session.findOneAndUpdate(
    {sessionKey: sessionKey},
    {$addToSet: {participants: newParticipant}},
    {new: true},
    function(err, foundSession) {
      // console.log("New participant created");a
    }
  )
}

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

function addSessionToDatabase(sessionKey, secret){
  const newSession = new Session({
    sessionKey: sessionKey,
    secret: secret,
    comments: [],
    participants: []
  });
  Session.insertMany([newSession], function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log("New Session " + newSession.sessionKey + " was successfully created.");
    }
  });
}

async function updateComments(comment, time, timeId, sessionKey){
  Session.findOneAndUpdate(
    {
      sessionKey: sessionKey
    },
    {$addToSet: {comments: new Comment({
      commentText: comment,
      commentTime: time,
      timeId: timeId
    })}},
    {new: true},
    function(err){
      if (err) {
        console.log(err);
      }
    });
};

// active and inactive are almost the same, can be combined into one

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
};

async function markParticipantAsActive(sessionKey, userId){
  Session.findOneAndUpdate(
    {
      sessionKey: sessionKey,
      "participants.participantId": userId
    },
    {$set: {"participants.$.inactive": false}},
    {new: true},
    function(err){
      if (err) {
        console.log(err);
      }
    });
};

async function checkSessionExists(query){
  return await Session.exists(query);
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
        const willBeDeleted = new Date().getTime() - new Date(lastDashboardAccess).getTime() > 3600000 ? true : false;
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



module.exports = {deleteSession, getSessionData, exportSessionData, updateParticipantStatus, checkSessionExists, updateComments, markParticipantAsInactive, markParticipantAsActive, addSessionToDatabase, addParticipantToSession};
