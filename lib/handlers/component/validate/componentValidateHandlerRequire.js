'use strict';

//local imports
const utils = require('../../../utils');

const FormeValidationError = require('../../../errors').FormeValidationError;
const ComponentValidateHandler = require('../componentValidateHandler');

//functions
function hasInvalidValue(value) {
    return value === null || value === undefined || (typeof value === 'string' && value.length === 0);
}

//main class
class ComponentValidateHandlerRequire extends ComponentValidateHandler {
    //properties
    get configuration() {
        return Object.assign(super.configuration, {
            require: true, //assumed yes :D
        });
    }

    //api
    execute(component, state) {
        //allow form to override required
        let valid = true;
        if (!component.form._unrequire) {
            //update required in state
            state.require = true;

            //check for invalid value
            if (state.require) {
                //first let the component execute its empty handlers
                return component._processEmptyHandlers(state)
                .then(empty => {
                    if (empty || !state.value) {
                        //empty value
                        valid = false;
                    } else {
                        //check special types
                        if (typeof state.value === 'object') {
                            if (component._exposed) {
                                //exposed values only!
                                if (component._expose.length === 1) {
                                    //single exposed value
                                    if (hasInvalidValue(state.value)) {
                                        valid = false;
                                    }
                                } else {
                                    //multiple exposed values
                                    for (let path of component._expose) {
                                        if (hasInvalidValue(utils.object.find.path(state.value, path))) {
                                            valid = false;
                                            break;
                                        }
                                    }
                                }

                            } else {
                                //check all element values
                                for (let element of component._elements) {
                                    if (hasInvalidValue(utils.object.find.path(state.value, element._ownPathSegments))) {
                                        valid = false;
                                        break;
                                    }
                                }
                            }
                        } else if (typeof state.value === 'string' && state.value.length === 0) {
                            //empty string (this should be handled by exposed)!
                            valid = false;
                        }
                    }

                    //success or fail?
                    if (!valid) {
                        return Promise.reject(new FormeValidationError('{label} is required'));
                    } else {
                        return Promise.resolve();
                    }
                });
            }
        }
    }
}

//expose module
module.exports = ComponentValidateHandlerRequire;