'use strict';

//main class
class InputProcessHandler {
    constructor() {
    }

    //properties
    get configuration() {
        return undefined;
    }

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