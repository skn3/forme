'use strict';

//local imports
const utils = require('../../utils');

const FormeInputError = require('../../errors').FormeError;
const InputHandler = require('../inputHandler');

//main class
class InputHandlerValidate extends InputHandler {
    constructor(handler, error) {
        super(null);
        this._defaultError = error;//should not set this._error as the functionality needs to be different to normal handlers
        this.handler = handler || null;
    }

    execute(storage, input, state) {
        if (this.handler === null) {
            return Promise.resolve();
        } else {
            return utils.promise.result(this.handler.call(input, storage, input.form, input, state))
            .catch(err => {
                if (err && err.message) {
                    if (err.constructor.name == 'Error') {
                        //convert error to correct type
                        throw new FormeInputError(err.message, input._name);
                    } else {
                        //pass error up, as-is
                        throw err;
                    }
                } else {
                    if (this._defaultError !== null) {
                        throw new FormeInputError(this._defaultError, input._name);
                    } else {
                        //throw empty error!
                        throw new FormeInputError('', input._name);
                    }
                }
            });
        }
    }
}

//expose module
module.exports = InputHandlerValidate;