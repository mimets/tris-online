const socket = io();

// elementi login
const loginDiv = document.getElementById('login');
const roomIdInput = document.getElementById('roomIdInput');
const nicknameInput = document.getElementById('nicknameInput');
const joinBtn = document.getElementById('joinBtn');
const loginError = document.getElementById('loginError');

// elementi gioco
const gameDiv = document.getElementById('game');
const cells = document.querySelectorAll('.cell');
const symbolEl = document.getElementById('symbol');
const turnEl = document.getElementById('turn');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const playersListEl = document.getElementById('playersList');
const roomInfoEl = document.getElementById('roomInfo');
const leaveBtn = document.getElementById('leaveBtn');

let mySymbol = null;
let currentTurn = 'X';
let gameOver = false;
let currentRoomId = null;

function renderBoard(board) {
  board.forEach((value, index) => {
    const cell = cells[index];
    cell.textContent = value || '';
    if (value) {
      cell.classList.add('taken');
    } else {
      cell.classList.remove('taken');
    }
  });
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

// join stanza
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

// esci dalla stanza (lato client basta ricaricare l'interfaccia)
leaveBtn.addEventListener('click', () => {
  // reset stato locale
  mySymbol = null;
  currentTurn = 'X';
  gameOver = false;
  currentRoomId = null;

  // torna a schermata login
  gameDiv.classList.add('hidden');
  loginDiv.classList.remove('hidden');

  // pulisci UI
  statusEl.textContent = '';
  playersListEl.textContent = '';
  roomInfoEl.textContent = '';
  symbolEl.textContent = '';
  turnEl.textContent = '';

  renderBoard(Array(9).fill(null));
});

// errori dal server
socket.on('errorMessage', (msg) => {
  loginError.textContent = msg;
});

// inizializzazione dopo join
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

// aggiornamento lista giocatori
socket.on('playersUpdate', (data) => {
  renderPlayers(data.players);
});

// stato partita
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

// click celle
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const index = parseInt(cell.getAttribute('data-index'), 10);
    if (gameOver) return;
    if (!mySymbol) return; // spettatore
    socket.emit('makeMove', index);
  });
});

// reset partita
resetBtn.addEventListener('click', () => {
  socket.emit('reset');
});
