/* CONFIGURATION & SETUP */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Off-screen canvas for lighting (Performance)
const lightCanvas = document.createElement('canvas');
const lightCtx = lightCanvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    lightCanvas.width = window.innerWidth;
    lightCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Game State
let gameState = 'MENU';
let frameCount = 0;
let level = 1;
let orbsCollected = 0;
let orbsNeeded = 5;

// Inputs
const keys = { w: false, a: false, s: false, d: false };

// Audio Context
let audioCtx;
let ambienceOsc;

/* --- AUDIO ENGINE --- */
/* --- AUDIO ENGINE --- */
const AudioEngine = {
    init: () => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    },
    
    // Dark Atmospheric Drone
    playAmbience: () => {
        if (!audioCtx) return;
        AudioEngine.stopAmbience();
        
        ambienceOsc = audioCtx.createOscillator();
        const ambienceGain = audioCtx.createGain(); // Local variable for gain to control fade out later
        // Store gain in a global var if you want to reference it later, 
        // but for now we attach it to the osc object or just use simple stop logic
        
        ambienceOsc.type = 'sawtooth';
        ambienceOsc.frequency.setValueAtTime(40, audioCtx.currentTime);
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 150;

        // LFO for texture
        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 0.02;
        
        lfo.connect(lfoGain);
        lfoGain.connect(ambienceGain.gain);
        
        ambienceGain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        
        ambienceOsc.connect(filter);
        filter.connect(ambienceGain);
        ambienceGain.connect(audioCtx.destination);
        
        ambienceOsc.start();
        lfo.start();
        
        // Attach gain to osc so we can fade it out in stopAmbience if needed
        ambienceOsc.gainNode = ambienceGain;
    },

    stopAmbience: () => {
        if (ambienceOsc) { 
            try { 
                if(ambienceOsc.gainNode) {
                   ambienceOsc.gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
                }
                ambienceOsc.stop(audioCtx.currentTime + 1); 
            } catch(e){} 
            ambienceOsc = null; 
        }
    },

    playPickup: () => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1600, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    },

    playHit: () => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(20, audioCtx.currentTime + 0.2);
        
        // Distortion
        const mod = audioCtx.createOscillator();
        mod.frequency.value = 500;
        const modGain = audioCtx.createGain();
        modGain.gain.value = 1000;
        mod.connect(modGain);
        modGain.connect(osc.frequency);

        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        
        mod.start();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        mod.stop(audioCtx.currentTime + 0.4);
        osc.stop(audioCtx.currentTime + 0.4);
    },

    // NEW: Level Up Sound
    playLevelUp: () => {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        [440, 554, 659, 880].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + (i * 0.1));
            gain.gain.setValueAtTime(0, now + (i * 0.1));
            gain.gain.linearRampToValueAtTime(0.1, now + (i * 0.1) + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.1) + 1.5);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now + (i * 0.1));
            osc.stop(now + (i * 0.1) + 1.5);
        });
    },

    // NEW: Game Over Sound
    playGameOver: () => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 2);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 2);
    },

    // NEW: Heartbeat Sound
    playHeartbeat: () => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(60, audioCtx.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    }
};

/* --- ENTITIES --- */
const player = {
    x: 0, y: 0,
    radius: 12,
    speed: 5,
    lightRadius: 180,
    lives: 3,
    invulnerable: 0 // Cooldown frames after hit
};

let enemies = [];
let orbs = [];
let particles = [];

class Enemy {
    constructor() {
        // SPAWN LOGIC: Always spawn outside the screen edges (Random Directions)
        const edge = Math.floor(Math.random() * 4); // 0:Top, 1:Right, 2:Bottom, 3:Left
        const offset = 50; // Distance outside screen

        if (edge === 0) { // Top
            this.x = Math.random() * canvas.width;
            this.y = -offset;
        } else if (edge === 1) { // Right
            this.x = canvas.width + offset;
            this.y = Math.random() * canvas.height;
        } else if (edge === 2) { // Bottom
            this.x = Math.random() * canvas.width;
            this.y = canvas.height + offset;
        } else { // Left
            this.x = -offset;
            this.y = Math.random() * canvas.height;
        }

        this.radius = 16;
        // Speed increases with level
        this.baseSpeed = 2 + (level * 0.4); 
        this.speed = this.baseSpeed;
    }

    update() {
        // Move towards player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);

        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;

        // Collision Check
        const dist = Math.hypot(dx, dy);
        if (dist < player.radius + this.radius) {
            if (player.invulnerable <= 0) {
                playerHit();
            }
        }
    }

