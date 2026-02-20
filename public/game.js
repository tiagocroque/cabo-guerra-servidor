const socket = io("https://cabo-guerra-servidor.onrender.com");
const marker = document.getElementById("marker");
const crowd = document.getElementById("crowd");
const winSound = document.getElementById("win");

socket.on("ropeUpdate", force => {
  const percent = 50 + (force / 6);
  marker.style.left = percent + "%";
  crowd.play();
  if (percent >= 100 || percent <= 0) {
    winSound.play();
    alert("🏆 Temos um vencedor!");
    setTimeout(()=>location.reload(),3000);
  }
});

socket.on("newQuestion", q => {
  document.getElementById("question").innerText =
    `${q.a} ${q.op} ${q.b} = ?`;
});

document.getElementById("send").onclick = () => {
  const answer = document.getElementById("answer").value;
  const roomId = prompt("Digite o código da sala:");
  socket.emit("answer", { roomId, answer });
};
