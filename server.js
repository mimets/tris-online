const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static('public'));

// rooms[roomId] = {
//   gameType: 'tris' | 'among',
//   // tris
//   board, currentTurn, gameOver,
//   // among
//   players: {
//     socketId: { nickname, role, x, y, color }
//   }
// }
const rooms = {};

// ---------- TRIS ----------

function createTrisRoom(roomId) {
  rooms[roomId] = {
    gameType: 'tris',
    board: Array(9).fill(null),
    currentTurn: 'X',
    gameOver: false,
    players: {}
  };
}

function checkWinner(board) {
  const b = board;
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b2,c] of lines) {
    if (b[a] && b[a] === b[b2] && b[a] === b[c]) {
      return b[a];
    }
  }
  if (b.every(cell => cell !== null)) return 'draw';
  return null;
}

// ---------- AMONG-LITE ----------

function createAmongRoom(roomId) {
  rooms[roomId] = {
    gameType: 'among',
    players: {}
  };
}

function getRandomColor() {
  const palette = ['#f97373', '#60a5fa', '#34d399', '#fbbf24', '#a855f7', '#ec4899', '#f97316'];
  return palette[Math.floor(Math.random() * palette.length)];
}

function assignAmongRoles(room) {
  const ids = Object.keys(room.players);
  if (ids.length === 0) return;

  const impostorIndex = Math.floor(Math.random() * ids.length);
  ids.forEach((id, idx) => {
    room.players[id].role = idx === impostorIndex ? 'impostor' : 'crew';
  });
}

// ---------- SOCKET.IO ----------

io.on('connection', (socket) => {
  console.log('Nuovo socket:', socket.id);
  socket.data.roomId = null;

  socket.on('joinRoom', ({ roomId, nickname, gameType }) => {
    roomId = (roomId || '').trim();
    nickname = (nickname || '').trim() || 'Anonimo';
    gameType = gameType === 'among' ? 'among' : 'tris';

    if (!roomId) {
      socket.emit('errorMessage', 'Devi inserire un codice stanza.');
      return;
    }

    if (!rooms[roomId]) {
      if (gameType === 'tris') createTrisRoom(roomId);
      else createAmongRoom(roomId);
    }

    const room = rooms[roomId];

    if (room.gameType !== gameType) {
      socket.emit(
        'errorMessage',
        `Questa stanza esiste già per il gioco "${room.gameType}". Cambia codice o seleziona lo stesso gioco.`
      );
      return;
    }

    socket.data.roomId = roomId;
    socket.join(roomId);

    if (room.gameType === 'tris') {
      const symbolsInUse = Object.values(room.players)
        .map(p => p.symbol)
        .filter(Boolean);

      let symbol = 'X';
      if (symbolsInUse.includes('X') && !symbolsInUse.includes('O')) {
        symbol = 'O';
      } else if (symbolsInUse.includes('X') && symbolsInUse.includes('O')) {
        symbol = null;
      }

      room.players[socket.id] = { symbol, nickname };

      socket.emit('init', {
        roomId,
        gameType: 'tris',
        symbol,
        board: room.board,
        currentTurn: room.currentTurn,
        gameOver: room.gameOver,
        players: room.players,
        among: null
      });

      io.to(roomId).emit('playersUpdate', {
        players: room.players
      });
    } else if (room.gameType === 'among') {
      const player = {
        nickname,
        role: 'crew',
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        color: getRandomColor()
      };
      room.players[socket.id] = player;

      assignAmongRoles(room);

      socket.emit('init', {
        roomId,
        gameType: 'among',
        symbol: null,
        board: null,
        currentTurn: null,
        gameOver: null,
        players: room.players,
        among: {
          me: { id: socket.id, ...room.players[socket.id] }
        }
      });

      io.to(roomId).emit('playersUpdate', {
        players: room.players
      });
    }
  });

  // TRIS: mossa
  socket.on('makeMove', (index) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    if (room.gameType !== 'tris') return;
    if (room.gameOver) return;

    const player = room.players[socket.id];
    if (!player || !player.symbol) return;

    const symbol = player.symbol;
    if (symbol !== room.currentTurn) return;
    if (room.board[index] !== null) return;

    room.board[index] = symbol;

    const winner = checkWinner(room.board);
    if (winner) {
      room.gameOver = true;
      io.to(roomId).emit('gameState', {
        gameType: 'tris',
        board: room.board,
        currentTurn: room.currentTurn,
        gameOver: room.gameOver,
        winner,
        players: room.players,
        among: null
      });
    } else {
      room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
      io.to(roomId).emit('gameState', {
        gameType: 'tris',
        board: room.board,
        currentTurn: room.currentTurn,
        gameOver: room.gameOver,
        winner: null,
        players: room.players,
        among: null
      });
    }
  });

  // RESET per entrambi i giochi
  socket.on('reset', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];

    if (room.gameType === 'tris') {
      room.board = Array(9).fill(null);
      room.currentTurn = 'X';
      room.gameOver = false;

      io.to(roomId).emit('gameState', {
        gameType: 'tris',
        board: room.board,
        currentTurn: room.currentTurn,
        gameOver: room.gameOver,
        winner: null,
        players: room.players,
        among: null
      });
    } else if (room.gameType === 'among') {
      // rimetti i player in posizioni random e riassegna ruoli
      Object.values(room.players).forEach(p => {
        p.x = 100 + Math.random() * 200;
        p.y = 100 + Math.random() * 200;
      });
      assignAmongRoles(room);

      io.to(roomId).emit('gameState', {
        gameType: 'among',
        board: null,
        currentTurn: null,
        gameOver: null,
        winner: null,
        players: room.players,
        among: null
      });
    }
  });

  // AMONG: movimento
  socket.on('move', ({ x, y }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    if (room.gameType !== 'among') return;

    const player = room.players[socket.id];
    if (!player) return;

    const clampedX = Math.max(40, Math.min(760, x));
    const clampedY = Math.max(40, Math.min(460, y));

    player.x = clampedX;
    player.y = clampedY;

    io.to(roomId).emit('playerMoved', {
      id: socket.id,
      x: player.x,
      y: player.y
    });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    delete room.players[socket.id];

    if (Object.keys(room.players).length === 0) {
      delete rooms[roomId];
      console.log('Room eliminata:', roomId);
    } else {
      if (room.gameType === 'among') {
        assignAmongRoles(room);
      }
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
