import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

/* --- HIGH-FIDELITY HORROR AUDIO ENGINE (MAX VOLUME) --- */
const AudioSys = {
    ctx: null,
    masterGain: null,
    reverbNode: null,
    nodes: [],
    musicTimer: null,
    
    init: () => {
        if(!AudioSys.ctx) {
            AudioSys.ctx = new (window.AudioContext || window.webkitAudioContext)();
            AudioSys.masterGain = AudioSys.ctx.createGain();
            
            // --- VOLUME BOOSTED HERE ---
            AudioSys.masterGain.gain.value = 3.0; // Extremely Loud
            
            AudioSys.masterGain.connect(AudioSys.ctx.destination);

            // Create Reverb
            AudioSys.reverbNode = AudioSys.ctx.createConvolver();
            AudioSys.reverbNode.buffer = AudioSys.createImpulseResponse(2.5, 2.0); 
            AudioSys.reverbNode.connect(AudioSys.masterGain);
        }
        if(AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
    },

    createImpulseResponse: (duration, decay) => {
        const rate = AudioSys.ctx.sampleRate;
        const length = rate * duration;
        const impulse = AudioSys.ctx.createBuffer(2, length, rate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = i / length; 
            const val = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
            left[i] = val;
            right[i] = val;
        }
        return impulse;
    },

    // 1. CINEMATIC HORROR MUSIC (LOUD)
    playMusic: () => {
        if (!AudioSys.ctx) return;
        AudioSys.stopAll();

        const t = AudioSys.ctx.currentTime;

        // --- LAYER A: The "THX" Deep Drone (Super-Saw) ---
        const freqs = [35, 35.5, 34.5]; 
        
        freqs.forEach(f => {
            const osc = AudioSys.ctx.createOscillator();
            const gain = AudioSys.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = f;
            
            const filter = AudioSys.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 100;
            
            const lfo = AudioSys.ctx.createOscillator();
            lfo.frequency.value = 0.1;
            const lfoGain = AudioSys.ctx.createGain();
            lfoGain.gain.value = 30;
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            lfo.start();

            gain.gain.value = 0.4; // Boosted Mix

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(AudioSys.reverbNode); 
            gain.connect(AudioSys.masterGain);
            
            osc.start();
            AudioSys.nodes.push(osc, lfo);
        });

        // --- LAYER B: The Ghost Piano ---
        const sadScale = [
            261.63, 311.13, 369.99, 415.30, 493.88, 622.25
        ];

        const playPianoNote = () => {
            if(AudioSys.ctx.state !== 'running') return;
            
            const noteFreq = sadScale[Math.floor(Math.random() * sadScale.length)];
            const time = AudioSys.ctx.currentTime;
            
            const osc = AudioSys.ctx.createOscillator();
            const gain = AudioSys.ctx.createGain();
            
            osc.type = 'triangle'; 
            osc.frequency.setValueAtTime(noteFreq, time);
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.5, time + 0.02); // Louder Attack
            gain.gain.exponentialRampToValueAtTime(0.001, time + 3.0); 

            osc.connect(gain);
            gain.connect(AudioSys.reverbNode); 
            
            osc.start(time);
            osc.stop(time + 3.0);
            
            const nextDelay = 2000 + Math.random() * 3000;
            AudioSys.musicTimer = setTimeout(playPianoNote, nextDelay);
        };

        playPianoNote();
    },

    stopAll: () => {
        AudioSys.nodes.forEach(n => {
            if(n.stop) n.stop();
            if(n.disconnect) n.disconnect();
        });
        AudioSys.nodes = [];
        if (AudioSys.musicTimer) {
            clearTimeout(AudioSys.musicTimer);
            AudioSys.musicTimer = null;
        }
    },

    // 2. SCREAM (MAX VOLUME)
    playScream: () => {
        if (!AudioSys.ctx) return;
        const t = AudioSys.ctx.currentTime;
        
        const osc = AudioSys.ctx.createOscillator();
        const gain = AudioSys.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(1200, t + 0.6); 
        
        const lfo = AudioSys.ctx.createOscillator();
        lfo.frequency.value = 50;
        const lfoGain = AudioSys.ctx.createGain();
        lfoGain.gain.value = 500;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        // MAX VOLUME FOR JUMPSCARE
        gain.gain.setValueAtTime(1.5, t); 
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

        osc.connect(gain);
        gain.connect(AudioSys.reverbNode); 
        
        osc.start();
        osc.stop(t+1);
        lfo.stop(t+1);
    },

    // 3. HEARTBEAT (THUMPING)
    playHeartbeat: () => {
        if (!AudioSys.ctx) return;
        const t = AudioSys.ctx.currentTime;
        const osc = AudioSys.ctx.createOscillator();
        const gain = AudioSys.ctx.createGain();
        
        osc.frequency.setValueAtTime(70, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.1); 
        
        gain.gain.setValueAtTime(2.0, t); // Very Loud Thump
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        
        osc.connect(gain);
        gain.connect(AudioSys.masterGain); 
        osc.start();
        osc.stop(t + 0.2);
    },

    // 4. COLLECT
    playCollect: () => {
        if (!AudioSys.ctx) return;
        const t = AudioSys.ctx.currentTime;
        const osc = AudioSys.ctx.createOscillator();
        const gain = AudioSys.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(1760, t + 0.1);
        
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.linearRampToValueAtTime(0, t + 1.0);
        
        osc.connect(gain);
        gain.connect(AudioSys.reverbNode);
        osc.start();
        osc.stop(t + 1.0);
    }
};

