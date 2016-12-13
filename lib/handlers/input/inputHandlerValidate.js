'use strict';

//local imports
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
            return new Promise(function(resolve, reject){
                return that.handler.call(input, req, input.form, input, state)
                .then(function(){
                    resolve();
                })
                .catch(function (err) {
                    if (typeof err == 'string' && err.length > 0) {
                        //pass error down
                        return reject(err);
                    } else {
                        if (this._defaultError !== null) {
                            return reject(this._defaultError);
                        } else {
                            return reject('{label} validation failed');
                        }
                    }
                });
            });
        }
    }
}

//expose module
module.exports = InputHandlerValidate;