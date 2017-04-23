'use strict';

//module imports
const FormeError = require('../../../errors').FormeError;
const validator = require('validator');

//local imports
const InputValidateHandler = require('../../inputValidateHandler');

//main class
class InputValidateHandlerIs extends InputValidateHandler {
    constructor(type, options, error) {
        super(error);
        this.type = type.toLowerCase();
        this.options = options;
    }

    execute(input, state) {
        //we take into account the state.require flag
        if (state.value !== null || state.require) {
            //lets convert our type into https://www.npmjs.com/package/validator#validators
            switch (this.type) {
                case 'uk-postcode':
                    if (!/[A-Z]{1,2}[0-9]{1,2}[A-Z]{0,1} ?[0-9][A-Z]{2}/i.test(state.value)) {
                        return Promise.reject(new FormeError('{label} is not a valid UK postcode'));
                    }
                    break;

                case 'alphanumeric':
                    if (!validator.isAlphanumeric(state.value, this.options)) {
                        return Promise.reject('{label} is not alphanumeric');
                    }
                    break;

                case 'email':
                    if (!validator.isEmail(state.value, this.options)) {
                        return Promise.reject(new FormeError('{label} is not a valid email'));
                    }
                    break;

                case 'username':
                    if (validator.whitelist(state.value, 'a-zA-Z0-9\_\-') !== state.value) {
                        return Promise.reject(new FormeError('{label} is not a valid username'));
                    }
                    break;

                case 'subdomain':
                    if (validator.whitelist(state.value, 'a-zA-Z0-9\_\-') !== state.value) {
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
                        return Promise.reject(new FormeError('{label} does not contain valid text'));
                    }
                    break;

                case 'boolean':
                case 'bool':
                    if (!validator.isInt(state.value)) {
                        return Promise.reject(new FormeError('{label} is not a valid boolean'));
                    }
                    break;

                case 'int':
                    if (!validator.isInt(state.value)) {
                        return Promise.reject(new FormeError('{label} is not a valid integer'));
                    }
                    break;

                case 'float':
                    if (!validator.isFloat(state.value)) {
                        return Promise.reject(new FormeError('{label} is not a valid float'));
                    }
                    break;

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

                case 'telephone':
                case 'tel':
                    if (validator.whitelist(state.value, '0-9\(\)\-\s\+') !== state.value) {
                        return Promise.reject(new FormeError('{label} is not a valid phone number'));
                    }
                    break;

                default:
                    //handle any others
                    if (this.type.length === 0) {
                        return Promise.reject(new FormeError('{label} is not valid'));
                    } else {
                        const func = validator['is' + this.type[0].toUpperCase() + this.type.slice(1).toLowerCase()];
                        if (func === undefined) {
                            return Promise.reject(new FormeError('{label} is not valid'));
                        } else {
                            //try calling validator's custom is routine
                            if (!func(state.value, this.options)) {
                                return Promise.reject(new FormeError('{label} is not a valid '+this.type));
                            }
                        }
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
module.exports = InputValidateHandlerIs;