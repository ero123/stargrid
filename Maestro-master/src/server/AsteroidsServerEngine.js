import { ServerEngine, TwoVector } from 'lance-gg';
import Asteroid from '../common/Asteroid';
import Bullet from '../common/Bullet';
import Ship from '../common/Ship';
import FinishLine from "../common/FinishLine";

export default class AsteroidsServerEngine extends ServerEngine {

    constructor(io, gameEngine, inputOptions) {
        super(io, gameEngine, inputOptions);
        gameEngine.physicsEngine.world.on('beginContact', this.handleCollision.bind(this));
        gameEngine.on('shoot', this.shoot.bind(this));
        this.groupsReady = [];
        this.playerGroups = {};
        this.scoreboard = {};
        this.currentWorld = 0;
        // maps groupCode -> {
        // c_playerID : int,
        // c_playerName : str,
        // c_socketID : int,
        // v_playerID : int,
        // v_playerName : int,
        // v_socketID : int,
        // full : bool,
        // c_ready : bool,
        // v_ready : bool,
        // gameStarted: bool
        // };
        this.io = io;

        this.roundStarted = false;
        this.stagingStarted = false;
        this.winningScore = 5;
        this.gameStagingTime = 5; // in seconds
    }

    // handle a collision on server only
    handleCollision(evt) {
        // identify the two objects which collided
        let A;
        let B;
        this.gameEngine.world.forEachObject((id, obj) => {
            if (obj.physicsObj === evt.bodyA) A = obj;
            if (obj.physicsObj === evt.bodyB) B = obj;
        });

        // check bullet-asteroid and ship-asteroid collisions
        if (!A || !B) return;
        this.gameEngine.trace.trace(() => `collision between A=${A.toString()}`);
        this.gameEngine.trace.trace(() => `collision and     B=${B.toString()}`);
        if (A instanceof Bullet && B instanceof Asteroid) this.gameEngine.explode(B, A);
        if (B instanceof Bullet && A instanceof Asteroid) this.gameEngine.explode(A, B);
        if (A instanceof Ship && B instanceof Asteroid) this.gameEngine.resetShip(A);
        if (B instanceof Ship && A instanceof Asteroid) this.gameEngine.resetShip(B);
        if (A instanceof Ship && B instanceof FinishLine) this.gameWon(A);
        if (B instanceof Ship && A instanceof FinishLine) this.gameWon(B);
    }

    // shooting creates a bullet
    shoot(player) {
        const RATE_OF_FIRE = 30;
        const currentTime = this.gameEngine.timer.currentTime;
        if (player.lastShot === 0 || currentTime >= player.lastShot + RATE_OF_FIRE) {
            player.lastShot = currentTime;
            let radius = this.gameEngine.shipSize;
            let angle = -player.physicsObj.angle + Math.PI / 2;
            let bullet = new Bullet(this.gameEngine, {}, {
                mass: 0.05,
                position: new TwoVector(
                    radius * Math.cos(angle) + player.physicsObj.position[0],
                    -radius * Math.sin(angle) + player.physicsObj.position[1]
                ),
                velocity: new TwoVector(
                    2 * Math.cos(angle) + player.physicsObj.velocity[0],
                    -2 * Math.sin(angle) + player.physicsObj.velocity[1]
                ),
                angularVelocity: 0
            });
            let obj = this.gameEngine.addObjectToWorld(bullet);
            this.gameEngine.timer.add(
                this.gameEngine.bulletLifeTime,
                this.destroyBullet,
                this,
                [obj.id]
            );
        }
    }

    // destroy the missile if it still exists
    destroyBullet(bulletId) {
        if (this.gameEngine.world.objects[bulletId]) {
            this.gameEngine.trace.trace(() => `bullet[${bulletId}] destroyed`);
            this.gameEngine.removeObjectFromWorld(bulletId);
        }
    }

    gameWon(ship) {
        ship.won = true;
        ship.score++;
        this.scoreboard[ship.groupCode]++;
        this.sendScoreboardUpdate();
        if (ship.score === this.winningScore) {
            this.finishRound(ship.groupCode);
        } else {
            this.gameEngine.removeAllBarriers();
            // restart game
            if (this.gameEngine.world.queryObjects({instanceType: Asteroid}).length === 0) {
                console.log("restarting");
                this.currentWorld = this.gameEngine.addBarriers(this.currentWorld);
                this.gameEngine.resetAllShips();
            } else {
                console.log("Error: not all barriers were removed.");
            }
        }
    }

    sendGroupUpdate(groupCode) {
        if (groupCode) {
            if (this.playerGroups[groupCode].c_socketID) {
                this.io.to(this.playerGroups[groupCode].c_socketID).emit('groupUpdate', this.playerGroups[groupCode]);
            }
            if (this.playerGroups[groupCode].v_socketID) {
                this.io.to(this.playerGroups[groupCode].v_socketID).emit('groupUpdate', this.playerGroups[groupCode]);
            }
        }
    }

