'use strict';

//local imports
const ProcessHandler = require('../processHandler');

//main class
class ProcessHandlerConvertBool extends ProcessHandler {
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
                const cased = state.value.toLowerCase();
                state.value = (state.value.length > 0 && state.value !== '0' && state.value !== 'no' && cased !== 'false') || cased === 'true';
            } else if (typeof state.value !== 'boolean') {
                state.value = !!state.value;
            }
        }
    }
}

//expose module
module.exports = ProcessHandlerConvertBool;