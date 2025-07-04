require('./keep_alive'); // Keep-alive serverni ishga tushirish
//jutsssqsqsqsqsqsqsqsqsqqsq

const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const colors = require('colors');
const fs = require('fs');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

colors.enable();

// Bot ID command line dan olinadi
const botId = process.argv[2];
const configFile = process.env.BOT_CONFIG_FILE || `bot-config-${botId}.json`;

// Konfiguratsiyani yuklash
let config;
try {
    config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
} catch (error) {
    console.error('Bot konfiguratsiyasini yuklab bo\'lmadi:', error.message);
    process.exit(1);
}

// Konfiguratsiya o'zgaruvchilari
const nomer = config.nomer || "1";
const p1 = config.p1 || [0, 64, 0];               // Boshlanish koordinatalari
const p2 = config.p2 || [0, 64, 0];               // Tugash koordinatalari
const auto_place = config.auto_place || "true";    // Avtomatik block qo'yish
const anti_spawn = config.anti_spawn || "true";    // Anti-spawn himoya
const admin = config.admin || "admin";             // Admin niki
const username = config.username || "bot";         // Bot niki
const pswd = config.pswd || "password";           // Bot paroli
const warp = config.warp || "home";               // Warp nomi
const blockType = config.blockType || "cobblestone"; // Block turi

const s = (parseInt(nomer) * 5);
const uz_fine = (s * 1000);
let placementActive = false;

function delay(ms) {
    const date = Date.now();
    let currentDate = null;
    do {
        currentDate = Date.now();
    } while (currentDate - date < ms);
}

let uzfine = "starting";

