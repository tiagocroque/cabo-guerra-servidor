const socket = io("https://cabo-guerra-servidor.onrender.com");

let currentRoom = null;

document.getElementById("createRoom").onclick = () => {
  socket.emit("createRoom");
};

socket.on("roomCreated", roomId => {
  currentRoom = roomId;
  document.getElementById("roomCode").innerText = "Sala: " + roomId;
});

document.getElementById("start").onclick = () => {
  const senha = document.getElementById("senha").value;
  socket.emit("startGame", { roomId: currentRoom, senha });
};
