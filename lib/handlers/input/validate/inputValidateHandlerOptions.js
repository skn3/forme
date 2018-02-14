'use strict';

//local imports
const utils = require('../../../utils');
const FormeValidationError = require('../../../errors').FormeValidationError;
const InputValidateHandler = require('../inputValidateHandler');

//main class
class InputValidateHandlerOptions extends InputValidateHandler {
    constructor(options, error) {
        super(error);
        this._options = options;
    }

    //properties
    get configuration() {
        const configuration = super.configuration;
        configuration.options = this._options;
        return configuration;
    }

    //api
    execute(input, state) {
        //we take into account the state.require flag
        if (state.value !== null || state.require) {
            //check for valid option
            if (this._options.findIndex(option => option.value === state.value) === -1) {
                return Promise.reject(new FormeValidationError('{label} has an invalid option'));
            }
        }

        //w00t!
        return Promise.resolve()
    }
}

//expose module
module.exports = InputValidateHandlerOptions;