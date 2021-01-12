import { ClientEngine, KeyboardControls } from 'lance-gg';
import AsteroidsRenderer from '../client/AsteroidsRenderer';
import Utils from "lance-gg/src/lib/Utils";
import io from 'socket.io-client';
const $ = require('jquery');


export default class AsteroidsClientEngine extends ClientEngine {

    constructor(gameEngine, options) {
        super(gameEngine, options, AsteroidsRenderer);
        this.playerOptions = options.playerOptions;
        //  Game input
        document.querySelector('#instructions').classList.remove('hidden');
        window.addEventListener('resize', this.resizeGame, false);
        this.controls = new KeyboardControls(this);
        this.controls.bindKey('up', 'up', { repeat: true } );
        this.controls.bindKey('down', 'down', { repeat: true } );
        this.controls.bindKey('left', 'left', { repeat: true } );
        this.controls.bindKey('right', 'right', { repeat: true } );
        this.controls.bindKey('space', 'space');
        this.gameStarted = false;
    }

    /**
     * Makes a connection to the game server.  Extend this method if you want to add additional
     * logic on every connection. Call the super-class connect first, and return a promise which
     * executes when the super-class promise completes.
     *
     * @param {Object} [options] additional socket.io options
     * @return {Promise} Resolved when the connection is made to the server
     */
    connect(options = {}) {

        let connectSocket = matchMakerAnswer => {
            return new Promise((resolve, reject) => {

                if (matchMakerAnswer.status !== 'ok')
                    reject('matchMaker failed status: ' + matchMakerAnswer.status);

                if (this.options.verbose)
                    console.log(`connecting to game server ${matchMakerAnswer.serverURL}`);
                this.socket = io(matchMakerAnswer.serverURL, options);

                this.networkMonitor.registerClient(this);

                $('#start-button').click(() => {
                    this.socket.emit('playerReady');
                    // document.getElementById('start-button').style.visibility = 'hidden';
                });
                $('#switch-button').click(() => {
                    this.socket.emit('playerSwitchRole');
                });

                this.socket.on('connect', () => {
                    if (this.options.verbose)
                        console.log('connection made');
                    resolve();
                });

                this.socket.on('error', (error) => {
                    reject(error);
                });

                this.socket.on('playerJoined', (playerData) => {
                    this.gameEngine.playerId = playerData.playerId;
                    this.messageIndex = Number(this.gameEngine.playerId) * 10000;
                    this.socket.emit('playerDataUpdate', this.playerOptions);
                });

                this.socket.on('waitingForPlayer', () => {
                    $('#share_link').show()
                    this.renderer.hideCanvas();
                    document.querySelector('#instructions').classList.remove('hidden');
                    document.getElementById('waiting-room-overlay').style.display = 'block';
                    document.getElementById('waiting-room-container').style.display = 'block';
                });

                this.socket.on('gameStaging', (data) => {
                    console.log('gameStaging received');
                    $('#share_link').hide();
                    $('#staging_alert').show();
                    let counter = data.gameStagingTime;
                    let interval = setInterval(function() {
                        counter--;
                        $('#staging_alert').html(`GAME STARTS IN ${counter} SECONDS!`);
                        if (counter === 0) {
                            $('#staging_alert').fadeOut();
                            clearInterval(interval);
                        }
                    }, 1000);
                });

                this.socket.on('gameBegin', (data) => {
                    $('#share_link').hide();
                    document.querySelector('#instructions').classList.add('hidden');
                    $('#waiting-room-overlay').css("display", "none");
                    $('#game_start_banner').html(`GAME START, FIRST TO ${data.winningScore} WINS!`);
                    $('#game_start_banner').show().delay(data.gameStagingTime).fadeOut();
                    this.viewer = this.renderer.viewer = data.viewer;
                    this.gameStarted = true;
                    this.gameEngine.playerReady[this.gameEngine.playerId] = true;
                    this.renderer.groupShipPID = data.ship_pid;
                    this.renderer.showCanvas();
                });

                this.socket.on('gameWon', (data) => {
                    this.gameStarted = false;
                    document.getElementById('winning_banner').innerHTML = `Winners:`
                        + `<br >`
                        + `${data.winningPlayers[0]} and ${data.winningPlayers[1]}`;
                    $('#winning_banner').show().delay(5000).fadeOut();
                    if (data.isSelf) {
                        $('#winning_soundclip').trigger("play");
                    }
                });

                this.socket.on('scoreboardUpdate', (data) => {
                    data.scoreboard.sort((a, b) => (a.score < b.score) ? 1 : -1);
                    $('#scoreboard').empty()
                    for (let obj of data.scoreboard) {
                        $(`<div>${obj.name}: ${obj.score}</div>`)
                            .addClass( (obj.name === data.own_name) ? 'blueFont' : 'whiteFont' )
                            .appendTo('#scoreboard');
                    }
                });

                this.socket.on('groupFull', () => {
                    window.alert('Group is full, please join/create another group.');
                    document.getElementById('name-prompt-overlay').style.display = 'block';
                    document.getElementById('name-prompt-container').style.display = 'block';

                    // Unbind from current socket, otherwise the next click will send two ready msgs to server.
                    $('#start-button').off('click');
                    $('#switch-button').off('click');
                });

                this.socket.on('groupUpdate', (groupData) => {
                    if (this.gameStarted) {
                        document.getElementById('other_player_disconnect').style.display = 'block';
                    } else {
                        document.getElementById('controller_label').innerHTML = groupData.c_playerName;
                        document.getElementById('viewer_label').innerHTML = groupData.v_playerName;
                        document.getElementById('controller_ready_img').style.visibility =
                            (groupData.c_ready ? 'visible' : 'hidden');
                        document.getElementById('viewer_ready_img').style.visibility =
                            (groupData.v_ready ? 'visible' : 'hidden');
                    }
                });

                this.socket.on('worldUpdate', (worldData) => {
                    this.inboundMessages.push(worldData);
                });

                this.socket.on('roomUpdate', (roomData) => {
                    this.gameEngine.emit('client__roomUpdate', roomData);
                });

                this.socket.on('disconnect', (reason) => {
                    console.log(reason);
                    window.alert('Server disconnected. Please refresh when server is available.');
                    this.socket.disconnect();
                });

            });
        };

        let matchmaker = Promise.resolve({ serverURL: this.options.serverURL, status: 'ok' });
        if (this.options.matchmaker)
            matchmaker = Utils.httpGetPromise(this.options.matchmaker);

        return matchmaker.then(connectSocket);
    }
}
