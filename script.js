document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;

    // --- Audio Files ---
    const sounds = {
        click: new Audio('https://www.soundjay.com/buttons/sounds/button-16.mp3'),
        attack: new Audio('https://www.soundjay.com/mechanical/sounds/clank-2.mp3'),
        victory: new Audio('https://www.soundjay.com/misc/sounds/magic-chime-01.mp3'),
        gameOver: new Audio('https://www.soundjay.com/misc/sounds/magic-chime-01.mp3'), // Placeholder
    };

    // --- Game State ---
    let gameState = {
        player: null,
        currentFloor: 1,
        room: 0,
        log: [],
        soundEnabled: true,
    };
    let currentMonster = null;

    // --- Main Game HTML Structure ---
    const gameHtml = `
        <div id="game-container" style="display: none;">
            <header id="top-bar">
                <h1>文字地牢：D&D 冒險</h1>
                <div id="game-info">
                    <span id="floor-display">層數: <span id="floor-number">1</span></span>
                    <button id="stats-toggle-btn">狀態</button>
                    <button id="save-button">存檔</button>
                    <button id="toggle-sound">音效: 開</button>
                </div>
            </header>
            <main id="main-content">
                <aside id="left-panel">
                    <div id="player-stats">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h2>角色狀態</h2>
                            <button id="close-stats-btn" style="display: none; padding: 5px 10px;">關閉</button>
                        </div>
                        <p>姓名: <span id="player-name"></span></p>
                        <p>職業: <span id="player-class"></span></p>
                        <p>等級: <span id="player-level"></span></p>
                        <p>HP: <progress id="player-hp-bar" value="100" max="100"></progress> <span id="player-hp"></span></p>
                        <p>MP: <progress id="player-mp-bar" value="50" max="50"></progress> <span id="player-mp"></span></p>
                        <p>經驗: <progress id="player-xp-bar" value="0" max="100"></progress> <span id="player-xp"></span></p>
                        <hr>
                        <p>力量: <span id="player-str"></span></p>
                        <p>敏捷: <span id="player-dex"></span></p>
                        <p>智力: <span id="player-int"></span></p>
                        <p>耐力: <span id="player-con"></span></p>
                        <hr>
                        <p>金幣: <span id="player-gold">0</span></p>
                        <h3>裝備</h3>
                        <p>武器: <span id="equipped-weapon">無</span></p>
                        <p>防具: <span id="equipped-armor">無</span></p>
                    </div>
                </aside>
                <section id="center-panel">
                    <div id="log-area"></div>
                    <div id="buttons-area"></div>
                </section>
            </main>
        </div>
    `;

    // --- Utility Functions ---
    function playSound(sound) {
        if (gameState.soundEnabled && sounds[sound]) {
            sounds[sound].currentTime = 0;
            sounds[sound].play();
        }
    }

    function logMessage(message) {
        const logArea = document.getElementById('log-area');
        const p = document.createElement('p');
        p.innerHTML = message;
        logArea.appendChild(p);
        logArea.scrollTop = logArea.scrollHeight;
        gameState.log.push(message);
    }

    function clearButtons() {
        document.getElementById('buttons-area').innerHTML = '';
    }

    function addButton(text, onClick, id = '') {
        const button = document.createElement('button');
        button.textContent = text;
        button.onclick = () => {
            playSound('click');
            onClick();
        };
        if (id) button.id = id;
        document.getElementById('buttons-area').appendChild(button);
    }

    function updateUI() {
        if (!gameState.player) return;
        const p = gameState.player;
        document.getElementById('player-name').textContent = p.name;
        document.getElementById('player-class').textContent = p.class;
        document.getElementById('player-level').textContent = p.level;
        document.getElementById('player-hp').textContent = `${p.hp}/${p.maxHp}`;
        document.getElementById('player-mp').textContent = `${p.mp}/${p.maxMp}`;
        document.getElementById('player-xp').textContent = `${p.xp}/${p.nextLevelXp}`;
        document.getElementById('player-hp-bar').value = p.hp;
        document.getElementById('player-hp-bar').max = p.maxHp;
        document.getElementById('player-mp-bar').value = p.mp;
        document.getElementById('player-mp-bar').max = p.maxMp;
        document.getElementById('player-xp-bar').value = p.xp;
        document.getElementById('player-xp-bar').max = p.nextLevelXp;
        document.getElementById('player-str').textContent = p.str;
        document.getElementById('player-dex').textContent = p.dex;
        document.getElementById('player-int').textContent = p.int;
        document.getElementById('player-con').textContent = p.con;
        document.getElementById('player-gold').textContent = p.gold;
        document.getElementById('equipped-weapon').textContent = p.equipment.weapon ? p.equipment.weapon.name : '無';
        document.getElementById('equipped-armor').textContent = p.equipment.armor ? p.equipment.armor.name : '無';
        document.getElementById('floor-number').textContent = gameState.currentFloor;
    }

    // --- Game Screens ---
    function showStartScreen() {
        body.innerHTML = `
            <div id="start-screen">
                <h1>文字地牢：D&D 冒險</h1>
                <button id="new-game-btn">新遊戲</button><br><br>
                <button id="load-game-btn">載入存檔</button><br><br>
                <button id="instructions-btn">遊戲說明</button>
            </div>
        `;
        document.getElementById('new-game-btn').onclick = () => { playSound('click'); showCharacterCreation(); };
        document.getElementById('load-game-btn').onclick = () => { playSound('click'); loadGame(true); };
        document.getElementById('instructions-btn').onclick = () => {
            playSound('click');
            alert('遊戲說明:\n- 點擊「探索下一室」來推進地牢。\n- 戰鬥是回合制的。\n- 擊敗怪物以獲得經驗與金幣。\n- HP歸零遊戲就會結束。\n- 記得隨時存檔！祝你好運！');
        };
    }

    function showCharacterCreation() {
        body.innerHTML = gameHtml;
        document.getElementById('game-container').style.display = 'block';
        const logArea = document.getElementById('log-area');
        logArea.innerHTML = `
            <h2>角色創建</h2>
            <p>輸入你的名字:</p>
            <input type="text" id="char-name-input" maxlength="10" placeholder="冒險者">
            <p>選擇你的職業:</p>
            <select id="class-selection"></select>
            <p>分配你的屬性點 (剩餘 <span id="points-left">10</span> 點):</p>
            <div id="attribute-allocation"></div>
        `;

        const classes = {
            '戰士': { str: 2, con: 1, int: 0, dex: 0, desc: '近戰專家，擁有較高的生命值和力量。' },
            '法師': { int: 2, dex: 1, str: 0, con: 0, desc: '元素掌控者，能施展強大的法術。' },
            '盜賊': { dex: 2, str: 1, int: 0, con: 0, desc: '敏捷的刺客，擅長躲避和致命一擊。' },
        };
        let attributes = { str: 8, dex: 8, int: 8, con: 8 };
        let pointsLeft = 10;

        const classSelect = document.getElementById('class-selection');
        Object.keys(classes).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = `${name} - ${classes[name].desc}`;
            classSelect.appendChild(option);
        });

        function updateCreationUI() {
            const selectedClass = classSelect.value;
            const attributeDiv = document.getElementById('attribute-allocation');
            attributeDiv.innerHTML = '';
            
            // Style the allocation area
            attributeDiv.style.display = 'grid';
            attributeDiv.style.gridTemplateColumns = window.innerWidth <= 768 ? '1fr' : '1fr 1fr';
            attributeDiv.style.gap = '10px';
            attributeDiv.style.marginBottom = '20px';

            Object.keys(attributes).forEach(attr => {
                let baseValue = 8 + (classes[selectedClass][attr] || 0);
                const attrContainer = document.createElement('div');
                attrContainer.style.display = 'flex';
                attrContainer.style.alignItems = 'center';
                attrContainer.style.justifyContent = 'space-between';
                attrContainer.style.background = '#333';
                attrContainer.style.padding = '10px';
                attrContainer.style.borderRadius = '5px';
                
                attrContainer.innerHTML = `
                    <span style="font-weight: bold; width: 50px;">${attr.toUpperCase()}</span>
                    <span style="font-size: 1.2em; color: #f1c40f; min-width: 30px; text-align: center;">${baseValue + (attributes[attr] - 8)}</span>
                    <div style="display: flex; gap: 5px;">
                        <button class="attr-btn" data-attr="${attr}" data-val="-1" style="padding: 5px 12px; font-weight: bold;">-</button>
                        <button class="attr-btn" data-attr="${attr}" data-val="1" style="padding: 5px 12px; font-weight: bold;">+</button>
                    </div>
                `;
                attributeDiv.appendChild(attrContainer);
            });
            document.getElementById('points-left').textContent = pointsLeft;

            document.querySelectorAll('.attr-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const attr = e.target.dataset.attr;
                    const val = parseInt(e.target.dataset.val);
                    if (val > 0 && pointsLeft > 0) {
                        attributes[attr]++;
                        pointsLeft--;
                    } else if (val < 0 && (attributes[attr] > 8)) {
                        attributes[attr]--;
                        pointsLeft++;
                    }
                    updateCreationUI();
                };
            });
        }

        classSelect.onchange = updateCreationUI;
        addButton('開始冒險', () => {
            const name = document.getElementById('char-name-input').value || '冒險者';
            const selectedClass = classSelect.value;
            Object.keys(attributes).forEach(attr => { attributes[attr] += (classes[selectedClass][attr] || 0); });

            gameState.player = {
                name: name, class: selectedClass, level: 1, xp: 0, nextLevelXp: 100,
                hp: attributes.con * 10, maxHp: attributes.con * 10,
                mp: attributes.int * 5, maxMp: attributes.int * 5,
                str: attributes.str, dex: attributes.dex, int: attributes.int, con: attributes.con,
                gold: 0, inventory: [], equipment: { weapon: null, armor: null },
            };

            logArea.innerHTML = '';
            logMessage(`歡迎你，${name}！你的冒險開始了。`);
            updateUI();
            attachEventListeners();
            startGame();
        });
        updateCreationUI();
    }

    function startGame() {
        clearButtons();
        logMessage("你站在一個陰暗潮濕的房間。空氣中瀰漫著腐朽和危險的氣息。");
        addButton("探索下一室", exploreNextRoom);
        addButton("打開物品欄", openInventory);
    }

    // --- Main Game Loop ---
    function exploreNextRoom() {
        gameState.room++;
        if (gameState.currentFloor < 5 && gameState.room > Math.floor(Math.random() * 3) + 3) {
            logMessage("你找到了通往下一層的樓梯。");
            clearButtons();
            addButton("前往下一層", descendFloor);
            return;
        }

        logMessage(`你小心翼翼地走進第 ${gameState.room} 個房間...`);
        clearButtons();

        const eventRoll = Math.random();
        if (eventRoll < 0.70) { initiateCombat(); }
        else if (eventRoll < 0.85) { findTreasure(); }
        else if (eventRoll < 0.95) { findRestStop(); }
        else { triggerTrap(); }
    }

    function descendFloor() {
        gameState.currentFloor++;
        gameState.room = 0;
        if (gameState.currentFloor === 5) {
            logMessage("<b style='color: #c0392b;'>你感受到一股強大的邪惡氣息...最終的挑戰在等著你！</b>");
            initiateBossFight();
        } else {
            logMessage(`你踏上了前往地牢第 ${gameState.currentFloor} 層的階梯...`);
            updateUI();
            startGame();
        }
    }

    // --- Events ---
    function initiateCombat() {
        const monsterList = ['哥布林', '骷髏兵', '巨蜘蛛', '穴居狼', '食人魔'];
        const monsterName = monsterList[Math.floor(Math.random() * monsterList.length)];
        const floor = gameState.currentFloor;
        currentMonster = {
            name: monsterName,
            hp: Math.floor((20 + floor * 10) * (Math.random() * 0.4 + 0.8)),
            atk: Math.floor((5 + floor * 3) * (Math.random() * 0.4 + 0.8)),
            def: Math.floor((2 + floor * 2) * (Math.random() * 0.4 + 0.8)),
        };
        currentMonster.maxHp = currentMonster.hp; // For display purposes
        logMessage(`<span style='color: #e74c3c;'>一隻 ${currentMonster.name} (HP: ${currentMonster.hp}) 擋住了你的去路！</span>`);
        playerTurn();
    }

    function initiateBossFight() {
        currentMonster = {
            name: "黑暗領主", hp: 500, maxHp: 500, atk: 35, def: 20, isBoss: true, specialAttackCooldown: 0,
        };
        logMessage(`<span style='color: #e74c3c; font-size: 1.2em;'><b>${currentMonster.name}</b> 出現在你的面前，散發著毀滅的氣息！</span>`);
        playerTurn();
    }

    function findTreasure() {
        const goldFound = 20 * gameState.currentFloor + Math.floor(Math.random() * 10 * gameState.currentFloor);
        gameState.player.gold += goldFound;
        logMessage(`<span style='color: #f1c40f;'>你打開寶箱，發現了 ${goldFound} 枚金幣！</span>`);
        if (Math.random() < 0.7) {
            const item = createRandomItem();
            gameState.player.inventory.push(item);
            logMessage(`寶箱中還有一個物品：<span style='color: #f1c40f;'>${item.name}</span>！`);
        }
        updateUI();
        addButton("繼續探索", exploreNextRoom);
        addButton("打開物品欄", openInventory);
    }

    function findRestStop() {
        logMessage("<span style='color: #2ecc71;'>你找到了一個可以安全休息的噴泉。</span>");
        const hpHealed = Math.floor(gameState.player.maxHp * 0.5);
        const mpHealed = Math.floor(gameState.player.maxMp * 0.5);
        gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + hpHealed);
        gameState.player.mp = Math.min(gameState.player.maxMp, gameState.player.mp + mpHealed);
        logMessage(`你恢復了 ${hpHealed} 點生命和 ${mpHealed} 點法力。`);
        updateUI();
        addButton("繼續探索", exploreNextRoom);
        addButton("打開物品欄", openInventory);
    }

    function triggerTrap() {
        const damage = Math.floor(gameState.player.maxHp * 0.1 * gameState.currentFloor);
        gameState.player.hp -= damage;
        logMessage(`<span style='color: #e67e22;'>陷阱觸發了！你受到了 ${damage} 點傷害！</span>`);
        updateUI();
        if (gameState.player.hp <= 0) {
            checkCombatEnd();
        } else {
            addButton("繼續探索", exploreNextRoom);
            addButton("打開物品欄", openInventory);
        }
    }

    // --- Combat System ---
    function playerTurn() {
        clearButtons();
        addButton("普通攻擊", playerAttack);
        addButton("職業技能", useSkill);
        addButton("打開物品欄", openInventory);
        addButton("防禦", playerDefend);
        addButton("逃跑", attemptToFlee);
    }

    function playerAttack() {
        playSound('attack');
        const p = gameState.player;
        const roll = Math.floor(Math.random() * 20) + 1;
        const hitChance = 60 + (p.dex - currentMonster.def) * 2;
        if (roll === 20 || (roll > 1 && roll > (100 - hitChance) / 5)) {
            let damage = Math.max(1, p.str + (p.equipment.weapon ? p.equipment.weapon.atk : 0) - currentMonster.def);
            if (roll === 20) {
                damage = Math.floor(damage * 1.5);
                logMessage(`<b>致命一擊！</b>(d20=${roll}) 你對 ${currentMonster.name} 造成了 <span style='color: #ffed4a;'>${damage}</span> 點傷害！`);
            } else {
                logMessage(`你擊中了 ${currentMonster.name} (d20=${roll})，造成了 ${damage} 點傷害。`);
            }
            currentMonster.hp -= damage;
        } else {
            logMessage(`你的攻擊被 ${currentMonster.name} (d20=${roll}) 躲開了。`);
        }
        updateUI();
        checkCombatEnd();
    }

    function useSkill() {
        const p = gameState.player;
        let skillUsed = false;
        if (p.class === '戰士' && p.mp >= 10) {
            p.mp -= 10;
            const damage = Math.floor(p.str * 1.5);
            currentMonster.hp -= damage;
            logMessage(`你使用了<b>重擊</b>，對 ${currentMonster.name} 造成了 ${damage} 點穿透傷害！`);
            skillUsed = true;
        } else if (p.class === '法師' && p.mp >= 15) {
            p.mp -= 15;
            const damage = Math.floor(p.int * 2);
            currentMonster.hp -= damage;
            logMessage(`你吟唱了<b>火球術</b>，火焰吞噬了 ${currentMonster.name}，造成 ${damage} 點魔法傷害！`);
            skillUsed = true;
        } else if (p.class === '盜賊' && p.mp >= 12) {
            p.mp -= 12;
            const damage = Math.floor(p.dex * 1.8);
            currentMonster.hp -= damage;
            logMessage(`你施展了<b>背刺</b>，悄無聲息地對 ${currentMonster.name} 造成了 ${damage} 點暴擊傷害！`);
            skillUsed = true;
        } else {
            logMessage("法力不足，無法使用技能！");
        }
        updateUI();
        if (skillUsed) checkCombatEnd(); else playerTurn();
    }

    function playerDefend() {
        gameState.player.isDefending = true;
        logMessage("你舉起了盾牌，準備防禦下一次攻擊。");
        checkCombatEnd();
    }

    function attemptToFlee() {
        if (currentMonster.isBoss) {
            logMessage("在黑暗領主面前，你無處可逃！");
            checkCombatEnd();
            return;
        }
        const fleeChance = 0.5 + (gameState.player.dex / 50) - (gameState.currentFloor * 0.05);
        if (Math.random() < fleeChance) {
            logMessage("你成功逃離了戰鬥！");
            currentMonster = null;
            startGame();
        } else {
            logMessage("你嘗試逃跑，但失敗了！");
            checkCombatEnd();
        }
    }

    function monsterTurn() {
        if (!currentMonster || currentMonster.hp <= 0) return;
        let damage;
        if (currentMonster.isBoss) {
            if (currentMonster.specialAttackCooldown > 0) {
                currentMonster.specialAttackCooldown--;
            }
            if (currentMonster.specialAttackCooldown === 0 && Math.random() < 0.4) {
                damage = Math.floor(currentMonster.atk * 1.8);
                logMessage(`<b>${currentMonster.name}</b> 使用了毀滅重擊！對你造成了 <span style='color:red;'>${damage}</span> 點巨量傷害！`);
                currentMonster.specialAttackCooldown = 2; // Cooldown for 2 turns
            } else {
                damage = Math.max(1, currentMonster.atk - (gameState.player.equipment.armor ? gameState.player.equipment.armor.def : 0));
                logMessage(`${currentMonster.name} 猛烈地攻擊你，造成了 ${damage} 點傷害。`);
            }
        } else {
            damage = Math.max(1, currentMonster.atk - (gameState.player.equipment.armor ? gameState.player.equipment.armor.def : 0));
            if (gameState.player.isDefending) {
                damage = Math.floor(damage / 2);
                logMessage(`${currentMonster.name} 攻擊了你，但你的防禦使傷害減少了！你受到了 ${damage} 點傷害。`);
            }
            else {
                logMessage(`${currentMonster.name} 攻擊了你，造成了 ${damage} 點傷害。`);
            }
        }
        if (gameState.player.isDefending) gameState.player.isDefending = false;
        gameState.player.hp -= damage;
        updateUI();
        checkCombatEnd(true);
    }

    function checkCombatEnd(wasMonsterTurn = false) {
        if (currentMonster && currentMonster.hp <= 0) {
            if (currentMonster.isBoss) {
                playSound('victory');
                logMessage(`<b style='color: #f1c40f; font-size: 1.5em;'>恭喜你！你擊敗了黑暗領主，拯救了這個被遺忘的地牢！</b>`);
                clearButtons();
                addButton("再玩一次", () => window.location.reload());
                return;
            }
            playSound('victory');
            logMessage(`你擊敗了 ${currentMonster.name}！`);
            const xpGained = 15 * gameState.currentFloor;
            const goldGained = 10 * gameState.currentFloor + Math.floor(Math.random() * 5 * gameState.currentFloor);
            gameState.player.xp += xpGained;
            gameState.player.gold += goldGained;
            logMessage(`你獲得了 ${xpGained} 點經驗和 ${goldGained} 枚金幣。`);
            if (Math.random() < 0.3) {
                const item = createRandomItem();
                gameState.player.inventory.push(item);
                logMessage(`怪物掉落了物品：<span style='color: #f1c40f;'>${item.name}</span>！`);
            }
            if (gameState.player.xp >= gameState.player.nextLevelXp) {
                levelUp();
            }
            currentMonster = null;
            updateUI();
            startGame();
        } else if (gameState.player.hp <= 0) {
            playSound('gameOver');
            gameState.player.hp = 0;
            updateUI();
            logMessage("<span style='color: red; font-weight: bold; font-size: 1.5em;'>你已經死亡... GAME OVER</span>");
            clearButtons();
            addButton("重新開始", () => window.location.reload());
        } else if (wasMonsterTurn) {
            playerTurn();
        } else if (currentMonster) {
            setTimeout(monsterTurn, 1000);
        }
    }

    function levelUp() {
        const p = gameState.player;
        p.level++;
        p.xp -= p.nextLevelXp;
        p.nextLevelXp = Math.floor(p.nextLevelXp * 1.5);
        const hpGain = 10 + Math.floor(p.con / 2);
        const mpGain = 5 + Math.floor(p.int / 2);
        p.maxHp += hpGain; p.hp = p.maxHp;
        p.maxMp += mpGain; p.mp = p.maxMp;
        p.str++; p.dex++; p.int++; p.con++;
        logMessage(`<b style='color: #2ecc71;'>恭喜！你升到了 ${p.level} 級！你的能力得到了提升，且狀態完全恢復！</b>`);
        updateUI();
    }

    // --- Items & Inventory ---
    function createRandomItem() {
        const itemTypes = ['weapon', 'armor', 'potion'];
        const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        const floor = gameState.currentFloor;
        let item;
        if (type === 'weapon') {
            const names = ['短劍', '手斧', '法杖', '匕首', '長劍'];
            item = { name: `(${floor}級) ${names[Math.floor(Math.random() * names.length)]}`, type: 'weapon', atk: 2 * floor + Math.floor(Math.random() * 3) };
        } else if (type === 'armor') {
            const names = ['皮甲', '鎖子甲', '法袍', '板甲'];
            item = { name: `(${floor}級) ${names[Math.floor(Math.random() * names.length)]}`, type: 'armor', def: 1 * floor + Math.floor(Math.random() * 2) };
        } else {
            item = { name: '治療藥水', type: 'potion', effect: () => {
                const healed = 50 + (10 * floor);
                gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + healed);
                logMessage(`你喝下了治療藥水，恢復了 ${healed} 點生命。`);
                updateUI();
            }};
        }
        return item;
    }

    function openInventory() {
        clearButtons();
        logMessage("--- 你的物品欄 ---");
        if (gameState.player.inventory.length === 0) {
            logMessage("空空如也...");
        } else {
            gameState.player.inventory.forEach((item, index) => {
                let desc = '';
                if (item.type === 'weapon') desc = `(攻擊+${item.atk})`;
                if (item.type === 'armor') desc = `(防禦+${item.def})`;
                if (item.type === 'potion') desc = `(恢復生命)`;
                addButton(`使用 ${item.name} ${desc}`, () => useItem(index));
            });
        }
        addButton("返回", currentMonster ? playerTurn : startGame);
    }

    function useItem(itemIndex) {
        const item = gameState.player.inventory[itemIndex];
        if (item.type === 'potion') {
            item.effect();
            gameState.player.inventory.splice(itemIndex, 1);
        } else if (item.type === 'weapon') {
            if (gameState.player.equipment.weapon) gameState.player.inventory.push(gameState.player.equipment.weapon);
            gameState.player.equipment.weapon = item;
            gameState.player.inventory.splice(itemIndex, 1);
            logMessage(`你裝備了 <span style='color: #f1c40f;'>${item.name}</span>。`);
        } else if (item.type === 'armor') {
            if (gameState.player.equipment.armor) gameState.player.inventory.push(gameState.player.equipment.armor);
            gameState.player.equipment.armor = item;
            gameState.player.inventory.splice(itemIndex, 1);
            logMessage(`你穿上了 <span style='color: #f1c40f;'>${item.name}</span>。`);
        }
        updateUI();
        openInventory();
    }

    // --- Save/Load System ---
    function attachEventListeners() {
        document.getElementById('save-button').onclick = () => { playSound('click'); saveGame(); };
        document.getElementById('toggle-sound').onclick = () => {
            playSound('click');
            gameState.soundEnabled = !gameState.soundEnabled;
            document.getElementById('toggle-sound').textContent = `音效: ${gameState.soundEnabled ? '開' : '關'}`;
        };

        // Mobile Stats Toggle
        const leftPanel = document.getElementById('left-panel');
        const statsToggleBtn = document.getElementById('stats-toggle-btn');
        const closeStatsBtn = document.getElementById('close-stats-btn');

        if (statsToggleBtn) {
            statsToggleBtn.onclick = () => {
                playSound('click');
                leftPanel.classList.toggle('active');
            };
        }

        if (closeStatsBtn) {
            // Show close button only on mobile
            if (window.innerWidth <= 768) {
                closeStatsBtn.style.display = 'block';
            }
            closeStatsBtn.onclick = () => {
                playSound('click');
                leftPanel.classList.remove('active');
            };
        }

        // Close stats panel when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                leftPanel.classList.contains('active') && 
                !leftPanel.contains(e.target) && 
                e.target !== statsToggleBtn) {
                leftPanel.classList.remove('active');
            }
        });
    }

    function saveGame() {
        if (!gameState.player) {
            alert("沒有可儲存的遊戲！");
            return;
        }
        try {
            localStorage.setItem('dndTextGameSave', JSON.stringify(gameState));
            logMessage("<span style='color: #2ecc71;'>遊戲已儲存！</span>");
        } catch (e) {
            console.error("儲存失敗:", e);
            alert("儲存遊戲時發生錯誤。");
        }
    }

    function loadGame(isFromStartScreen = false) {
        const savedGame = localStorage.getItem('dndTextGameSave');
        if (savedGame) {
            try {
                gameState = JSON.parse(savedGame);
                // Re-assign functions to items as they are lost in JSON
                gameState.player.inventory.forEach(item => {
                    if (item.type === 'potion') {
                        item.effect = () => {
                            const healed = 50 + (10 * gameState.currentFloor);
                            gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + healed);
                            logMessage(`你喝下了治療藥水，恢復了 ${healed} 點生命。`);
                            updateUI();
                        };
                    }
                });

                if (isFromStartScreen) {
                    body.innerHTML = gameHtml;
                    document.getElementById('game-container').style.display = 'block';
                }
                const logArea = document.getElementById('log-area');
                logArea.innerHTML = '';
                gameState.log.forEach(msg => { logArea.innerHTML += `<p>${msg}</p>`; });
                logMessage("<span style='color: #2ecc71;'>遊戲已載入！</span>");
                updateUI();
                attachEventListeners();
                startGame();
            } catch (e) {
                console.error("讀取失敗:", e);
                alert("讀取存檔時發生錯誤。正在重新開始...");
                showStartScreen();
            }
        } else {
            alert("沒有找到存檔！");
        }
    }

    // --- Initializer ---
    showStartScreen();
});