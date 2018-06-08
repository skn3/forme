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
        let valid = true;
        if (state.value === null) {
            //value is null, is this allowed?
            if (!this.allowNull) {
                valid = false;
            }
        } else if (typeof state.value === 'string') {
            if (state.value.length === 0) {
                //no string, can we treat this as null?
                if (!this.allowNull) {
                    //nope!
                    valid = false;
                } else {
                    //yup :D
                    state.value = null;
                }
            } else {
                //we have a string so attempt to parse it!
                try {
                    state.value = JSON.parse(state.value);
                } catch (err) {
                    if (constants.logErrors) {
                        console.log(err);
                    }
                    valid = false;
                }
            }
        } else if (typeof state.value !== 'object') {
            //anything else that is not object is not allowed!
            valid = false;
        }

        //finally validate!
        if (!valid) {
            throw new FormeValidationError(`{label} contains invalid json`);
        }
    }
}

//expose module
module.exports = ProcessHandlerConvertJson;