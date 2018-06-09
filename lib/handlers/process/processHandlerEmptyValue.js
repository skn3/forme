'use strict';

//local imports
const ProcessHandler = require('../processHandler');

//main class
class ProcessHandlerEmptyValue extends ProcessHandler {
    constructor(value) {
        super();
        this.nullValue = arguments.length > 0?value:'';
    }

    //properties
    get configuration() {
        return this.nullValue;
    }

    //api
    execute(input, state) {
        //convert empty value to the one defined
        return input._processEmptyHandlers(state)
        .then(empty => {
            if (empty === null) {
                if (empty === true) {
                    state.value = this.nullValue;
                }
            } else {
                if (state.value === '' || state.value === 0 || state.value === null || state.value === undefined || state.value === false) {
                    state.value = this.nullValue;
                }
            }
        });
    }
}

//expose module
module.exports = ProcessHandlerEmptyValue;