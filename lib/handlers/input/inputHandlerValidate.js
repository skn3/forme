'use strict';

//local imports
const InputHandler = require('../inputHandler.js');

//main class
class InputHandlerValidate extends InputHandler {
    constructor(callback, error) {
        super(null);
        this._defaultError = error;//should not set this._error as the functionality needs to be different to normal handlers
        this.callback = callback || null;
    }

    execute(req, input, state, finish) {
        if (this.callback === null) {
            return finish();
        }

        //let callback indicate
        function valid() {
            finish()
        }

        function invalid(error) {
            if (typeof error == 'string' && error.length > 0) {
                finish(error);
            } else {
                if (this._defaultError !== null) {
                    finish(this._defaultError);
                } else {
                    finish('{label} validation failed');
                }
            }
        }

        //handle this is a more user friendly fashion
        this.callback.call(input, req, input, state, valid, invalid);
    }
}

//expose module
module.exports = InputHandlerValidate;