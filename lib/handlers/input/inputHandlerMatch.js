'use strict';

//local imports
const InputHandler = require('../inputHandler.js');

//main class
class InputHandlerMatch extends InputHandler {
    constructor(target, error) {
        super(error);
        this.target = target;
    }

    execute(req, input, state, finish) {
        //check value matches target
        const target = input._form._findInput(this.target);
        const targetValue = input._form.value(req, this.target);

        if (target === null || state.value != targetValue) {
            const targetLabel = target?target._label:'unknown';
            return finish("{label} does not match "+targetLabel);
        }

        //success
        return finish();
    }
}

//expose module
module.exports = InputHandlerMatch;