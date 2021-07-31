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

// Setup and starting cleaning routine
const keepInactiveFor = process.env.KEEP_INACTIVE_FOR * 60;
setInterval(cleaningRoutine(keepInactiveFor), 60000);

// Establising connection with the MongoDB

const mongooseConnectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
}

mongoose.connect(mongodbURL, mongooseConnectOptions).then(function() {
    console.log("Connected to DB: " + mongodbURL);
});

// Schemas for database entries are being defined
const statusSchema = {
  emotion: String,
  objects: [String],
  looks: Boolean,
  time: Number,
  happinessScore: Number,
};

const participantSchema = {
  participantId: Number,
  participantName: String,
  secret: String,
  inactive: Boolean,
  currentStatus: statusSchema,
  participantStatus: [statusSchema]
};

const commentSchema = {
  text: String,
  time: Date
}

const sessionSchema = {
  start: Number,
  lastDashboardAccess: Number,
  sessionKey: String,
  secret: String,
  comments: [commentSchema],
  participants: [participantSchema]
};

// Monogoose models creation using above schemas
const Session = mongoose.model("Session", sessionSchema);
const Participant = mongoose.model("Participant", participantSchema);
const Status = mongoose.model("Status", statusSchema);
const Comment = mongoose.model("Comment", commentSchema);


function deleteSession(sessionKey){
  Session.deleteOne({sessionKey: sessionKey}).then((deletedSession, err) => {
    err ? console.log(err) :
    console.log(
      "Session " + sessionKey + " has been deleted as host closed the session."
    );
  });
}

// returns session data
async function getSessionData(sessionKey) {
  return await Session.findOneAndUpdate(
    {sessionKey: sessionKey},
    {lastDashboardAccess: Math.floor(new Date().getTime()/1000)}
  );
}

// returns session data
async function getSmallSessionData(sessionKey) {
  await Session.updateOne(
    {sessionKey: sessionKey},
    {lastDashboardAccess: Math.floor(new Date().getTime()/1000)},
  );
  return await Session.find(
    {sessionKey: sessionKey},
    ['participants.currentStatus', 'participants.inactive', 'participants.participantId', 'participants.participantName']
  );
}

async function getSessionDataNoDashboard(sessionKey) {
  return await Session.findOne(
    {sessionKey: sessionKey}
  );
}

// returns session data without unnecessary information for export
async function exportSessionData(sessionKey) {
  return await Session.findOne(
    {sessionKey: sessionKey},
    {'_id': false, 'secret': false, '__v': false,
    'participants._id': false, 'participants.secret': false,
    'participants.participantStatus._id': false}
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
  Session.updateOne(
    {sessionKey: sessionKey},
    {$addToSet: {participants: newParticipant}},
    {new: true}
  ).then(err => {});
}

function updateParticipantStatus(sessionKey, userId, statusVector, time){
  const newStatus = new Status({
    emotion: statusVector.e,
    happinessScore: statusVector.hs,
    time: time,
    looks: statusVector.l,
    objects: statusVector.o
  });
  Session.updateOne(
    {sessionKey: sessionKey,
    "participants.participantId": userId},
    {$addToSet: {"participants.$.participantStatus": newStatus},
    "participants.$.currentStatus": newStatus},
    {new: true}
  ).then(err => {});
}

function addSessionToDatabase(sessionKey, secret){
  const newSession = new Session({
    start: Math.floor(new Date().getTime() / 1000),
    sessionKey: sessionKey,
    secret: secret,
    comments: [],
    participants: [],
    lastDashboardAccess: Math.floor(new Date().getTime() / 1000)
  });
  Session.insertMany([newSession], function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log("New Session " + newSession.sessionKey + " was successfully created.");
    }
  });
}

async function updateComments(comment, time, sessionKey){
  const newComment = new Comment({text: comment, time: time});
  Session.updateOne(
    {sessionKey: sessionKey},
    {$addToSet: newComment},
    {new: true}
  ).then(err => {});
}

// active and inactive are almost the same, can be combined into one

async function changeParticipantInactive(inactiveBool, sessionKey, userId){
  Session.updateOne(
    {sessionKey: sessionKey,
    "participants.participantId": userId},
    {$set: {"participants.$.inactive": inactiveBool}},
    {new: true}
  ).then(err => {});
}

async function checkSessionExists(query){
  return await Session.exists(query);
}

async function getSessionStartTime(sessionKey){
  var session = await Session.findOne({sessionKey: sessionKey}, ["start"]);
  return session.start;
}

function cleaningRoutine(keepInactiveFor){
  return function(){
    const currentTime = Math.floor(new Date().getTime()/1000);
    const deleteBefore = currentTime - keepInactiveFor;
    Session.deleteMany(
      {"lastDashboardAccess": {$lte: deleteBefore}},
      function (){console.log("Cleaning finished.")}
    );
  }
}

module.exports = {deleteSession, getSessionData, exportSessionData,
                  updateParticipantStatus, checkSessionExists, updateComments,
                  getSessionStartTime, changeParticipantInactive,
                  addSessionToDatabase, getSessionDataNoDashboard,
                  getSmallSessionData, addParticipantToSession};
