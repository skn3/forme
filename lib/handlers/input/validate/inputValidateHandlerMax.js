'use strict';

//local imports
const InputValidateHandlerSize = require('./inputValidateHandlerSize');

//main class
class InputValidateHandlerMax extends InputValidateHandlerSize {
    constructor(size, error) {
        super(null, size, error);
    }

    //properties
    get configuration() {
        return Object.assign(super.configuration, {
            max: this.max,
        });
    }
}

//expose module
module.exports = InputValidateHandlerMax;