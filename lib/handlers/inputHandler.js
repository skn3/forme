'use strict';

//main class
class InputHandler {
    constructor(error) {
        this.error = error || null;
    }

    execute(req, input, state, finish) {
        return finish();
    }
}

//expose module
module.exports = InputHandler;