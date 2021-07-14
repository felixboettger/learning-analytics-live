//jshint esversion:6

// --- Imports---

const dotenv = require("dotenv").config();
const fs = require("fs");
const express = require("express");
const session = require('express-session');
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const http = require("http");
const https = require("https");
const WebSocketServer = require("websocket").server;

const laCalc = require("./src/la-calculations")
const laMain = require("./src/la-main")
const laHelp = require("./src/la-helpers")
const laDB = require("./src/la-database")

// --- Configs ---

const updateInterval = process.env.UPDATE_INTERVAL;
const portNr = process.env.PORT;
const localEnv = ("true" === process.env.LOCAL_ENV) ? true : false;

// --- Express Setup ---

const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(express.json({limit: "1mb"}));
app.use(cookieParser());
app.use(session({resave: false,
  saveUninitialized: false,
  secret: process.env.SECRET,
  cookie : {
    secure: true,
    sameSite: 'strict'
  }}));

// --- HTTP Get Request Handlers

app.get("/", function(req, res) {
  res.render("home");
});

app.get("/host", function(req, res) {
  laHelp.checkSession(req.cookies.sessionKey, req.cookies.hsecret).then(exists => {
    if (exists) {
      res.render("host-with-join-existing");
    } else {
      res.render("host");
    }
  });
});

app.get("/dashboard", function(req, res) {
  res.render("dashboard")
});

app.post("/dashboard", function(req, res) {
  const [sessionKey, secret] = laMain.createSession();
  const url = req.protocol + "://" + req.get("host") + "/join/" + sessionKey;
  res.cookie("sessionKey", sessionKey);
  res.cookie("hsecret", secret);
  res.redirect("/dashboard");
})

app.get("/participant", function(req, res) {
  laHelp.checkParticipant(req.cookies.sessionKey, req.cookies.psecret, req.cookies.participantId).then(exists => {
    if (exists && laMain.checkActiveSession(req.cookies.sessionKey)){
      res.render("participant-with-join-existing");
    } else {
      res.render("participant");
    }
  });
});

// Join with direct link
app.get("/join/:sessionKey", function(req, res) {
  res.cookie("sessionKey", req.params.sessionKey);
  res.redirect("/participant");
});

app.get("/about", function(req, res) {
  res.render("about");
});

app.get("/legal", function(req, res) {
  res.render("legal-notice");
});

app.get("/client", function(req, res) {
  res.render("client");
});

// // --- HTTP Post Request Handlers


// Creation of new participant
app.post("/participant", function(req, res) {
  laMain.createParticipant(req.body.sessionKey, req.body.participantName).then((participant) => {
    if (participant === undefined) {
      res.render("participant-session-not-found", {sessionKey: req.body.sessionKey});
    } else {
      res.cookie("sessionKey", req.body.sessionKey);
      res.cookie("participantName", req.body.participantName);
      res.cookie("participantId", participant[0]);
      res.cookie("psecret", participant[1]);
      res.render("client");
    }
  });
});

// --- Server setup and start

// Running server as actual server, with security etc
if (!localEnv) {
  // https server for running the actual communication, serving the website etc.
  server = https
    .createServer(
      {
        key: fs.readFileSync(process.env.SSL_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT),
        ca: fs.readFileSync(process.env.SSL_CHAIN)
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

// Running the server locally for development or testing, no security etc.
if (localEnv) {
  server = app.listen(portNr, function() {
    console.log("Server started on Port: " + 443);
  });
}

webSocketServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});


webSocketServer.on("request", function(req){
  const type = req.resourceURL.query.type;
  if (type === "dashboard") {
    handleDashboardSocket(req);
  } else if (type === "client") {
    handleClientSocket(req);
  }
});

// --- Web Socket Request Handling ---

function handleDashboardSocket(req){
  laHelp.checkSocketConnect(req).then(isValid => {
    if (!(isValid)) {
      req.reject();
      return;
    } else {
      const sessionKey = req.resourceURL.query.sessionKey;
      const connection = req.accept('echo-protocol', req.origin);
      laMain.addHostToSocketDict(sessionKey, connection);
      const clientSockets = laMain.getClientSockets(sessionKey);
      const refreshIntervalId = setInterval(function(){
        laDB.getSessionData(sessionKey).then(sessionData => {
          connection.send(JSON.stringify({datatype: "counters", data: laCalc.generateCounterElements(sessionData)}));
          connection.send(JSON.stringify({datatype: "participants", data: laCalc.generateParticipants(sessionData)}));
        });
      }, updateInterval)
    connection.on("message", function(message){
      if (message.type === 'utf8') {
          const request = message.utf8Data;
          if (request === "download"){
            laDB.exportSessionData(sessionKey
            ).then(exportData => {
              connection.send(JSON.stringify({datatype: "download", data: exportData}));
            });
          } else if (request == "end"){
            clearInterval(refreshIntervalId);
            laMain.endSession(sessionKey);
            console.log("Session " + sessionKey + " closed!");
          }
      }
    });
    connection.on("close", function(){
      clearInterval(refreshIntervalId);
    });
  }})
}

function handleClientSocket(req){
  laHelp.checkSocketConnect(req).then(isValid => {
    if (!(isValid)) {
      req.reject();
      return;
    } else {
      const connection = req.accept('echo-protocol', req.origin);
      const sessionKey = req.resourceURL.query.sessionKey;
      const userId = req.resourceURL.query.userId;
      const index = laMain.addClientToSocketDict(sessionKey, connection);
      laMain.getSessionStartTime(sessionKey).then((sessionStartTime) => {
        connection.on("message", function(message){
          laDB.markParticipantAsActive(sessionKey, userId);
          const messageJSON = JSON.parse(message.utf8Data);
          const datatype = messageJSON.datatype;
          if (datatype === "status"){
            const statusVector = messageJSON.data;
            const time = Math.floor(new Date().getTime()/1000) - sessionStartTime;
            laDB.updateParticipantStatus(sessionKey, userId, statusVector, time);
          } else if (datatype === "comment") {
            const [comment, time] = [messageJSON.data.te, new Date().getTime()];
            laMain.sendToHostSocket(sessionKey, JSON.stringify({datatype: "comment", data: {te: comment, ti: time}}));
            laDB.updateComments(comment, time, sessionKey);
          } else if (datatype === "ready"){
              connection.send(JSON.stringify({datatype: "start", interval: updateInterval}));
          }
        });
      });
        connection.on("close", function(){
          if (laMain.checkActiveSession(sessionKey)){
            laMain.removeFromSocketDict(sessionKey, index);
          }
          laDB.markParticipantAsInactive(sessionKey, userId);
        });
      };
    });
}
