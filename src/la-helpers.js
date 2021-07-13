//jshint esversion:6

// This module includes all helper functions for the server.

// --- Imports ---

const laDB = require("./la-database");
const crypto = require("crypto");

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

function generateSecret(bytes){
  return crypto.randomBytes(bytes).toString("hex");
}

async function checkSocketConnect(req){
  const type = req.resourceURL.query.type;
  const query = (type === "dashboard") ? {sessionKey: req.resourceURL.query.sessionKey, secret: req.resourceURL.query.hsecret} : {sessionKey: req.resourceURL.query.sessionKey, "participants.participantId": req.resourceURL.query.userId, "participants.secret": req.resourceURL.query.psecret};
  const allowed = await laDB.checkSessionExists(query);
  // const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const ip = "";
  allowed ? console.log("Connection from " + type + " " + ip + " allowed") : console.log("Connection from " + type + " " + ip + " rejected");
  return allowed;
}

async function checkSession(sessionKey, secret){
  const query = {sessionKey: sessionKey, secret: secret};
  const allowed = await laDB.checkSessionExists(query);
  console.log("Session exists:", allowed);
  return allowed;
}

async function checkParticipant(sessionKey, secret, participantId){
  const query = {sessionKey: sessionKey, "participants.participantId": participantId, "participants.secret": secret};
  const allowed = await laDB.checkSessionExists(query);
  return allowed;
}

module.exports = {generateSessionKey, checkSocketConnect, generateSecret, checkSession, checkParticipant};
