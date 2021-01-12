import { GameEngine, P2PhysicsEngine, TwoVector } from 'lance-gg';
import Asteroid from './Asteroid';
import Bullet from './Bullet';
import Ship from './Ship';
import FinishLine from "./FinishLine";
import Maze from "./Maze";

export default class AsteroidsGameEngine extends GameEngine {

    constructor(options) {
        super(options);

        // create physics with no friction; wrap positions after each step
        this.physicsEngine = new P2PhysicsEngine({ gameEngine: this });
        this.physicsEngine.world.defaultContactMaterial.friction = 10;
        this.on('postStep', this.warpAll.bind(this));

        // game variables
        Object.assign(this, {
            lives: 0,
            shipSize: 0.4,
            shipTurnSpeed: 0.035,
            shipSpeed: 4,
            bulletRadius: 0.03,
            bulletLifeTime: 60,
            shootingSpeed: 0.5,
            asteroidRadius: 1.125,
            numAsteroidLevels: 4,
            numAsteroidVerts: 4,
            maxAsteroidSpeed: 0,
            spaceWidth: 16,
            spaceHeight: 9,
            wallWidth: 0.01,
            SHIP: Math.pow(2, 1),
            BULLET: Math.pow(2, 2),
            ASTEROID: Math.pow(2, 3),
            FINISHLINE: Math.pow(2, 4),
        });

        this.playerReady = {};
        this.spawnCoor = new TwoVector(-6.5, 3.75);
    }

    // If the body is out of space bounds, warp it to the other side
    warpAll() {
        this.world.forEachObject((id, obj) => {
            let p = obj.position;
            let v = obj.velocity;
            if (p.x > this.spaceWidth / 2) {
                p.x = this.spaceWidth / 2;
                v.x = 0;
            }
            if (p.y > this.spaceHeight / 2) {
                p.y = this.spaceHeight / 2;
                v.y = 0;
            }
            if (p.x < -this.spaceWidth / 2) {
                p.x = -this.spaceWidth / 2;
                v.x = 0;
            }
            if (p.y < -this.spaceHeight / 2) {
                p.y = -this.spaceHeight / 2;
                v.y = 0;
            }
            obj.refreshToPhysics();
        });

    }

    registerClasses(serializer) {
        serializer.registerClass(Ship);
        serializer.registerClass(Asteroid);
        serializer.registerClass(Bullet);
        serializer.registerClass(FinishLine);
    }

    processInput(inputData, playerId) {
        super.processInput(inputData, playerId);
        if (playerId in this.playerReady && this.playerReady[playerId]) {
            // handle keyboard presses
            let playerShip = this.world.queryObject({ playerId: playerId, instanceType: Ship });
            if (playerShip) {
                if (inputData.input === 'up') {
                    playerShip.physicsObj.applyForceLocal([0, -this.shipSpeed]);
                } else if (inputData.input === 'right') {
                    playerShip.physicsObj.angle += this.shipTurnSpeed;
                } else if (inputData.input === 'left') {
                    playerShip.physicsObj.angle -= this.shipTurnSpeed;
                } else if (inputData.input === 'down') {
                    playerShip.physicsObj.applyForceLocal([0, this.shipSpeed]);
                } else if (inputData.input === 'space') {
                    this.emit('shoot', playerShip);
                }
                playerShip.refreshFromPhysics();
            }
        }
    }

    // create ship
    addShip(playerId, c_name, v_name, groupCode, score = 0, lastShot = 0) {
        let s = new Ship(this, {}, {
            playerId: playerId,
            mass: 10,
            angularVelocity: 0,
            position: this.spawnCoor,
            velocity: new TwoVector(0, 0),
        });
        s.score = score;
        s.won = false;
        s.c_name = c_name;
        s.v_name = v_name;
        s.lastShot = lastShot;
        s.groupCode = groupCode;
        this.addObjectToWorld(s);
    }

