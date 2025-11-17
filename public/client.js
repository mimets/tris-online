const socket = io();

const cells = document.querySelectorAll('.cell');
const symbolEl = document.getElementById('symbol');
const turnEl = document.getElementById('turn');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset');

let mySymbol = null;
let currentTurn = 'X';
let gameOver = false;

function renderBoard(board) {
  board.forEach((value, index) => {
    cells[index].textContent = value || '';
  });
}

socket.on('init', (data) => {
  mySymbol = data.symbol;
  renderBoard(data.board);
  currentTurn = data.currentTurn;
  gameOver = data.gameOver;

  if (!mySymbol) {
    symbolEl.textContent = 'Sei spettatore (X e O già occupati)';
  } else {
    symbolEl.textContent = 'Tu sei: ' + mySymbol;
  }
  turnEl.textContent = 'Turno di: ' + currentTurn;
  statusEl.textContent = '';
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
});

cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const index = parseInt(cell.getAttribute('data-index'), 10);
    if (gameOver) return;
    if (!mySymbol) return;
    socket.emit('makeMove', index);
  });
});

resetBtn.addEventListener('click', () => {
  socket.emit('reset');
});
