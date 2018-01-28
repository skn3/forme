'use strict';

//local imports
const InputProcessHandler = require('../inputProcessHandler');

//main class
class InputProcessHandlerConvertString extends InputProcessHandler {
    constructor(allowNull) {
        super();
        this.allowNull = allowNull || false;
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
            if (state.value === null) {
                state.value = '';
            } else {
                state.value = state.value.toString();
            }
        }
    }
}

//expose module
module.exports = InputProcessHandlerConvertString;