'use strict';

//local imports
const utils = require('../../../utils');
const FormeValidationError = require('../../../errors').FormeValidationError;
const InputValidateHandler = require('../inputValidateHandler');

//main class
class InputValidateHandlerBlacklist extends InputValidateHandler {
    constructor(list, error) {
        super(error);
        this.list = list || [];
    }

    //properties
    get configuration() {
        return Object.assign(super.configuration, {
            blacklist: Array.from(this.list),
        });
    }

    //api
    execute(input, state) {
        //we take into account the state.require flag
        if (state.value !== null) {
            //check for invalid option
            for (let index = 0; index < this.list.length; index++) {
                if (utils.value.compare(state.value, this.list[index], this._strict)) {
                    //inform of success
                    return Promise.reject(new FormeValidationError('{label} is not allowed'));
                }
            }
        }

        return Promise.resolve();
    }
}

//expose module
module.exports = InputValidateHandlerBlacklist;