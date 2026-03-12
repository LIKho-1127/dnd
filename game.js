/**
 * 黑暗地城 - D&D 暗影 (Roguelike Action Version)
 */

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const TILE_SIZE = 32; // 增加地圖縮放
const GRID_W = 25;
const GRID_H = 25;

const TILE_TYPE = { WALL: 0, FLOOR: 1, STAIRS: 2, ENTRY: 3 };
const ENTITY_TYPE = { PLAYER: 'player', GOBLIN: 'goblin', SKELETON: 'skeleton', SPIDER: 'spider', BOSS: 'boss', POTION: 'potion', UPGRADE: 'upgrade', GOLD: 'gold' };

// --- 音效系統 ---
const AudioEngine = (() => {
    let ctx = null;
    function init() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    function playTone(freq, type, duration, vol = 0.1) {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + duration);
    }
    return {
        init,
        hit: () => playTone(100 + Math.random() * 50, 'sawtooth', 0.1, 0.1),
        swing: () => playTone(300, 'sine', 0.1, 0.05),
        death: () => playTone(60, 'square', 0.3, 0.1),
        pickup: () => playTone(600, 'triangle', 0.1, 0.1)
    };
})();

// --- 物理與碰撞偵測 ---
const Physics = {
    circleRect(cx, cy, radius, rx, ry, rw, rh) {
        let testX = cx; let testY = cy;
        if (cx < rx) testX = rx; else if (cx > rx + rw) testX = rx + rw;
        if (cy < ry) testY = ry; else if (cy > ry + rh) testY = ry + rh;
        const distSq = (cx - testX) ** 2 + (cy - testY) ** 2;
        return distSq <= radius ** 2;
    }
};

// --- 實體基類 ---
class Entity {
    constructor(x, y, radius) {
        this.x = x; this.y = y; this.radius = radius;
        this.vx = 0; this.vy = 0;
        this.hp = 100; this.maxHp = 100;
        this.atk = 10; this.alive = true;
        this.color = '#fff';
        this.knockbackX = 0; this.knockbackY = 0;
    }

    updatePhysics() {
        // 應用擊退
        this.x += this.vx + this.knockbackX;
        this.y += this.vy + this.knockbackY;
        this.knockbackX *= 0.8; this.knockbackY *= 0.8;

        // 地圖碰撞
        const gx = Math.floor(this.x / TILE_SIZE);
        const gy = Math.floor(this.y / TILE_SIZE);
        
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const tx = gx + dx; const ty = gy + dy;
                if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) continue;
                if (game.map[ty][tx] === TILE_TYPE.WALL) {
                    const rx = tx * TILE_SIZE; const ry = ty * TILE_SIZE;
                    if (Physics.circleRect(this.x, this.y, this.radius, rx, ry, TILE_SIZE, TILE_SIZE)) {
                        // 簡單推回邏輯
                        const testX = Math.max(rx, Math.min(this.x, rx + TILE_SIZE));
                        const testY = Math.max(ry, Math.min(this.y, ry + TILE_SIZE));
                        const diffX = this.x - testX; const diffY = this.y - testY;
                        const dist = Math.sqrt(diffX ** 2 + diffY ** 2);
                        if (dist > 0) {
                            this.x += (diffX / dist) * (this.radius - dist);
                            this.y += (diffY / dist) * (this.radius - dist);
                        }
                    }
                }
            }
        }
    }

    takeDamage(dmg, kx = 0, ky = 0) {
        this.hp -= dmg;
        this.knockbackX = kx; this.knockbackY = ky;
        game.spawnParticles(this.x, this.y, '#f00');
        AudioEngine.hit();
        if (this.hp <= 0) {
            this.alive = false;
            AudioEngine.death();
        }
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 10);
        this.speed = 3;
        this.atkCooldown = 0;
        this.gold = 0; this.lv = 1; this.xp = 0;
        this.inventory = [];
        this.dirX = 0; this.dirY = 1;
    }

    update() {
        if (!this.alive) return;
        this.updatePhysics();
        if (this.atkCooldown > 0) this.atkCooldown--;
    }

    attack() {
        if (this.atkCooldown > 0) return;
        this.atkCooldown = 25; // 稍微增加冷卻
        AudioEngine.swing();
        
        const atkRadius = 50; // 增加攻擊距離
        const playerAngle = Math.atan2(this.dirY, this.dirX);
        const arcRange = Math.PI / 4; // 左右各 22.5 度，共 45 度 (Math.PI/4 是 45度，但通常動作遊戲 45度指的是單邊，我這裡設定總共約 90 度感官較好，若要精確 45 度則是 Math.PI/8)
        const preciseArc = Math.PI / 4; // 設定為 45 度範圍

        // 產生揮砍特效粒子
        for (let i = -2; i <= 2; i++) {
            const angle = playerAngle + (i * preciseArc / 4);
            const fx = this.x + Math.cos(angle) * 30;
            const fy = this.y + Math.sin(angle) * 30;
            game.spawnParticles(fx, fy, '#fff', 2);
        }

        game.entities.forEach(e => {
            if (e instanceof Monster && e.alive) {
                const dx = e.x - this.x;
                const dy = e.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < atkRadius + e.radius) {
                    const targetAngle = Math.atan2(dy, dx);
                    let angleDiff = targetAngle - playerAngle;
                    
                    // 角度正規化
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                    if (Math.abs(angleDiff) < preciseArc / 2) {
                        const kx = Math.cos(targetAngle) * 15;
                        const ky = Math.sin(targetAngle) * 15;
                        e.takeDamage(this.atk, kx, ky);
                        if (!e.alive) {
                            this.xp += e.xpVal;
                            if (this.xp >= this.lv * 100) this.levelUp();
                        }
                    }
                }
            }
        });
    }

    levelUp() {
        this.lv++; this.xp = 0;
        this.maxHp += 20; this.hp = this.maxHp;
        this.atk += 5;
        game.log(`等級提升至 ${this.lv}！`);
    }

    draw(ctx, camX, camY) {
        const px = this.x - camX; const py = this.y - camY;
        ctx.fillStyle = '#0077ff';
        ctx.beginPath(); ctx.arc(px, py, this.radius, 0, Math.PI * 2); ctx.fill();
        // 繪製面向方向
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + this.dirX * 15, py + this.dirY * 15); ctx.stroke();
    }
}

