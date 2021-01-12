import querystring from 'query-string';
import { Lib } from 'lance-gg';
import AsteroidsClientEngine from '../client/AsteroidsClientEngine';
import AsteroidsGameEngine from '../common/AsteroidsGameEngine';
const qsOptions = querystring.parse(location.search);
const $ = require('jquery');

// default options, overwritten by query-string options
// is sent to both game engine and client engine
const defaults = {
    traceLevel: Lib.Trace.TRACE_NONE,
    delayInputCount: 5,
    scheduler: 'render-schedule',
    syncOptions: {
        sync: qsOptions.sync || 'extrapolate',
        localObjBending: 0.8,
        remoteObjBending: 1.0,
        bendingIncrements: 6
    }
};
let options = Object.assign(defaults, qsOptions);

function getUrlParams() {
    let paramMap = {};
    if (location.search.length == 0) {
        return paramMap;
    }
    let parts = location.search.substring(1).split("&");
    for (let i = 0; i < parts.length; i ++) {
        let component = parts[i].split("=");
        paramMap[decodeURIComponent(component[0])] = decodeURIComponent(component[1]);
    }
    return paramMap;
}

$(document).ready(() => {
    $('#name-input').focus();
    let params = getUrlParams();
    if ('id' in params) {
        $('#gamecode-input').val(params['id']);
    }

    const sendName = () => {
        const MAX_STR_LENGTH = 12;
        const name = $('#name-input').val().toUpperCase();
        let gamecode = $('#gamecode-input').val().toUpperCase();

        if (gamecode.length === 0 || gamecode.length > MAX_STR_LENGTH) {
            gamecode = Math.random().toString(36).substring(7).toUpperCase();
        }

        if (name && name.length < MAX_STR_LENGTH) {
            options.playerOptions = {
                playerName: name,
                privateCode: gamecode,
                verbose: true,
            };
            // create a client engine and a game engine
            const gameEngine = new AsteroidsGameEngine(options);
            const clientEngine = new AsteroidsClientEngine(gameEngine, options);
            document.getElementById('name-prompt-overlay').style.display = 'none';
            document.getElementById('name-prompt-container').style.display = 'none';
            document.getElementById('title').style.display = 'none';
            $('#instruct_friend').hide();
            $('#share_link').html(
                `Share this link with your friend: <br /> www.stargrid.io/?id=${gamecode}`
            );
            clientEngine.start();
        } else {
            window.alert('Your name cannot be blank or over 10 characters.');
        }
        return false;
    };
    $('#name-form').submit(sendName);
    $('#name-submit').click(sendName);
});