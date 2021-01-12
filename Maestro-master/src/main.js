import path from 'path';
import express from 'express';
import socketIO from 'socket.io';
import { Lib } from 'lance-gg';
import AsteroidsGameEngine from './common/AsteroidsGameEngine';
import AsteroidsServerEngine from './server/AsteroidsServerEngine';

const PORT = process.env.PORT || 80;
const INDEX = path.join(__dirname, '../dist/index.html');

// define routes and socket
const server = express();
server.get('/', function(req, res) { res.sendFile(INDEX); });
server.use('/', express.static(path.join(__dirname, '../dist/')));
let requestHandler = server.listen(PORT, () => console.log(`Listening on ${ PORT }`));
const io = socketIO(requestHandler);

// Game Instances
const gameEngine = new AsteroidsGameEngine({ traceLevel: Lib.Trace.TRACE_NONE });
const serverEngine = new AsteroidsServerEngine(io, gameEngine, {
    debug: {},
    updateRate: 6,
    timeoutInterval: 0
});

// start the game
serverEngine.start();
