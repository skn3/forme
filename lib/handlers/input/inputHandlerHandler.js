'use strict';

//local imports
const InputHandler = require('../inputHandler.js');

//main class
class InputHandlerHandler extends InputHandler {
    constructor(callback, error) {
        super(error);
        this.callback = callback || null;
    }

    execute(req, input, state, finish) {
        if (this.callback === null) {
            return finish();
        }

        //pass to callback for complete operation
        this.callback.call(input, req, input, state, finish);
    }
}

//expose module
module.exports = InputHandlerHandler;