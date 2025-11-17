const socket = io();

const loginDiv = document.getElementById('login');
const roomIdInput = document.getElementById('roomIdInput');
const nicknameInput = document.getElementById('nicknameInput');
const joinBtn = document.getElementById('joinBtn');
const loginError = document.getElementById('loginError');

const gameDiv = document.getElementById('game');
const cells = document.querySelectorAll('.cell');
const symbolEl = document.getElementById('symbol');
const turnEl = document.getElementById('turn');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const playersListEl = document.getElementById('playersList');
const roomInfoEl = document.getElementById('roomInfo');

let mySymbol = null;
let currentTurn = 'X';
let gameOver = false;
let currentRoomId = null;

function renderBoard(board) {
  board.forEach((value, index) => {
    cells[index].textContent = value || '';
  });
}

function renderPlayers(players) {
  const list = Object.values(players)
    .map(p => {
      const sym = p.symbol ? `(${p.symbol})` : '(spettatore)';
      return `${p.nickname} ${sym}`;
    });
  playersListEl.textContent = 'Giocatori in stanza: ' + list.join(' | ');
}

joinBtn.addEventListener('click', () => {
  const roomId = roomIdInput.value.trim();
  const nickname = nicknameInput.value.trim();

  if (!roomId) {
    loginError.textContent = 'Inserisci un codice stanza.';
    return;
  }

  loginError.textContent = '';
  socket.emit('joinRoom', { roomId, nickname });
});

socket.on('errorMessage', (msg) => {
  loginError.textContent = msg;
});

socket.on('init', (data) => {
  currentRoomId = data.roomId;
  mySymbol = data.symbol;
  currentTurn = data.currentTurn;
  gameOver = data.gameOver;

  loginDiv.classList.add('hidden');
  gameDiv.classList.remove('hidden');

  renderBoard(data.board);
  renderPlayers(data.players);

  roomInfoEl.textContent = 'Stanza: ' + currentRoomId;

  if (!mySymbol) {
    symbolEl.textContent = 'Sei spettatore (X e O già occupati)';
  } else {
    symbolEl.textContent = 'Tu sei: ' + mySymbol;
  }
  turnEl.textContent = 'Turno di: ' + currentTurn;
  statusEl.textContent = '';
});

socket.on('playersUpdate', (data) => {
  renderPlayers(data.players);
});

socket.on('gameState', (data) => {
  renderBoard(data.board);
  currentTurn = data.currentTurn;
  gameOver = data.gameOver;

  turnEl.textContent = 'Turno di: ' + currentTurn;

  if (data.winner === 'X' || data.winner === 'O') {
    statusEl.textContent = 'Ha vinto: ' + data.winner;
  } else if (data.winner === 'draw') {
    statusEl.textContent = 'Pareggio!';
  } else {
    statusEl.textContent = '';
  }

  if (data.players) {
    renderPlayers(data.players);
  }
});

cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const index = parseInt(cell.getAttribute('data-index'), 10);
    if (gameOver) return;
    if (!mySymbol) return; // spettatore
    socket.emit('makeMove', index);
  });
});

resetBtn.addEventListener('click', () => {
  socket.emit('reset');
});
