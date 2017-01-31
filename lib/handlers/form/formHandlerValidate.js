'use strict';

//local imports
const FormeError = require('../../errors').FormeError;
const FormHandler = require('../formHandler');

//main class
class FormHandlerValidate extends FormHandler {
    constructor(handler, error) {
        super(null);
        this._defaultError = error;//should not set this._error as the functionality needs to be different to normal handlers
        this.handler = handler || null;
    }

    execute(req, form, state) {
        const that = this;

        if (this.handler === null) {
            return Promise.resolve();
        } else {
            return that.handler.call(form, req, form, state)
            .then(function(){
                return Promise.resolve();
            })
            .catch(function (err) {
                //pass error up
                if (err.message.length > 0) {
                    if (err.constructor.name == 'Error') {
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
                        throw new FormeError('{label} validation failed');
                    }
                }
            });
        }
    }
}

//expose module
module.exports = FormHandlerValidate;