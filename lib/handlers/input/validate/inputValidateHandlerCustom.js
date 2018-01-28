'use strict';

//local imports
const utils = require('../../../utils');

const FormeValidationError = require('../../../errors').FormeValidationError;
const InputValidateHandler = require('../inputValidateHandler');

//main class
class InputValidateHandlerCustom extends InputValidateHandler {
    constructor(handler, error) {
        super(null);
        this._defaultError = error;//should not set this._error as the functionality needs to be different to normal handlers
        this.handler = handler || null;
    }

    //properties
    get configuration() {
        if (this._defaultError) {
            return {
                callback: this.handler,
                error: this._defaultError,
            }
        } else {
            return this.handler;
        }
    }

    //api
    execute(input, state) {
        if (this.handler === null) {
            return Promise.resolve();
        } else {
            return utils.promise.result(this.handler.call(input, input.form, input, state))
            .catch(err => {
                if (err && err.message) {
                    if (err.constructor === Error) {
                        //convert error to correct type (but we keep any special error types in their original format)
                        throw new FormeValidationError(err.message, input._name);
                    } else {
                        //pass error up, as-is
                        throw err;
                    }
                } else {
                    if (this._defaultError !== null) {
                        throw new FormeValidationError(this._defaultError, input._name);
                    } else {
                        //throw empty error!
                        throw new FormeValidationError('', input._name);
                    }
                }
            });
        }
    }
}

//expose module
module.exports = InputValidateHandlerCustom;