    sendScoreboardUpdate() {
        let scoreboard_converted = [];
        for (let groupCode of Object.keys(this.scoreboard)) {
            scoreboard_converted.push({
                score : this.scoreboard[groupCode],
                name : `${this.playerGroups[groupCode].c_playerName} and ${this.playerGroups[groupCode].v_playerName}`
            });
        }
        for (let groupCode of this.groupsReady) {
            let group = this.playerGroups[groupCode];
            this.io.to(group.c_socketID).emit('scoreboardUpdate', {
                scoreboard: scoreboard_converted,
                own_name: `${this.playerGroups[groupCode].c_playerName} and ${this.playerGroups[groupCode].v_playerName}`,
            });
            this.io.to(group.v_socketID).emit('scoreboardUpdate', {
                scoreboard: scoreboard_converted,
                own_name: `${this.playerGroups[groupCode].c_playerName} and ${this.playerGroups[groupCode].v_playerName}`,
            });
        }
    }

    // Getting ready to start round
    staging() {
        console.log('Staging started');
        this.stagingStarted = true;
        for (let socketId of Object.keys(this.connectedPlayers)) {
            this.io.to(socketId).emit('gameStaging', {
                gameStagingTime : this.gameStagingTime
            });
        }

        // Delay game start by 15 seconds
        setTimeout(() => {
            console.log('timeoutfn called');
            this.startRound();
        }, this.gameStagingTime * 1000);
    }

    // Start round for all players who are ready
    startRound() {
        console.log('Round started');
        this.scoreboard = {};
        this.stagingStarted = false;
        this.roundStarted = true;
        this.gameEngine.addBarriers();
        for (let groupCode of this.groupsReady) {
            this.enterRound(groupCode);
        }
        this.sendScoreboardUpdate();
    }

    // Start game for group who joins a started round
    enterRound(groupCode) {
        this.scoreboard[groupCode] = 0;
        let group = this.playerGroups[groupCode];
        this.gameEngine.addShip(group.c_playerID, group.c_playerName, group.v_playerName, groupCode);
        this.gameEngine.playerReady[group.c_playerID] = true;

        this.io.to(group.c_socketID).emit('gameBegin', {
            ship_pid : group.c_playerID,
            viewer : false,
            winningScore : this.winningScore
        });
        this.io.to(group.v_socketID).emit('gameBegin', {
            ship_pid : group.c_playerID,
            viewer : true,
            winningScore : this.winningScore
        });
        this.playerGroups[groupCode].gameStarted = true;
    }

    finishRound(winningGroupCode) {
        this.roundStarted = false;
        this.gameEngine.removeAllBarriers();
        this.gameEngine.removeAllShips();
        let winningPlayers = [
            this.playerGroups[winningGroupCode].c_playerName,
            this.playerGroups[winningGroupCode].v_playerName
        ];
        for (let groupCode of this.groupsReady) {
            let group = this.playerGroups[groupCode];
            this.io.to(group.c_socketID).emit('gameWon', {
                winningPlayers : winningPlayers,
                isSelf : groupCode === winningGroupCode
            });
            this.io.to(group.v_socketID).emit('gameWon', {
                winningPlayers : winningPlayers,
                isSelf : groupCode === winningGroupCode
            });
            this.playerGroups[groupCode].c_ready = false;
            this.playerGroups[groupCode].v_ready = false;
            this.io.to(group.c_socketID).emit('waitingForPlayer');
            this.io.to(group.v_socketID).emit('waitingForPlayer');
            this.sendGroupUpdate(groupCode);
        }
        this.groupsReady = [];

    }

