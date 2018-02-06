'use strict';

//local imports
const InputValidateHandlerSize = require('./inputValidateHandlerSize');

//main class
class InputValidateHandlerMin extends InputValidateHandlerSize {
    constructor(size, error) {
        super(size, null, error);
    }

    //properties
    get configuration() {
        return Object.assign(super.configuration, {
            min: this.min,
        });
    }
}

//expose module
module.exports = InputValidateHandlerMin;