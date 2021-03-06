"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const image_json_1 = __importDefault(require("../data/image.json"));
const colors_1 = require("./colors");
const placeCanvas_1 = require("./placeCanvas");
const utils_1 = require("./utils");
let io;
let clients = [];
let queue = new utils_1.Queue();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        io = new socket_io_1.Server();
        yield getPixelsToDraw();
        io.on('connection', (socket) => {
            console.log('socket connected', socket.id);
            clients.push({
                id: socket.id,
                ratelimitEnd: Date.now(),
                ready: false,
            });
            socket.on('ratelimitUpdate', (rl) => {
                console.log(`updating ratelimit of ${socket.id} to ${rl}`);
                updateClient(socket.id, { ratelimitEnd: rl });
            });
            socket.on('ready', () => {
                updateClient(socket.id, { ready: true, });
                console.log(`client ${socket.id} ready`);
            });
        });
        setInterval(step, 1000);
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            console.log('updating queue...');
            queue = yield getPixelsToDraw();
        }), 10 * 1000);
        const port = parseInt(process.env.PORT) || 3000;
        console.log(`listening on :${port}`);
        io.listen(port);
    });
}
function updateClient(id, newData) {
    const i = clients.findIndex(x => x.id === id);
    clients[i] = Object.assign(Object.assign({}, clients[i]), newData);
}
function getNextFreeClient() {
    return __awaiter(this, void 0, void 0, function* () {
        const c = Object.values(clients).reduce((acc, x) => (x.ready && (acc === null || acc.ratelimitEnd > x.ratelimitEnd)) ? x : acc, null);
        if (!c)
            return null;
        if (c.ratelimitEnd > Date.now()) {
            yield (0, utils_1.sleep)(c.ratelimitEnd - Date.now());
        }
        return c;
    });
}
function step() {
    return __awaiter(this, void 0, void 0, function* () {
        if (queue.isEmpty)
            return;
        let px = queue.dequeue();
        let c = yield getNextFreeClient();
        if (!c || !c.ready) {
            queue.enqueue(px);
            return;
        }
        console.log('sending draw to', c.id);
        io.sockets.sockets.get(c.id).emit('draw', px);
        updateClient(c.id, { ready: false });
    });
}
function getPixelsToDraw() {
    return __awaiter(this, void 0, void 0, function* () {
        let q = new utils_1.Queue();
        const { topLeftX, topLeftY, width, height } = image_json_1.default.props;
        const currentData = yield (0, placeCanvas_1.getPixelsAt)(topLeftX, topLeftY, width, height);
        let total = 0;
        let left = 0;
        for (const [x, y, color] of image_json_1.default.pixels) {
            total++;
            const c = (0, utils_1.getColorAt)(currentData, x, y, width);
            if (colors_1.Colors[c] == color)
                continue;
            let obj = { x: topLeftX + x, y: topLeftY + y, color: color + 1 };
            // console.log('adding to queue', obj);
            q.enqueue(obj);
            left++;
        }
        console.log(`${left}/${total} pixels left`);
        return q;
    });
}
main().catch(console.error);
