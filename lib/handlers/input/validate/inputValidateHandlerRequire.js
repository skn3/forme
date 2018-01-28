'use strict';

//local imports
const FormeValidationError = require('../../../errors').FormeValidationError;
const InputValidateHandler = require('../inputValidateHandler');

//main class
class InputValidateHandlerRequire extends InputValidateHandler {
    //properties
    get configuration() {
        return Object.assign(super.configuration, {
            require: true, //assumed yes :D
        });
    }

    //api
    execute(input, state) {
        //allow form to override required
        if (!input.form._unrequire) {
            //update required in state
            state.require = true;

            //check for invalid value
            if (state.require && (state.value === null || (typeof state.value === 'string' && state.value.length === 0))) {
                return Promise.reject(new FormeValidationError('{label} is required'));
            }
        }

        //success
        return Promise.resolve();
    }
}

//expose module
module.exports = InputValidateHandlerRequire;