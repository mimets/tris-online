const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

app.use(express.static('public'));

// rooms[roomId] = {
//   board: Array(9),
//   currentTurn: 'X' | 'O',
//   gameOver: bool,
//   players: { socketId: { symbol: 'X'|'O'|null, nickname: string } }
// }
const rooms = {};

function createRoom(roomId) {
  rooms[roomId] = {
    board: Array(9).fill(null),
    currentTurn: 'X',
    gameOver: false,
    players: {}
  };
}

function checkWinner(b) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b2,c] of lines) {
    if (b[a] && b[a] === b[b2] && b[a] === b[c]) {
      return b[a]; // 'X' o 'O'
    }
  }
  if (b.every(cell => cell !== null)) return 'draw';
  return null;
}

io.on('connection', (socket) => {
  console.log('Nuovo socket:', socket.id);

  // info per questo socket
  socket.data.roomId = null;

  // join room con nickname
  socket.on('joinRoom', ({ roomId, nickname }) => {
    roomId = (roomId || '').trim();
    nickname = (nickname || '').trim() || 'Anonimo';

    if (!roomId) {
      socket.emit('errorMessage', 'Devi inserire un codice stanza.');
      return;
    }

    if (!rooms[roomId]) {
      createRoom(roomId);
    }

    const room = rooms[roomId];

    // calcola simbolo: X se non c'è, O se c'è solo X, null se già X e O
    const symbolsInUse = Object.values(room.players)
      .map(p => p.symbol)
      .filter(Boolean);

    let symbol = 'X';
    if (symbolsInUse.includes('X') && !symbolsInUse.includes('O')) {
      symbol = 'O';
    } else if (symbolsInUse.includes('X') && symbolsInUse.includes('O')) {
      symbol = null; // spettatore
    }

    room.players[socket.id] = { symbol, nickname };
    socket.data.roomId = roomId;
    socket.join(roomId);

    console.log(`Socket ${socket.id} è entrato in room ${roomId} con simbolo`, symbol);

    // manda stato iniziale solo a questo socket
    socket.emit('init', {
      roomId,
      symbol,
      board: room.board,
      currentTurn: room.currentTurn,
      gameOver: room.gameOver,
      players: room.players
    });

    // aggiorna anche gli altri nella stanza
    io.to(roomId).emit('playersUpdate', {
      players: room.players
    });
  });

  socket.on('makeMove', (index) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    if (room.gameOver) return;

    const player = room.players[socket.id];
    if (!player || !player.symbol) return; // spettatore

    const symbol = player.symbol;
    if (symbol !== room.currentTurn) return;

    if (room.board[index] !== null) return;

    room.board[index] = symbol;

    const winner = checkWinner(room.board);
    if (winner) {
      room.gameOver = true;
      io.to(roomId).emit('gameState', {
        board: room.board,
        currentTurn: room.currentTurn,
        gameOver: room.gameOver,
        winner,
        players: room.players
      });
    } else {
      room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
      io.to(roomId).emit('gameState', {
        board: room.board,
        currentTurn: room.currentTurn,
        gameOver: room.gameOver,
        winner: null,
        players: room.players
      });
    }
  });

  socket.on('reset', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    room.board = Array(9).fill(null);
    room.currentTurn = 'X';
    room.gameOver = false;

    io.to(roomId).emit('gameState', {
      board: room.board,
      currentTurn: room.currentTurn,
      gameOver: room.gameOver,
      winner: null,
      players: room.players
    });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    delete room.players[socket.id];

    // se stanza vuota, la eliminiamo
    if (Object.keys(room.players).length === 0) {
      delete rooms[roomId];
      console.log('Room eliminata:', roomId);
    } else {
      // aggiorna lista giocatori agli altri
      io.to(roomId).emit('playersUpdate', {
        players: room.players
      });
    }

    console.log('Socket disconnesso:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server avviato su porta ' + PORT);
});
