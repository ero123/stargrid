import { Renderer } from 'lance-gg';
import Asteroid from './../common/Asteroid';
import Bullet from './../common/Bullet';
import Ship from './../common/Ship';
import FinishLine from "../common/FinishLine";

let ctx = null;
let game = null;
let canvas = null;

export default class AsteroidsRenderer extends Renderer {

    constructor(gameEngine, clientEngine) {
        super(gameEngine, clientEngine);
        game = gameEngine;

        // Init canvas
        canvas = document.createElement('canvas');
        canvas.style.visibility = 'hidden';
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
        document.body.insertBefore(canvas, document.getElementById('logo'));
        game.w = canvas.width;
        game.h = canvas.height;
        game.zoom = game.h / game.spaceHeight;
        if (game.w / game.spaceWidth < game.zoom) game.zoom = game.w / game.spaceWidth;
        ctx = canvas.getContext('2d');
        ctx.lineWidth = 2 / game.zoom;
        ctx.strokeStyle = ctx.fillStyle = 'white';
        ctx.shadowBlur = 10;
        ctx.shadowColor = "white";
        ctx.font = "0.2px ONEDAY";
        ctx.textAlign = "center";
        this.viewer = false;
        this.groupShipPID = null;
    }

    showCanvas() {
        canvas.style.visibility = 'visible';
    }

    hideCanvas() {
        canvas.style.visibility = 'hidden';
    }

    draw(t, dt) {
        super.draw(t, dt);

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Resize the canvas
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
        game.w = window.innerWidth * window.devicePixelRatio;
        game.h = window.innerHeight * window.devicePixelRatio;
        game.zoom = game.h / game.spaceHeight;
        if (game.w / game.spaceWidth < game.zoom) game.zoom = game.w / game.spaceWidth;
        ctx.lineWidth = 2 / game.zoom;


        // Transform the canvas
        // Note that we need to flip the y axis since Canvas pixel coordinates
        // goes from top to bottom, while physics does the opposite.
        ctx.save();
        ctx.translate(game.w/2, game.h/2); // Translate to the center
        // ctx.scale(game.zoom, -game.zoom);  // Zoom in and flip y axis
        ctx.scale(game.zoom, game.zoom); // original y flip doesnt allow for text

        // Draw all things
        //this.drawBounds();
        game.world.forEachObject((_, obj) => {
            if (obj instanceof Ship) {
                this.drawShip(obj.physicsObj, obj.playerId === this.groupShipPID, obj.c_name, obj.v_name);
            } else if (obj instanceof Bullet) {
                this.drawBullet(obj.physicsObj);
            } else if (obj instanceof FinishLine) {
                this.drawFinishLine(obj.physicsObj);
            } else if (obj instanceof Asteroid && (obj.shot || obj.color == "blue" || this.viewer)) {
                this.drawAsteroid(obj.physicsObj, obj.color);
            }
        });

        // update status and restore
        this.updateStatus();
        ctx.restore();
    }

    updateStatus() {
        let playerShip = this.gameEngine.world.queryObject({ playerId: this.groupShipPID });

        if (!playerShip) {
            /*if (this.lives == undefined)
                document.getElementById('gameover').classList.remove('hidden');*/
            return;
        }

        // update score if necessary
        /*
        if (playerShip.playerId === this.groupShipPID && this.score != playerShip.score) {
            document.getElementById('score').innerHTML = 'Score: ' + playerShip.score;
            this.score = playerShip.score;
        }
         */

        // update winning if necessary
        if (playerShip.playerId === this.groupShipPID && playerShip.won) {
            //document.getElementById('gamewin').classList.remove('hidden');
           // this.lives++;
        }
    }

    removeInstructions() {
        document.getElementById('instructions').classList.add('hidden');
        document.getElementById('instructionsMobile').classList.add('hidden');
    }

    drawShip(body, special, c_name, v_name) {
        //let radius = body.shapes[0].radius;
        if (special) {
            ctx.strokeStyle = ctx.fillStyle = "#18CAE6";
            ctx.shadowColor = "#18CAE6";
        }
        ctx.save();
        ctx.translate(body.position[0], body.position[1]); // Translate to the ship center
        ctx.font = "0.2px ONEDAY";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(v_name, 0, -0.63);
        ctx.fillText(c_name, 0, -0.4);
        ctx.rotate(body.angle); // Rotate to ship orientation
        ctx.beginPath();
        for(let j = 0; j < 3; j++) {
            let xv = body.shapes[0].vertices[j][0];
            let yv = body.shapes[0].vertices[j][1];
            if (j == 0) ctx.moveTo(xv, yv);
            else ctx.lineTo(xv, yv);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = ctx.fillStyle = 'white';
        ctx.shadowColor = "white";
    }

    drawFinishLine(body) {
        ctx.strokeStyle = ctx.fillStyle = "#18CAE6";
        ctx.shadowColor = "#18CAE6";
        ctx.save();
        ctx.translate(body.position[0], body.position[1]);  // Translate to the center
        //ctx.fillStyle = '#18CAE6';
        //ctx.rotate(.785);
        ctx.beginPath();
        for(let j = 0; j < game.numAsteroidVerts; j++) {
            let xv = body.verts[j][0];
            let yv = body.verts[j][1];
            if (j == 0) ctx.moveTo(xv, yv);
            else ctx.lineTo(xv, yv);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = "0.3px ONEDAY";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Finish", 0, 0);
        ctx.restore();
        ctx.strokeStyle = ctx.fillStyle = 'white';
        ctx.shadowColor = "white";
    }

    drawAsteroid(body, color = "white") {
        ctx.save();
        ctx.translate(body.position[0], body.position[1]);  // Translate to the center
        ctx.beginPath();
        for(let j = 0; j < game.numAsteroidVerts; j++) {
            let xv = body.verts[j][0];
            let yv = body.verts[j][1];
            if (j == 0) ctx.moveTo(xv, yv);
            else ctx.lineTo(xv, yv);
        }
        ctx.closePath();
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'white';
        ctx.stroke();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = color; //'#3447a2';
        ctx.fill();
        ctx.restore();
    }

    drawBullet(body) {
        console.log("SORRRY FOR PAAARTY ROCKINN")
        ctx.beginPath();
        ctx.arc(body.position[0], body.position[1], game.bulletRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.closePath();
    }

    drawBounds() {
        ctx.beginPath();
        ctx.moveTo(-game.spaceWidth / 2, -game.spaceHeight / 2);
        ctx.lineTo(-game.spaceWidth / 2, game.spaceHeight / 2);
        ctx.lineTo(game.spaceWidth / 2, game.spaceHeight / 2);
        ctx.lineTo(game.spaceWidth / 2, -game.spaceHeight / 2);
        ctx.lineTo(-game.spaceWidth / 2, -game.spaceHeight / 2);
        ctx.closePath();
        ctx.stroke();
    }

}
