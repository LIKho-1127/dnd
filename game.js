/**
 * 黑暗地城 - D&D 暗影
 * 專業單檔網頁遊戲實現
 */

// --- 遊戲常數與設定 ---
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const TILE_SIZE = 24;
const GRID_W = 20;
const GRID_H = 15;
const VIEW_W = CANVAS_WIDTH;
const VIEW_H = 400; // 遊戲視野高度

const TILE_TYPE = {
    WALL: 0,
    FLOOR: 1,
    STAIRS: 2,
    ENTRY: 3
};

const ENTITY_TYPE = {
    PLAYER: 'player',
    GOBLIN: 'goblin',
    SKELETON: 'skeleton',
    SPIDER: 'spider',
    BOSS: 'boss',
    POTION: 'potion',
    UPGRADE: 'upgrade',
    GOLD: 'gold'
};

// --- 音效系統 (Web Audio API) ---
const AudioEngine = (() => {
    let ctx = null;

    function init() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    function playTone(freq, type, duration, vol = 0.1) {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    }

    return {
        init,
        move: () => playTone(150, 'sine', 0.1, 0.05),
        hit: () => playTone(100 + Math.random() * 50, 'sawtooth', 0.2, 0.1),
        heal: () => playTone(440, 'sine', 0.3, 0.1),
        death: () => playTone(50, 'square', 0.5, 0.2),
        pickup: () => playTone(600, 'triangle', 0.1, 0.1),
        stairs: () => {
            playTone(300, 'sine', 0.2, 0.1);
            setTimeout(() => playTone(400, 'sine', 0.2, 0.1), 100);
            setTimeout(() => playTone(500, 'sine', 0.2, 0.1), 200);
        }
    };
})();

// --- 實體類別 ---
class Entity {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.hp = 10;
        this.maxHp = 10;
        this.atk = 2;
        this.def = 0;
        this.alive = true;
        this.color = '#fff';
    }

    draw(ctx, cameraX, cameraY) {
        const px = this.x * TILE_SIZE - cameraX;
        const py = this.y * TILE_SIZE - cameraY;
        
        // 繪製陰影
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(px + TILE_SIZE/2, py + TILE_SIZE - 2, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        this.renderShape(ctx, px, py);
        
        // 繪製血條 (如果是怪物)
        if (this.type !== ENTITY_TYPE.PLAYER && this.hp < this.maxHp) {
            const barW = 20;
            ctx.fillStyle = '#000';
            ctx.fillRect(px + (TILE_SIZE - barW)/2, py - 5, barW, 4);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(px + (TILE_SIZE - barW)/2, py - 5, barW * (this.hp / this.maxHp), 4);
        }
    }

    renderShape(ctx, px, py) {
        // 由子類別覆寫
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, ENTITY_TYPE.PLAYER);
        this.hp = 100;
        this.maxHp = 100;
        this.atk = 12;
        this.def = 5;
        this.lv = 1;
        this.xp = 0;
        this.gold = 0;
        this.inventory = [];
        this.color = '#0077ff'; // 亮藍色
    }

    renderShape(ctx, px, py) {
        // 亮藍色騎士
        ctx.fillStyle = this.color;
        ctx.fillRect(px + 4, py + 4, 16, 16); 
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px + 8, py + 2, 8, 8); 
        // 亮銀劍
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 20, py + 12);
        ctx.lineTo(px + 28, py + 4);
        ctx.stroke();
    }

    addXp(amount) {
        this.xp += amount;
        if (this.xp >= this.lv * 50) {
            this.levelUp();
        }
    }

    levelUp() {
        this.lv++;
        this.xp = 0;
        this.maxHp += 20;
        this.hp = this.maxHp;
        this.atk += 3;
        this.def += 2;
        game.log(`升級了！目前等級 ${this.lv}`);
    }
}

