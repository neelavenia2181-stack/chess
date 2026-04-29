const game = new Chess();
let boardFlipped = false;
let hintsEnabled = true;

// DOM Elements
const boardEl = document.getElementById('board');
const rankLabelsEl = document.getElementById('rank-labels');
const fileLabelsEl = document.getElementById('file-labels');
const statusEl = document.getElementById('status-text');
const moveHistoryEl = document.getElementById('move-history');
const capturedWhiteEl = document.getElementById('captured-by-white');
const capturedBlackEl = document.getElementById('captured-by-black');

// State for interactions
let selectedSquare = null;
let legalMovesForSelected = [];
let pendingPromotionMove = null;
let draggedSquare = null;

let gameMode = null; // 'bot' or 'online'
let playerColor = 'w';
let currentRoomId = null;
let socket = null;

// Unicode piece mapping
const PIECE_UNICODE = {
    'p': '♙', 'n': '♘', 'b': '♗', 'r': '♖', 'q': '♕', 'k': '♔',
    'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔'
};
// Different visual style for black to contrast better or we can just rely on color css
// Alternatively actual unicode characters for black pieces: ♟♞♝♜♛♚
const PIECE_UNICODE_EXACT = {
    'w': {'p': '♙', 'n': '♘', 'b': '♗', 'r': '♖', 'q': '♕', 'k': '♔'},
    'b': {'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚'}
};

// Add piece values for basic bot logic
const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function makeBotMove() {
    if (game.game_over()) return;
    
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return;
    
    // Sort moves by potential capture value (descending)
    moves.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        if (a.captured) scoreA = pieceValues[a.captured] || 0;
        if (b.captured) scoreB = pieceValues[b.captured] || 0;
        // Promote is also good
        if (a.promotion) scoreA += 8;
        if (b.promotion) scoreB += 8;
        return scoreB - scoreA;
    });
    
    // Take the best move, or pick randomly among moves with the same best score
    const bestScore = (moves[0].captured ? pieceValues[moves[0].captured] : 0) + (moves[0].promotion ? 8 : 0);
    const bestMoves = moves.filter(m => {
        const score = (m.captured ? pieceValues[m.captured] : 0) + (m.promotion ? 8 : 0);
        return score === bestScore;
    });
    
    const chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    
    executeMove({ from: chosenMove.from, to: chosenMove.to, promotion: chosenMove.promotion });
}

function initBoard() {
    drawLabels();
    renderBoard();
    updateStatus();
    
    // Set initial toggle state
    const hintsBtn = document.getElementById('btn-hints');
    if (hintsEnabled) {
        hintsBtn.classList.add('active');
    }
    
    // Bind Controls
    document.getElementById('btn-new-game').addEventListener('click', () => {
        game.reset();
        selectedSquare = null;
        renderBoard();
        updateStatus();
        updateMoveHistory();
        updateCapturedPieces();
        addCoachMessage("A new game begins. Make it count.");
    });
    
    document.getElementById('btn-undo').addEventListener('click', () => {
        game.undo();
        selectedSquare = null;
        renderBoard();
        updateStatus();
        updateMoveHistory();
        updateCapturedPieces();
    });
    
    document.getElementById('btn-flip').addEventListener('click', () => {
        boardFlipped = !boardFlipped;
        drawLabels();
        renderBoard();
    });
    
    document.getElementById('btn-hints').addEventListener('click', (e) => {
        hintsEnabled = !hintsEnabled;
        e.currentTarget.classList.toggle('active', hintsEnabled);
        renderBoard();
    });

    // Sub handlers for modal
    document.querySelectorAll('.promo-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            const promotion = btn.dataset.piece;
            document.getElementById('promotion-modal').classList.add('hidden');
            if (pendingPromotionMove) {
                pendingPromotionMove.promotion = promotion;
                executeMove(pendingPromotionMove);
                pendingPromotionMove = null;
            }
        });
    });

    // Chat coach
    const input = document.getElementById('coach-input');
    const sendBtn = document.getElementById('btn-coach-send');
    
    const sendChat = () => {
        const text = input.value.trim();
        if(!text) return;
        
        // Add User Message
        addMessageUI(text, 'user');
        input.value = '';
        
        // Mock API Response
        setTimeout(() => mockCoachResponse(text), 800);
    };

    sendBtn.addEventListener('click', sendChat);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
}

