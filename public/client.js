const socket = io();

// login
const loginDiv = document.getElementById('login');
const roomIdInput = document.getElementById('roomIdInput');
const nicknameInput = document.getElementById('nicknameInput');
const gameSelect = document.getElementById('gameSelect');
const joinBtn = document.getElementById('joinBtn');
const loginError = document.getElementById('loginError');

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
