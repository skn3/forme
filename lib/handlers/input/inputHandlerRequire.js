'use strict';

//local imports
const FormeError = require('../../errors.js').FormeError;
const InputHandler = require('../inputHandler.js');

//main class
class InputHandlerRequire extends InputHandler {
    execute(req, input, state) {
        //update required in state
        state.require = true;

        //check for invalid value
        if (state.require && (state.value === null || (typeof state.value == 'string' && state.value.length == 0))) {
            return Promise.reject(new FormeError('{label} is required'));
        }

        //success
        return Promise.resolve();
    }
}

//expose module
module.exports = InputHandlerRequire;