<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Tris Online - Stanze</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app-container">
    <h1>Tris <span>Online</span></h1>
    <p class="subtitle">Crea una stanza, condividi il codice e gioca contro chi vuoi.</p>

    <div id="login">
      <div id="login-top">
        <input id="roomIdInput" type="text" placeholder="Codice stanza (es. abc123)">
      </div>
      <div id="login-bottom">
        <input id="nicknameInput" class="input-small" type="text" placeholder="Nickname">
        <button id="joinBtn">Entra / Crea stanza</button>
      </div>
      <p id="loginError" class="error"></p>
    </div>

    <div id="game" class="hidden">
      <div id="info">
        <p id="roomInfo"></p>
        <p id="symbol" class="info-label"></p>
        <p id="turn" class="info-label"></p>
        <p id="status"></p>
      </div>

      <div id="playersList"></div>

      <div id="board">
        <div class="cell" data-index="0"></div>
        <div class="cell" data-index="1"></div>
        <div class="cell" data-index="2"></div>
        <div class="cell" data-index="3"></div>
        <div class="cell" data-index="4"></div>
        <div class="cell" data-index="5"></div>
        <div class="cell" data-index="6"></div>
        <div class="cell" data-index="7"></div>
        <div class="cell" data-index="8"></div>
      </div>

      <button id="reset">Nuova partita</button>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="client.js"></script>
</body>
</html>
