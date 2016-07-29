'use strict';

//local imports
var InputHandler = require('../inputHandler.js');

//main class
class InputHandlerBlacklist extends InputHandler {
    constructor(list, error) {
        super(error);
        this.list = list || [];
    }

    execute(req, input, state, finish) {
        //we take into account the state.require flag
        if (state.value !== null) {
            //check for invalid option
            for (var index = 0; index < this.list.length; index++) {
                if (state.value == this.list[index]) {
                    //inform of success
                    return finish('{label} is not allowed');
                }
            }
        }

        //success
        finish();
    }
}

//expose module
module.exports = InputHandlerBlacklist;