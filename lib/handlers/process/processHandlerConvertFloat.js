'use strict';

//local imports
const ProcessHandler = require('../processHandler');

//main class
class ProcessHandlerConvertFloat extends ProcessHandler {
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
                //otherwise always convert to float because we cant distinguish between int and float in js without parsing!
                state.value = Number(parseFloat(state.value) || 0.0);
            }
        }
    }
}

//expose module
module.exports = ProcessHandlerConvertFloat;