function createBot() {
    // Anti-spawn himoya
    if (anti_spawn == "true") {
        if (uzfine == "join") {
            uzfine = "starting";
            console.log(`${s} sekunddan keyin bot serverga qo'shiladi`.yellow);
            delay(uz_fine);
        }
    }

    // Bot yaratish
    const bot = mineflayer.createBot({
        host: "hypixel.uz",
        port: 25566,
        username: username,
        version: '1.18.2'
    });

    // Pathfinder plaginini yuklash (aqlli harakat uchun)
    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        console.log("SPAWNED".green);
        
        if (uzfine == "starting") {
            uzfine = "login";
        }

        // Pathfinder sozlamalari (tez va aqlli harakat)
        const mcData = require('minecraft-data')(bot.version);
        const movements = new Movements(bot, mcData);
        movements.canDig = false;                    // Blocklar qazmaslik
        movements.allow1by1towers = false;          // Minora qurmmaslik
        movements.scafoldingBlocks = [];
        movements.blocksCantBreak.add(mcData.blocksByName.bedrock.id);
        movements.blocksCantBreak.add(mcData.blocksByName.barrier.id);
        movements.digCost = 0;
        movements.placeCost = 0;
        bot.pathfinder.setMovements(movements);

        // Avtomatik block qo'yishni boshlash
        if (auto_place == "true") {
            if (uzfine == "login") {
                setTimeout(() => {
                    if (!placementActive) {
                        place();
                        console.log("Block qo'yish funksiyasi ishga tushdi".green);
                    }
                }, 3000);
                setTimeout(() => {
                    bot.chat('/is warp ' + warp);
                    console.log("Warpga borildi".yellow);
                }, 1000);
            }
        }
    });

    // Serverdan kelgan xabarlarni qayta ishlash
    bot.on('messagestr', (message) => {
        console.log(message);

        if (message.includes('register')) {
            bot.chat('/register ' + pswd + ' ' + pswd);
        }
        if (message.includes('login')) {
            bot.chat('/login ' + pswd);
        }
        if (uzfine == "login") {
            uzfine = "0";
        }
    });

    // Admin komandalarini tinglash
    bot.on('chat', (username, message) => {
        if (username === admin) {
            // Maxsus bot komandasi
            if (message.indexOf('!' + nomer + ' ') !== -1) {
                var replacement = '!' + nomer + ' ',
                    toReplace = "",
                    str = message;
                str = str.replace(replacement, toReplace);
                bot.chat(str);
            }
        }
    });

    // Umumiy admin komandalar
    bot.on('chat', (username, message) => {
        if (username === admin) {
            if (message.indexOf('! ') !== -1) {
                var replacement = '! ',
                    toReplace = "",
                    str = message;
                str = str.replace(replacement, toReplace);
                bot.chat(str);
            }
        }
    });

    // Bot boshqaruv komandalar
    bot.on('whisper', async (username, message) => {
        if (username == admin) {
            switch (message) {
                case 'quit':
                case 'quit' + nomer:
                    bot.quit();
                    uzfine = "quit";
                    break;
                case 'start' + nomer:
                case 'start':
                    if (!placementActive) {
                        place();
                    }
                    break;
                case 'stop' + nomer:
                case 'stop':
                    placementActive = false;
                    console.log("Block qo'yish to'xtatildi".red);
                    break;
            }
        }
    });

    // Manual rejim uchun komandalar
    if (auto_place == "false") {
        bot.on('chat', async (username, message) => {
            if (username == admin) {
                switch (message) {
                    case 'run':
                    case 'run' + nomer:
                        if (!placementActive) place();
                        break;
                }
            }
        });
    }

    // Koordinatalar oralig'ini hisoblash funksiyasi
    function range(p1, p2) {
        p1 = parseInt(p1);
        p2 = parseInt(p2);
        let res = [];
        if (p1 > p2) {
            for (let j = p1; j >= p2; j--) {
                res.push(j);
            }
        } else {
            for (let j = p1; j <= p2; j++) {
                res.push(j);
            }
        }
        return res;
    }

    const xrange = range(p1[0], p2[0]);
    const yrange = range(p1[1], p2[1]);
    const zrange = range(p1[2], p2[2]);
	
	async function getBlockFromChestIfEmpty() {
    console.log("Bloklar tugadi. Chestdan blok olinadi...".cyan);

    try {
        // Warp chest joyga borish
        bot.chat("/is visit FORTUNE_04");
        console.log("visiting to FORTUNE_04...".yellow);
        await bot.waitForTicks(100); // taxminan 5s

        const chestPos = new Vec3(6193, 54, -1363);
        const chestBlock = bot.blockAt(chestPos);

        if (!chestBlock || !bot.openChest) {
            console.log("Chest topilmadi yoki ochib bo‘lmadi!".red);
            return false;
        }

        const chest = await bot.openChest(chestBlock);
        await bot.waitForTicks(20);

        const items = chest.containerItems().filter(item => item.name === blockType);
        if (items.length === 0) {
            console.log(`Chestda ${blockType} yo'q.`.red);
            chest.close();
            return false;
        }

        let totalTaken = 0;
        for (const item of items) {
            try {
                const countToTake = item.count;
                await chest.withdraw(item.type, null, countToTake);
                totalTaken += countToTake;
                console.log(`${countToTake} ta ${item.name} olindi`.green);
            } catch (e) {
                if (e.message.includes("destination full")) {
                    console.log("Inventory to‘ldi, olish to‘xtatildi.".yellow);
                    break;
                } else {
                    console.log(`Olishda xatolik: ${e.message}`.red);
                }
            }
        }

        await bot.waitForTicks(20);
        chest.close();

        return totalTaken > 0;
    } catch (e) {
        console.log(`Chest ochishda xatolik: ${e.message}`.red);
        return false;
    } finally {
        // Har qanday holatda orqaga qaytish
        bot.chat("/back");
        console.log("Position updated after warp".yellow);
        await bot.waitForTicks(80);
    }
}


    // ASOSIY BLOCK QO'YISH FUNKSIYASI - ENG TEZKOR VA AQLLI
    async function place() {
        if (placementActive) {
            console.log("Block qo'yish allaqachon faol".yellow);
            return;
        }
        
        placementActive = true;
        console.log(`Boshlanish: ${p1.join(', ')}, Tugash: ${p2.join(', ')}, Block: ${blockType}`.cyan);
        
        // Blocklar mavjudligini tekshirish
let currentBlockItem = bot.inventory.items().find(item => item.name === blockType);
if (!currentBlockItem) {
    console.log(`${blockType} tugadi! Chestdan olishga urinish...`.red);

    const success = await getBlockFromChestIfEmpty();
    if (!success) {
        console.log(`${blockType} topilmadi. 5 sekunddan keyin qayta uriniladi.`.yellow);
        placementActive = false;
        return setTimeout(() => {
            if (!placementActive) place();
        }, 5000);
    }

    currentBlockItem = bot.inventory.items().find(item => item.name === blockType);
    if (!currentBlockItem) {
        console.log(`${blockType} hali ham topilmadi. Qayta uriniladi.`.red);
        placementActive = false;
        return setTimeout(() => {
            if (!placementActive) place();
        }, 5000);
    }
}

        let placedCount = 0;
        let skippedCount = 0;
        const totalBlocks = xrange.length * yrange.length * zrange.length;

        console.log(`Jami ${totalBlocks} ta block o'rnatiladi`.yellow);

        // AQLLI STRATEGIYA: Pastdan yuqoriga
        const sortedPositions = [];
        for (let y of yrange) {
            for (let x of xrange) {
                for (let z of zrange) {
                    sortedPositions.push(new Vec3(x, y, z));
                }
            }
        }
        
        // Y koordinatasi bo'yicha saralash (barqaror qurish uchun)
        sortedPositions.sort((a, b) => a.y - b.y);

        // HAR BIR POZITSIYA UCHUN BLOCK QO'YISH
        for (let pos of sortedPositions) {
            if (!placementActive) {
                console.log("Block qo'yish komanda bilan to'xtatildi".yellow);
                return;
            }

            try {
                let block = bot.blockAt(pos);
                
                // Agar block allaqachon mavjud bo'lsa, o'tkazib yuborish
                if (!block || block.name !== 'air') {
                    skippedCount++;
                    continue;
                }

                // Blocklar mavjudligini qayta tekshirish
                let currentBlockItem = bot.inventory.items().find(item => item.name === blockType);
if (!currentBlockItem) {
    console.log(`${blockType} tugadi! Chestdan olishga urinish...`.red);

    const success = await getBlockFromChestIfEmpty();
    if (!success) {
        console.log(`${blockType} topilmadi. 5 sekunddan keyin qayta uriniladi.`.yellow);
        placementActive = false;
        return setTimeout(() => {
            if (!placementActive) place();
        }, 5000);
    }
}

                // AQLLI HARAKAT - faqat kerak bo'lganda
                const distance = bot.entity.position.distanceTo(pos);
                if (distance > 4.5) {
                    try {
                        // Tezkor pathfinding
                        bot.pathfinder.setGoal(new goals.GoalNear(pos.x, pos.y, pos.z, 4));
                        
                        await new Promise((resolve) => {
                            const timeout = setTimeout(resolve, 2000); // Tez timeout
                            const checkPosition = setInterval(() => {
                                if (bot.entity.position.distanceTo(pos) <= 4.5) {
                                    clearInterval(checkPosition);
                                    clearTimeout(timeout);
                                    resolve();
                                }
                            }, 100);
                        });
                    } catch (pathError) {
                        // To'g'ridan-to'g'ri harakat
                        const dx = pos.x - bot.entity.position.x;
                        const dz = pos.z - bot.entity.position.z;
                        bot.look(Math.atan2(-dx, -dz), 0);
                        bot.setControlState('forward', true);
                        bot.setControlState('sprint', true); // Sprint qilish
                        await new Promise(resolve => setTimeout(resolve, 300));
                        bot.setControlState('forward', false);
                        bot.setControlState('sprint', false);
                    }
                }

                // Blockni tez jihozlash
                if (!bot.heldItem || bot.heldItem.name !== blockType) {
                    await bot.equip(currentBlockItem, 'hand');
                }

                // AQLLI REFERENCE BLOCK TOPISH
                const offsets = [
                    new Vec3(0, -1, 0), // Pastdan (eng barqaror)
                    new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
                    new Vec3(0, 0, 1), new Vec3(0, 0, -1),
                    new Vec3(0, 1, 0)  // Yuqoridan (oxirgi variant)
                ];

                let placed = false;
                for (let offset of offsets) {
                    const refPos = pos.plus(offset);
                    const referenceBlock = bot.blockAt(refPos);
                    
                    if (referenceBlock && referenceBlock.name !== 'air' && 
                        referenceBlock.name !== 'water' && referenceBlock.name !== 'lava') {
                        try {
                            // Tez qarab block qo'yish
                            const faceVector = pos.minus(refPos);
                            await bot.placeBlock(referenceBlock, faceVector);
                            
                            placedCount++;
                            placed = true;
                            
                            console.log(`✓ Block: ${pos.toString()} (${placedCount}/${totalBlocks})`.green);
                            
                            // Minimal kechikish (maksimal tezlik uchun)
                            await new Promise(resolve => setTimeout(resolve, 10));
                            break;
                        } catch (placeError) {
                            // Bu reference block ishlamasa, keyingisini sinash
                            continue;
                        }
                    }
                }

                // Agar reference block topilmasa, yerdan minora qurish
                if (!placed && placedCount < totalBlocks * 0.1) {
                    for (let y = pos.y - 1; y >= Math.min(...yrange) - 5; y--) {
                        const groundPos = new Vec3(pos.x, y, pos.z);
                        const groundBlock = bot.blockAt(groundPos);
                        
                        if (groundBlock && groundBlock.name !== 'air') {
                            try {
                                // Yuqoriga minora qurish
                                let currentY = y + 1;
                                while (currentY <= pos.y && placementActive) {
                                    const buildPos = new Vec3(pos.x, currentY, pos.z);
                                    const buildBlock = bot.blockAt(buildPos);
                                    
                                    if (buildBlock && buildBlock.name === 'air') {
                                        const belowBuildPos = new Vec3(pos.x, currentY - 1, pos.z);
                                        const belowBuildBlock = bot.blockAt(belowBuildPos);
                                        
                                        if (belowBuildBlock && belowBuildBlock.name !== 'air') {
                                            await bot.placeBlock(belowBuildBlock, new Vec3(0, 1, 0));
                                            placedCount++;
                                            console.log(`↑ Minora: ${buildPos.toString()} (${placedCount}/${totalBlocks})`.blue);
                                            await new Promise(resolve => setTimeout(resolve, 10));
                                        }
                                    }
                                    currentY++;
                                }
                                break;
                            } catch (towerError) {
                                continue;
                            }
                        }
                    }
                }

            } catch (error) {
                console.log(`Xatolik: ${error.message}`.red);
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }

        console.log(`Jami ${placedCount} ta block o'rnatildi! ${skippedCount} ta allaqachon mavjud.`.green);
        
        // AQLLI QAYTA BOSHLASH MANTIQI
        if (placedCount === 0 && skippedCount < totalBlocks * 0.8) {
            console.log("Block qo'yib bo'lmadi. 3 sekunddan keyin qayta...".yellow);
            placementActive = false;
            return setTimeout(() => {
                if (placementActive === false) place();
            }, 3000);
        } else if (placedCount > 0) {
            // Agar muvaffaqiyat bo'lsa, davom etish
            console.log("Keyingi tsiklga o'tish...".cyan);
            placementActive = false;
            setTimeout(() => {
                if (placementActive === false) place();
            }, 200);
        } else {
            console.log("Barcha mumkin bo'lgan blocklar o'rnatildi!".green);
            placementActive = false;
        }
    }

    // ADMIN KOMANDALAR
    bot.on('chat', async (username, message) => {
        if (username == `${admin}`) {
            switch (message) {
                case 'tpa' + nomer:
                    bot.chat(`/tpa ${admin}`);
                    break;
            }
        }
    });

    // XATOLIKLAR VA HODISALAR
    bot.on('kicked', (reason) => {
        console.log(`Bot serverdan chiqarildi: ${reason}`.red);
        placementActive = false;
    });

    bot.on('error', (error) => {
        console.log(`Bot xatolik: ${error.message}`.red);
        placementActive = false;
    });

    bot.on('death', () => {
        bot.chat("/back");
        console.log("BOT O'LDI - qayta tiklash...".red);
        // O'limdan keyin qayta boshlash
        setTimeout(() => {
            if (!placementActive) place();
        }, 5000);
    });

    bot.on('end', () => {
        placementActive = false;
        if (uzfine == "quit" || uzfine == "join") {
            console.log(`Bot ${admin} tomonidan chiqarildi. 5 sekunddan keyin qayta...`.red);
            setTimeout(() => {
                uzfine = "join";
                createBot();
            }, 5000);
        } else {
            console.log("5 SEKUNDDAN KEYIN BOT QAYTA ULANADI".red);
            setTimeout(() => {
                uzfine = "join";
                createBot();
            }, 5000);
        }
    });
}

// DASTUR TUGATISH
process.on('SIGINT', () => {
    console.log('Bot dasturi to\'xtatilmoqda...'.yellow);
    placementActive = false;
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Bot dasturi to\'xtatilmoqda...'.yellow);
    placementActive = false;
    process.exit(0);
});

// BOTNI ISHGA TUSHIRISH
createBot();
