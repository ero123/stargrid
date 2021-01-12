import { PhysicalObject2D, BaseTypes } from 'lance-gg';

let game = null;
let p2 = null;

export default class FinishLine extends PhysicalObject2D {

    constructor(gameEngine, options, props, dim) {
        super(gameEngine, options, props);
        this.dim = dim;
    }

    static get netScheme() {
        return Object.assign({
            level: { type: BaseTypes.TYPES.INT16 },
            dim: { type: BaseTypes.TYPES.CLASSINSTANCE }
        }, super.netScheme);
    }

    // position bending: bend fully to server position in each sync [percent=1.0],
    // unless the position difference is larger than 4.0 (i.e. wrap beyond bounds)
    get bending() {
        return { position: { max: 4.0 } };
    }

    // on add-to-world, create a physics body
    onAddToWorld() {
        game = this.gameEngine;
        p2 = game.physicsEngine.p2;
        this.physicsObj = new p2.Body({
            mass: this.mass, damping: 0, angularDamping: 0,
            position: [this.position.x, this.position.y],
            velocity: [this.velocity.x, this.velocity.y]
        });
        this.physicsObj.addShape(new p2.Box({
            width: this.dim.x,
            height: this.dim.y,
            collisionGroup: game.FINISHLINE, // Belongs to the ASTEROID group
            collisionMask: game.SHIP // Can collide with SHIP group
        }));
        this.addFinishLineVerts();
        game.physicsEngine.world.addBody(this.physicsObj);
    }

    addFinishLineVerts() {
        let width = this.physicsObj.shapes[0].width;
        let height = this.physicsObj.shapes[0].height;
        this.physicsObj.verts = [
            [-width / 2, -height / 2],
            [-width / 2, height / 2],
            [width / 2, height / 2],
            [width / 2, -height / 2],
        ];
    }

    // on remove-from-world, remove the physics body
    onRemoveFromWorld() {
        game.physicsEngine.world.removeBody(this.physicsObj);
    }

    syncTo(other) {
        super.syncTo(other);
        this.dim = other.dim;
    }

    toString() {
        return `FinishLine::${super.toString()} Level${this.level}`;
    }
}