function drawLabels() {
    rankLabelsEl.innerHTML = '';
    fileLabelsEl.innerHTML = '';
    
    const ranks = ['8','7','6','5','4','3','2','1'];
    const files = ['a','b','c','d','e','f','g','h'];
    
    if (boardFlipped) {
        ranks.reverse();
        files.reverse();
    }
    
    ranks.forEach(r => {
        const div = document.createElement('div');
        div.className = 'rank-label';
        div.textContent = r;
        rankLabelsEl.appendChild(div);
    });
    
    files.forEach(f => {
        const div = document.createElement('div');
        div.className = 'file-label';
        div.textContent = f;
        fileLabelsEl.appendChild(div);
    });
}

function getSquareId(fileIndex, rankIndex) {
    const files = 'abcdefgh';
    return files[fileIndex] + (8 - rankIndex);
}

function renderBoard() {
    boardEl.innerHTML = '';
    const boardState = game.board(); // 8x8 array: state[rank][file]
    
    // We render grid from top-left (a8) to bottom-right (h1)
    // If flipped, start from bottom-right (h1) to top-left (a8)
    
    const ranks = boardFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7]; // indices in game.board()
    const files = boardFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7]; 
    
    const lastMove = getHistoryLastMove(); // {from, to} to highlight
    const inCheck = game.in_check();
    let kingSquare = null;

    if (inCheck) {
        // Find king to highlight
        const turn = game.turn();
        for(let r=0; r<8; r++){
            for(let f=0; f<8; f++){
                const p = game.board()[r][f];
                if (p && p.type === 'k' && p.color === turn) {
                    kingSquare = getSquareId(f, r);
                }
            }
        }
    }

    ranks.forEach(r => {
        files.forEach(f => {
            const sqId = getSquareId(f, r);
            const piece = boardState[r][f];
            
            const isLightColor = (r + f) % 2 === 0;
            const squareEl = document.createElement('div');
            squareEl.className = `square ${isLightColor ? 'light' : 'dark'}`;
            squareEl.dataset.sq = sqId;
            
            // Highlight checking
            if (lastMove && (lastMove.from === sqId || lastMove.to === sqId)) {
                squareEl.classList.add('last-move');
            }
            if (selectedSquare === sqId) {
                squareEl.classList.add('selected');
            }
            if (inCheck && kingSquare === sqId) {
                squareEl.classList.add('check');
            }
            
            // Valid move hints
            if (selectedSquare && hintsEnabled) {
                const moveObj = legalMovesForSelected.find(m => m.to === sqId);
                if (moveObj) {
                    squareEl.classList.add('valid-move');
                    if(game.get(sqId) || moveObj.flags.includes('e')) {
                        squareEl.classList.add('capture');
                    }
                }
            }
            
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.className = `piece ${piece.color}`;
                pieceEl.textContent = PIECE_UNICODE_EXACT[piece.color][piece.type];
                
                // Only make pieces draggable if it's the player's turn
                if (!game.game_over() && 
                    ((gameMode === 'online' && piece.color === playerColor && game.turn() === playerColor) || 
                     (gameMode !== 'online' && piece.color === game.turn()))) {
                    pieceEl.draggable = true;
                    
                    pieceEl.addEventListener('dragstart', (e) => {
                        draggedSquare = sqId;
                        selectedSquare = sqId;
                        legalMovesForSelected = game.moves({ square: sqId, verbose: true });
                        
                        // Manually add highlights to avoid DOM re-creation
                        const squares = document.querySelectorAll('.square');
                        squares.forEach(sq => {
                            sq.classList.remove('selected', 'valid-move', 'capture');
                            if (sq.dataset.sq === sqId) {
                                sq.classList.add('selected');
                            }
                            const moveObj = legalMovesForSelected.find(m => m.to === sq.dataset.sq);
                            if (moveObj && hintsEnabled) {
                                sq.classList.add('valid-move');
                                if (game.get(sq.dataset.sq) || moveObj.flags.includes('e')) {
                                    sq.classList.add('capture');
                                }
                            }
                        });
                        
                        document.getElementById('board-wrapper').classList.add('active-glow');
                        
                        setTimeout(() => e.target.style.opacity = '0.5', 0);
                    });
                    
                    pieceEl.addEventListener('dragend', (e) => {
                        e.target.style.opacity = '1';
                        draggedSquare = null;
                    });
                }
                
                squareEl.appendChild(pieceEl);
            }
            
            squareEl.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessary to allow dropping
            });
            
            squareEl.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedSquare) {
                    const toSquare = sqId;
                    const fromSquare = draggedSquare;
                    
                    // Let handleSquareClick handle the logic of making the move
                    selectedSquare = fromSquare; 
                    legalMovesForSelected = game.moves({ square: fromSquare, verbose: true });
                    handleSquareClick(toSquare);
                    
                    draggedSquare = null;
                }
            });
            
            squareEl.addEventListener('click', () => handleSquareClick(sqId));
            
            boardEl.appendChild(squareEl);
        });
    });
    
    // Add board glow effect when a piece is selected
    const boardWrapper = document.getElementById('board-wrapper');
    if (selectedSquare) {
        boardWrapper.classList.add('active-glow');
    } else {
        boardWrapper.classList.remove('active-glow');
    }
}

