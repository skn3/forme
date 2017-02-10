'use strict';

//local imports
const FormeError = require('../../errors').FormeError;
const InputHandler = require('../inputHandler');

//main class
class InputHandlerBlacklist extends InputHandler {
    constructor(list, error) {
        super(error);
        this.list = list || [];
    }

    execute(req, input, state) {
        //we take into account the state.require flag
        if (state.value !== null) {
            //check for invalid option
            for (let index = 0; index < this.list.length; index++) {
                if (state.value == this.list[index]) {
                    //inform of success
                    return Promise.reject(new FormeError('{label} is not allowed'));
                }
            }
        }

        return Promise.resolve();
    }
}

//expose module
module.exports = InputHandlerBlacklist;