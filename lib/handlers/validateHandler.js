'use strict';

//main class
class ValidateHandler {
    constructor(error) {
        this.error = error || null;
    }

    //properties
    get configuration() {
        const out = {};
        if (this.error) {
            out.error = this.error;
        }
        return out;
    }

    //api
    execute(target, state) {
        return Promise.resolve();
    }
}

//expose module
module.exports = ValidateHandler;