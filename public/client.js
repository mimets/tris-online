const socket = io();

// elementi login
const loginDiv = document.getElementById('login');
const roomIdInput = document.getElementById('roomIdInput');
const nicknameInput = document.getElementById('nicknameInput');
const joinBtn = document.getElementById('joinBtn');
const loginError = document.getElementById('loginError');

// elementi gioco
const gameDiv = document.getElementById('game');
const boardEl = document.getElementById('board');
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

// linee di vittoria (indici celle)
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

function clearWinEffects() {
  boardEl.classList.remove('board-draw');
  cells.forEach(c => c.classList.remove('win'));
}

function renderBoard(board, winnerSymbol = null) {
  // reset effetti
  clearWinEffects();

  board.forEach((value, index) => {
    const cell = cells[index];
    cell.textContent = value || '';
    if (value) {
      cell.classList.add('taken');
    } else {
      cell.classList.remove('taken');
    }
  });

  // se c'è un vincitore, evidenzia la linea
  if (winnerSymbol === 'X' || winnerSymbol === 'O') {
    for (const [a,b,c] of WIN_LINES) {
      if (board[a] === winnerSymbol && board[b] === winnerSymbol && board[c] === winnerSymbol) {
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

// esci dalla stanza (solo lato client)
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
  currentTurn = data.currentTurn;
  gameOver = data.gameOver;

  // se c'è vincitore, passiamo il simbolo per highlight
  const winnerSymbol = data.winner === 'X' || data.winner === 'O' ? data.winner : null;
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
  clearWinEffects();
  socket.emit('reset');
});
