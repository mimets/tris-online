const socket = io();

// login
const loginDiv = document.getElementById('login');
const roomIdInput = document.getElementById('roomIdInput');
const nicknameInput = document.getElementById('nicknameInput');
const joinBtn = document.getElementById('joinBtn');
const loginError = document.getElementById('loginError');
const gameOptions = document.querySelectorAll('.game-option');

// gioco
const gameDiv = document.getElementById('game');
const boardEl = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const symbolEl = document.getElementById('symbol');
const turnEl = document.getElementById('turn');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const playersListEl = document.getElementById('playersList');
const roomInfoEl = document.getElementById('roomInfo');
const gameInfoEl = document.getElementById('gameInfo');
const leaveBtn = document.getElementById('leaveBtn');

const trisWrapper = document.getElementById('trisWrapper');
const morraWrapper = document.getElementById('morraWrapper');
const morraButtons = document.querySelectorAll('.morra-btn');

let mySymbol = null;
let currentTurn = 'X';
let gameOver = false;
let currentRoomId = null;
let currentGameType = 'tris';

// linee vittoria tris
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

// selezione gioco dal menu a sinistra
gameOptions.forEach(btn => {
  btn.addEventListener('click', () => {
    gameOptions.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

function getSelectedGameType() {
  const active = document.querySelector('.game-option.active');
  if (!active) return 'tris';
  const v = active.getAttribute('data-game');
  return v === 'morra' ? 'morra' : 'tris';
}

function clearWinEffects() {
  boardEl.classList.remove('board-draw');
  cells.forEach(c => c.classList.remove('win'));
}

function renderBoard(board, winnerSymbol = null) {
  clearWinEffects();

  if (!board) {
    cells.forEach(c => {
      c.textContent = '';
      c.classList.remove('taken');
    });
    return;
  }

  board.forEach((value, index) => {
    const cell = cells[index];
    cell.textContent = value || '';
    if (value) {
      cell.classList.add('taken');
    } else {
      cell.classList.remove('taken');
    }
  });

  if (winnerSymbol === 'X' || winnerSymbol === 'O') {
    for (const [a,b,c] of WIN_LINES) {
      const boardArr = board;
      if (boardArr[a] === winnerSymbol && boardArr[b] === winnerSymbol && boardArr[c] === winnerSymbol) {
        cells[a].classList.add('win');
        cells[b].classList.add('win');
        cells[c].classList.add('win');
        break;
      }
    }
  }
}

function renderPlayers(players) {
  const list = Object.values(players)
    .map(p => {
      const sym = p.symbol ? `(${p.symbol})` : '(spettatore)';
      return `${p.nickname} ${sym}`;
    });
  playersListEl.textContent =
    list.length > 0
      ? 'Giocatori in stanza: ' + list.join(' | ')
      : 'Nessun giocatore nella stanza.';
}

function updateGameLayout(gameType) {
  currentGameType = gameType;

  if (gameType === 'tris') {
    trisWrapper.classList.remove('hidden');
    morraWrapper.classList.add('hidden');
    gameInfoEl.textContent = 'Gioco: Tris 3×3';
  } else if (gameType === 'morra') {
    trisWrapper.classList.add('hidden');
    morraWrapper.classList.remove('hidden');
    gameInfoEl.textContent = 'Gioco: Morra cinese';
  }
}

// join stanza
joinBtn.addEventListener('click', () => {
  const roomId = roomIdInput.value.trim();
  const nickname = nicknameInput.value.trim();
  const gameType = getSelectedGameType();

  if (!roomId) {
    loginError.textContent = 'Inserisci un codice stanza.';
    return;
  }

  loginError.textContent = '';
  socket.emit('joinRoom', { roomId, nickname, gameType });
});

// esci stanza
leaveBtn.addEventListener('click', () => {
  mySymbol = null;
  currentTurn = 'X';
  gameOver = false;
  currentRoomId = null;

  gameDiv.classList.add('hidden');
  loginDiv.classList.remove('hidden');

  statusEl.textContent = '';
  playersListEl.textContent = '';
  roomInfoEl.textContent = '';
  gameInfoEl.textContent = '';
  symbolEl.textContent = '';
  turnEl.textContent = '';

  renderBoard(null);
});

// errori
socket.on('errorMessage', (msg) => {
  loginError.textContent = msg;
});

// init dopo join
socket.on('init', (data) => {
  currentRoomId = data.roomId;
  currentGameType = data.gameType;
  mySymbol = data.symbol;
  currentTurn = data.currentTurn;
  gameOver = !!data.gameOver;

  loginDiv.classList.add('hidden');
  gameDiv.classList.remove('hidden');

  roomInfoEl.textContent = 'Stanza: ' + currentRoomId;
  updateGameLayout(currentGameType);
  renderPlayers(data.players);

  if (currentGameType === 'tris') {
    renderBoard(data.board);
    symbolEl.textContent = mySymbol
      ? 'Tu sei: ' + mySymbol
      : 'Sei spettatore (X e O occupati)';
    turnEl.textContent = 'Turno di: ' + currentTurn;
    statusEl.textContent = '';
  } else if (currentGameType === 'morra') {
    renderBoard(null);
    symbolEl.textContent = 'Scegli sasso, carta o forbice.';
    turnEl.textContent = '';
    if (data.morra && data.morra.lastResult) {
      statusEl.textContent = data.morra.lastResult.text;
    } else {
      statusEl.textContent = 'In attesa delle scelte...';
    }
  }
});

// update giocatori
socket.on('playersUpdate', (data) => {
  renderPlayers(data.players);
});

// stato partita
socket.on('gameState', (data) => {
  currentGameType = data.gameType;

  updateGameLayout(currentGameType);

  if (currentGameType === 'tris') {
    currentTurn = data.currentTurn;
    gameOver = !!data.gameOver;

    const winnerSymbol =
      data.winner === 'X' || data.winner === 'O' ? data.winner : null;
    renderBoard(data.board, winnerSymbol);

    turnEl.textContent = 'Turno di: ' + currentTurn;

    if (data.winner === 'X' || data.winner === 'O') {
      statusEl.textContent = 'Ha vinto: ' + data.winner;
    } else if (data.winner === 'draw') {
      statusEl.textContent = 'Pareggio!';
      boardEl.classList.add('board-draw');
    } else {
      statusEl.textContent = '';
    }
  } else if (currentGameType === 'morra') {
    gameOver = false;
    renderBoard(null);

    if (data.morra && data.morra.lastResult) {
      statusEl.textContent = data.morra.lastResult.text;
    } else {
      statusEl.textContent = 'In attesa delle scelte...';
    }
  }

  if (data.players) {
    renderPlayers(data.players);
  }
});

// click celle tris
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    if (currentGameType !== 'tris') return;
    const index = parseInt(cell.getAttribute('data-index'), 10);
    if (gameOver) return;
    if (!mySymbol) return;
    socket.emit('makeMove', index);
  });
});

// bottoni morra
morraButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (currentGameType !== 'morra') return;
    const choice = btn.getAttribute('data-choice');
    socket.emit('morraChoice', choice);
  });
});

// reset
resetBtn.addEventListener('click', () => {
  clearWinEffects();
  socket.emit('reset');
});
