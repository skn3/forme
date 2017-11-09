'use strict';

//local imports
const InputValidateHandlerSize = require('./inputValidateHandlerSize');

//main class
class InputValidateHandlerMax extends InputValidateHandlerSize {
    constructor(size, error) {
        super(null, size, error);
    }
}

//expose module
module.exports = InputValidateHandlerMax;