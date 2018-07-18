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
            //if null it means no empty handlers, so we should fallback to built in ones!
            if (empty === null) {
                empty = state.value === '' || state.value === 0 || state.value === null || state.value === undefined || state.value === false;
            }

            //now, was it empty?
            if (empty) {
                //yup
                state.value = this.nullValue;
            }
        });
    }
}

//expose module
module.exports = ProcessHandlerEmptyValue;