class Monster extends Entity {
    constructor(x, y, type, floor) {
        super(x, y, 12);
        this.type = type;
        const scale = 1 + (floor - 1) * 0.2;
        this.speed = 0.5 + Math.random() * 0.5; // 調低怪物速度 (原本是 1 + random)
        this.atkCooldown = 0;
        
        if (type === ENTITY_TYPE.GOBLIN) { this.hp = 30 * scale; this.color = '#0f4'; this.xpVal = 20; }
        else if (type === ENTITY_TYPE.SKELETON) { this.hp = 50 * scale; this.color = '#eee'; this.xpVal = 35; this.speed *= 0.7; }
        else if (type === ENTITY_TYPE.SPIDER) { this.hp = 20 * scale; this.color = '#c0f'; this.xpVal = 25; this.speed *= 1.3; }
        else if (type === ENTITY_TYPE.BOSS) { this.hp = 1000; this.radius = 30; this.color = '#f06'; this.xpVal = 1000; this.speed = 0.8; }
        this.maxHp = this.hp;
    }

    update() {
        if (!this.alive) return;
        
        const dist = Math.sqrt((game.player.x - this.x) ** 2 + (game.player.y - this.y) ** 2);
        if (dist < 200 || this.type === ENTITY_TYPE.BOSS) {
            const dx = (game.player.x - this.x) / dist;
            const dy = (game.player.y - this.y) / dist;
            this.vx = dx * this.speed;
            this.vy = dy * this.speed;
            
            if (dist < this.radius + game.player.radius + 5 && this.atkCooldown === 0) {
                game.player.takeDamage(5, dx * 5, dy * 5);
                this.atkCooldown = 60;
            }
        } else {
            this.vx *= 0.9; this.vy *= 0.9;
        }

        if (this.atkCooldown > 0) this.atkCooldown--;
        this.updatePhysics();
    }

    draw(ctx, camX, camY) {
        const px = this.x - camX; const py = this.y - camY;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(px, py, this.radius, 0, Math.PI * 2); ctx.fill();
        // 血條
        ctx.fillStyle = '#000'; ctx.fillRect(px - 15, py - this.radius - 10, 30, 4);
        ctx.fillStyle = '#f00'; ctx.fillRect(px - 15, py - this.radius - 10, 30 * (this.hp / this.maxHp), 4);
    }
}

