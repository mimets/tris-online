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
//   gameType: 'tris' | 'morra',
//   board: Array(9) (solo per tris),
//   currentTurn: 'X' | 'O' (solo per tris),
//   gameOver: bool (tris),
//   morra: { // solo per morra
//     choices: { socketId: 'rock'|'paper'|'scissors' },
//     lastResult: { winnerNickname, text }
//   },
//   players: { socketId: { symbol, nickname } }
// }
const rooms = {};

function createRoom(roomId, gameType) {
  const base = {
    gameType,
    players: {}
  };

  if (gameType === 'tris') {
    base.board = Array(9).fill(null);
    base.currentTurn = 'X';
    base.gameOver = false;
  } else if (gameType === 'morra') {
    base.morra = {
      choices: {},
      lastResult: null
    };
  }

  rooms[roomId] = base;
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

function evaluateMorra(choices, players) {
  const ids = Object.keys(choices);
  if (ids.length < 2) return null;

  const [id1, id2] = ids;
  const c1 = choices[id1];
  const c2 = choices[id2];

  if (!c1 || !c2) return null;

  if (c1 === c2) {
    return {
      winnerNickname: null,
      text: `Pareggio: ${c1} contro ${c2}`
    };
  }

  const winMap = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper'
  };

  let winnerId;
  if (winMap[c1] === c2) {
    winnerId = id1;
  } else if (winMap[c2] === c1) {
    winnerId = id2;
  } else {
    return null;
  }

  const winnerNickname = players[winnerId]?.nickname || 'Sconosciuto';

  return {
    winnerNickname,
    text: `${winnerNickname} ha vinto: ${c1} contro ${c2}`
  };
}

io.on('connection', (socket) => {
  console.log('Nuovo socket:', socket.id);
  socket.data.roomId = null;

  // join stanza con nickname + gameType
  socket.on('joinRoom', ({ roomId, nickname, gameType }) => {
    roomId = (roomId || '').trim();
    nickname = (nickname || '').trim() || 'Anonimo';
    gameType = gameType === 'morra' ? 'morra' : 'tris';

    if (!roomId) {
      socket.emit('errorMessage', 'Devi inserire un codice stanza.');
      return;
    }

    if (!rooms[roomId]) {
      createRoom(roomId, gameType);
    }

    const room = rooms[roomId];

    // stanza esistente ma con altro gioco
    if (room.gameType !== gameType) {
      socket.emit(
        'errorMessage',
        `Questa stanza esiste già per il gioco "${room.gameType}". Cambia codice o seleziona lo stesso gioco.`
      );
      return;
    }

    const symbolsInUse = Object.values(room.players)
      .map(p => p.symbol)
      .filter(Boolean);

    let symbol = 'X';
    if (room.gameType === 'tris') {
      if (symbolsInUse.includes('X') && !symbolsInUse.includes('O')) {
        symbol = 'O';
      } else if (symbolsInUse.includes('X') && symbolsInUse.includes('O')) {
        symbol = null; // spettatore
      }
    } else {
      symbol = null; // morra non usa X/O
    }

    room.players[socket.id] = { symbol, nickname };
    socket.data.roomId = roomId;
    socket.join(roomId);

    console.log(
      `Socket ${socket.id} è entrato in room ${roomId} (${room.gameType})`
    );

    if (room.gameType === 'tris') {
      socket.emit('init', {
        roomId,
        gameType: room.gameType,
        symbol,
        board: room.board,
        currentTurn: room.currentTurn,
        gameOver: room.gameOver,
        players: room.players,
        morra: null
      });
    } else {
      socket.emit('init', {
        roomId,
        gameType: room.gameType,
        symbol: null,
        board: null,
        currentTurn: null,
        gameOver: null,
        players: room.players,
        morra: room.morra
      });
    }

    io.to(roomId).emit('playersUpdate', {
      players: room.players
    });
  });

  // mossa tris
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
        morra: null
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
        morra: null
      });
    }
  });

  // reset
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
        morra: null
      });
    } else if (room.gameType === 'morra') {
      room.morra.choices = {};
      room.morra.lastResult = null;

      io.to(roomId).emit('gameState', {
        gameType: 'morra',
        board: null,
        currentTurn: null,
        gameOver: null,
        winner: null,
        players: room.players,
        morra: room.morra
      });
    }
  });

  // mossa morra
  socket.on('morraChoice', (choice) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    if (room.gameType !== 'morra') return;

    const c = choice === 'rock' || choice === 'paper' || choice === 'scissors'
      ? choice
      : null;
    if (!c) return;

    room.morra.choices[socket.id] = c;

    const result = evaluateMorra(room.morra.choices, room.players);
    if (result) {
      room.morra.lastResult = result;

      io.to(roomId).emit('gameState', {
        gameType: 'morra',
        board: null,
        currentTurn: null,
        gameOver: null,
        winner: null,
        players: room.players,
        morra: room.morra
      });

      room.morra.choices = {};
    } else {
      io.to(roomId).emit('gameState', {
        gameType: 'morra',
        board: null,
        currentTurn: null,
        gameOver: null,
        winner: null,
        players: room.players,
        morra: room.morra
      });
    }
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    delete room.players[socket.id];

    if (room.gameType === 'morra' && room.morra) {
      delete room.morra.choices[socket.id];
    }

    if (Object.keys(room.players).length === 0) {
      delete rooms[roomId];
      console.log('Room eliminata:', roomId);
    } else {
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
