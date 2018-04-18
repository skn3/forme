'use strict';

//local imports
const FormeValidationError = require('../../../errors').FormeValidationError;
const InputValidateHandler = require('../inputValidateHandler');

//main class
class InputValidateHandlerWhitelist extends InputValidateHandler {
    constructor(whitelist, error) {
        super(error);
        this.whitelist = whitelist;
    }

    //properties
    get configuration() {
        return Object.assign(super.configuration, {
            whitelist: Array.from(this.whitelist),
        });
    }

    //api
    execute(input, state) {
        //we take into account the state.require flag
        if (state.value !== null || state.require) {
            //check for valid option
            if (this.whitelist.findIndex(option => option.value === state.value) === -1) {
                return Promise.reject(new FormeValidationError('{label} value is not allowed'));
            }
        }

        //w00t!
        return Promise.resolve()
    }
}

//expose module
module.exports = InputValidateHandlerWhitelist;