// --- 遊戲核心 ---
const game = {
    canvas: null, ctx: null,
    player: null, entities: [], map: [],
    floor: 1, camera: { x: 0, y: 0 },
    keys: {}, joystick: { active: false, x: 0, y: 0, startX: 0, startY: 0 },
    particles: [], state: 'title',

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.canvas.width = CANVAS_WIDTH; this.canvas.height = CANVAS_HEIGHT;
        this.ctx = this.canvas.getContext('2d');
        this.setupInput();
        this.loop();
    },

    setupInput() {
        window.onkeydown = e => this.keys[e.code] = true;
        window.onkeyup = e => this.keys[e.code] = false;
        
        // 觸控 / 搖桿
        const joyContainer = document.getElementById('joystick-container');
        const joyKnob = document.getElementById('joystick-knob');
        
        if (joyContainer) {
            joyContainer.ontouchstart = e => {
                const touch = e.touches[0];
                this.joystick.active = true;
                this.joystick.startX = touch.clientX; this.joystick.startY = touch.clientY;
            };
        }

        window.ontouchmove = e => {
            if (!this.joystick.active) return;
            const touch = e.touches[0];
            const dx = touch.clientX - this.joystick.startX;
            const dy = touch.clientY - this.joystick.startY;
            const dist = Math.min(40, Math.sqrt(dx*dx + dy*dy));
            const angle = Math.atan2(dy, dx);
            this.joystick.x = Math.cos(angle) * (dist / 40);
            this.joystick.y = Math.sin(angle) * (dist / 40);
            if (joyKnob) joyKnob.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
        };

        window.ontouchend = () => {
            this.joystick.active = false; this.joystick.x = 0; this.joystick.y = 0;
            if (joyKnob) joyKnob.style.transform = `translate(0, 0)`;
        };

        const atkBtn = document.getElementById('attack-btn');
        if (atkBtn) {
            atkBtn.onmousedown = e => { e.preventDefault(); if(this.player) this.player.attack(); };
            atkBtn.ontouchstart = e => { e.preventDefault(); if(this.player) this.player.attack(); };
        }

        document.getElementById('start-btn').onclick = () => this.start();
        document.getElementById('retry-btn').onclick = () => this.restart();
        document.getElementById('load-btn').onclick = () => this.loadGame();
        document.getElementById('load-death-btn').onclick = () => this.loadGame();
        document.getElementById('help-btn').onclick = () => document.getElementById('how-to-play').classList.remove('hidden');
        document.getElementById('close-help-btn').onclick = () => document.getElementById('how-to-play').classList.add('hidden');
    },

    restart() {
        this.floor = 1;
        this.state = 'playing';
        document.getElementById('death-screen').classList.add('hidden');
        this.start();
    },

    saveGameAuto() {
        const data = {
            floor: this.floor,
            player: {
                hp: this.player.hp, maxHp: this.player.maxHp,
                atk: this.player.atk, lv: this.player.lv, xp: this.player.xp,
                gold: this.player.gold
            }
        };
        localStorage.setItem('dungeon_save_action', JSON.stringify(data));
    },

    loadGame() {
        const raw = localStorage.getItem('dungeon_save_action');
        if (!raw) { this.log("沒有存檔記錄"); return; }
        const data = JSON.parse(raw);
        this.floor = data.floor;
        this.player = new Player(0, 0);
        Object.assign(this.player, data.player);
        this.generateFloor();
        this.state = 'playing';
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('death-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('controls').classList.remove('hidden');
    },

    start() {
        AudioEngine.init();
        this.player = new Player(0, 0);
        this.generateFloor();
        this.state = 'playing';
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('controls').classList.remove('hidden');
        this.saveGameAuto();
    },

    generateFloor() {
        this.map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(TILE_TYPE.WALL));
        const rooms = [];
        
        // 1. 生成隨機房間
        for (let i = 0; i < 8; i++) {
            const w = 4 + Math.floor(Math.random() * 4);
            const h = 4 + Math.floor(Math.random() * 4);
            const x = 1 + Math.floor(Math.random() * (GRID_W - w - 2));
            const y = 1 + Math.floor(Math.random() * (GRID_H - h - 2));
            
            // 挖開房間
            for (let ry = y; ry < y + h; ry++) {
                for (let rx = x; rx < x + w; rx++) {
                    this.map[ry][rx] = TILE_TYPE.FLOOR;
                }
            }
            rooms.push({
                x: x, y: y, w: w, h: h,
                cx: Math.floor(x + w / 2),
                cy: Math.floor(y + h / 2)
            });
        }

        // 2. 使用走廊連接所有房間 (確保連通性)
        for (let i = 0; i < rooms.length - 1; i++) {
            let cur = rooms[i];
            let next = rooms[i + 1];
            
            // 先走水平再走垂直，或者相反
            let tx = cur.cx;
            let ty = cur.cy;
            
            while (tx !== next.cx) {
                this.map[ty][tx] = TILE_TYPE.FLOOR;
                tx += tx < next.cx ? 1 : -1;
            }
            while (ty !== next.cy) {
                this.map[ty][tx] = TILE_TYPE.FLOOR;
                ty += ty < next.cy ? 1 : -1;
            }
        }
        
        // 設定玩家起始位置 (第一個房間中心)
        this.player.x = rooms[0].cx * TILE_SIZE + TILE_SIZE / 2;
        this.player.y = rooms[0].cy * TILE_SIZE + TILE_SIZE / 2;
        
        this.entities = [];
        
        if (this.floor === 5) {
            const lastRoom = rooms[rooms.length - 1];
            this.entities.push(new Monster(lastRoom.cx * TILE_SIZE, lastRoom.cy * TILE_SIZE, ENTITY_TYPE.BOSS, 5));
        } else {
            // 生成怪物
            for (let i = 1; i < rooms.length; i++) {
                const count = 1 + Math.floor(Math.random() * 2);
                for (let j = 0; j < count; j++) {
                    const types = [ENTITY_TYPE.GOBLIN, ENTITY_TYPE.SKELETON, ENTITY_TYPE.SPIDER];
                    const rx = (rooms[i].x + 1 + Math.random() * (rooms[i].w - 2)) * TILE_SIZE;
                    const ry = (rooms[i].y + 1 + Math.random() * (rooms[i].h - 2)) * TILE_SIZE;
                    this.entities.push(new Monster(rx, ry, types[Math.floor(Math.random() * 3)], this.floor));
                }
            }
            // 放置樓梯 (最後一個房間中心)
            const sRoom = rooms[rooms.length - 1];
            this.map[sRoom.cy][sRoom.cx] = TILE_TYPE.STAIRS;
        }
    },

    update() {
        if (this.state !== 'playing') return;

        // 玩家控制
        let mx = 0; let my = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) my -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) my += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
        
        // 鍵盤攻擊觸發
        if (this.keys['Space']) {
            this.player.attack();
        }

        if (this.joystick.active) { mx = this.joystick.x; my = this.joystick.y; }

        if (mx !== 0 || my !== 0) {
            const mag = Math.sqrt(mx*mx + my*my);
            this.player.vx = (mx / mag) * this.player.speed;
            this.player.vy = (my / mag) * this.player.speed;
            this.player.dirX = mx / mag; this.player.dirY = my / mag;
        } else {
            this.player.vx *= 0.8; this.player.vy *= 0.8;
        }

        this.player.update();
        this.entities.forEach(e => e.update());
        this.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
        this.particles = this.particles.filter(p => p.life > 0);

        // 相機跟隨
        this.camera.x += (this.player.x - CANVAS_WIDTH/2 - this.camera.x) * 0.1;
        this.camera.y += (this.player.y - CANVAS_HEIGHT/2 - this.camera.y) * 0.1;

        // 檢查過關
        const tx = Math.floor(this.player.x / TILE_SIZE);
        const ty = Math.floor(this.player.y / TILE_SIZE);
        if (this.map[ty] && this.map[ty][tx] === TILE_TYPE.STAIRS && this.entities.filter(e => e instanceof Monster && e.alive).length === 0) {
            this.floor++; this.generateFloor();
            this.log(`進入 B${this.floor}`);
        }

        if (!this.player.alive) {
            this.state = 'death';
            document.getElementById('death-screen').classList.remove('hidden');
        }

        this.updateHUD();
    },

    draw() {
        this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (this.state === 'title') return;

        this.ctx.save();
        this.ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));

        // 繪製地圖
        for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                const tile = this.map[y][x];
                if (tile === TILE_TYPE.WALL) {
                    this.ctx.fillStyle = '#333'; this.ctx.fillRect(x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
                } else if (tile === TILE_TYPE.STAIRS) {
                    this.ctx.fillStyle = '#0f6'; this.ctx.fillRect(x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
                } else {
                    this.ctx.fillStyle = '#111'; this.ctx.fillRect(x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    this.ctx.strokeStyle = '#222'; this.ctx.strokeRect(x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        this.entities.forEach(e => { if(e.alive) e.draw(this.ctx, 0, 0); });
        this.player.draw(this.ctx, 0, 0);
        
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color; this.ctx.globalAlpha = p.life/20;
            this.ctx.fillRect(p.x, p.y, 4, 4);
        });
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    },

    spawnParticles(x, y, color, count = 8) {
        for(let i=0; i<count; i++) {
            this.particles.push({x, y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 20, color});
        }
    },

    updateHUD() {
        const hpFill = document.getElementById('hp-fill');
        const hpText = document.getElementById('hp-text');
        const lvVal = document.getElementById('lv-val');
        const floorVal = document.getElementById('floor-val');
        const goldVal = document.getElementById('gold-val');

        if (hpFill) hpFill.style.width = `${(this.player.hp / this.player.maxHp)*100}%`;
        if (hpText) hpText.innerText = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;
        if (lvVal) lvVal.innerText = this.player.lv;
        if (floorVal) floorVal.innerText = `B${this.floor}`;
        if (goldVal) goldVal.innerText = this.player.gold;
    },

    log(msg) {
        const log = document.getElementById('msg-log');
        log.innerText = msg; setTimeout(() => log.innerText = '', 3000);
    },

    loop() {
        this.update(); this.draw();
        requestAnimationFrame(() => this.loop());
    }
};

game.init();