    onPlayerConnected(socket) {
        super.onPlayerConnected(socket);
        let that = this;
        socket.on('playerDataUpdate', function(data) {
            that.connectedPlayers[socket.id].playerName = data.playerName;
            that.connectedPlayers[socket.id].privateCode = data.privateCode;
            if (data.privateCode in that.playerGroups) {
                if (that.playerGroups[data.privateCode].full) {
                    that.connectedPlayers[socket.id].privateCode = null;
                    socket.emit('groupFull');
                } else {
                    if (that.playerGroups[data.privateCode].v_playerID === null) {
                        that.playerGroups[data.privateCode].v_playerID = socket.playerId;
                        that.playerGroups[data.privateCode].v_playerName = data.playerName;
                        that.playerGroups[data.privateCode].v_socketID = socket.id;
                        that.playerGroups[data.privateCode].full = true;
                        socket.emit('waitingForPlayer');
                        that.sendGroupUpdate(data.privateCode);
                    } else {
                        that.playerGroups[data.privateCode].c_playerID = socket.playerId;
                        that.playerGroups[data.privateCode].c_playerName = data.playerName;
                        that.playerGroups[data.privateCode].c_socketID = socket.id;
                        that.playerGroups[data.privateCode].full = true;
                        socket.emit('waitingForPlayer');
                        that.sendGroupUpdate(data.privateCode);
                    }
                }
            } else {
                that.playerGroups[data.privateCode] = {
                    c_playerID : socket.playerId,
                    c_playerName : data.playerName,
                    c_socketID : socket.id,
                    v_playerID : null,
                    v_playerName : null,
                    v_socketID : null,
                    full : false,
                    c_ready : false,
                    v_ready : false,
                    gameStarted: false
                };
                socket.emit('waitingForPlayer');
                that.sendGroupUpdate(data.privateCode);
            }
        });

        socket.on('playerReady', function() {
            let groupCode = that.connectedPlayers[socket.id].privateCode;
            if (that.playerGroups[groupCode].v_socketID === socket.id) {
                that.playerGroups[groupCode].v_ready = !that.playerGroups[groupCode].v_ready;
            } else {
                that.playerGroups[groupCode].c_ready = !that.playerGroups[groupCode].c_ready;
            }
            that.sendGroupUpdate(groupCode);

            // Check for start game
            let group = that.playerGroups[groupCode];
            if (group.v_ready && group.c_ready) {
                that.groupsReady.push(groupCode);

                if (that.roundStarted) {
                    that.enterRound(groupCode);
                    that.sendScoreboardUpdate();
                } else if (!that.stagingStarted){
                    that.staging();
                }
            } else {
                that.groupsReady = that.groupsReady.filter(gc => (gc !== groupCode));
            }
            console.log(`Groups ready: ${that.groupsReady}`);
        });

        socket.on('playerSwitchRole', function() {
            let groupCode = that.connectedPlayers[socket.id].privateCode;
            let switchedGroup = {
                c_playerID : that.playerGroups[groupCode].v_playerID,
                c_playerName : that.playerGroups[groupCode].v_playerName,
                c_socketID : that.playerGroups[groupCode].v_socketID,
                v_playerID : that.playerGroups[groupCode].c_playerID,
                v_playerName : that.playerGroups[groupCode].c_playerName,
                v_socketID : that.playerGroups[groupCode].c_socketID,
                full : that.playerGroups[groupCode].full,
                c_ready : that.playerGroups[groupCode].v_ready,
                v_ready : that.playerGroups[groupCode].c_ready,
                gameStarted: false
            }
            that.playerGroups[groupCode] = switchedGroup;
            that.sendGroupUpdate(groupCode);
        });
    }

    onPlayerDisconnected(socketId, playerId) {
        let group_code = this.connectedPlayers[socketId].privateCode;
        super.onPlayerDisconnected(socketId, playerId);
        if (group_code && this.playerGroups[group_code]) {
            if (playerId === this.playerGroups[group_code].c_playerID) {
                this.playerGroups[group_code].c_playerID = null;
                this.playerGroups[group_code].c_socketID = null;
                this.playerGroups[group_code].c_playerName = null;
                this.playerGroups[group_code].c_ready = false;
                this.playerGroups[group_code].full = false;
                if (this.playerGroups[group_code].v_socketID) {
                    this.io.to(this.playerGroups[group_code].v_socketID).emit('groupUpdate', this.playerGroups[group_code]);
                }
            } else {
                this.playerGroups[group_code].v_playerID = null;
                this.playerGroups[group_code].v_socketID = null;
                this.playerGroups[group_code].v_playerName = null;
                this.playerGroups[group_code].v_ready = false;
                this.playerGroups[group_code].full = false;
                if (this.playerGroups[group_code].c_socketID) {
                    this.io.to(this.playerGroups[group_code].c_socketID).emit('groupUpdate', this.playerGroups[group_code]);
                }
            }

            // Remove the group of the player that left from groupsReady.
            this.groupsReady = this.groupsReady.filter(gc => (gc !== group_code));

            //Removes player from scoreboard and send update
            delete this.scoreboard[group_code];
            this.sendScoreboardUpdate();

            if (this.playerGroups[group_code] && this.playerGroups[group_code].c_socketID === null && this.playerGroups[group_code].v_socketID === null) {
                delete this.playerGroups[group_code];
            }

            if (this.playerGroups[group_code] && this.playerGroups[group_code].c_playerID && playerId !== this.playerGroups[group_code].c_playerID) {
                for (let o of this.gameEngine.world.queryObjects({
                    playerId : this.playerGroups[group_code].c_playerID
                })) {
                    this.gameEngine.removeObjectFromWorld(o.id);
                }
            }
        }
        for (let o of this.gameEngine.world.queryObjects({ playerId }))
            this.gameEngine.removeObjectFromWorld(o.id);

    }
}