    draw() {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Red Glowing Eyes
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'red';
        ctx.beginPath();
        ctx.arc(this.x - 6, this.y - 3, 4, 0, Math.PI * 2);
        ctx.arc(this.x + 6, this.y - 3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Orb {
    constructor() {
        this.x = Math.random() * (canvas.width - 60) + 30;
        this.y = Math.random() * (canvas.height - 60) + 30;
        this.radius = 8;
        this.active = true;
    }

    draw() {
        if (!this.active) return;
        const pulse = Math.sin(frameCount * 0.15) * 4;
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

function createParticles(x, y, color) {
    for(let i=0; i<15; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1.0,
            color: color
        });
    }
}

/* --- GAME LOGIC --- */

function initLevel() {
    orbsCollected = 0;
    // FORMULA: Level 1 = 5, Level 2 = 8, Level 3 = 11...
    orbsNeeded = 5 + ((level - 1) * 3); 
    
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.invulnerable = 60; // Safe for 1 second at start
    
    enemies = [];
    orbs = [];
    
    // Create Orbs
    for (let i = 0; i < orbsNeeded; i++) {
        orbs.push(new Orb());
    }
    
    // Initial Enemies (More spawn over time)
    const initialEnemies = 3 + level;
    for (let i = 0; i < initialEnemies; i++) {
        enemies.push(new Enemy());
    }
    
    updateUI();
}

function playerHit() {
    player.lives--;
    player.invulnerable = 60; // 1 second (approx 60 frames) invulnerability
    AudioEngine.playHit();
    createParticles(player.x, player.y, '#ff0000');
    
    // Screen Shake effect (simulated by displacing player slightly)
    player.x += (Math.random() - 0.5) * 20;
    player.y += (Math.random() - 0.5) * 20;

    updateUI();

    if (player.lives <= 0) {
        gameOver();
    }
}

function checkOrbCollision() {
    orbs.forEach(orb => {
        if (!orb.active) return;
        const dist = Math.hypot(orb.x - player.x, orb.y - player.y);
        if (dist < player.radius + orb.radius + 10) {
            orb.active = false;
            orbsCollected++;
            AudioEngine.playPickup();
            createParticles(orb.x, orb.y, '#00ffff');
            updateUI();

            if (orbsCollected >= orbsNeeded) {
                nextLevel();
            }
        }
    });
}

function nextLevel() {
    level++;
    // Reward: 1 Life back (max 3)
    if (player.lives < 3) player.lives++;

    AudioEngine.playLevelUp();
    
    const msg = document.createElement('div');
    msg.innerText = "DEPTH " + level;
    msg.style.position = 'absolute';
    msg.style.top = '30%'; left = '50%';
    msg.style.transform = 'translate(-50%, -50%)';
    msg.style.color = '#fff';
    msg.style.fontSize = '5rem';
    msg.style.fontFamily = 'Creepster';
    msg.style.textShadow = '0 0 30px #00ffff';
    msg.style.zIndex = '100';
    msg.style.width = "100%";
    msg.style.textAlign = "center";
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2500);

    initLevel();
}

function handleInput() {
    if (keys.w && player.y > player.radius) player.y -= player.speed;
    if (keys.s && player.y < canvas.height - player.radius) player.y += player.speed;
    if (keys.a && player.x > player.radius) player.x -= player.speed;
    if (keys.d && player.x < canvas.width - player.radius) player.x += player.speed;
}

function updateUI() {
    document.getElementById('level-display').innerText = level;
    document.getElementById('score-display').innerText = `${orbsCollected}/${orbsNeeded}`;
    
    // Convert Lives to Hearts
    let hearts = "";
    for(let i=0; i<player.lives; i++) hearts += "❤️";
    document.getElementById('lives-display').innerText = hearts;
}

function render() {
    // 1. Clear Main Canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<canvas.width; i+=60) { ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); }
    for(let i=0; i<canvas.height; i+=60) { ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); }
    ctx.stroke();

    // 2. Draw Entities
    orbs.forEach(o => o.draw());
    enemies.forEach(e => e.draw());
    
    // Player Draw (Blink if invulnerable)
    if (player.invulnerable <= 0 || frameCount % 10 < 5) {
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fff';
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, 4, 4);
        ctx.globalAlpha = 1;
    });

    // 3. Lighting Overlay
    lightCtx.globalCompositeOperation = 'source-over';
    lightCtx.fillStyle = 'rgba(0, 0, 0, 0.98)'; 
    lightCtx.fillRect(0, 0, canvas.width, canvas.height);

    lightCtx.globalCompositeOperation = 'destination-out';
    const flicker = Math.random() > 0.9 ? 0.95 : 1.0;
    const grad = lightCtx.createRadialGradient(player.x, player.y, 10, player.x, player.y, player.lightRadius * flicker);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    
    lightCtx.fillStyle = grad;
    lightCtx.beginPath();
    lightCtx.arc(player.x, player.y, player.lightRadius * flicker, 0, Math.PI*2);
    lightCtx.fill();

    ctx.drawImage(lightCanvas, 0, 0);
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;

    // --- ADD THIS BLOCK ---
    // Heartbeat Effect when lives are low (1 Life)
    if (player.lives === 1) {
        if (frameCount % 60 === 0) { // Approx once per second
            AudioEngine.playHeartbeat();
        }
    }
    // ----------------------

    handleInput();
    // ... rest of function ...
    handleInput();
    checkOrbCollision();

    // Spawn new enemies randomly periodically to keep pressure up
    // Higher level = more frequent spawns
    if (frameCount % (180 - (level * 10)) === 0 && enemies.length < 50) {
        enemies.push(new Enemy());
    }

    enemies.forEach(e => e.update());
    
    // Particle Logic
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.05;
        if(p.life <= 0) particles.splice(i, 1);
    });

    if (player.invulnerable > 0) player.invulnerable--;

    render();
    frameCount++;
    requestAnimationFrame(gameLoop);
}

function startGame() {
    AudioEngine.init();
    AudioEngine.playAmbience();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    resize();
    
    player.lives = 5;
    level = 1;
    gameState = 'PLAYING';
    initLevel();
    gameLoop();
}

function gameOver() {
    gameState = 'GAMEOVER';
    AudioEngine.playGameOver();
    AudioEngine.stopAmbience();
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('final-level').innerText = level;
}

/* INPUTS */
window.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);