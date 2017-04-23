'use strict';

//main class
class ContainerValidateHandler {
    constructor(error) {
        this.error = error || null;
    }

    execute(container, state) {
        return Promise.resolve();
    }
}

//expose module
module.exports = ContainerValidateHandler;