    getRandInt(min, max) {
        // Includes min and max.
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    resetAllShips() {
        for (let o of this.world.queryObjects({ instanceType: Ship })) {
            this.resetShip(o);
        }
    }

    resetShip(ship) {
        let old_score = ship.score;
        let c_name = ship.c_name;
        let v_name = ship.v_name;
        let old_pid = ship.playerId;
        let old_gcode = ship.groupCode;
        this.removeObjectFromWorld(ship.id);
        this.addShip(old_pid, c_name, v_name, old_gcode, old_score);
    }


    // asteroid explosion
    explode(asteroid, bullet) {
        // Remove asteroid and bullet
        let asteroidBody = asteroid.physicsObj;
        let level = asteroid.level;
        let x = asteroidBody.position[0];
        let y = asteroidBody.position[1];
        let r = this.asteroidRadius * (this.numAsteroidLevels - level) / this.numAsteroidLevels;

        let sizeX = asteroid.physicsObj.shapes[0].width;
        let sizeY = asteroid.physicsObj.shapes[0].height;
        let posX = asteroid.physicsObj.position[0];
        let posY = asteroid.physicsObj.position[1];
        if (asteroid.breakable) {
            this.removeObjectFromWorld(asteroid);
        } else {
            this.buildBarrier(posX, posY, sizeX, sizeY, true);
        }

        this.removeObjectFromWorld(bullet);


        // Add new sub-asteroids
        /*
        if (level < 3) {
            let angleDisturb = Math.PI/2 * Math.random();
            for (let i=0; i<4; i++) {
                let angle = Math.PI/2 * i + angleDisturb;
                let subAsteroid = new Asteroid(this, {}, {
                    mass: 10,
                    position: new TwoVector(x + r * Math.cos(angle), y + r * Math.sin(angle)),
                    velocity: new TwoVector(0, 0)
                });
                subAsteroid.level = level + 1;
                this.trace.info(() => `creating sub-asteroid with radius ${r}: ${subAsteroid.toString()}`);
                this.addObjectToWorld(subAsteroid);
            }
        }
        */
    }

    buildBarrier(posX, posY, sizeX, sizeY, shot = false) {
        let barrier = new Asteroid(this, {}, {
            mass: 100000,
            position: new TwoVector(posX, posY),
            velocity: new TwoVector(0, 0),
            angularVelocity: 0
        }, new TwoVector(sizeX, sizeY));
        barrier.level = 0;
        barrier.color = "white";
        barrier.shot = shot;
        let obj = this.addObjectToWorld(barrier);
        if (shot) {
            this.timer.add(this.bulletLifeTime, this.destroyBarrier, this, [obj.id]);
        }
    }

    // Add finishline
    addFinishLine(posX, posY) {
        let a = new FinishLine(this, {}, {
            mass: 10000,
            position: new TwoVector(posX, posY),
            velocity: new TwoVector(0, 0),
            angularVelocity: 0
        }, new TwoVector(1, 1));
        a.level = 0;
        this.addObjectToWorld(a);
    }

    removeAllBarriers() {
        for (let o of this.world.queryObjects({ instanceType: Asteroid })) {
            this.removeObjectFromWorld(o.id);
        }
        for (let o of this.world.queryObjects({ instanceType: FinishLine })) {
            this.removeObjectFromWorld(o.id);
        }
    }

    removeAllShips() {
        for (let o of this.world.queryObjects({ instanceType: Ship })) {
            this.removeObjectFromWorld(o.id);
        }
        for (let o of this.world.queryObjects({ instanceType: Bullet })) {
            this.removeObjectFromWorld(o.id);
        }
    }

    destroyBarrier(barrierId) {
        if (this.world.objects[barrierId]) {
            this.trace.trace(() => `barrier[${barrierId}] destroyed`);
            this.removeObjectFromWorld(barrierId);
        }
    }

    /*
     * World Generation Code
     * 10 different levels
     */
    addBarriers(currentWorld) {
        let world_choice = currentWorld;
        while (!world_choice || world_choice === currentWorld) {
            world_choice = this.getRandInt(0, 15);
        }
        switch(world_choice) {
            case 0:
                this.empty_world();
                break;
            case 1:
                this.one_block_world();
                break;
            case 2:
                this.over_middle_under_world();
                break;
            case 3:
                this.s_world();
                break;
            case 4:
                this.enter_the_room();
                break;
            case 5:
                this.crossroads();
                break;
            case 6:
                this.s_tunnel();
                break;
            case 7:
                this.spiral();
                break;
            default:
                this.generated_world();
                break;
        }
        this.addWalls();
        return world_choice;
    }

    addWallBlock(xcoor, ycoor, blockWidth, blockHeight, breakable = false) {
        let mazeBlock = new Asteroid(this, {}, {
            mass: 100000,
            position: new TwoVector(xcoor, ycoor),
            velocity: new TwoVector(0, 0),
            angularVelocity: 0
        }, new TwoVector(blockWidth, blockHeight), breakable);
        mazeBlock.level = 0;
        mazeBlock.color = breakable ? "blue" : "white";
        this.addObjectToWorld(mazeBlock);
    }

    /*
        Some math to explain for the generation:
        1. The maze generated is a matrix of size (2 * maze.width + 1, 2 * maze.height + 1),
            where 1's represent walls and 0's represent space.
            The whole outer border of the matrix is 1's, so we can ignore that since we already add our own walls.
            This means we just need to fill in the maps with the grid size of (2 * maze.width - 1, 2 * maze.height - 1)
            that represents the maze generated without the outer border.

        2. The rest of the code is just adapting this grid to our game space.
            blockWidth and blockHeight are used to figure out how big a block of wall should be.

        TODO:
         1. We should make the walls skinnier so we can fit more maze into the game. Probably require some check for
            consecutive blocks of walls.
         2. I haven't messed with the start and finish points (Currently I'm using the 'diagonal' setting,
            so start is bottom left and end is top right). We can potentially add more interesting variations

        Checkout https://keesiemeijer.github.io/maze-generator/#generate and its github repo.
     */
    generated_world() {
        const maze_gen = new Maze();
        maze_gen.generate();
        const undersizeConstant = 2; // How much smaller to make the walls compared to the actual size
        let blockWidth = this.spaceWidth / (2 * maze_gen.width - 1);
        let blockHeight = this.spaceHeight / (2 * maze_gen.height - 1);
        console.log(maze_gen.matrix);
        console.log(maze_gen.entryNodes);
        for (let x = 1; x < 2 * maze_gen.width; x++) {
            for (let y = 1; y < 2 * maze_gen.height; y++) {
                const breakable = maze_gen.matrix[y].charAt(x) === '2';
                if (maze_gen.matrix[y].charAt(x) !== '0') {
                    let xcoor = blockWidth * (x - maze_gen.width);
                    let ycoor = -blockHeight * (y - maze_gen.height);
                    this.addWallBlock(
                        xcoor,
                        ycoor,
                        blockWidth / undersizeConstant,
                        blockHeight / undersizeConstant,
                        breakable,
                    );

                    // If next horizontal block is also a wall, add a connector
                    if ((x !== 2 * maze_gen.width - 1) && (maze_gen.matrix[y].charAt(x + 1) !== '0')) {
                        this.addWallBlock(
                            xcoor + blockWidth / 2,
                            ycoor,
                            blockWidth / undersizeConstant,
                            blockHeight / undersizeConstant,
                            breakable,
                        );
                    }

                    // If next vertical block is also a wall, add a connector
                    if ((y !== 2 * maze_gen.height - 1) && (maze_gen.matrix[y + 1].charAt(x) !== '0')) {
                        this.addWallBlock(
                            xcoor,
                            ycoor - blockHeight / 2,
                            blockWidth / undersizeConstant,
                            blockHeight / undersizeConstant,
                            breakable,
                        );
                    }

                    // If this is a wall block on the first column
                    if (x === 1) {
                        this.addWallBlock(
                            xcoor - blockWidth / 2 + blockWidth / undersizeConstant / 4,
                            ycoor,
                            blockWidth / undersizeConstant / 2,
                            blockHeight / undersizeConstant,
                            breakable,
                        );
                    }

                    // If this is a wall block on the last column
                    if (x === 2 * maze_gen.width - 1) {
                        this.addWallBlock(
                            xcoor + blockWidth / 2 - blockWidth / undersizeConstant / 4,
                            ycoor,
                            blockWidth / undersizeConstant / 2,
                            blockHeight / undersizeConstant,
                            breakable,
                        );
                    }

                    // If this is a wall block on the first row
                    if (y === 1) {
                        this.addWallBlock(
                            xcoor,
                            ycoor + blockHeight / 2 - blockHeight / undersizeConstant / 4,
                            blockWidth / undersizeConstant,
                            blockHeight / undersizeConstant / 2,
                            breakable,
                        );
                    }

                    // If this is a wall block on the last row
                    if (y === 2 * maze_gen.height - 1) {
                        this.addWallBlock(
                            xcoor,
                            ycoor - blockHeight / 2 + blockHeight / undersizeConstant / 4,
                            blockWidth / undersizeConstant,
                            blockHeight / undersizeConstant / 2,
                            breakable,
                        );
                    }
                }
            }
        }
        this.spawnCoor = new TwoVector(blockWidth * (1 - maze_gen.width), blockHeight * (maze_gen.height - 1));
        this.addFinishLine(blockWidth * (maze_gen.width - 1), -blockHeight * (maze_gen.height - 1));
    }


    addWalls() {
        // this.addWallBlock(0, -this.spaceHeight / 2, this.spaceWidth, this.wallWidth);
        // this.addWallBlock(0, this.spaceHeight / 2, this.spaceWidth, this.wallWidth);
        // this.addWallBlock(-this.spaceWidth, 0, this.wallWidth, this.spaceHeight);
        // this.addWallBlock(this.spaceWidth, 0, this.wallWidth, this.spaceHeight);
    }

    empty_world() {
        this.addFinishLine(6.5, -3.75);
    }

    one_block_world() {
        this.buildBarrier(-5, 1.5, 1, 3);
        this.addFinishLine(6.5, -3.75);
    }

    over_middle_under_world() {
        this.buildBarrier(-5, 1.5, 1, 7);
        this.buildBarrier(5, -1.5, 1, 7);
        this.buildBarrier(0, -3, 1, 4);
        this.buildBarrier(0, 3, 1, 4);
        this.addFinishLine(6.5, -3.75);
    }

    s_world() {
        this.buildBarrier(-1.5, 2, 13, 1);
        this.buildBarrier(1.5, -2, 13, 1);
        this.addFinishLine(6.5, -3.75);
    }

    enter_the_room() {
        this.buildBarrier(-1.5, 2, 13, 1);
        this.buildBarrier(0, -3, 1, 4);
        this.addFinishLine(-6.5, -3.75);
    }

    crossroads() {
        this.buildBarrier(5, 3, 1, 1);
        this.buildBarrier(5, 0, 1, 1);
        this.addFinishLine(5, -3);

        this.buildBarrier(2.5, 3, 1, 1);
        this.buildBarrier(2.5, 0, 1, 1);
        this.buildBarrier(2.5, -3, 1, 1);

        this.buildBarrier(0, 3, 1, 1);
        this.buildBarrier(0, 0, 1, 1);
        this.buildBarrier(0, -3, 1, 1);

        this.buildBarrier(-2.5, 3, 1, 1);
        this.buildBarrier(-2.5, 0, 1, 1);
        this.buildBarrier(-2.5, -3, 1, 1);

        this.buildBarrier(-5, 3, 1, 1);
        this.buildBarrier(-5, 0, 1, 1);
        this.buildBarrier(-5, -3, 1, 1);
    }

    s_tunnel() {
        // Top and Bottom
        this.buildBarrier(0, 5, 11, 1);
        this.buildBarrier(0, -5, 11, 1);

        // Left and Right
        this.buildBarrier(5, -1, 1, 6);
        this.buildBarrier(-5, 1, 1, 6);

        // Middle
        this.buildBarrier(-1, -1.5, 7, 1);
        this.buildBarrier(1, 1.5, 7, 1);

        this.addFinishLine(6.5, -3.75);
    }

    spiral() {
        // Top and Bottom
        this.buildBarrier(0, 7, 11, 1);
        this.buildBarrier(0, -7, 11, 1);

        // Left and Right
        this.buildBarrier(6, 0, 1, 13);
        this.buildBarrier(-5, 1, 1, 6);
        this.buildBarrier(2, 0.5, 1, 3);

        // Middle
        this.buildBarrier(-1, -1.5, 7, 1);
        this.buildBarrier(0, 1.5, 5, 1);

        this.addFinishLine(0, 0);
    }
}
