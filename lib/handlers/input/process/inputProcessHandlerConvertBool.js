'use strict';

//local imports
const InputProcessHandler = require('../inputProcessHandler');

//main class
class InputProcessHandlerConvertBool extends InputProcessHandler {
    constructor(allowNull) {
        super();
        this.allowNull = !!allowNull;
    }

    //properties
    get configuration() {
        return this.allowNull;
    }

    get htmlInputType() {
        return null;
    }

    //api
    execute(input, state) {
        //dont convert null value (unless force has been specified)
        if (state.value !== null || !this.allowNull) {
            //convert string values
            if (typeof state.value === 'string') {
                state.value = state.value.length > 0 && state.value !== '0' && state.value !== 'no' && state.value.toLowerCase() !== 'true';
            } else {
                state.value = !!state.value;
            }
        }
    }
}

//expose module
module.exports = InputProcessHandlerConvertBool;