function handleSquareClick(sqId) {
    if (game.game_over()) return;
    if (gameMode === 'online' && game.turn() !== playerColor) return;
    
    // If a square is selected, check if we are making a move
    if (selectedSquare) {
        const moveDetails = legalMovesForSelected.find(m => m.to === sqId);
        
        if (moveDetails) {
            // Check for promotion
            if (moveDetails.flags.includes('p') || moveDetails.flags.includes('cp')) {
                pendingPromotionMove = { from: selectedSquare, to: sqId };
                document.getElementById('promotion-modal').classList.remove('hidden');
                return;
            } else {
                executeMove({ from: selectedSquare, to: sqId });
                return;
            }
        }
        
        // If clicking another piece of our color, select it instead
        const piece = game.get(sqId);
        if (piece && piece.color === game.turn()) {
            selectedSquare = sqId;
            legalMovesForSelected = game.moves({ square: sqId, verbose: true });
        } else {
            selectedSquare = null;
            legalMovesForSelected = [];
        }
    } else {
        // No square selected yet
        const piece = game.get(sqId);
        if (piece && piece.color === game.turn()) {
            selectedSquare = sqId;
            legalMovesForSelected = game.moves({ square: sqId, verbose: true });
        }
    }
    
    renderBoard();
}

function executeMove(moveObj, isRemote = false) {
    // Check if this move is a capture before making it
    const fromPiece = game.get(moveObj.from);
    const isCapture = game.get(moveObj.to) !== null || (fromPiece && fromPiece.type === 'p' && moveObj.from[0] !== moveObj.to[0] && game.get(moveObj.to) === null);
    const capturedPieceSquare = moveObj.to;
    
    const moveRes = game.move(moveObj);
    selectedSquare = null;
    legalMovesForSelected = [];
    
    if (moveRes) {
        if (gameMode === 'online' && !isRemote) {
            socket.emit('move', { roomId: currentRoomId, move: moveObj });
        }
        
        renderBoard();
        
        // Add move animation to destination square
        const toSquare = document.querySelector(`[data-sq="${moveRes.to}"] .piece`);
        if (toSquare) {
            toSquare.classList.add('piece-moved');
            setTimeout(() => toSquare.classList.remove('piece-moved'), 300);
        }
        
        // Create particle explosion for captures
        if (isCapture && typeof createCaptureExplosion === 'function') {
            // Get the center coordinates of the captured square
            const squareElement = document.querySelector(`[data-sq="${capturedPieceSquare}"]`);
            if (squareElement) {
                const rect = squareElement.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                createCaptureExplosion(centerX, centerY, isCapture ? '#ff6b35' : '#ff1493');
            }
        }
        
        updateStatus();
        updateMoveHistory();
        updateCapturedPieces();
        
        // Coach trigger on checkmate/draw
        if (game.in_checkmate()) {
            setTimeout(() => addCoachMessage(`Checkmate! Amazing game. ${moveRes.color === 'w' ? 'White' : 'Black'} wins!`), 500);
            if (typeof window.createFireworks === 'function') setTimeout(window.createFireworks, 500);
        } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
            setTimeout(() => addCoachMessage("Game Over - It's a Draw!"), 500);
        } else {
            // Trigger bot if it's black's turn
            if (gameMode === 'bot' && game.turn() === 'b' && !game.game_over()) {
                setTimeout(makeBotMove, 600);
            }
        }
    }
}

