'use strict';

//local imports
const FormeError = require('../../errors.js').FormeError;
const InputHandler = require('../inputHandler.js');

//main class
class InputHandlerOptions extends InputHandler {
    execute(req, input, state) {
        //we take into account the state.require flag
        if (state.value !== null || state.require) {
            //check for valid option
            for (let index = 0; index < input._options.length; index++) {
                if (state.value == input._options[index].value) {
                    //inform of success
                    return Promise.resolve();
                }
            }
        }

        //invalid option
        return Promise.reject(new FormeError('{label} has an invalid option'));
    }
}

//expose module
module.exports = InputHandlerOptions;