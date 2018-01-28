'use strict';

//local imports
const utils = require('../../../utils');
const FormeValidationError = require('../../../errors').FormeValidationError;
const InputValidateHandler = require('../inputValidateHandler');

//main class
class InputValidateHandlerOptions extends InputValidateHandler {
    constructor(options, strict) {
        super();
        this._options = options;
        this._strict = !!strict;
    }

    //properties
    get configuration() {
        return Object.assign(super.configuration, {
            options: Array.from(this._options),
            strict: this._strict,
        });
    }

    //api
    execute(input, state) {
        //we take into account the state.require flag
        if (state.value !== null || state.require) {
            //check for valid option
            for (let index = 0; index < input._options.length; index++) {
                if (utils.value.compare(state.value, input._options[index].value, this._strict)) {
                    //inform of success
                    return Promise.resolve();
                }
            }
        }

        //invalid option
        return Promise.reject(new FormeValidationError('{label} has an invalid option'));
    }
}

//expose module
module.exports = InputValidateHandlerOptions;