function updateStatus() {
    let text = '';
    const turnName = game.turn() === 'w' ? 'White' : 'Black';
    const statusEl = document.getElementById('game-status');
    
    statusEl.classList.remove('check', 'checkmate', 'draw');
    
    if (game.in_checkmate()) {
        text = `Checkmate! ${turnName === 'White' ? 'Black' : 'White'} wins.`;
        statusEl.classList.add('checkmate');
    } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
        text = 'Game Over - Draw';
        statusEl.classList.add('draw');
    } else {
        text = `${turnName} to move`;
        if (game.in_check()) {
            text += ', ' + turnName + ' is in check!';
            statusEl.classList.add('check');
        }
    }
    
    document.getElementById('status-text').textContent = text;
}

function getHistoryLastMove() {
    const hist = game.history({ verbose: true });
    if (hist.length > 0) {
        return hist[hist.length - 1];
    }
    return null;
}

function updateMoveHistory() {
    const hist = game.history();
    moveHistoryEl.innerHTML = '';
    
    for (let i = 0; i < hist.length; i += 2) {
        const m1 = hist[i];
        const m2 = hist[i + 1];
        const row = document.createElement('div');
        row.className = 'move-row';
        
        const num = document.createElement('div');
        num.className = 'move-num';
        num.textContent = (i/2 + 1) + '.';
        
        const w = document.createElement('div');
        w.className = 'move-w';
        w.textContent = m1;
        
        row.appendChild(num);
        row.appendChild(w);
        
        if (m2) {
            const b = document.createElement('div');
            b.className = 'move-b';
            b.textContent = m2;
            row.appendChild(b);
        }
        
        moveHistoryEl.appendChild(row);
    }
    
    // Auto-scroll
    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
}

// Very basic material counting for captured pieces
function updateCapturedPieces() {
    // A full set of pieces initially
    const initialCounts = { p:8, n:2, b:2, r:2, q:1 };
    const currentCountsW = { p:0, n:0, b:0, r:0, q:0 };
    const currentCountsB = { p:0, n:0, b:0, r:0, q:0 };
    
    const board = game.board();
    for (let r=0; r<8; r++) {
        for (let f=0; f<8; f++) {
            const piece = board[r][f];
            if (piece && piece.type !== 'k') {
                if(piece.color === 'w') currentCountsW[piece.type]++;
                if(piece.color === 'b') currentCountsB[piece.type]++;
            }
        }
    }
    
    // Captured by White = initial Black pieces minus current Black pieces
    const capturedByW = [];
    const capturedByB = [];
    
    const order = ['q','r','b','n','p'];
    
    order.forEach(type => {
        const lostB = initialCounts[type] - currentCountsB[type];
        for (let i=0; i<lostB; i++) capturedByW.push(PIECE_UNICODE_EXACT['b'][type]);
        
        const lostW = initialCounts[type] - currentCountsW[type];
        for (let i=0; i<lostW; i++) capturedByB.push(PIECE_UNICODE_EXACT['w'][type]);
    });
    
    capturedWhiteEl.innerHTML = capturedByW.map(ch => `<span>${ch}</span>`).join('');
    capturedBlackEl.innerHTML = capturedByB.map(ch => `<span>${ch}</span>`).join('');
}

