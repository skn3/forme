'use strict';

//module imports
var validator = require('validator');

//local imports
var InputHandler = require('../inputHandler.js');

//main class
class InputHandlerIs extends InputHandler {
    constructor(type, error) {
        super(error);
        this.type = type.toLowerCase();
    }

    execute(req, input, state, finish) {
        //we take into account the state.require flag
        if (state.value !== null || state.require) {
            //lets convert our type into https://www.npmjs.com/package/validator#validators
            switch (this.type) {
                case 'alphanumeric':
                    if (!validator.isAlphanumeric(state.value)) {
                        return finish('{label} is not alphanumeric');
                    }
                    return finish();

                case 'email':
                    if (!validator.isEmail(state.value)) {
                        return finish('{label} is not a valid email');
                    }
                    return finish();

                case 'username':
                    if (validator.whitelist(state.value, 'a-zA-Z0-9\_\-') != state.value) {
                        return finish('{label} is not a valid username');
                    }
                    return finish();

                case 'subdomain':
                    if (validator.whitelist(state.value, 'a-zA-Z0-9\_\-') != state.value) {
                        return finish('{label} is not a valid subdomain');
                    }
                    return finish();

                case 'isodate':
                    if (!validator.isISO8601(state.value)) {
                        return finish('{label} is not a valid date');
                    }
                    return finish();

                case 'text':
                    if (!validator.isAscii(state.value)) {
                        return finish('{label} is not a valid text');
                    }
                    return finish();
            }
        }

        //skip
        return finish();
    }
}

//expose module
module.exports = InputHandlerIs;