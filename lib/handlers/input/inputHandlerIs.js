'use strict';

//module imports
const FormeError = require('../../errors').FormeError;
const validator = require('validator');

//local imports
const InputHandler = require('../inputHandler');

//main class
class InputHandlerIs extends InputHandler {
    constructor(type, error) {
        super(error);
        this.type = type.toLowerCase();
    }

    execute(input, state) {
        //we take into account the state.require flag
        if (state.value !== null || state.require) {
            //lets convert our type into https://www.npmjs.com/package/validator#validators
            switch (this.type) {
                case 'alphanumeric':
                    if (!validator.isAlphanumeric(state.value)) {
                        return Promise.resolve('{label} is not alphanumeric');
                    }
                    break;

                case 'email':
                    if (!validator.isEmail(state.value)) {
                        return Promise.reject(new FormeError('{label} is not a valid email'));
                    }
                    break;

                case 'username':
                    if (validator.whitelist(state.value, 'a-zA-Z0-9\_\-') != state.value) {
                        return Promise.reject(new FormeError('{label} is not a valid username'));
                    }
                    break;

                case 'subdomain':
                    if (validator.whitelist(state.value, 'a-zA-Z0-9\_\-') != state.value) {
                        return Promise.reject(new FormeError('{label} is not a valid subdomain'));
                    }
                    break;

                case 'isodate':
                    if (!validator.isISO8601(state.value)) {
                        return Promise.reject(new FormeError('{label} is not a valid date'));
                    }
                    break;

                case 'text':
                    if (!validator.isAscii(state.value)) {
                        return Promise.reject(new FormeError('{label} is not a valid text'));
                    }
                    break;

                case 'float':
                case 'decimal':
                case 'number':
                    if (!validator.isDecimal(state.value)) {
                        return Promise.reject(new FormeError('{label} is not a valid number'));
                    }
                    break;

                case 'color':
                    if (!validator.isHexColor(state.value)) {
                        return Promise.reject(new FormeError('{label} is not a valid color'));
                    }
                    break;

                case 'tel':
                    if (validator.whitelist(state.value, 'a-zA-Z0-9\s\+') != state.value) {
                        return Promise.reject(new FormeError('{label} is not a valid phone number'));
                    }
                    break;
            }
        }

        //skip
        return Promise.resolve();
    }

    HTML5InputType() {
        switch(this.type) {
            case 'tel':
                return 'tel';
            case 'color':
                return 'color';
            case 'email':
                return 'email';
            case 'isodate':
                return 'date';
            case 'subdomain':
                return 'url';
            case 'float':
            case 'decimal':
            case 'number':
                return 'number';
            default:
                //unhandled types dont override
                return null;
        }
    }
}

//expose module
module.exports = InputHandlerIs;