class Monster extends Entity {
    constructor(x, y, type, floor) {
        super(x, y, type);
        const scale = 1 + (floor - 1) * 0.3;
        
        if (type === ENTITY_TYPE.GOBLIN) {
            this.hp = Math.floor(20 * scale);
            this.atk = Math.floor(6 * scale);
            this.def = Math.floor(1 * scale);
            this.color = '#00ff44'; // 亮綠
            this.xpVal = 15;
        } else if (type === ENTITY_TYPE.SKELETON) {
            this.hp = Math.floor(30 * scale);
            this.atk = Math.floor(10 * scale);
            this.def = Math.floor(3 * scale);
            this.color = '#eeeeee'; // 亮白
            this.xpVal = 25;
        } else if (type === ENTITY_TYPE.SPIDER) {
            this.hp = Math.floor(15 * scale);
            this.atk = Math.floor(12 * scale);
            this.def = Math.floor(0 * scale);
            this.color = '#cc00ff'; // 亮紫
            this.xpVal = 20;
        } else if (type === ENTITY_TYPE.BOSS) {
            this.hp = 500;
            this.maxHp = 500;
            this.atk = 25;
            this.def = 10;
            this.color = '#ff0066'; // 桃紅
            this.xpVal = 1000;
        }
        this.maxHp = this.hp;
    }

