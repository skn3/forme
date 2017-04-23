'use strict';

//local imports
const InputProcessHandler = require('../../inputProcessHandler');

//main class
class InputProcessHandlerConvert extends InputProcessHandler {
    constructor(type, allowNull) {
        super();
        this.type = type || 'string';
        this.allowNull = allowNull || false;
    }

    execute(input, state) {
        //dont convert null value (unless force has been specified)
        if (state.value !== null || !this.allowNull) {
            //try and find new value
            switch (this.type) {
                case 'bool':
                    state.value = !!state.value;
                    break;
                case 'int':
                    if (state.value === null) {
                        state.value = Number(0);
                    } else {
                        state.value = Number(parseInt(state.value) || 0);
                    }
                    break;
                case 'float':
                    if (state.value === null) {
                        state.value = Number(0.0);
                    } else {
                        state.value = Number(parseFloat(state.value) || 0.0);
                    }
                    break;
                case 'string':
                    if (state.value === null) {
                        state.value = '';
                    } else {
                        state.value = state.value.toString();
                    }
                    break;
            }
        }
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
module.exports = InputProcessHandlerConvert;