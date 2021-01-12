// Maze generation class
export default class Maze {
    constructor(args) {
        const defaults = {
            width: 6,
            height: 4,
            wallSize: 10,
            entryType: 'diagonal',
            bias: '',
            color: '#000000',
            backgroundColor: '#FFFFFF',
            solveColor: '#cc3737',
            removeWalls: 2,

            // Maximum 300 walls can be removed
            maxWallsRemove: 300,

            // No restrictions
            maxMaze: 0,
            maxCanvas: 0,
            maxCanvasDimension: 0,
            maxSolve: 0,
        }
        const settings = Object.assign({}, defaults, args);
        this.matrix = [];
        this.wallsRemoved = 0;
        this.width = parseInt(settings['width'], 10);
        this.height = parseInt(settings['height'], 10);
        this.wallSize = parseInt(settings['wallSize'], 10);
        this.removeWalls = parseInt(settings['removeWalls'], 10);
        this.entryNodes = this.getEntryNodes(settings['entryType']);
        this.bias = settings['bias'];
        this.color = settings['color'];
        this.backgroundColor = settings['backgroundColor'];
        this.solveColor = settings['solveColor'];
        this.maxMaze = parseInt(settings['maxMaze'], 10);
        this.maxCanvas = parseInt(settings['maxCanvas'], 10);
        this.maxCanvasDimension = parseInt(settings['maxCanvasDimension'], 10);
        this.maxSolve = parseInt(settings['maxSolve'], 10);
        this.maxWallsRemove = parseInt(settings['maxWallsRemove'], 10);
    }

