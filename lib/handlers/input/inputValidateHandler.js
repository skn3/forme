'use strict';

//local imports
const ValidateHandler = require('../validateHandler');

//main class
class InputValidateHandler extends ValidateHandler {
    //properties
    get htmlInputType() {
        return null;
    }
}

//expose module
module.exports = InputValidateHandler;