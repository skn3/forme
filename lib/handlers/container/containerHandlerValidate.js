'use strict';

//local imports
const utils = require('../../utils');

const FormeError = require('../../errors').FormeError;
const ContainerHandler = require('../containerHandler');

//main class
class ContainerHandlerValidate extends ContainerHandler {
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
                    if (err.constructor.name === 'Error') {
                        //convert error to correct type
                        throw new FormeError(err.message);
                    } else {
                        //pass error up, as-is
                        throw err;
                    }
                } else {
                    if (this._defaultError !== null) {
                        throw new FormeError(this._defaultError);
                    } else {
                        //throw empty error!
                        throw new FormeError('');
                    }
                }
            });
        }
    }
}

//expose module
module.exports = ContainerHandlerValidate;