//jshint esversion:6

// This module includes all functions that directly manipulate the database

// --- Imports ---

const dotenv = require("dotenv").config({
  path: `../.env`
});
const mongoose = require("mongoose");

// --- Config ---

// Set localEnv to false for server deploy, set to true to enable local testing
const localEnv = ("true" === process.env.LOCAL_ENV) ? true : false;

// MongoDB URL. A MongoDB is required for running the server.
const mongodbURL = localEnv ? process.env.DB_HOST_LOCAL : process.env.DB_HOST;

// Setup and starting cleaning routine
const keepInactiveFor = process.env.KEEP_INACTIVE_FOR * 60;

// --- Connecting to MongoDB ---

// Options used to connect to MongoDB via Mongoose
const mongooseConnectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
}

// Function that connects with the MongoDB.
mongoose.connect(mongodbURL, mongooseConnectOptions).then(function() {
  console.log("Connected to DB: " + mongodbURL);
});

// --- MongoDB Schemas ---

const statusSchema = {
  sessionKey: String,
  participantId: Number,
  emotion: String,
  time: Number,
  utcTimeClient: Date,
  utcTimeServer: Date,
  aus: Array,
  err: String,
  landmarks: Array,
};

const participantSchema = {
  id: Number,
  name: String,
  secret: String,
  inactive: Boolean,
  currentStatus: statusSchema,
  fingerprint: String
};

const sessionSchema = {
  start: Number,
  lastDashboardAccess: Number,
  sessionKey: String,
  secret: String,
  goodbyeMessage: String,
  surveyURL: String,
  participants: [participantSchema]
};

// Creation of Mongoose Models using above schemas.
const Session = mongoose.model("Session", sessionSchema);
const Participant = mongoose.model("Participant", participantSchema);
const Status = mongoose.model("Status", statusSchema);


// --- Starting functions ---

// Set interval for cleaning routine.
// setInterval(cleaningRoutine(keepInactiveFor), 60000);

// Marking all participants as inactive after server restart (only executed on restart).
markAllAsInactive();

// --- Function Definitions ---

/**
 * addParticipantToSession - Function that adds a newly joined participant to the session.
 *
 * @param  {int} participantId Unique ID for the participants in respect to their session.
 * @param  {string} name Name that the participant entered when joining.
 * @param  {string} secret Secret that is used to authenticate the participant.
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 */
function addParticipantToSession(participantId, name, secret, sessionKey, fingerprint) {
  const newParticipant = new Participant({
    id: participantId,
    name: name,
    secret: secret,
    inactive: true,
    fingerprint: fingerprint
  });
  Session.updateOne({
    sessionKey: sessionKey
  }, {
    $addToSet: {
      participants: newParticipant
    }
  }, {
    new: true
  }).then(info => {});
}

