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
        //check value matches target
        const target = input._form._findInput(this._target);
        const targetValue = input._form.getValue(this._target);

        if (target === null || !utils.value.compare(state.value, targetValue, this._strict)) {
            const targetLabel = target?target._label:'unknown';
            return Promise.reject(new FormeValidationError("{label} does not match "+targetLabel));
        }

        //success
        return Promise.resolve();
    }
}

//expose module
module.exports = InputValidateHandlerMatch;