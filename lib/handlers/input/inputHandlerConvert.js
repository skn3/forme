'use strict';

//local imports
const FormeError = require('../../errors.js').FormeError;
const InputHandler = require('../inputHandler.js');

//main class
class InputHandlerSize extends InputHandler {
    constructor(type, force, error) {
        super(error);
        this.type = type || 'string';
        this.force = force || false;
    }

    execute(req, input, state) {
        //dont convert null value (unless force has been specified)
        if (state.value !== null || this.force) {
            //try and find new value
            switch (this.type) {
                case 'bool':
                    if (!state.value) {
                        state.value = false;
                    } else {
                        state.value = true;
                    }
                    break;
                case 'int':
                    if (state.value == null) {
                        state.value = Number(0);
                    } else {
                        state.value = Number(parseInt(state.value) || 0);
                    }
                    break;
                case 'float':
                    if (state.value == null) {
                        state.value = Number(0.0);
                    } else {
                        state.value = Number(parseFloat(state.value) || 0.0);
                    }
                    break;
                case 'string':
                    if (state.value == null) {
                        state.value = '';
                    } else {
                        state.value = state.value.toString();
                    }
                    break;
            }
        }

        return Promise.resolve();
    }

    HTML5InputType() {
        switch(this.type) {
            case 'int':
            case 'float':
                return 'number';
            default:
                //unhandled types dont override
                return null;
        }
    }
}

//expose module
module.exports = InputHandlerSize;