'use strict';

//local imports
const FormeError = require('../../errors').FormeError;
const InputHandler = require('../inputHandler');

//main class
class InputHandlerMatch extends InputHandler {
    constructor(target, error) {
        super(error);
        this.target = target;
    }

    execute(input, state) {
        //check value matches target
        const target = input._form._findInput(this.target);
        const targetValue = input._form.value(this.target);

        if (target === null || state.value != targetValue) {
            const targetLabel = target?target._label:'unknown';
            return Promise.reject(new FormeError("{label} does not match "+targetLabel));
        }

        //success
        return Promise.resolve();
    }
}

//expose module
module.exports = InputHandlerMatch;