/* --- GAME VARIABLES --- */
let scene, camera, renderer, controls, raycaster;
let flashlight;
let moveForward=false, moveBackward=false, moveLeft=false, moveRight=false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

let gameState = 'MENU';
let level = 1;
let dolls = [];
let dollsFound = 0;
let dollsTotal = 5;

// Lady AI
let ladySprite;
let ladySpeed = 6.0; 
let lastHeartbeatTime = 0;

/* --- SETUP --- */
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505); 
    scene.fog = new THREE.FogExp2(0x111111, 0.035); 

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.y = 1.6;

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0x444444, 0x000000, 0.6); 
    scene.add(ambient);

    // Flashlight
    flashlight = new THREE.SpotLight(0xffffff, 2.5);
    flashlight.position.set(0,0,0);
    flashlight.angle = 0.6;
    flashlight.penumbra = 0.3;
    flashlight.distance = 50;
    flashlight.castShadow = true;
    camera.add(flashlight);
    flashlight.target.position.set(0,0,-1);
    camera.add(flashlight.target);
    scene.add(camera);

    controls = new PointerLockControls(camera, document.body);
    raycaster = new THREE.Raycaster();

    createLevel();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseClick);
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

/* --- TEXTURE GENERATOR (SCARY FACE) --- */
function createScaryTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 256, 256);

    // Ghostly Head
    const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 100);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.5, 'rgba(200, 200, 200, 0.5)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Eyes
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(90, 110, 20, 0, Math.PI*2); 
    ctx.arc(166, 110, 20, 0, Math.PI*2); 
    ctx.fill();

    // Red Pupils
    ctx.fillStyle = '#ff0000';
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'red';
    ctx.beginPath();
    ctx.arc(90, 110, 5, 0, Math.PI*2);
    ctx.arc(166, 110, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Screaming Mouth
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.ellipse(128, 180, 25, 40, 0, 0, Math.PI*2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

/* --- LEVEL --- */
function createLevel() {
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({color: 0x1a1a1a});
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI/2;
    scene.add(floor);

    const wallGeo = new THREE.BoxGeometry(4, 10, 4);
    const wallMat = new THREE.MeshStandardMaterial({color: 0x333333});
    
    for(let i=0; i<40; i++) {
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.x = (Math.random()-0.5)*90;
        wall.position.z = (Math.random()-0.5)*90;
        wall.position.y = 5;
        scene.add(wall);
    }
}

function spawnEntities() {
    dolls.forEach(d => scene.remove(d));
    dolls = [];
    if(ladySprite) scene.remove(ladySprite);

    dollsTotal = 4 + level;
    dollsFound = 0;
    document.getElementById('dolls-total').innerText = dollsTotal;
    document.getElementById('dolls-display').innerText = 0;

    const dollGeo = new THREE.SphereGeometry(0.4);
    const dollMat = new THREE.MeshBasicMaterial({color: 0x00ffff}); 

    for(let i=0; i<dollsTotal; i++) {
        const d = new THREE.Mesh(dollGeo, dollMat);
        d.position.set((Math.random()-0.5)*80, 0.5, (Math.random()-0.5)*80);
        d.name = 'doll';
        scene.add(d);
        dolls.push(d);
    }

    const ladyMap = createScaryTexture();
    const ladyMat = new THREE.SpriteMaterial({ map: ladyMap, color: 0xffffff });
    ladySprite = new THREE.Sprite(ladyMat);
    ladySprite.scale.set(3, 4, 1); 
    
    ladySprite.position.set(40, 2, 40);
    scene.add(ladySprite);
    
    // Speed
    ladySpeed = 6.0 + (level * 0.8);
}

/* --- LOGIC --- */
function updateLady(delta, time) {
    if(!ladySprite) return;

    const dist = ladySprite.position.distanceTo(camera.position);

    let beatDelay = 1000;
    if(dist < 20) beatDelay = 400; 
    if(dist < 10) beatDelay = 250; 

    if(dist < 30) {
        if(time - lastHeartbeatTime > beatDelay) {
            AudioSys.playHeartbeat();
            lastHeartbeatTime = time;
            document.getElementById('bpm-display').innerText = Math.floor(60000/beatDelay);
            if(Math.random() > 0.95) AudioSys.playScream();
        }
    } else {
        document.getElementById('bpm-display').innerText = "60";
    }

    if(dist > 1.2) {
        const dir = new THREE.Vector3().subVectors(camera.position, ladySprite.position).normalize();
        ladySprite.position.add(dir.multiplyScalar(ladySpeed * delta));
    } else {
        gameOver();
    }
}

function onMouseClick() {
    if(gameState !== 'PLAYING') return;
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const intersects = raycaster.intersectObjects(dolls);
    if(intersects.length > 0) {
        collectDoll(intersects[0].object);
    }
}

function collectDoll(obj) {
    scene.remove(obj);
    dolls = dolls.filter(d => d!==obj);
    dollsFound++;
    document.getElementById('dolls-display').innerText = dollsFound;
    AudioSys.playCollect();

    if(dollsFound >= dollsTotal) {
        startQuiz();
    }
}

/* --- QUIZ --- */
const riddles = [
    {q: "I have keys but open no locks.", a: ["piano"]},
    {q: "The more you take, the more you leave behind.", a: ["footsteps"]},
    {q: "What connects two people but touches only one?", a: ["ring"]}
];

function startQuiz() {
    gameState = 'QUIZ';
    controls.unlock();
    document.getElementById('quiz-screen').classList.remove('hidden');
    const r = riddles[(level-1)%riddles.length];
    document.getElementById('question-text').innerText = r.q;
}

document.getElementById('submit-answer').addEventListener('click', () => {
    const ans = document.getElementById('quiz-input').value.toLowerCase().trim();
    const r = riddles[(level-1)%riddles.length];
    
    if(r.a.includes(ans)) {
        level++;
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('quiz-input').value = "";
        gameState = 'PLAYING';
        controls.lock();
        spawnEntities();
    } else {
        document.getElementById('quiz-feedback').innerText = "WRONG. SHE IS FASTER NOW.";
        ladySpeed += 3; 
    }
});

/* --- MOVEMENT --- */
function onKeyDown(e) {
    switch(e.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyD': moveRight = true; break;
        case 'KeyF': 
            if(flashlight.intensity > 0) flashlight.intensity = 0;
            else flashlight.intensity = 2.5;
            break;
    }
}
function onKeyUp(e) {
    switch(e.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyD': moveRight = false; break;
    }
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if(gameState === 'PLAYING') {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 150.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 150.0 * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        updateLady(delta, time);
    }

    prevTime = time;
    renderer.render(scene, camera);
}

function gameOver() {
    gameState = 'GAMEOVER';
    controls.unlock();
    AudioSys.stopAll();
    AudioSys.playScream();
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function startGame() {
    AudioSys.init();
    AudioSys.playMusic(); 
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    gameState = 'PLAYING';
    level = 1;
    controls.lock();
    spawnEntities();
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

init();