'use strict';

//local imports
const InputHandler = require('../inputHandler.js');

//main class
class InputHandlerOptions extends InputHandler {
    execute(req, input, state, finish) {
        //we take into account the state.require flag
        if (state.value !== null || state.require) {
            //check for valid option
            for (let index = 0; index < input._options.length; index++) {
                if (state.value == input._options[index].value) {
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