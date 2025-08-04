// Canvas setup
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);

// Game constants
const COLS = 10;
const ROWS = 20;

// Game state
let arena = createMatrix(COLS, ROWS);
let currentPiece = null;
let currentPos = { x: 0, y: 0 };
let score = 0;
let gameOver = false;
let paused = true;
let gameStarted = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

// DOM elements
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const restartBtnOverlay = document.getElementById('restartBtnOverlay');
const scoreElement = document.getElementById('score');
const gameOverOverlay = document.getElementById('gameOverOverlay');

// Audio
const clearSound = new Audio('glass-clear.mp3');
const bgMusic = new Audio('background-music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.4;

// One-time fallback to allow audio to play
function enableMusicFallback() {
  const tryPlay = () => {
    if (bgMusic.paused) {
      bgMusic.play().catch(() => {});
    }
    document.removeEventListener('keydown', tryPlay);
    document.removeEventListener('click', tryPlay);
  };
  document.addEventListener('keydown', tryPlay);
  document.addEventListener('click', tryPlay);
}

// Tetrimino shapes
const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[2, 0, 0], [2, 2, 2], [0, 0, 0]],
  L: [[0, 0, 3], [3, 3, 3], [0, 0, 0]],
  O: [[4, 4], [4, 4]],
  S: [[0, 5, 5], [5, 5, 0], [0, 0, 0]],
  T: [[0, 6, 0], [6, 6, 6], [0, 0, 0]],
  Z: [[7, 7, 0], [0, 7, 7], [0, 0, 0]]
};

// Helpers
function createMatrix(w, h) {
  const matrix = [];
  while (h--) matrix.push(new Array(w).fill(0));
  return matrix;
}

function getColor(num) {
  const colors = [
    null,
    'rgba(129, 212, 250, 0.7)',
    'rgba(129, 212, 250, 0.7)',
    'rgba(129, 212, 250, 0.7)',
    'rgba(129, 212, 250, 0.7)',
    'rgba(129, 212, 250, 0.7)',
    'rgba(129, 212, 250, 0.7)',
    'rgba(129, 212, 250, 0.7)',
  ];
  return colors[num];
}

function collide(arena, piece, pos) {
  for (let y = 0; y < piece.length; y++) {
    for (let x = 0; x < piece[y].length; x++) {
      if (piece[y][x] !== 0) {
        const newX = x + pos.x;
        const newY = y + pos.y;
        if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
        if (newY >= 0 && arena[newY][newX] !== 0) return true;
      }
    }
  }
  return false;
}

function merge(arena, piece, pos) {
  piece.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + pos.y][x + pos.x] = value;
      }
    });
  });
}

function arenaSweep() {
  let rowsCleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (arena[y][x] === 0) continue outer;
    }
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    rowsCleared++;
    y++;
  }

  if (rowsCleared > 0) {
    score += 100 * Math.pow(2, rowsCleared - 1);
    updateScore();
    clearSound.currentTime = 0;
    clearSound.play();
  }
}

function updateScore() {
  scoreElement.textContent = score;
}

function createPiece() {
  const types = Object.keys(SHAPES);
  const rand = types[Math.floor(Math.random() * types.length)];
  return SHAPES[rand].map(row => row.slice());
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < y; x++) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

function playerRotate(dir) {
  const posX = currentPos.x;
  let offset = 1;
  rotate(currentPiece, dir);
  while (collide(arena, currentPiece, currentPos)) {
    currentPos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > currentPiece[0].length) {
      rotate(currentPiece, -dir);
      currentPos.x = posX;
      return;
    }
  }
}

function drop() {
  currentPos.y++;
  if (collide(arena, currentPiece, currentPos)) {
    currentPos.y--;
    merge(arena, currentPiece, currentPos);
    arenaSweep();
    spawnPiece();
  }
  dropCounter = 0;
}

function move(dir) {
  currentPos.x += dir;
  if (collide(arena, currentPiece, currentPos)) {
    currentPos.x -= dir;
  }
}

function spawnPiece() {
  currentPiece = createPiece();
  currentPos.y = 0;
  currentPos.x = Math.floor((COLS - currentPiece[0].length) / 2);
  if (collide(arena, currentPiece, currentPos)) {
    gameOver = true;
    showGameOver();
    bgMusic.pause();
  }
}

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val !== 0) {
        context.fillStyle = getColor(val);
        context.shadowColor = 'rgba(255, 255, 255, 0.7)';
        context.shadowBlur = 8;
        context.fillRect(x + offset.x, y + offset.y, 1, 1);
        context.shadowBlur = 0;
        context.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        context.lineWidth = 0.1;
        context.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawMatrix(arena, { x: 0, y: 0 });
  if (currentPiece) drawMatrix(currentPiece, currentPos);
}

function showGameOver() {
  gameOverOverlay.classList.add('visible');
}

function hideGameOver() {
  gameOverOverlay.classList.remove('visible');
}

function resetGame() {
  arena = createMatrix(COLS, ROWS);
  score = 0;
  updateScore();
  gameOver = false;
  paused = false;
  dropInterval = 1000;
  spawnPiece();
  hideGameOver();
  lastTime = 0;
  dropCounter = 0;
  draw();
}

// Main loop
function update(time = 0) {
  if (gameOver || paused) {
    lastTime = time;
    requestAnimationFrame(update);
    return;
  }

  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter > dropInterval) drop();
  draw();
  requestAnimationFrame(update);
}

// ESC key: start or pause
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!gameStarted) {
      gameStarted = true;
      resetGame();
      paused = false;
      update();
      bgMusic.play().catch(() => {});
      enableMusicFallback();
    } else if (!gameOver) {
      paused = !paused;
      if (paused) bgMusic.pause();
      else bgMusic.play().catch(() => {});
    }
  }

  if (!gameStarted || paused || gameOver) return;

  switch (event.key) {
    case 'ArrowLeft': move(-1); break;
    case 'ArrowRight': move(1); break;
    case 'ArrowDown': drop(); break;
    case ' ':
      playerRotate(1);
      event.preventDefault();
      break;
  }
});

// Button controls
startBtn?.addEventListener('click', () => {
  if (!gameStarted) {
    gameStarted = true;
    resetGame();
    paused = false;
    update();
    bgMusic.play().catch(() => {});
    enableMusicFallback();
  }
});

pauseBtn?.addEventListener('click', () => {
  if (gameStarted && !gameOver) {
    paused = !paused;
    if (paused) bgMusic.pause();
    else bgMusic.play().catch(() => {});
  }
});

restartBtn?.addEventListener('click', () => {
  gameStarted = true;
  resetGame();
  paused = false;
  update();
  bgMusic.play().catch(() => {});
  enableMusicFallback();
});

restartBtnOverlay?.addEventListener('click', () => {
  gameStarted = true;
  resetGame();
  paused = false;
  update();
  bgMusic.play().catch(() => {});
  enableMusicFallback();
});
