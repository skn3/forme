'use strict';

//module imports
const FormeValidationError = require('../../../errors').FormeValidationError;
const validator = require('validator');

//local imports
const InputValidateHandler = require('../inputValidateHandler');

//main class
class InputValidateHandlerIs extends InputValidateHandler {
    constructor(type, options, error) {
        super(error);
        this.type = type.toLowerCase();
        this.options = options;
    }

    //properties
    get configuration() {
        const configuration = super.configuration;
        configuration.type = this.type;
        if (this.options) {
            configuration.options = this.options;
        }
        return configuration;
    }

    get htmlInputType() {
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
                return 'text';
            case 'float':
            case 'decimal':
            case 'number':
                return 'number';
            default:
                //unhandled types dont override
                return null;
        }
    }

    //api
    execute(input, state) {
        //we take into account the state.require flag
        if ((state.value !== null && state.value !== '') || state.require) {
            //lets convert our type into https://www.npmjs.com/package/validator#validators
            switch (this.type) {
                case 'uk-postcode':
                    if (!/[A-Z]{1,2}[0-9]{1,2}[A-Z]? ?[0-9][A-Z]{2}/i.test(state.value)) {
                        return Promise.reject(new FormeValidationError('{label} is not a valid UK postcode'));
                    }
                    break;

                case 'alphanumeric':
                    //noinspection Annotator
                    if (!validator.isAlphanumeric(state.value, this.options)) {
                        return Promise.reject('{label} is not alphanumeric');
                    }
                    break;

                case 'email':
                    //noinspection Annotator
                    if (!validator.isEmail(state.value, this.options)) {
                        return Promise.reject(new FormeValidationError('{label} is not a valid email'));
                    }
                    break;

                case 'username':
                    //noinspection Annotator
                    if (validator.whitelist(state.value, 'a-zA-Z0-9\_\-') !== state.value) {
                        return Promise.reject(new FormeValidationError('{label} is not a valid username'));
                    }
                    break;

                case 'subdomain':
                    //noinspection Annotator
                    if (validator.whitelist(state.value, 'a-zA-Z0-9\_\-') !== state.value) {
                        return Promise.reject(new FormeValidationError('{label} is not a valid subdomain'));
                    }
                    break;

                case 'isodate':
                    //noinspection Annotator
                    if (!validator.isISO8601(state.value)) {
                        return Promise.reject(new FormeValidationError('{label} is not a valid date'));
                    }
                    break;

                case 'text':
                    //noinspection Annotator
                    if (!validator.isAscii(state.value)) {
                        return Promise.reject(new FormeValidationError('{label} does not contain valid text'));
                    }
                    break;

                case 'boolean':
                case 'bool':
                    //noinspection Annotator,Annotator,Annotator
                    if (!validator.isInt(state.value)) {
                        return Promise.reject(new FormeValidationError('{label} is not a valid boolean'));
                    }
                    break;

                case 'int':
                    //noinspection Annotator
                    if (!validator.isInt(state.value)) {
                        return Promise.reject(new FormeValidationError('{label} is not a valid integer'));
                    }
                    break;

                case 'float':
                    //noinspection Annotator
                    if (!validator.isFloat(state.value)) {
                        return Promise.reject(new FormeValidationError('{label} is not a valid float'));
                    }
                    break;

                case 'decimal':
                case 'number':
                    //noinspection Annotator
                    if (!validator.isDecimal(state.value)) {
                        return Promise.reject(new FormeValidationError('{label} is not a valid number'));
                    }
                    break;

                case 'color':
                case 'colour':
                    //noinspection Annotator
                    if (!validator.isHexColor(state.value)) {
                        return Promise.reject(new FormeValidationError('{label} is not a valid color'));
                    }
                    break;

                case 'phone':
                case 'telephone':
                case 'tel':
                    //noinspection Annotator
                    if (validator.whitelist(state.value, '0-9\(\)\-\s\+') !== state.value) {
                        return Promise.reject(new FormeValidationError('{label} is not a valid phone number'));
                    }
                    break;

                default:
                    //handle any others
                    if (this.type.length === 0) {
                        return Promise.reject(new FormeValidationError('{label} is not valid'));
                    } else {
                        const func = validator['is' + this.type[0].toUpperCase() + this.type.slice(1).toLowerCase()];
                        if (func === undefined) {
                            return Promise.reject(new FormeValidationError('{label} has an unknown type'));
                        } else {
                            //try calling validator's custom is routine
                            if (!func(state.value, this.options)) {
                                return Promise.reject(new FormeValidationError('{label} is not a valid '+this.type));
                            }
                        }
                    }
                    break;
            }
        }

        //skip
        return Promise.resolve();
    }
}

//expose module
module.exports = InputValidateHandlerIs;