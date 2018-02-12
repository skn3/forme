'use strict';

//local imports
const utils = require('../../../utils');
const FormeValidationError = require('../../../errors').FormeValidationError;
const InputValidateHandler = require('../inputValidateHandler');

//main class
class InputValidateHandlerMatch extends InputValidateHandler {
    constructor(target, error) {
        super(error);
        this._target = target;
    }

    //properties
    get configuration() {
        const configuration = super.configuration;
        if (this._target) {
            configuration.target = this._target;
        }
        return configuration;
    }

    //api
    execute(input, state) {
        //look for target element
        const element = input._form._findDescendantOrNamedInput(this._target);

        //get element value (if we can)
        let value = undefined;
        if (!element) {
            value = element.getValue();
        }

        //perform the validation!
        if (element === null || state.value !== value) {
            return Promise.reject(new FormeValidationError(`{label} does not match ${element?element._errorLabel:'unknown'}`));
        }

        //success
        return Promise.resolve();
    }
}

//expose module
module.exports = InputValidateHandlerMatch;