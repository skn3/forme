'use strict';

//local imports
var InputHandler = require('../inputHandler.js');

//main class
class InputHandlerOptions extends InputHandler {
    execute(req, input, state, finish) {
        //we take into account the state.require flag
        if (state.value !== null || state.require) {
            //check for valid option
            for (var index = 0; index < this.input._options.length; index++) {
                if (state.value == this.input._options[index].value) {
                    //inform of success
                    return finish();
                }
            }
        }

        //invalid option
        return finish('{label} has an invalid option');
    }
}

//expose module
module.exports = InputHandlerOptions;