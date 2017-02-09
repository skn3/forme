'use strict';

//local imports
const InputHandler = require('../inputHandler');

//main class
class InputHandlerHandler extends InputHandler {
    constructor(handler, error) {
        super(error);
        this.handler = handler || null;
    }

    execute(req, input, state) {
        if (this.handler === null) {
            return Promise.resolve({
                success: true,
            });
        } else {
            return this.handler.call(input, req, input, state);
        }
    }
}

//expose module
module.exports = InputHandlerHandler;