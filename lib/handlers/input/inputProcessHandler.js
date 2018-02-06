'use strict';

const ProcessHandler = require('../processHandler');

//main class
class InputProcessHandler extends ProcessHandler {
    //properties
    get htmlInputType() {
        return null;
    }

    //api
    execute(input, state) {
        return Promise.resolve();
    }
}

//expose module
module.exports = InputProcessHandler;