'use strict';

const ExecuteHandler = require('./executeHandler');

//main class
class ValidateHandler extends ExecuteHandler {
    constructor(error) {
        super();
        this.error = error || null;
    }

    //properties
    get configuration() {
        const configuration = super.configuration || {};
        if (this.error) {
            configuration.error = this.error;
        }
        return configuration;
    }

    //api
    execute(target, state) {
        return Promise.resolve();
    }
}

//expose module
module.exports = ValidateHandler;