    renderShape(ctx, px, py) {
        ctx.fillStyle = this.color;
        if (this.type === ENTITY_TYPE.GOBLIN) {
            ctx.beginPath();
            ctx.arc(px + 12, py + 12, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.fillRect(px+8, py+10, 2, 2);
            ctx.fillRect(px+14, py+10, 2, 2);
        } else if (this.type === ENTITY_TYPE.SKELETON) {
            ctx.fillRect(px + 6, py + 4, 12, 16);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(px + 8, py + 8, 2, 2);
            ctx.fillRect(px + 14, py + 8, 2, 2);
        } else if (this.type === ENTITY_TYPE.SPIDER) {
            ctx.beginPath();
            ctx.arc(px + 12, py + 12, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            for(let i=0; i<8; i++) {
                const ang = (i/8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(px+12, py+12);
                ctx.lineTo(px+12 + Math.cos(ang)*12, py+12 + Math.sin(ang)*12);
                ctx.stroke();
            }
        } else if (this.type === ENTITY_TYPE.BOSS) {
            ctx.fillRect(px - 12, py - 12, 48, 48);
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.moveTo(px - 12, py - 12); ctx.lineTo(px + 36, py - 12); ctx.lineTo(px + 12, py - 30);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillRect(px, py, 6, 6); ctx.fillRect(px + 18, py, 6, 6);
        }
    }
}

class Item extends Entity {
    constructor(x, y, type) {
        super(x, y, type);
    }
    renderShape(ctx, px, py) {
        if (this.type === ENTITY_TYPE.POTION) {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.moveTo(px+12, py+4); ctx.lineTo(px+20, py+20); ctx.lineTo(px+4, py+20);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillRect(px+10, py+12, 4, 4);
        } else if (this.type === ENTITY_TYPE.UPGRADE) {
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(px+8, py+4, 8, 16);
            ctx.fillRect(px+4, py+8, 16, 4);
        } else if (this.type === ENTITY_TYPE.GOLD) {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(px+12, py+12, 8, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

// --- 遊戲核心引擎 ---
const game = {
    canvas: null,
    ctx: null,
    floor: 1,
    map: [],
    fog: [],
    entities: [],
    player: null,
    camera: { x: 0, y: 0 },
    particles: [],
    shake: 0,
    state: 'title', // title, playing, death, victory
    enemiesRemaining: 0,
    stairsVisible: false,

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        this.ctx = this.canvas.getContext('2d');
        
        this.setupEventListeners();
        this.loop();
    },

    setupEventListeners() {
        // 按鈕監聽
        document.getElementById('start-btn').onclick = () => this.startNewGame();
        document.getElementById('load-btn').onclick = () => this.loadGame();
        document.getElementById('retry-btn').onclick = () => this.startNewGame();
        document.getElementById('load-death-btn').onclick = () => this.loadGame();
        document.getElementById('help-btn').onclick = () => document.getElementById('how-to-play').classList.remove('hidden');
        document.getElementById('close-help-btn').onclick = () => document.getElementById('how-to-play').classList.add('hidden');

        // 鍵盤移動
        window.onkeydown = (e) => {
            if (this.state !== 'playing') return;
            let dx = 0, dy = 0;
            if (e.key === 'ArrowUp') dy = -1;
            if (e.key === 'ArrowDown') dy = 1;
            if (e.key === 'ArrowLeft') dx = -1;
            if (e.key === 'ArrowRight') dx = 1;
            if (dx !== 0 || dy !== 0) this.tryMovePlayer(dx, dy);
        };

        // 虛擬搖桿
        const bindBtn = (id, dx, dy) => {
            document.getElementById(id).ontouchstart = (e) => { e.preventDefault(); this.tryMovePlayer(dx, dy); };
            document.getElementById(id).onmousedown = (e) => { this.tryMovePlayer(dx, dy); };
        };
        bindBtn('ctrl-up', 0, -1);
        bindBtn('ctrl-down', 0, 1);
        bindBtn('ctrl-left', -1, 0);
        bindBtn('ctrl-right', 1, 0);

        // 觸控滑動
        let touchStart = null;
        this.canvas.ontouchstart = (e) => { touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
        this.canvas.ontouchend = (e) => {
            if (!touchStart || this.state !== 'playing') return;
            const dx = e.changedTouches[0].clientX - touchStart.x;
            const dy = e.changedTouches[0].clientY - touchStart.y;
            if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
                if (Math.abs(dx) > Math.abs(dy)) this.tryMovePlayer(dx > 0 ? 1 : -1, 0);
                else this.tryMovePlayer(0, dy > 0 ? 1 : -1);
            }
            touchStart = null;
        };

        // 背包點擊
        for (let i = 0; i < 4; i++) {
            document.getElementById(`slot-${i}`).onclick = () => this.useItem(i);
        }
    },

    startNewGame() {
        AudioEngine.init();
        this.floor = 1;
        this.player = new Player(0, 0);
        this.generateFloor();
        this.state = 'playing';
        this.showUI();
    },

    generateFloor() {
        this.map = Array(GRID_H).fill().map(() => Array(GRID_W).fill(TILE_TYPE.WALL));
        this.fog = Array(GRID_H).fill().map(() => Array(GRID_W).fill(0)); // 0: 未探索, 1: 可見, 2: 已探索但陰影
        this.entities = [];
        this.stairsVisible = false;

        // 隨機房間生成
        const rooms = [];
        const numRooms = 6 + Math.floor(Math.random() * 5);
        for (let i = 0; i < numRooms; i++) {
            const w = 3 + Math.floor(Math.random() * 4);
            const h = 3 + Math.floor(Math.random() * 4);
            const x = 1 + Math.floor(Math.random() * (GRID_W - w - 2));
            const y = 1 + Math.floor(Math.random() * (GRID_H - h - 2));
            
            // 挖開房間
            for (let ry = y; ry < y + h; ry++) {
                for (let rx = x; rx < x + w; rx++) {
                    this.map[ry][rx] = TILE_TYPE.FLOOR;
                }
            }
            rooms.push({ x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) });
        }

        // 連接房間 (簡單走廊)
        for (let i = 0; i < rooms.length - 1; i++) {
            let cx = rooms[i].x;
            let cy = rooms[i].y;
            const tx = rooms[i + 1].x;
            const ty = rooms[i + 1].y;
            while (cx !== tx || cy !== ty) {
                if (Math.random() < 0.5) {
                    if (cx !== tx) cx += (tx > cx ? 1 : -1);
                    else if (cy !== ty) cy += (ty > cy ? 1 : -1);
                } else {
                    if (cy !== ty) cy += (ty > cy ? 1 : -1);
                    else if (cx !== tx) cx += (tx > cx ? 1 : -1);
                }
                this.map[cy][cx] = TILE_TYPE.FLOOR;
            }
        }

        // 設定玩家位置
        this.player.x = rooms[0].x;
        this.player.y = rooms[0].y;
        this.map[this.player.y][this.player.x] = TILE_TYPE.ENTRY;

        // 第5層是 Boss
        if (this.floor === 5) {
            const lastRoom = rooms[rooms.length - 1];
            const boss = new Monster(lastRoom.x, lastRoom.y, ENTITY_TYPE.BOSS, this.floor);
            this.entities.push(boss);
            this.enemiesRemaining = 1;
            this.log("最終 Boss 出現了！小心它的憤怒！");
        } else {
            // 生成怪物與寶藏
            let enemies = 0;
            const enemyCount = 4 + Math.floor(this.floor * 1.5);
            for (let i = 0; i < enemyCount; i++) {
                const pos = this.getRandomFloorPos();
                if (pos.x === this.player.x && pos.y === this.player.y) continue;
                const types = [ENTITY_TYPE.GOBLIN, ENTITY_TYPE.SKELETON, ENTITY_TYPE.SPIDER];
                const type = types[Math.floor(Math.random() * types.length)];
                this.entities.push(new Monster(pos.x, pos.y, type, this.floor));
                enemies++;
            }
            this.enemiesRemaining = enemies;

            // 生成道具
            for (let i = 0; i < 3; i++) {
                const pos = this.getRandomFloorPos();
                const type = Math.random() < 0.4 ? ENTITY_TYPE.POTION : (Math.random() < 0.3 ? ENTITY_TYPE.UPGRADE : ENTITY_TYPE.GOLD);
                this.entities.push(new Item(pos.x, pos.y, type));
            }
            
            // 放置隱藏樓梯 (原本是牆，怪物死光會變樓梯)
            const stairPos = rooms[rooms.length - 1];
            this.stairPos = stairPos;
        }

        this.updateFog();
        this.saveGameAuto();
    },

    getRandomFloorPos() {
        let x, y;
        do {
            x = Math.floor(Math.random() * GRID_W);
            y = Math.floor(Math.random() * GRID_H);
        } while (this.map[y][x] !== TILE_TYPE.FLOOR);
        return { x, y };
    },

    tryMovePlayer(dx, dy) {
        const nx = this.player.x + dx;
        const ny = this.player.y + dy;

        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) return;

        // 檢查牆壁
        if (this.map[ny][nx] === TILE_TYPE.WALL) return;

        // 檢查怪物 (戰鬥)
        const target = this.entities.find(e => e.x === nx && e.y === ny && e.alive);
        if (target) {
            if (target instanceof Monster) {
                this.combat(this.player, target);
                return;
            } else if (target instanceof Item) {
                this.pickUp(target);
            }
        }

        // 檢查樓梯
        if (this.map[ny][nx] === TILE_TYPE.STAIRS) {
            AudioEngine.stairs();
            this.nextFloor();
            return;
        }

        // 移動
        this.player.x = nx;
        this.player.y = ny;
        AudioEngine.move();
        this.updateFog();
        
        // 怪物 AI (簡單跟隨)
        this.updateEnemies();
    },

    updateEnemies() {
        this.entities.forEach(e => {
            if (e instanceof Monster && e.alive) {
                // 所有怪物（包含 Boss）的行動邏輯
                const moveChance = e.type === ENTITY_TYPE.BOSS ? 0.6 : 0.4;
                if (Math.random() < moveChance) {
                    const dx = Math.sign(this.player.x - e.x);
                    const dy = Math.sign(this.player.y - e.y);
                    
                    // 檢查玩家是否在相鄰格（攻擊範圍）
                    if (Math.abs(this.player.x - e.x) + Math.abs(this.player.y - e.y) === 1) {
                        this.combat(e, this.player);
                    } else {
                        // 嘗試移動
                        const nx = e.x + (Math.random() < 0.5 ? dx : 0);
                        const ny = e.y + (nx === e.x ? dy : 0);
                        
                        if (this.map[ny][nx] === TILE_TYPE.FLOOR || this.map[ny][nx] === TILE_TYPE.ENTRY) {
                            if (!this.entities.some(other => other !== e && other.x === nx && other.y === ny && other.alive)) {
                                e.x = nx;
                                e.y = ny;
                            }
                        }
                    }
                }
            }
        });
    },

    combat(attacker, defender) {
        AudioEngine.hit();
        this.shake = 5;
        
        const isCrit = Math.random() < 0.1;
        let damage = Math.max(1, attacker.atk + Math.floor(Math.random() * 5) - defender.def);
        if (isCrit) damage *= 2;
        
        defender.hp -= damage;
        this.spawnParticles(defender.x * TILE_SIZE + 12, defender.y * TILE_SIZE + 12, isCrit ? '#f1c40f' : '#ff0000');

        if (defender.hp <= 0) {
            defender.alive = false;
            AudioEngine.death();
            if (defender instanceof Monster) {
                this.player.addXp(defender.xpVal);
                this.enemiesRemaining--;
                if (defender.type === ENTITY_TYPE.BOSS) {
                    this.state = 'victory';
                    this.showVictory();
                } else if (this.enemiesRemaining <= 0) {
                    this.map[this.stairPos.y][this.stairPos.x] = TILE_TYPE.STAIRS;
                    this.log("出口樓梯已開啟！");
                }
            } else if (defender instanceof Player) {
                this.state = 'death';
                this.showDeath();
            }
        }
    },

    pickUp(item) {
        AudioEngine.pickup();
        item.alive = false;
        if (item.type === ENTITY_TYPE.GOLD) {
            const amount = 10 + Math.floor(Math.random() * 20);
            this.player.gold += amount;
            this.log(`獲得了 ${amount} 金幣`);
        } else if (item.type === ENTITY_TYPE.POTION) {
            if (this.player.inventory.length < 4) {
                this.player.inventory.push('potion');
                this.updateInvUI();
                this.log("獲得生命藥水");
            } else {
                this.log("背包已滿");
            }
        } else if (item.type === ENTITY_TYPE.UPGRADE) {
            this.player.atk += 2;
            this.log("武器升級！攻擊力提升");
        }
    },

    useItem(index) {
        if (this.player.inventory[index] === 'potion') {
            AudioEngine.heal();
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
            this.player.inventory.splice(index, 1);
            this.updateInvUI();
            this.log("使用了藥水，HP 恢復 30");
        }
    },

    nextFloor() {
        this.floor++;
        this.generateFloor();
        this.log(`進入第 ${this.floor} 層`);
    },

    updateFog() {
        // 簡單圓形視野
        for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                const dx = x - this.player.x;
                const dy = y - this.player.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < 36) { // 半徑 6 格
                    this.fog[y][x] = 1;
                } else if (this.fog[y][x] === 1) {
                    this.fog[y][x] = 2;
                }
            }
        }
    },

    spawnParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 30,
                color
            });
        }
    },

    log(msg) {
        const log = document.getElementById('msg-log');
        log.innerText = msg;
        setTimeout(() => { if (log.innerText === msg) log.innerText = ''; }, 3000);
    },

    saveGameAuto() {
        const data = {
            floor: this.floor,
            player: {
                hp: this.player.hp, maxHp: this.player.maxHp,
                atk: this.player.atk, def: this.player.def,
                lv: this.player.lv, xp: this.player.xp,
                gold: this.player.gold, inventory: this.player.inventory
            }
        };
        localStorage.setItem('dungeon_save', JSON.stringify(data));
    },

    loadGame() {
        const raw = localStorage.getItem('dungeon_save');
        if (!raw) { this.log("沒有存檔記錄"); return; }
        const data = JSON.parse(raw);
        this.floor = data.floor;
        this.player = new Player(0, 0);
        Object.assign(this.player, data.player);
        this.generateFloor();
        this.state = 'playing';
        this.showUI();
        document.getElementById('death-screen').classList.add('hidden');
        document.getElementById('title-screen').classList.add('hidden');
    },

    showUI() {
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('inventory').classList.remove('hidden');
        document.getElementById('controls').classList.remove('hidden');
        this.updateInvUI();
    },

    updateInvUI() {
        for (let i = 0; i < 4; i++) {
            const slot = document.getElementById(`slot-${i}`);
            slot.innerText = this.player.inventory[i] === 'potion' ? '🧪' : '';
        }
    },

    showDeath() {
        document.getElementById('death-screen').classList.remove('hidden');
    },

    showVictory() {
        document.getElementById('victory-screen').classList.remove('hidden');
        document.getElementById('final-score').innerText = `最終等級: ${this.player.lv} | 金幣: ${this.player.gold}`;
    },

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    },

    update() {
        if (this.state !== 'playing') return;
        
        // 更新粒子
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            return p.life > 0;
        });

        // 更新相機 (確保相機不會超出地圖邊界太多)
        const targetX = this.player.x * TILE_SIZE - CANVAS_WIDTH / 2 + TILE_SIZE / 2;
        const targetY = this.player.y * TILE_SIZE - CANVAS_HEIGHT / 2 + TILE_SIZE / 2; // 使用 CANVAS_HEIGHT 而非 VIEW_H
        this.camera.x += (targetX - this.camera.x) * 0.1;
        this.camera.y += (targetY - this.camera.y) * 0.1;

        if (this.shake > 0) this.shake--;

        // 更新 HUD
        const hpFill = document.getElementById('hp-fill');
        const hpText = document.getElementById('hp-text');
        if (hpFill) hpFill.style.width = `${(this.player.hp / this.player.maxHp) * 100}%`;
        if (hpText) hpText.innerText = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;
        
        const lvVal = document.getElementById('lv-val');
        const floorVal = document.getElementById('floor-val');
        const goldVal = document.getElementById('gold-val');
        const atkVal = document.getElementById('atk-val');
        const defVal = document.getElementById('def-val');

        if (lvVal) lvVal.innerText = this.player.lv;
        if (floorVal) floorVal.innerText = `B${this.floor}`;
        if (goldVal) goldVal.innerText = this.player.gold;
        if (atkVal) atkVal.innerText = this.player.atk;
        if (defVal) defVal.innerText = this.player.def;
    },

    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        if (!this.player || this.state === 'title') return;

        this.ctx.save();
        if (this.shake > 0) {
            this.ctx.translate(Math.random() * this.shake - this.shake/2, Math.random() * this.shake - this.shake/2);
        }
        
        const camX = Math.floor(this.camera.x);
        const camY = Math.floor(this.camera.y);

        // 繪製地圖
        for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                const px = x * TILE_SIZE - camX;
                const py = y * TILE_SIZE - camY;
                
                // 擴大繪製範圍檢查，確保邊緣平滑
                if (px < -TILE_SIZE || px > CANVAS_WIDTH || py < -TILE_SIZE || py > CANVAS_HEIGHT) continue;

                const fogState = this.fog[y][x];
                if (fogState === 0) continue;

                const tile = this.map[y][x];
                if (tile === TILE_TYPE.WALL) {
                    this.ctx.fillStyle = '#444444'; // 深灰色牆壁
                    this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    this.ctx.strokeStyle = '#222222';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                } else {
                    this.ctx.fillStyle = '#1a1a1a'; // 極深灰地板
                    this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    
                    if (tile === TILE_TYPE.STAIRS) {
                        this.ctx.fillStyle = '#00ff66'; 
                        this.ctx.fillRect(px + 4, py + 4, 16, 16);
                        this.ctx.shadowBlur = 15;
                        this.ctx.shadowColor = '#00ff66';
                        this.ctx.strokeStyle = '#00ff66';
                        this.ctx.strokeRect(px + 4, py + 4, 16, 16);
                        this.ctx.shadowBlur = 0;
                    } else if (tile === TILE_TYPE.ENTRY) {
                        this.ctx.fillStyle = '#0066ff';
                        this.ctx.fillRect(px + 6, py + 6, 12, 12);
                    } else {
                        // 一般地板細節
                        this.ctx.strokeStyle = '#222';
                        this.ctx.beginPath();
                        this.ctx.moveTo(px + 4, py + 4); 
                        this.ctx.lineTo(px + 6, py + 8);
                        this.ctx.stroke();
                    }
                }

                // 迷霧遮罩 (已探索但不在視野內)
                if (fogState === 2) {
                    this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
                    this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                }
            }
        }

        // 繪製實體 (僅在視野內)
        this.entities.forEach(e => {
            if (e.alive && this.fog[e.y][e.x] === 1) {
                e.draw(this.ctx, camX, camY);
            }
        });

        // 繪製玩家
        if (this.player && (this.state === 'playing' || this.state === 'victory')) {
            this.player.draw(this.ctx, camX, camY);
        }

        // 繪製粒子
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life / 30;
            this.ctx.fillRect(p.x - camX, p.y - camY, 4, 4);
        });
        this.ctx.globalAlpha = 1;

        this.ctx.restore();
    }
};

// 啟動遊戲
game.init();
