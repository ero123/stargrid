import { PhysicalObject2D, BaseTypes } from 'lance-gg';

let game = null;
let p2 = null;

export default class Ship extends PhysicalObject2D {

    static get netScheme() {
        return Object.assign({
            score: { type: BaseTypes.TYPES.INT8 },
            won: { type: BaseTypes.TYPES.INT8 },
            c_name: { type: BaseTypes.TYPES.STRING },
            v_name: { type: BaseTypes.TYPES.STRING },
            lastShot: { type: BaseTypes.TYPES.INT16 },
            groupCode: { type: BaseTypes.TYPES.STRING },
        }, super.netScheme);
    }

    // no position bending if difference is larger than 4.0 (i.e. wrap beyond bounds),
    // no angular velocity bending, no local angle bending
    get bending() {
        return {
            position: { max: 4.0 },
            angularVelocity: { percent: 0.0 },
            angleLocal: { percent: 0.0 }
        };
    }

    onAddToWorld(gameEngine) {
        game = gameEngine;
        p2 = gameEngine.physicsEngine.p2;

        // Add ship physics
        let shape = this.shape = new p2.Convex({
            vertices: [[-game.shipSize*0.6, game.shipSize], [0, -game.shipSize], [game.shipSize*0.6, game.shipSize]],
            radius: game.shipSize,
            collisionGroup: game.SHIP, // Belongs to the SHIP group
            collisionMask: game.ASTEROID | game.FINISHLINE // Only collide with the ASTEROID group
        });
        this.physicsObj = new p2.Body({
            mass: 1,
            position: [this.position.x, this.position.y],
            angle: this.angle,
            damping: .7,
            angularDamping: .7
        });
        this.physicsObj.addShape(shape);
        gameEngine.physicsEngine.world.addBody(this.physicsObj);
    }

    onRemoveFromWorld(gameEngine) {
        game.physicsEngine.world.removeBody(this.physicsObj);
    }

    toString() {
        return `Ship::${super.toString()} score=${this.score}`;
    }

    syncTo(other) {
        super.syncTo(other);
        this.score = other.score;
        this.won = other.won;
        this.c_name = other.c_name;
        this.v_name = other.v_name;
        this.lastShot = other.lastShot;
        this.groupCode = other.groupCode;
    }
}
