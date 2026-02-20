const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.get('/', (req, res) => res.send('Servidor Cabo de Guerra Matemático online.'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Configuração do jogo
const QUESTION_TIME = 30000; // 30s
const TOTAL_QUESTIONS = 30;
const GROUPS = ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5', 'Grupo 6', 'Grupo 7', 'Grupo 8'];

let game = {
  started: false,
  currentQuestion: 0,
  questionStartTime: null,
  currentQuestionData: null,
  timerInterval: null
};

let players = {}; // { socketId: { name, group, score } }

// Gera conta aleatória
function generateQuestion() {
  const ops = ['+', '-', '×', '÷'];
  const op = ops[Math.floor(Math.random() * ops.length)];

  let a, b, answer;
  if (op === '+') {
    a = randInt(1, 100);
    b = randInt(1, 100);
    answer = a + b;
  } else if (op === '-') {
    a = randInt(1, 100);
    b = randInt(1, a); // garante não negativo
    answer = a - b;
  } else if (op === '×') {
    a = randInt(2, 20);
    b = randInt(2, 20);
    answer = a * b;
  } else {
    b = randInt(2, 20);
    answer = randInt(1, 10);
    a = b * answer; // divisão exata
  }

  return { a, b, op, answer };
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Inicia o jogo (pode acionar manualmente via socket "startGame")
function startGame() {
  if (game.started) return;
  game.started = true;
  game.currentQuestion = 0;
  broadcastNewQuestion();
}

function broadcastNewQuestion() {
  if (game.currentQuestion >= TOTAL_QUESTIONS) {
    endGame();
    return;
  }

  game.currentQuestion += 1;
  game.currentQuestionData = generateQuestion();
  game.questionStartTime = Date.now();

  if (game.timerInterval) clearInterval(game.timerInterval);

  game.timerInterval = setInterval(() => {
    const elapsed = Date.now() - game.questionStartTime;
    const remaining = Math.max(0, QUESTION_TIME - elapsed);
    io.emit('timer', { remaining });

    if (remaining === 0) {
      clearInterval(game.timerInterval);
      io.emit('questionEnded');
      setTimeout(() => {
        broadcastNewQuestion();
      }, 2000);
    }
  }, 200);

  const { a, b, op } = game.currentQuestionData;
  io.emit('newQuestion', {
    index: game.currentQuestion,
    total: TOTAL_QUESTIONS,
    a,
    b,
    op,
    time: QUESTION_TIME
  });
}

// Finaliza o jogo
function endGame() {
  game.started = false;
  if (game.timerInterval) clearInterval(game.timerInterval);
  const rankingIndividual = getIndividualRanking();
  const rankingGroups = getGroupRanking();
  io.emit('gameEnded', { rankingIndividual, rankingGroups });
}

// Ranking individual
function getIndividualRanking() {
  return Object.values(players)
    .sort((a, b) => b.score - a.score)
    .map(p => ({ name: p.name, group: p.group, score: p.score }));
}

// Ranking por grupo
function getGroupRanking() {
  const groupScores = {};
  GROUPS.forEach(g => {
    groupScores[g] = 0;
  });
  Object.values(players).forEach(p => {
    if (!groupScores[p.group]) groupScores[p.group] = 0;
    groupScores[p.group] += p.score;
  });
  return Object.entries(groupScores)
    .map(([group, score]) => ({ group, score }))
    .sort((a, b) => b.score - a.score);
}

// Cálculo de pontos tipo Kahoot
// pontos = arred(1000 * (tempo_restante / tempo_total)), se acertar
function calculatePoints(isCorrect, answerTimeMs) {
  if (!isCorrect) return 0;
  const timeLeft = Math.max(0, QUESTION_TIME - answerTimeMs);
  const base = 1000;
  const points = Math.round(base * (timeLeft / QUESTION_TIME));
  return points;
}

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

  // Jogador entra
  socket.on('join', ({ name, group }) => {
    if (!GROUPS.includes(group)) group = GROUPS[0];
    players[socket.id] = { id: socket.id, name, group, score: 0 };
    socket.emit('joined', { success: true, name, group, totalQuestions: TOTAL_QUESTIONS });
    io.emit('playersUpdate', getIndividualRanking());

    // se o jogo não começou ainda, quem entrar primeiro pode iniciar
    socket.emit('gameStatus', { started: game.started, currentQuestion: game.currentQuestion });
  });

  // Host (professor) inicia jogo manualmente pelo front (poderia ser um botão admin)
  socket.on('startGame', () => {
    startGame();
  });

  // Resposta de um jogador
  socket.on('answer', ({ answer }) => {
    if (!game.started || !game.currentQuestionData) return;
    const player = players[socket.id];
    if (!player) return;

    const elapsed = Date.now() - game.questionStartTime;
    if (elapsed > QUESTION_TIME) return; // fora do tempo

    const isCorrect = parseInt(answer) === game.currentQuestionData.answer;
    const points = calculatePoints(isCorrect, elapsed);
    player.score += points;

    socket.emit('answerResult', {
      correct: isCorrect,
      points,
      totalScore: player.score,
      correctAnswer: game.currentQuestionData.answer
    });

    // Atualiza rankings
    const rankingIndividual = getIndividualRanking();
    const rankingGroups = getGroupRanking();
    io.emit('rankingUpdate', { rankingIndividual, rankingGroups });
  });

  socket.on('disconnect', () => {
    console.log('Desconectado:', socket.id);
    delete players[socket.id];
    io.emit('playersUpdate', getIndividualRanking());
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Servidor rodando na porta', PORT);
});
