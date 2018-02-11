'use strict';

//local imports
const utils = require('../../../utils');
const FormeValidationError = require('../../../errors').FormeValidationError;
const InputValidateHandler = require('../inputValidateHandler');

//main class
class InputValidateHandlerBlacklist extends InputValidateHandler {
    constructor(blacklist, error) {
        super(error);
        this.blacklist = blacklist || [];
    }

    //properties
    get configuration() {
        return Object.assign(super.configuration, {
            blacklist: Array.from(this.blacklist),
        });
    }

    //api
    execute(input, state) {
        //we take into account the state.require flag
        if (state.value !== null) {
            //check for invalid option
            if (this.blacklist.indexOf(state.value) !== -1) {
                //inform of success
                return Promise.reject(new FormeValidationError('{label} value is not allowed'));
            }
        }

        return Promise.resolve();
    }
}

//expose module
module.exports = InputValidateHandlerBlacklist;