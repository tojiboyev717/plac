const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const fs = require('fs');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

const botId = process.argv[2];
const configFile = process.env.BOT_CONFIG_FILE || `bot-config-${botId}.json`;

let config;
try {
    config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
} catch {
    process.exit(1);
}

const nomer = config.nomer || "1";
const p1 = config.p1 || [0, 64, 0];
const p2 = config.p2 || [0, 64, 0];
const auto_place = config.auto_place || "true";
const anti_spawn = config.anti_spawn || "true";
const admin = config.admin || "admin";
const username = config.username || "bot";
const pswd = config.pswd || "password";
const warp = config.warp || "home";
const blockType = config.blockType || "cobblestone";

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
    if (anti_spawn == "true") {
        if (uzfine == "join") {
            uzfine = "starting";
            delay(uz_fine);
        }
    }

    const bot = mineflayer.createBot({
        host: "hypixel.uz",
        port: 25566,
        username: username,
        version: '1.18.2'
    });

    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        if (uzfine == "starting") uzfine = "login";

        const mcData = require('minecraft-data')(bot.version);
        const movements = new Movements(bot, mcData);
        movements.canDig = false;
        movements.allow1by1towers = false;
        movements.scafoldingBlocks = [];
        movements.blocksCantBreak.add(mcData.blocksByName.bedrock.id);
        movements.blocksCantBreak.add(mcData.blocksByName.barrier.id);
        movements.digCost = 0;
        movements.placeCost = 0;
        bot.pathfinder.setMovements(movements);

        if (auto_place == "true" && uzfine == "login") {
            setTimeout(() => {
                if (!placementActive) place();
            }, 3000);
            setTimeout(() => {
                bot.chat('/is warp ' + warp);
            }, 1000);
        }
    });

    bot.on('messagestr', (message) => {
        if (message.includes('register')) bot.chat('/register ' + pswd + ' ' + pswd);
        if (message.includes('login')) bot.chat('/login ' + pswd);
        if (uzfine == "login") uzfine = "0";
    });

    bot.on('chat', (username, message) => {
        if (username === admin && message.indexOf('!' + nomer + ' ') !== -1) {
            bot.chat(message.replace('!' + nomer + ' ', ''));
        } else if (username === admin && message.indexOf('! ') !== -1) {
            bot.chat(message.replace('! ', ''));
        }
    });

    bot.on('whisper', async (username, message) => {
        if (username == admin) {
            if (message === 'quit' || message === 'quit' + nomer) {
                bot.quit();
                uzfine = "quit";
            } else if (message === 'start' + nomer || message === 'start') {
                if (!placementActive) place();
            } else if (message === 'stop' + nomer || message === 'stop') {
                placementActive = false;
            }
        }
    });

    if (auto_place == "false") {
        bot.on('chat', async (username, message) => {
            if (username == admin && (message === 'run' || message === 'run' + nomer)) {
                if (!placementActive) place();
            }
        });
    }

    function range(p1, p2) {
        p1 = parseInt(p1);
        p2 = parseInt(p2);
        let res = [];
        if (p1 > p2) {
            for (let j = p1; j >= p2; j--) res.push(j);
        } else {
            for (let j = p1; j <= p2; j++) res.push(j);
        }
        return res;
    }

    const xrange = range(p1[0], p2[0]);
    const yrange = range(p1[1], p2[1]);
    const zrange = range(p1[2], p2[2]);

    async function getBlockFromChestIfEmpty() {
        try {
            bot.chat("/is visit FORTUNE_04");
            await bot.waitForTicks(100);

            const chestPos = new Vec3(6193, 54, -1363);
            const chestBlock = bot.blockAt(chestPos);
            if (!chestBlock || !bot.openChest) return false;

            const chest = await bot.openChest(chestBlock);
            await bot.waitForTicks(20);

            const items = chest.containerItems().filter(item => item.name === blockType);
            if (items.length === 0) {
                chest.close();
                return false;
            }

            let totalTaken = 0;
            for (const item of items) {
                try {
                    const countToTake = item.count;
                    await chest.withdraw(item.type, null, countToTake);
                    totalTaken += countToTake;
                } catch (e) {
                    if (e.message.includes("destination full")) break;
                }
            }

            await bot.waitForTicks(20);
            chest.close();
            return totalTaken > 0;
        } catch {
            return false;
        } finally {
            bot.chat("/back");
            await bot.waitForTicks(80);
        }
    }

    async function place() {
        if (placementActive) return;
        placementActive = true;

        let currentBlockItem = bot.inventory.items().find(item => item.name === blockType);
        if (!currentBlockItem) {
            const success = await getBlockFromChestIfEmpty();
            if (!success) {
                placementActive = false;
                return setTimeout(() => {
                    if (!placementActive) place();
                }, 5000);
            }
            currentBlockItem = bot.inventory.items().find(item => item.name === blockType);
            if (!currentBlockItem) {
                placementActive = false;
                return setTimeout(() => {
                    if (!placementActive) place();
                }, 5000);
            }
        }

        const sortedPositions = [];
        for (let y of yrange) for (let x of xrange) for (let z of zrange)
            sortedPositions.push(new Vec3(x, y, z));
        sortedPositions.sort((a, b) => a.y - b.y);

        for (let pos of sortedPositions) {
            if (!placementActive) return;

            try {
                let block = bot.blockAt(pos);
                if (!block || block.name !== 'air') continue;

                let currentBlockItem = bot.inventory.items().find(item => item.name === blockType);
                if (!currentBlockItem) {
                    const success = await getBlockFromChestIfEmpty();
                    if (!success) {
                        placementActive = false;
                        return setTimeout(() => {
                            if (!placementActive) place();
                        }, 5000);
                    }
                }

                const distance = bot.entity.position.distanceTo(pos);
                if (distance > 4.5) {
                    try {
                        bot.pathfinder.setGoal(new goals.GoalNear(pos.x, pos.y, pos.z, 4));
                        await new Promise((resolve) => {
                            const timeout = setTimeout(resolve, 2000);
                            const checkPosition = setInterval(() => {
                                if (bot.entity.position.distanceTo(pos) <= 4.5) {
                                    clearInterval(checkPosition);
                                    clearTimeout(timeout);
                                    resolve();
                                }
                            }, 100);
                        });
                    } catch {
                        const dx = pos.x - bot.entity.position.x;
                        const dz = pos.z - bot.entity.position.z;
                        bot.look(Math.atan2(-dx, -dz), 0);
                        bot.setControlState('forward', true);
                        bot.setControlState('sprint', true);
                        await new Promise(resolve => setTimeout(resolve, 300));
                        bot.setControlState('forward', false);
                        bot.setControlState('sprint', false);
                    }
                }

                if (!bot.heldItem || bot.heldItem.name !== blockType) {
                    await bot.equip(currentBlockItem, 'hand');
                }

                const offsets = [
                    new Vec3(0, -1, 0), new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
                    new Vec3(0, 0, 1), new Vec3(0, 0, -1), new Vec3(0, 1, 0)
                ];

                let placed = false;
                for (let offset of offsets) {
                    const refPos = pos.plus(offset);
                    const referenceBlock = bot.blockAt(refPos);
                    if (referenceBlock && referenceBlock.name !== 'air' && referenceBlock.name !== 'water' && referenceBlock.name !== 'lava') {
                        try {
                            const faceVector = pos.minus(refPos);
                            await bot.placeBlock(referenceBlock, faceVector);
                            placed = true;
                            await new Promise(resolve => setTimeout(resolve, 10));
                            break;
                        } catch { continue; }
                    }
                }

                if (!placed) {
                    for (let y = pos.y - 1; y >= Math.min(...yrange) - 5; y--) {
                        const groundPos = new Vec3(pos.x, y, pos.z);
                        const groundBlock = bot.blockAt(groundPos);
                        if (groundBlock && groundBlock.name !== 'air') {
                            try {
                                let currentY = y + 1;
                                while (currentY <= pos.y && placementActive) {
                                    const buildPos = new Vec3(pos.x, currentY, pos.z);
                                    const buildBlock = bot.blockAt(buildPos);
                                    if (buildBlock && buildBlock.name === 'air') {
                                        const belowBuildBlock = bot.blockAt(new Vec3(pos.x, currentY - 1, pos.z));
                                        if (belowBuildBlock && belowBuildBlock.name !== 'air') {
                                            await bot.placeBlock(belowBuildBlock, new Vec3(0, 1, 0));
                                            await new Promise(resolve => setTimeout(resolve, 10));
                                        }
                                    }
                                    currentY++;
                                }
                                break;
                            } catch { continue; }
                        }
                    }
                }

            } catch {
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }

        placementActive = false;
        setTimeout(() => {
            if (!placementActive) place();
        }, 200);
    }

    bot.on('chat', async (username, message) => {
        if (username == `${admin}` && message === 'tpa' + nomer) {
            bot.chat(`/tpa ${admin}`);
        }
    });

    bot.on('kicked', () => placementActive = false);
    bot.on('error', () => placementActive = false);

    bot.on('death', () => {
        bot.chat("/back");
        setTimeout(() => {
            if (!placementActive) place();
        }, 5000);
    });

    bot.on('end', () => {
        placementActive = false;
        setTimeout(() => {
            uzfine = "join";
            createBot();
        }, 5000);
    });
}

process.on('SIGINT', () => {
    placementActive = false;
    process.exit(0);
});
process.on('SIGTERM', () => {
    placementActive = false;
    process.exit(0);
});

createBot();
