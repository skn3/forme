'use strict';

//local imports
const InputValidateHandlerSize = require('./inputValidateHandlerSize');

//main class
class InputValidateHandlerMin extends InputValidateHandlerSize {
    constructor(size, error) {
        super(size, null, error);
    }
}

//expose module
module.exports = InputValidateHandlerMin;