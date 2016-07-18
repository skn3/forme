'use strict';

//local imports
var InputHandler = require('../inputHandler.js');

//main class
class InputHandlerSize extends InputHandler {
    constructor(min, max, error) {
        super(error);
        this.min = min !== null && min > 0?min:null;
        this.max = max !== null && max >= 0?max:null;
    }

    execute(req, input, state, finish) {
        //we take into account the state.require flag

        //check min
        if (this.min !== null && ((state.value === null && state.require) || ((state.value !== null || state.require) && typeof state.value == 'string' && state.value.length < this.min))) {
            return finish('{label} is too short');
        }

        //check max
        if (this.max !== null && ((state.value === null && state.require) || ((state.value !== null || state.require) && typeof state.value == 'string' && state.value.length > this.max))) {
            return finish('{label} is too long');
        }

        //success
        return finish();
    }
}

//expose module
module.exports = InputHandlerSize;