// AI Coach mockup logic
function addMessageUI(text, sender) {
    const chat = document.getElementById('coach-chat');
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${sender}`;
    
    if (sender === 'assistant') {
        msgDiv.innerHTML = `
            <div class="msg-icon">◈</div>
            <div class="msg-content">${text}</div>
        `;
    } else {
        msgDiv.innerHTML = `<div class="msg-content">${text}</div>`;
    }
    
    chat.appendChild(msgDiv);
    chat.scrollTop = chat.scrollHeight;
}

function addCoachMessage(text) {
    addMessageUI(text, 'assistant');
}

function mockCoachResponse(userText) {
    const text = userText.toLowerCase();
    let reply = "Keep up the pressure! Every move counts.";
    
    if (text.includes('opening')) {
        reply = "In the opening, focus on developing your minor pieces (knights and bishops) and controlling the center.";
    } else if (text.includes('strategy')) {
        reply = "A good strategy involves a solid defense and looking for tactical opportunities like forks or pins.";
    } else if (text.includes('hello') || text.includes('hi')) {
        reply = "Hello! I'm here to analyze your game and provide strategic advice.";
    } else if (text.includes('hint')) {
        reply = "Look at the highlighted squares when you click a piece to see legal moves.";
    } else {
        const generic = [
            "Interesting approach. Consider your piece activity.",
            "Always check and double-check your king's safety.",
            "Are there any unprotected pieces you can target?",
            "Pawn structure is the soul of chess.",
            "Don't rush; think about your opponent's possible replies."
        ];
        reply = generic[Math.floor(Math.random() * generic.length)];
    }
    
    addCoachMessage(reply);
}

// Particle System for overdrive effects
function initParticleSystem() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Particle class
    class Particle {
        constructor() {
            this.reset();
        }
        
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5;
            this.color = `hsla(${Math.random() * 60 + 300}, 80%, 60%, ${Math.random() * 0.3 + 0.1})`; // Pink-purple range
            this.alpha = Math.random() * 0.5 + 0.3;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            // Wrap around edges
            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
            if (this.y < 0) this.y = canvas.height;
            if (this.y > canvas.height) this.y = 0;
            
            // Slow fade
            this.alpha -= 0.002;
            if (this.alpha <= 0) this.reset();
        }
        
        draw() {
            ctx.fillStyle = this.color.replace('0.3)', `${this.alpha})`).replace('0.1)', `${this.alpha * 0.3 + 0.1})`);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Create particles
    const particles = [];
    const particleCount = Math.min(50, Math.floor((canvas.width * canvas.height) / 10000)); // Scale with screen size
    
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    
    // Animation loop
    function animate() {
        // Clear with slight fade for trailing effect
        ctx.fillStyle = 'rgba(10, 8, 18, 0.1)'; // Very dark bg with low alpha for fade
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    // Create explosion effect for captures
    window.createCaptureExplosion = function(x, y, color = '#ff1493') {
        const explosionParticles = [];
        const explosionCount = 20;
        
        for (let i = 0; i < explosionCount; i++) {
            explosionParticles.push({
                x: x,
                y: y,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 8,
                speedY: (Math.random() - 0.5) * 8,
                color: color,
                life: 1.0,
                decay: Math.random() * 0.02 + 0.01
            });
        }
        
        function animateExplosion() {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Fade previous frame
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            let alive = false;
            
            explosionParticles.forEach(p => {
                if (p.life <= 0) return;
                
                p.x += p.speedX;
                p.y += p.speedY;
                p.life -= p.decay;
                
                if (p.life > 0) {
                    alive = true;
                    ctx.fillStyle = `hsla(320, 80%, 60%, ${p.life * 0.8})`; // Pink with fade
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            
            if (alive) {
                requestAnimationFrame(animateExplosion);
            }
        }
        
        animateExplosion();
    };

    // Create fireworks effect for winning
    window.createFireworks = function() {
        const colors = ['#ffd700', '#ff1493', '#00e5ff', '#ff6b35', '#a855f7'];
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const x = Math.random() * canvas.width * 0.8 + canvas.width * 0.1;
                const y = Math.random() * canvas.height * 0.5 + canvas.height * 0.1;
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                // Explode multiple times for bigger effect
                window.createCaptureExplosion(x, y, color);
                setTimeout(() => window.createCaptureExplosion(x + 20, y + 20, color), 100);
                setTimeout(() => window.createCaptureExplosion(x - 20, y - 20, color), 200);
            }, i * 400);
        }
    };
}

// Mode Selection Logic
function setupModes() {
    document.getElementById('btn-mode-bot').addEventListener('click', () => {
        gameMode = 'bot';
        document.getElementById('mode-modal').classList.add('hidden');
        initBoard();
    });

    document.getElementById('btn-mode-online').addEventListener('click', () => {
        gameMode = 'online';
        document.getElementById('mode-modal').classList.add('hidden');
        document.getElementById('lobby-modal').classList.remove('hidden');
        initSocket();
    });

    document.getElementById('btn-lobby-back').addEventListener('click', () => {
        document.getElementById('lobby-modal').classList.add('hidden');
        document.getElementById('mode-modal').classList.remove('hidden');
        if(socket) socket.disconnect();
        socket = null;
    });

    document.getElementById('btn-create-room').addEventListener('click', () => {
        if (socket) socket.emit('createRoom');
    });

    document.getElementById('btn-join-room').addEventListener('click', () => {
        const code = document.getElementById('room-code-input').value.trim();
        if (code && socket) {
            socket.emit('joinRoom', code);
        }
    });
}

function initSocket() {
    if(!socket) {
        // We assume socket.io is loaded globally via script tag
        socket = io();
        
        socket.on('roomCreated', (data) => {
            currentRoomId = data.roomId;
            playerColor = data.color;
            document.getElementById('lobby-modal').classList.add('hidden');
            showRoomInfo(currentRoomId);
            addCoachMessage("Room created! Share code: " + currentRoomId);
            initBoard();
            boardFlipped = false;
            renderBoard();
        });
        
        socket.on('roomJoined', (data) => {
            currentRoomId = data.roomId;
            playerColor = data.color;
            document.getElementById('lobby-modal').classList.add('hidden');
            showRoomInfo(currentRoomId);
            addCoachMessage("Joined room! You are playing Black.");
            initBoard();
            boardFlipped = true; // Auto flip for black
            renderBoard();
        });
        
        socket.on('gameStarted', (msg) => {
            addCoachMessage(msg);
        });
        
        socket.on('opponentMove', (moveObj) => {
            executeMove(moveObj, true); // true = remote move
        });
        
        socket.on('errorMsg', (msg) => {
            document.getElementById('lobby-msg').textContent = msg;
        });
        
        socket.on('opponentDisconnected', () => {
            addCoachMessage("Opponent disconnected. You win!");
            document.getElementById('status-text').textContent = "Opponent Left. You Win!";
            document.getElementById('game-status').classList.add('checkmate');
            if (typeof window.createFireworks === 'function') window.createFireworks();
        });
    }
}

function showRoomInfo(code) {
    document.getElementById('room-info').classList.remove('hidden');
    document.getElementById('room-code-display').textContent = code;
}

// Start game
setupModes();

// Initialize particle system
initParticleSystem();
