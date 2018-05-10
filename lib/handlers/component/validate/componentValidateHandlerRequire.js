'use strict';

//local imports
const utils = require('../../../utils');

const ComponentValidateHandler = require('../componentValidateHandler');

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
                if (!state.value) {
                    //empty value
                    valid = false;
                } else {
                    //check special types
                    if (typeof state.value === 'object') {
                        if (component._exposed) {
                            //exposed values only!
                            for (let path of component._expose) {
                                const value = utils.object.find.path(state.value, path);
                                if (value === null || value === undefined || (typeof value === 'string' && value.length === 0)) {
                                    valid = false;
                                    break;
                                }
                            }

                        } else {
                            //check all values
                            for (let element of component._elements) {
                                const path = element._ownPathSegments;
                                const value = utils.object.find.path(state.value, path);
                                if (value === null || value === undefined || (typeof value === 'string' && value.length === 0)) {
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
            }
        }

        //success or fail?
        if (!valid) {
            return Promise.reject(new FormeValidationError('{label} is required'));
        } else {
            return Promise.resolve();
        }
    }
}

//expose module
module.exports = ComponentValidateHandlerRequire;