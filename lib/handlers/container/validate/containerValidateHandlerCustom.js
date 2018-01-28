'use strict';

//local imports
const utils = require('../../../utils');

const FormeValidationError = require('../../../errors').FormeValidationError;
const ContainerValidateHandler = require('../containerValidateHandler');

//main class
class ContainerValidateHandlerCustom extends ContainerValidateHandler {
    constructor(handler, error) {
        super(null);
        this._defaultError = error || null;//should not set this._error as the functionality needs to be different to normal handlers
        this.handler = handler || null;
    }

    execute(container, state) {
        if (this.handler === null) {
            return Promise.resolve();
        } else {
            return utils.promise.result(container._executeValidateHandler(this.handler, state))
            .catch(err => {
                //pass error up
                if (err && err.message) {
                    if (err.constructor === Error) {
                        //convert standard Error type to correct type (but we keep any special error types in their original format)
                        throw new FormeValidationError(err.message);
                    } else {
                        //pass error up, as-is
                        throw err;
                    }
                } else {
                    if (this._defaultError !== null) {
                        throw new FormeValidationError(this._defaultError);
                    } else {
                        //throw empty error!
                        throw new FormeValidationError('');
                    }
                }
            });
        }
    }
}

//expose module
module.exports = ContainerValidateHandlerCustom;