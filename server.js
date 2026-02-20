const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

const SENHA_PROFESSOR = "MaristaUltra2026";
const MAX_FORCE = 300;

let rooms = {};

function createRoom() {
  const id = uuidv4().slice(0, 6);
  rooms[id] = {
    players: [],
    started: false,
    currentQuestion: 0,
    ropeForce: 0,
    questions: JSON.parse(fs.readFileSync("./data/questions.json"))
  };
  return id;
}

io.on("connection", socket => {

  socket.on("createRoom", () => {
    const roomId = createRoom();
    socket.join(roomId);
    socket.emit("roomCreated", roomId);
  });

  socket.on("joinRoom", ({ roomId, name, group }) => {
    if (!rooms[roomId]) return;
    socket.join(roomId);
    rooms[roomId].players.push({ id: socket.id, name, group, score: 0 });
    io.to(roomId).emit("playersUpdate", rooms[roomId].players);
  });

  socket.on("startGame", ({ roomId, senha }) => {
    if (senha !== SENHA_PROFESSOR) {
      socket.emit("startDenied");
      return;
    }
    const room = rooms[roomId];
    room.started = true;
    room.currentQuestion = 0;
    room.ropeForce = 0;
    io.to(roomId).emit("gameStarted");
    sendQuestion(roomId);
  });

  socket.on("answer", ({ roomId, answer }) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;
    const q = room.questions[room.currentQuestion];
    const player = room.players.find(p => p.id === socket.id);
    if (Number(answer) === q.answer) {
      player.score += 10;
      const direction = Number(player.group.replace("Grupo ","")) % 2 === 0 ? 1 : -1;
      room.ropeForce += 15 * direction;
      room.ropeForce = Math.max(-MAX_FORCE, Math.min(MAX_FORCE, room.ropeForce));
      io.to(roomId).emit("ropeUpdate", room.ropeForce);
    }
  });

  function sendQuestion(roomId) {
    const room = rooms[roomId];
    if (room.currentQuestion >= room.questions.length) {
      io.to(roomId).emit("gameEnded");
      room.started = false;
      return;
    }
    const q = room.questions[room.currentQuestion];
    io.to(roomId).emit("newQuestion", {
      index: room.currentQuestion + 1,
      total: room.questions.length,
      ...q
    });
    setTimeout(() => {
      room.currentQuestion++;
      sendQuestion(roomId);
    }, 30000);
  }
});

server.listen(process.env.PORT || 3000, () => {
  console.log("ULTRA Premium rodando");
});
