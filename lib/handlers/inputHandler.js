'use strict';

//main class
class InputHandler {
    constructor(error) {
        this.error = error || null;
    }

    execute(req, input, state, finish) {
        return finish();
    }

    HTML5InputType() {
        return null;
    }
}

//expose module
module.exports = InputHandler;