'use strict';

//local imports
const constants = require('../../constants');
const FormeValidationError = require('../../errors').FormeValidationError;
const ProcessHandler = require('../processHandler');

//main class
class ProcessHandlerConvertJson extends ProcessHandler {
    constructor(allowNull, error=null) {
        super(error);
        this.allowNull = !!allowNull;
    }

    //properties
    get configuration() {
        const configuration = super.configuration || {};
        configuration.allowNull = this.allowNull;
        configuration.error = this.error;
        return configuration;
    }

    get htmlInputType() {
        return null;
    }

    //api
    execute(input, state) {
        //dont convert null value (unless specified)
        if ((state.value !== null || !this.allowNull)) {
            //we dont have to bother converting if state.value is already an object!
            if (state.value === null || typeof state.value !== 'object') {
                try {
                    state.value = JSON.parse(state.value);
                } catch (err) {
                    if (constants.logErrors) {
                        console.log(err);
                    }

                    throw new FormeValidationError(`{label} contains invalid json`);
                }
            }
        }
    }
}

//expose module
module.exports = ProcessHandlerConvertJson;