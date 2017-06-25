'use strict';

//local imports
const FormeError = require('../../../errors').FormeError;
const InputValidateHandler = require('../../inputValidateHandler');

//main class
class InputValidateHandlerRequire extends InputValidateHandler {
    execute(input, state) {
        //allow form to override required
        if (!input.form._unrequire) {
            //update required in state
            state.require = true;

            //check for invalid value
            if (state.require && (state.value === null || (typeof state.value === 'string' && state.value.length === 0))) {
                return Promise.reject(new FormeError('{label} is required'));
            }
        }

        //success
        return Promise.resolve();
    }
}

//expose module
module.exports = InputValidateHandlerRequire;