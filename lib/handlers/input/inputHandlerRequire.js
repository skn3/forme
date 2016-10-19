'use strict';

//local imports
const InputHandler = require('../inputHandler.js');

//main class
class InputHandlerRequire extends InputHandler {
    execute(req, input, state, finish) {
        //update required in state
        state.require = true;

        //check for invalid value
        if (state.require && (state.value === null || (typeof state.value == 'string' && state.value.length == 0))) {
            return finish('{label} is required');
        }

        //success
        return finish();
    }
}

//expose module
module.exports = InputHandlerRequire;