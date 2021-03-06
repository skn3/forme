'use strict';

//local imports
const InputProcessHandler = require('../inputProcessHandler');

//main class
class InputProcessHandlerConvertFloat extends InputProcessHandler {
    constructor(allowNull) {
        super();
        this.allowNull = allowNull || false;
    }

    //properties
    get configuration() {
        return this.allowNull;
    }

    get htmlInputType() {
        return 'number';
    }

    //api
    execute(input, state) {
        //dont convert null value (unless force has been specified)
        if (state.value !== null || !this.allowNull) {
            if (state.value === null) {
                state.value = Number(0.0);
            } else {
                state.value = Number(parseFloat(state.value) || 0.0);
            }
        }
    }
}

//expose module
module.exports = InputProcessHandlerConvertFloat;