/**
 * addSessionToDatabase - Function that adds a newly created session to the database.
 *
 * @param  {string} secret Secret that is used to authenticate the host.
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 */
function addSessionToDatabase(secret, sessionKey) {
  const newSession = new Session({
    start: Math.floor(new Date().getTime() / 1000),
    sessionKey: sessionKey,
    secret: secret,
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

/**
 * changeParticipantInactive - Function that marks a participant as inactive.
 *
 * @param  {type} inactiveBool Boolean that determines if participant is active (false) or inactive (true).
 * @param  {type} sessionKey Unique session identifier that was generated on session creation.
 * @param  {type} participantId Unique ID for the participants in respect to their session.
 */
async function changeParticipantInactive(inactiveBool, sessionKey, participantId) {
  await Session.updateOne({
    sessionKey: sessionKey,
    "participants.id": participantId
  }, {
    $set: {
      "participants.$.inactive": inactiveBool
    }
  }, {
    new: true
  }).then(info => {});
}

/**
 * checkSessionExists - Function that checks whether or not a session matching the query exists.
 *
 * @param  {object} query MongoDB/Mongoose query.
 * @return {boolean} Boolean that encodes whether or not a matching session exists.
 */
async function checkSessionExists(query) {
  return await Session.exists(query);
}

/**
 * cleaningRoutine - Function that automatically deletes inactive sessions from Database.
 *
 * @param  {int} keepInactiveFor Integer defined in .env file, determines number of minutes that a session is kept alive without host.
 */
function cleaningRoutine(keepInactiveFor) {
  return function() {
    const currentTime = Math.floor(new Date().getTime() / 1000);
    const deleteBefore = currentTime - keepInactiveFor;
    Session.deleteMany({
        "lastDashboardAccess": {
          $lte: deleteBefore
        }
      },
      function() {
        console.log("Cleaning finished.")
      }
    );
  }
}

/**
 * getParticipantData - Requesting data for dashboard data generation.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @return {array} Returns an array of the active participants for the given session.
 */
async function getParticipantData(sessionKey) {
  await Session.updateOne({
    sessionKey: sessionKey
  }, {
    lastDashboardAccess: Math.floor(new Date().getTime() / 1000)
  }, );
  foundSession = await Session.findOne({
      sessionKey: sessionKey
    },
    ['participants.inactive', 'participants.currentStatus', 'participants.id', 'participants.name'],
  );
  return foundSession["participants"];
}

/**
 * getSessionData - Returns all data for a given session
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {boolean} forDashboard If set to true, the lastDashboardAccess variable will be updated.
 * @return {object} Returns the object for the session.
 */
async function getSessionData(sessionKey, forDashboard) {
  if (forDashboard) {
    return await Session.findOneAndUpdate({
      sessionKey: sessionKey
    }, {
      lastDashboardAccess: Math.floor(new Date().getTime() / 1000)
    });
  } else {
    return await Session.findOne({
      sessionKey: sessionKey
    }, )
  }
}

async function setGoodbyeMessage(sessionKey, goodbyeMessage){
  console.log("Set goodbye message:", goodbyeMessage, sessionKey)
  await Session.updateOne(
    {sessionKey: sessionKey},
    {$set: {goodbyeMessage: goodbyeMessage}
  });
}

async function setSurveyURL(sessionKey, surveyURL){
  console.log("Set survey URL:", surveyURL, sessionKey)
  await Session.updateOne(
    {sessionKey: sessionKey},
    {$set: {surveyURL: surveyURL}}
  )
}

/**
 * getSessionStartTime - Function that returns the start time of a given session.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @return {int} Integer of seconds since 01.01.1970.
 */
async function getSessionStartTime(sessionKey) {
  var session = await Session.findOne({
    sessionKey: sessionKey
  }, ["start"]);
  return session.start;
}

/**
 * markAllAsInactive - Function that marks all participants as inactive on server restart.
 */
async function markAllAsInactive() {
  console.log("Marking all participants as inactive (server restarted)");

  await Session.updateMany({
    "participants.inactive": false
  }, {
    $set: {
      "participants.$.inactive": true
    }
  }, {
    new: true
  }).then(info => {});
}

/**
 * updateParticipantStatus - Function that updates the participants status in the Database.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {int} participantId Unique ID for the participants in respect to their session.
 * @param  {object} statusVector Object generated by the client that contains new status info.
 * @param  {int} time Time of the status (in seconds since session start).
 */
function updateParticipantStatus(sessionKey, participantId, statusVector, relativeTime) {
  // console.log(statusVector);
  const newStatus = new Status({
    landmarks: statusVector.lm,
    sessionKey: sessionKey,
    participantId: participantId,
    emotion: statusVector.e,
    time: relativeTime,
    utcTimeClient: statusVector.t,
    utcTimeServer: new Date().getTime(),
    aus: statusVector.au,
    err: statusVector.err
  });
  const newLiveStatus = new Status({
    emotion: statusVector.e,
    time: relativeTime,
    aus: statusVector.au
  });
  Session.updateOne({
      sessionKey: sessionKey,
      "participants.id": participantId
    },
    {
      "participants.$.currentStatus": newLiveStatus
    }, {
      new: true
    }
  ).then(info => {});
  Status.insertMany([newStatus], function(err) {
    if (err) {
      console.log(err);
    } else {
      // console.log("New Status was successfully saved.");
    }
  });

}

// --- Definition of module exports ---

module.exports = {
  addParticipantToSession,
  addSessionToDatabase,
  changeParticipantInactive,
  checkSessionExists,
  getParticipantData,
  getSessionData,
  getSessionStartTime,
  setGoodbyeMessage,
  setSurveyURL,
  updateParticipantStatus
};
