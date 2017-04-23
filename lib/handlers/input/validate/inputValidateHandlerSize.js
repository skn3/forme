'use strict';

//local imports
const FormeError = require('../../../errors').FormeError;
const InputValidateHandler = require('../../inputValidateHandler');

//main class
class InputValidateHandlerSize extends InputValidateHandler {
    constructor(min, max, error) {
        super(error);
        this.min = min !== null && min > 0?min:null;
        this.max = max !== null && max >= 0?max:null;
    }

    execute(input, state) {
        //we take into account the state.require flag

        //check min
        if (this.min !== null && ((state.value === null && state.require) || ((state.value !== null || state.require) && typeof state.value === 'string' && state.value.length < this.min))) {
            return Promise.reject(new FormeError('{label} is too short'));
        }

        //check max
        if (this.max !== null && ((state.value === null && state.require) || ((state.value !== null || state.require) && typeof state.value === 'string' && state.value.length > this.max))) {
            return Promise.reject(new FormeError('{label} is too long'));
        }

        //success
        return Promise.resolve();
    }
}

//expose module
module.exports = InputValidateHandlerSize;