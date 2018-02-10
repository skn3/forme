'use strict';

//local imports
const utils = require('../../../utils');
const FormeValidationError = require('../../../errors').FormeValidationError;
const InputValidateHandler = require('../inputValidateHandler');

//main class
class InputValidateHandlerMatch extends InputValidateHandler {
    constructor(target, strict, error) {
        super(error);
        this._target = target;
        this._strict = strict;
    }

    //properties
    get configuration() {
        const configuration = super.configuration;
        if (this._target) {
            configuration.target = this._target;
        }
        if (this._strict) {
            configuration.strict = this._strict;
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
        if (element === null || !utils.value.compare(state.value, value, this._strict)) {
            return Promise.reject(new FormeValidationError(`{label} does not match ${element?element._label:'unknown'}`));
        }

        //success
        return Promise.resolve();
    }
}

//expose module
module.exports = InputValidateHandlerMatch;