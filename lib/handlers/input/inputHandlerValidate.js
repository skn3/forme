'use strict';

//local imports
const FormeError = require('../../errors.js').FormeError;
const InputHandler = require('../inputHandler.js');

//main class
class InputHandlerValidate extends InputHandler {
    constructor(handler, error) {
        super(null);
        this._defaultError = error;//should not set this._error as the functionality needs to be different to normal handlers
        this.handler = handler || null;
    }

    execute(req, input, state) {
        const that = this;

        if (this.handler === null) {
            return Promise.resolve();
        } else {
            return that.handler.call(input, req, input.form, input, state)
            .then(function(){
                resolve();
            })
            .catch(function (err) {
                if (typeof err.message == 'string' && err.message.length > 0) {
                    //pass error down
                    throw err;
                    return reject(new FormeError(err));
                } else {
                    if (this._defaultError !== null) {
                        throw new FormeError(this._defaultError);
                    } else {
                        throw new FormeError('{label} validation failed');
                    }
                }
            });
        }
    }
}

//expose module
module.exports = InputHandlerValidate;