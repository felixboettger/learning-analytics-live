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
const nodeOsUtils = require('node-os-utils')
const WebSocketServer = require("websocket").server;
const randomName = require("node-random-name");

const laCalc = require("./src/la-calculations")
const laMain = require("./src/la-main")
const laHelp = require("./src/la-helpers")
const laDB = require("./src/la-database")

// --- Configs ---

const updateInterval = process.env.UPDATE_INTERVAL;
const portNr = process.env.PORT;
const localEnv = ("true" === process.env.LOCAL_ENV) ? true : false;
const testing = ("true" === process.env.TESTING) ? true : false;

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

setInterval(function(){
  nodeOsUtils.cpu.usage().then(info => console.log(info));
  //nodeOsUtils.memory.usage().then(info => console.log(info));

}, 5000);

// --- HTTP Get Request Handlers ---

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

app.get("/privacy", function(req, res) {
  res.render("privacy");
});

app.get("/privacy-german", function(req, res) {
  res.render("privacy-german");
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

if (testing){
  app.get("/load-simulation/:sessionKey", function(req, res) {
    laMain.createParticipant(req.params.sessionKey, randomName()).then(testParticipant => {
      laMain.sendParticipantCookies(res, req.body.sessionKey, req.body.participantName, testParticipant[0], testParticipant[1]);
      res.render("load-simulation");
    });
  });
}

// --- HTTP Post Request Handlers ---

// Creation of new participant
app.post("/participant", function(req, res) {
  laMain.createParticipant(req.body.sessionKey, req.body.participantName).then((participant) => {
    if (participant === undefined) {
      res.render("participant-session-not-found", {sessionKey: req.body.sessionKey});
    } else {
      laMain.sendParticipantCookies(res, req.body.sessionKey, req.body.participantName, participant[0], participant[1]);
      res.redirect("/client");
    }
  });
});

// Creation of a new session
app.post("/dashboard", function(req, res) {
  const [sessionKey, secret] = laMain.createSession();
  const url = req.protocol + "://" + req.get("host") + "/join/" + sessionKey;
  res.cookie("sessionKey", sessionKey);
  res.cookie("hsecret", secret);
  res.redirect("/dashboard");
});

// --- Server setup and start ---

if (!localEnv) {
  // Running server as actual server, with security etc
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
  // http server used to forward incoming http requests to https to enable encrypted data transfer
  http
    .createServer(function(req, res) {
      res.writeHead(301, {
        Location: "https://" + req.headers["host"] + req.url
      });
      res.end();
    })
    .listen(80);
} else {
  // Running the server locally for development or testing, no security etc.
  server = app.listen(portNr, function() {
    console.log("Server started on Port: " + portNr);
  });
}

webSocketServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});

webSocketServer.on("request", function(req){
  const type = req.resourceURL.query.type;
  if (type === "dashboard") {
    laMain.handleDashboardSocket(req, updateInterval);
  } else if (type === "client") {
    laMain.handleClientSocket(req, updateInterval);
  }
});
