'use strict';

//local imports
var InputHandler = require('../inputHandler.js');

//main class
class InputHandlerCallback extends InputHandler {
    constructor(callback, error) {
        super(error);
        this.callback = callback || null;
    }

    execute(req, input, state, finish) {
        if (this.callback === null) {
            return finish();
        }

        //pass to callback
        this.callback(req, input, state, finish);
    }
}

//expose module
module.exports = InputHandlerCallback;