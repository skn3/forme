'use strict';

//local imports
const InputHandler = require('../inputHandler.js');

//main class
class InputHandlerBlacklist extends InputHandler {
    constructor(list, error) {
        super(error);
        this.list = list || [];
    }

    execute(req, input, state) {
        //we take into account the state.require flag
        return new Promise(function(resolve, reject){
            if (state.value !== null) {
                //check for invalid option
                for (let index = 0; index < this.list.length; index++) {
                    if (state.value == this.list[index]) {
                        //inform of success
                        return Promise.reject('{label} is not allowed');
                    }
                }
            }

            return Promise.resolve();
        });
    }
}

//expose module
module.exports = InputHandlerBlacklist;