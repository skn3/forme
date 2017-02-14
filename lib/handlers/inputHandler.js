'use strict';

//main class
class InputHandler {
    constructor(error) {
        this.error = error || null;
    }

    execute(storage, input, state) {
        return Promise.resolve();
    }

    HTML5InputType() {
        return null;
    }
}

//expose module
module.exports = InputHandler;