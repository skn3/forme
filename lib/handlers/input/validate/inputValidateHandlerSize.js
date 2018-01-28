'use strict';

//local imports
const FormeValidationError = require('../../../errors').FormeValidationError;
const InputValidateHandler = require('../inputValidateHandler');

//main class
class InputValidateHandlerSize extends InputValidateHandler {
    constructor(min, max, error) {
        super(error);
        this.min = min !== null && min > 0?min:null;
        this.max = max !== null && max >= 0?max:null;
    }

    //properties
    get configuration() {
        return Object.assign(super.configuration, {
            min: this.min,
            max: this.max,
        });
    }

    //api
    execute(input, state) {
        //we take into account the state.require flag

        //check min
        if (this.min !== null && ((state.value === null && state.require) || ((state.value !== null || state.require) && typeof state.value === 'string' && state.value.length < this.min))) {
            return Promise.reject(new FormeValidationError('{label} is too short'));
        }

        //check max
        if (this.max !== null && ((state.value === null && state.require) || ((state.value !== null || state.require) && typeof state.value === 'string' && state.value.length > this.max))) {
            return Promise.reject(new FormeValidationError('{label} is too long'));
        }

        //success
        return Promise.resolve();
    }
}

//expose module
module.exports = InputValidateHandlerSize;