    getRandInt(min, max) {
        // Includes min and max.
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    generate() {
        if (!this.isValidSize()) {
            this.matrix = [];
            alert('Please use smaller maze dimensions');
            return;
        }

        let nodes = this.generateNodes();
        nodes = this.parseMaze(nodes);
        this.getMatrix(nodes);
        this.removeMazeWalls();

        // Randomly place breakable obstacles
        let placed = 0;
        while (placed < 7) {
            const randomRow = this.getRandInt(1, this.matrix.length - 2);
            const randomCol = this.getRandInt(1, this.matrix[0].length - 2);
            if (randomRow == 1 && randomCol == 1) continue;
            this.matrix[randomRow] = this.replaceAt(this.matrix[randomRow], randomCol, "2");
            placed++;
        }
    }

    isValidSize() {
        const max = this.maxCanvasDimension;
        const canvas_width = ((this.width * 2) + 1) * this.wallSize;
        const canvas_height = ((this.height * 2) + 1) * this.wallSize;

        // Max dimension Firefox and Chrome
        if (max && ((max <= canvas_width) || (max <= canvas_height))) {
            return false;
        }

        // Max area (200 columns) * (200 rows) with wall size 10px
        return !(this.maxCanvas && (this.maxCanvas <= (canvas_width * canvas_height)));
    }

    generateNodes() {
        const count = this.width * this.height;
        let nodes = [];

        for (let i = 0; i < count; i++) {
            // visited, nswe
            nodes[i] = "01111";
        }

        return nodes;
    }

    replaceAt(str, index, replacement) {
        if (index > str.length - 1) {
            return str;
        }
        return str.substr(0, index) + replacement + str.substr(index + 1);
    }

    stringVal(str, index) {
        return parseInt(str.charAt(index), 10);
    }

    parseMaze(nodes) {
        const mazeSize = nodes.length;
        const positionIndex = { 'n': 1, 's': 2, 'w': 3, 'e': 4, };
        const oppositeIndex = { 'n': 2, 's': 1, 'w': 4, 'e': 3 };

        if (!mazeSize) {
            return;
        }

        let max = 0;
        let moveNodes = [];
        let visited = 0;
        let position = parseInt(Math.floor(Math.random() * nodes.length), 10);

        let biasCount = 0;
        let biasFactor = 3;
        if (this.bias) {
            if (('horizontal' === this.bias)) {
                biasFactor = (1 <= (this.width / 100)) ? Math.floor(this.width / 100) + 2 : 3;
            } else if ('vertical' === this.bias) {
                biasFactor = (1 <= (this.height / 100)) ? Math.floor(this.height / 100) + 2 : 3;
            }
        }

        // Set start node visited.
        nodes[position] = this.replaceAt(nodes[position], 0, 1);

        while (visited < (mazeSize - 1)) {
            biasCount++;

            max++;
            if (this.maxMaze && (this.maxMaze < max)) {
                alert('Please use smaller maze dimensions');
                // move_nodes = [];
                this.matrix = [];
                return [];
            }

            let next = this.getNeighbours(position);
            let that = this;
            let directions = Object.keys(next).filter(function(key) {
                return (-1 !== next[key]) && !that.stringVal(this[next[key]], 0);
            }, nodes);

            if (this.bias && (biasCount !== biasFactor)) {
                directions = this.biasDirections(directions);
            } else {
                biasCount = 0;
            }

            if (directions.length) {
                ++visited;

                if (1 < directions.length) {
                    moveNodes.push(position);
                }

                let direction = directions[Math.floor(Math.random() * directions.length)];

                // Update current position
                nodes[position] = this.replaceAt(nodes[position], positionIndex[direction], 0);
                // Set new position
                position = next[direction];

                // Update next position
                nodes[position] = this.replaceAt(nodes[position], oppositeIndex[direction], 0);
                nodes[position] = this.replaceAt(nodes[position], 0, 1);
            } else {
                if (!moveNodes.length) {
                    break;
                }

                position = moveNodes.pop();
            }
        }

        return nodes;
    }

    getMatrix(nodes) {
        const mazeSize = this.width * this.height;

        // Add the complete maze in a matrix
        // where 1 is a wall and 0 is a corridor.

        let row1 = '';
        let row2 = '';

        if (nodes.length !== mazeSize) {
            return;
        }

        for (let i = 0; i < mazeSize; i++) {
            row1 += !row1.length ? '1' : '';
            row2 += !row2.length ? '1' : '';

            if (this.stringVal(nodes[i], 1)) {
                row1 += '11';
                if (this.stringVal(nodes[i], 4)) {
                    row2 += '01';
                } else {
                    row2 += '00';
                }
            } else {
                let hasAbove = nodes.hasOwnProperty(i - this.width);
                let above = hasAbove && this.stringVal(nodes[i - this.width], 4);
                let hasNext = nodes.hasOwnProperty(i + 1);
                let next = hasNext && this.stringVal(nodes[i + 1], 1);

                if (this.stringVal(nodes[i], 4)) {
                    row1 += '01';
                    row2 += '01';
                } else if (next || above) {
                    row1 += '01';
                    row2 += '00';
                } else {
                    row1 += '00';
                    row2 += '00';
                }
            }

            if (0 === ((i + 1) % this.width)) {
                this.matrix.push(row1);
                this.matrix.push(row2);
                row1 = '';
                row2 = '';
            }
        }

        // Add closing row
        this.matrix.push('1'.repeat((this.width * 2) + 1));
    }

    getEntryNodes(access) {
        const y = ((this.height * 2) + 1) - 2;
        const x = ((this.width * 2) + 1) - 2;

        let entryNodes = {};

        if ('diagonal' === access) {
            entryNodes.start = { 'x': 1, 'y': 1, 'gate': { 'x': 0, 'y': 1 } };
            entryNodes.end = { 'x': x, 'y': y, 'gate': { 'x': x + 1, 'y': y } };
        }

        if ('horizontal' === access || 'vertical' === access) {
            let xy = ('horizontal' === access) ? y : x;
            xy = ((xy - 1) / 2);
            let odd = (xy % 2);
            xy = odd ? xy : xy + 1;

            let start_x = ('horizontal' === access) ? 1 : xy;
            let start_y = ('horizontal' === access) ? xy : 1;
            let end_x = ('horizontal' === access) ? x : (odd ? start_x + 2 : start_x);
            let end_y = ('horizontal' === access) ? (odd ? start_y + 2 : start_y) : y;
            let startgate = ('horizontal' === access) ? { 'x': 0, 'y': start_y } : { 'x': start_x, 'y': 0 };
            let endgate = ('horizontal' === access) ? { 'x': x + 1, 'y': end_y } : { 'x': end_x, 'y': y + 1 };

            entryNodes.start = { 'x': start_x, 'y': start_y, 'gate': startgate };
            entryNodes.end = { 'x': end_x, 'y': end_y, 'gate': endgate };
        }

        return entryNodes;
    }

    biasDirections(directions) {
        const horizontal = (-1 !== directions.indexOf('w')) || (-1 !== directions.indexOf('e'));
        const vertical = (-1 !== directions.indexOf('n')) || (-1 !== directions.indexOf('s'));

        if (('horizontal' === this.bias) && horizontal) {
            directions = directions.filter(function(key) {
                return (('w' === key) || ('e' === key))
            });
        } else if (('vertical' === this.bias) && vertical) {
            directions = directions.filter(function(key) {
                return (('n' === key) || ('s' === key))
            });
        }

        return directions;
    }

    getNeighbours(pos) {
        return {
            'n': (0 <= (pos - this.width)) ? pos - this.width : -1,
            's': ((this.width * this.height) > (pos + this.width)) ? pos + this.width : -1,
            'w': ((0 < pos) && (0 !== (pos % this.width))) ? pos - 1 : -1,
            'e': (0 !== ((pos + 1) % this.width)) ? pos + 1 : -1,
        };
    }

    removeWall(y, i) {
        // Break wall if possible.
        const even = (y % 2 === 0)
        const wall = this.stringVal(this.matrix[y], i);

        if (!wall) {
            return false;
        }

        if (!even && (i % 2 === 0)) {
            // Uneven row and even column
            const hasTop = (y - 2 > 0) && (1 === this.stringVal(this.matrix[y - 2], i));
            const hasBottom = (y + 2 < this.matrix.length) && (1 === this.stringVal(this.matrix[y + 2], i));

            if (hasTop && hasBottom) {
                this.matrix[y] = this.replaceAt(this.matrix[y], i, '0');
                return true;
            } else if (!hasTop && hasBottom) {
                const left = 1 === this.stringVal(this.matrix[y - 1], i - 1);
                const right = 1 === this.stringVal(this.matrix[y - 1], i + 1);
                if (left || right) {
                    this.matrix[y] = this.replaceAt(this.matrix[y], i, '0');
                    return true;
                }
            } else if (!hasBottom && hasTop) {
                const left = 1 === this.stringVal(this.matrix[y + 1], i - 1);
                const right = 1 === this.stringVal(this.matrix[y + 1], i + 1);
                if (left || right) {
                    this.matrix[y] = this.replaceAt(this.matrix[y], i, '0');
                    return true;
                }
            }

        } else if (even && (i % 2 !== 0)) {
            // Even row and uneven column
            const hasLeft = 1 === this.stringVal(this.matrix[y], i - 2);
            const hasRight = 1 === this.stringVal(this.matrix[y], i + 2);

            if (hasLeft && hasRight) {
                this.matrix[y] = this.replaceAt(this.matrix[y], i, '0');
                return true;
            } else if (!hasLeft && hasRight) {
                const top = 1 === this.stringVal(this.matrix[y - 1], i - 1);
                const bottom = 1 === this.stringVal(this.matrix[y + 1], i - 1);
                if (top || bottom) {
                    this.matrix[y] = this.replaceAt(this.matrix[y], i, '0');
                    return true;
                }
            } else if (!hasRight && hasLeft) {
                const top = 1 === this.stringVal(this.matrix[y - 1], i + 1);
                const bottom = 1 === this.stringVal(this.matrix[y + 1], i + 1);
                if (top || bottom) {
                    this.matrix[y] = this.replaceAt(this.matrix[y], i, '0');
                    return true;
                }
            }
        }

        return false;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            let temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
    }

    removeMazeWalls() {
        if (!this.removeWalls || !this.matrix.length) {
            return;
        }

        const min = 1;
        const max = this.matrix.length - 1;
        const maxTries = this.maxWallsRemove;
        let tries = 0;

        while (tries < maxTries) {
            tries++;

            // Did we reached the goal
            if (this.wallsRemoved >= this.removeWalls) {
                break;
            }

            // Get random row from matrix
            let y = Math.floor(Math.random() * (max - min + 1)) + min;
            y = (y === max) ? y - 1 : y;

            let walls = [];
            let row = this.matrix[y];

            // Get walls from random row
            for (let i = 0; i < row.length; i++) {
                if (i === 0 || i === row.length - 1) {
                    continue;
                }

                const wall = this.stringVal(row, i);
                if (wall) {
                    walls.push(i);
                }
            }

            // Shuffle walls randomly
            this.shuffleArray(walls);

            // Try breaking a wall for this row.
            for (let i = 0; i < walls.length; i++) {
                if (this.removeWall(y, walls[i])) {

                    // Wall can be broken
                    this.wallsRemoved++;
                    break;
                }
            }
        }
    }

    hasEntries( entries ) {
        return entries.hasOwnProperty('start') && entries.hasOwnProperty('end');
    }

    getEntryNode( entries, type, gate = false ) {
        if ( !this.hasEntries( entries ) ) {
            return false;
        }

        if( 'start' === type ) {
            return gate ? entries.start.gate : {'x': entries.start.x, 'y': entries.start.y};
        }

        if( 'end' === type ) {
            return gate ? entries.end.gate : {'x': entries.end.x, 'y': entries.end.y};
        }

        return false;
    }

    draw() {
        const canvas = document.getElementById('maze');
        if (!canvas || !this.matrix.length) {
            return;
        }

        if (!this.isValidSize()) {
            this.matrix = [];
            alert('Please use smaller maze dimensions');
            return;
        }

        canvas.width = ((this.width * 2) + 1) * this.wallSize;
        canvas.height = ((this.height * 2) + 1) * this.wallSize;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Add background
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Set maze collor
        ctx.fillStyle = this.color;

        const row_count = this.matrix.length;
        const gateEntry = this.getEntryNode(this.entryNodes, 'start', true);
        const gateExit = this.getEntryNode(this.entryNodes, 'end', true);

        for (let i = 0; i < row_count; i++) {
            let row_length = this.matrix[i].length;
            for (let j = 0; j < row_length; j++) {
                if (gateEntry && gateExit) {
                    if ((j === gateEntry.x) && (i === gateEntry.y)) {
                        continue;
                    }
                    if ((j === gateExit.x) && (i === gateExit.y)) {
                        continue;
                    }
                }
                let pixel = parseInt(this.matrix[i].charAt(j), 10);
                if (pixel) {
                    ctx.fillRect((j * this.wallSize), (i * this.wallSize), this.wallSize, this.wallSize);
                }
            }
        }
    }
}
