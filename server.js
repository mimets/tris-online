const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {};           // socket.id -> 'X' o 'O'
let board = Array(9).fill(null); // 0..8
let currentTurn = 'X';
let gameOver = false;

function checkWinner(b) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8], // righe
    [0,3,6],[1,4,7],[2,5,8], // colonne
    [0,4,8],[2,4,6]          // diagonali
  ];
  for (const [a,b2,c] of lines) {
    if (b[a] && b[a] === b[b2] && b[a] === b[c]) {
      return b[a]; // 'X' o 'O'
    }
  }
  if (b.every(cell => cell !== null)) return 'draw';
  return null;
}

function resetGame() {
  board = Array(9).fill(null);
  currentTurn = 'X';
  gameOver = false;
}

io.on('connection', (socket) => {
  console.log('Nuovo giocatore', socket.id);

  // Assegna X o O
  const existingSymbols = Object.values(players);
  let symbol = 'X';
  if (existingSymbols.includes('X') && !existingSymbols.includes('O')) {
    symbol = 'O';
  } else if (existingSymbols.includes('X') && existingSymbols.includes('O')) {
    symbol = null; // spettatore
  }
  players[socket.id] = symbol;

  socket.emit('init', { 
    symbol,
    board,
    currentTurn,
    gameOver
  });

  socket.on('makeMove', (index) => {
    if (gameOver) return;
    const symbol = players[socket.id];
    if (!symbol) return;             // spettatore
    if (symbol !== currentTurn) return;
    if (board[index] !== null) return;

    board[index] = symbol;

    const winner = checkWinner(board);
    if (winner) {
      gameOver = true;
      io.emit('gameState', {
        board,
        currentTurn,
        gameOver,
        winner
      });
    } else {
      currentTurn = currentTurn === 'X' ? 'O' : 'X';
      io.emit('gameState', {
        board,
        currentTurn,
        gameOver,
        winner: null
      });
    }
  });

  socket.on('reset', () => {
    if (!players[socket.id]) return;
    resetGame();
    io.emit('gameState', {
      board,
      currentTurn,
      gameOver,
      winner: null
    });
  });

  socket.on('disconnect', () => {
    console.log('Giocatore disconnesso', socket.id);
    delete players[socket.id];
    // opzionale: reset gara quando qualcuno esce
    resetGame();
    io.emit('gameState', {
      board,
      currentTurn,
      gameOver,
      winner: null
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server avviato su http://localhost:' + PORT);
});
