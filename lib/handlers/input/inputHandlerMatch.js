'use strict';

//local imports
var InputHandler = require('../inputHandler.js');

//main class
class InputHandlerMatch extends InputHandler {
    constructor(target, error) {
        super(error);
        this.target = target;
    }

    execute(req, input, state, finish) {
        //check value matches target
        var target = input._form._findInput(this.target);
        var targetValue = input._form.value(req, this.target);

        if (target === null || state.value != targetValue) {
            var targetLabel = target?target._label:'unknown';
            return finish("{label} does not match "+targetLabel);
        }

        //success
        return finish();
    }
}

//expose module
module.exports = InputHandlerMatch;