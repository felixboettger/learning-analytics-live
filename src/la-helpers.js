//jshint esversion:6

// This module includes all helper functions for the server.

// --- Imports ---

const laDB = require("./la-database");
const crypto = require("crypto");

/**
 * checkParticipant - Checks if a participant is existing and accessible with given data.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {string} secret Secret that is used to authenticate the participant.
 * @param  {int} participantId Unique ID for the participants in respect to their session.
 * @return {boolean} Boolean if participant is existing and accessible.
 */
async function checkParticipant(sessionKey, secret, participantId) {
  const query = {
    sessionKey: sessionKey,
    "participants.id": participantId,
    "participants.secret": secret
  };
  const allowed = await laDB.checkSessionExists(query);
  return allowed;
}

/**
 * checkSession - Checks if a session is existing and accessible with given data.
 *
 * @param  {string} sessionKey Unique session identifier that was generated on session creation.
 * @param  {string} secret Secret that is used to authenticate the host.
 * @return {boolean} Boolean if session is existing and accessible.
 */
async function checkSession(sessionKey, secret) {
  const query = {
    sessionKey: sessionKey,
    secret: secret
  };
  const allowed = await laDB.checkSessionExists(query);
  return allowed;
}

/**
 * checkSocketConnect - Function that checks if authentication details are valid. (Both Host and Client)
 *
 * @param  {object} req HTTP(s) request object.
 * @return {boolean} Boolean if authentication details are valid.
 */
async function checkSocketConnect(req) {
  const type = req.resourceURL.query.type;
  const query = (type === "dashboard") ? {
    sessionKey: req.resourceURL.query.sessionKey,
    secret: req.resourceURL.query.hsecret
  } : {
    sessionKey: req.resourceURL.query.sessionKey,
    "participants.id": req.resourceURL.query.participantId,
    "participants.secret": req.resourceURL.query.psecret
  };
  const allowed = await laDB.checkSessionExists(query);
  // const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const ip = "";
  allowed ? console.log("Connection from " + type + " " + ip + " allowed") : console.log("Connection from " + type + " " + ip + " rejected");
  return allowed;
}

/**
 * generateSecret - Function that generates a secret using the crypto module.
 *
 * @param  {int} bytes Number of bytes for the new secret.
 * @return {string} Created secret as hexadecimal representation (string).
 */
function generateSecret(bytes) {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * generateSessionKey - Generates a new session key
 *
 * @return {string} sessionKey in the format ABCD-ABCD-ABCD
 */
function generateSessionKey() {
  // I is excluded as it can be hard to distinguish between I and l
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

function checkEnvironmentVariables(environmentVariables){
  let correct = true;
  const environmentVariablesNeeded = ["DB_HOST", "PORT", "UPDATE_INTERVAL", "SECRET", "TESTING"];
  environmentVariablesNeeded.forEach((variable) => {
    if (!(variable in environmentVariables)){
      console.log(variable + " not set! Check the .env file");
      correct = false;
    }
  });
  return correct;
}

// --- Definition of module exports ---

module.exports = {
  checkEnvironmentVariables,
  checkParticipant,
  checkSession,
  checkSocketConnect,
  generateSecret,
  generateSessionKey
};
