'use strict';

//local imports
const utils = require('../../../utils');
const FormeError = require('../../../errors').FormeError;
const InputValidateHandler = require('../../inputValidateHandler');

//main class
class InputValidateHandlerOptions extends InputValidateHandler {
    constructor(strict) {
        super();
        this._strict = !!strict;
    }

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
        return Promise.reject(new FormeError('{label} has an invalid option'));
    }
}

//expose module
module.exports = InputValidateHandlerOptions;