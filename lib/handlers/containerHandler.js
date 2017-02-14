'use strict';

//main class
class ContainerHandler {
    constructor(error) {
        this.error = error || null;
    }

    execute(container, state) {
        return Promise.resolve();
    }
}

//expose module
module.exports = ContainerHandler;