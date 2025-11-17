const socket = io();

// login
const loginDiv = document.getElementById('login');
const roomIdInput = document.getElementById('roomIdInput');
const nicknameInput = document.getElementById('nicknameInput');
const joinBtn = document.getElementById('joinBtn');
const loginError = document.getElementById('loginError');
const gameOptions = document.querySelectorAll('.game-option');

// info gioco
const gameDiv = document.getElementById('game');
const roomInfoEl = document.getElementById('roomInfo');
const gameInfoEl = document.getElementById('gameInfo');
const symbolEl = document.getElementById('symbol');
const turnEl = document.getElementById('turn');
const statusEl = document.getElementById('status');
const playersListEl = document.getElementById('playersList');
const leaveBtn = document.getElementById('leaveBtn');
const resetBtn = document.getElementById('reset');

// tris
const trisWrapper = document.getElementById('trisWrapper');
const boardEl = document.getElementById('board');
const cells = document.querySelectorAll('.cell');

// among
const amongWrapper = document.getElementById('amongWrapper');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let currentGameType = 'tris';
let currentRoomId = null;

// stato tris
let mySymbol = null;
let currentTurn = 'X';
let gameOver = false;

// stato among
let myId = null;
let myRole = null;
let playersAmong = {};
let keys = {};

// linee vittoria tris
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

// --- selezione gioco menu sinistra ---
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
  return v === 'among' ? 'among' : 'tris';
}

// --- UI helper ---
function clearWinEffects() {
  if (!boardEl) return;
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
      const bArr = board;
      if (bArr[a] === winnerSymbol && bArr[b] === winnerSymbol && bArr[c] === winnerSymbol) {
        cells[a].classList.add('win');
        cells[b].classList.add('win');
        cells[c].classList.add('win');
        break;
      }
    }
  }
}

function renderPlayersGeneric(players) {
  const list = Object.entries(players)
    .map(([id, p]) => {
      const sym = p.symbol ? `(${p.symbol})` : '';
      return `${p.nickname || '???'} ${sym}`.trim();
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
    amongWrapper.classList.add('hidden');
    gameInfoEl.textContent = 'Gioco: Tris 3×3';
  } else if (gameType === 'among') {
    trisWrapper.classList.add('hidden');
    amongWrapper.classList.remove('hidden');
    gameInfoEl.textContent = 'Gioco: Among‑Lite';
  }
}

// --- join stanza ---
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

// esci
leaveBtn.addEventListener('click', () => {
  location.reload();
});

// errori
socket.on('errorMessage', (msg) => {
  loginError.textContent = msg;
});

// init stanza
socket.on('init', (data) => {
  currentRoomId = data.roomId;
  currentGameType = data.gameType;

  loginDiv.classList.add('hidden');
  gameDiv.classList.remove('hidden');

  roomInfoEl.textContent = 'Stanza: ' + currentRoomId;
  updateGameLayout(currentGameType);
  renderPlayersGeneric(data.players || {});

  if (currentGameType === 'tris') {
    mySymbol = data.symbol;
    currentTurn = data.currentTurn;
    gameOver = !!data.gameOver;

    renderBoard(data.board);
    symbolEl.textContent = mySymbol
      ? 'Tu sei: ' + mySymbol
      : 'Sei spettatore (X e O occupati)';
    turnEl.textContent = 'Turno di: ' + currentTurn;
    statusEl.textContent = '';
  } else if (currentGameType === 'among') {
    myId = data.among.me.id;
    myRole = data.among.me.role;
    playersAmong = data.players || {};

    symbolEl.textContent = 'Ruolo: ' + (myRole === 'impostor' ? 'Impostore' : 'Crew');
    turnEl.textContent = '';
    statusEl.textContent = 'Muoviti con WASD o frecce.';
    startLoop();
  }
});

// update players
socket.on('playersUpdate', (data) => {
  if (currentGameType === 'tris') {
    renderPlayersGeneric(data.players);
  } else if (currentGameType === 'among') {
    playersAmong = data.players || {};
    renderPlayersGeneric(playersAmong);
    if (playersAmong[myId]) {
      myRole = playersAmong[myId].role;
      symbolEl.textContent = 'Ruolo: ' + (myRole === 'impostor' ? 'Impostore' : 'Crew');
    }
  }
});

// game state
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

    if (data.players) renderPlayersGeneric(data.players);
  } else if (currentGameType === 'among') {
    if (data.players) {
      playersAmong = data.players;
      renderPlayersGeneric(playersAmong);
    }
    statusEl.textContent = 'Muoviti con WASD o frecce.';
  }
});

// TRIS: click celle
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    if (currentGameType !== 'tris') return;
    const index = parseInt(cell.getAttribute('data-index'), 10);
    if (gameOver) return;
    if (!mySymbol) return;
    socket.emit('makeMove', index);
  });
});

// RESET
resetBtn.addEventListener('click', () => {
  clearWinEffects();
  socket.emit('reset');
});

// AMONG: movimento
socket.on('playerMoved', (data) => {
  if (currentGameType !== 'among') return;
  if (!playersAmong[data.id]) return;
  playersAmong[data.id].x = data.x;
  playersAmong[data.id].y = data.y;
});

// input tastiera among
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

function updateMyPosition(delta) {
  if (currentGameType !== 'among') return;
  if (!playersAmong[myId]) return;

  const speed = 150;
  let dx = 0;
  let dy = 0;

  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  if (dx === 0 && dy === 0) return;

  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= length;
  dy /= length;

  const p = playersAmong[myId];
  p.x += dx * speed * delta;
  p.y += dy * speed * delta;

  socket.emit('move', { x: p.x, y: p.y });
}

function drawAmong() {
  if (!canvas || !ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
  ctx.fillRect(canvas.width / 2 - 120, 80, 240, 140);
  ctx.fillRect(80, canvas.height - 190, 200, 140);
  ctx.fillRect(canvas.width - 280, canvas.height - 190, 200, 140);

  Object.entries(playersAmong).forEach(([id, p]) => {
    const isMe = id === myId;

    ctx.beginPath();
    ctx.fillStyle = p.color || '#60a5fa';
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(p.x + 4, p.y - 2, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.beginPath();
    ctx.arc(p.x, p.y + 18, 10, 0, Math.PI);
    ctx.fill();

    ctx.fillStyle = isMe ? '#f97316' : '#e5e7eb';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(p.nickname || '???', p.x, p.y - 24);

    if (isMe) {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

let lastTime = null;
function loop(timestamp) {
  if (currentGameType !== 'among') return;
  if (!lastTime) lastTime = timestamp;
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  updateMyPosition(delta);
  drawAmong();

  requestAnimationFrame(loop);
}

function startLoop() {
  lastTime = null;
  requestAnimationFrame(loop);
}
