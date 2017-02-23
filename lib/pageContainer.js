'use strict';

//local imports
const utils = require('./utils');

const FormeContainer = require('./container');

class FormePageContainer extends FormeContainer {
    constructor(form, name, callback) {
        super('page', form, name);

        this._callback = callback;
    };

    //private properties
    get _destination() {
        //page container doesn't need destination as it used when a form uses teh same path for each page
        return null;
    }

    get _url() {
        return this._form._driver.url();
    }

    //private methods
    _clone(override) {
        //create copy
        const clone = new FormePageContainer();

        //iterate over properties
        for(let key of Object.keys(this)) {
            if (override && override[key] !== undefined) {
                clone[key] = override[key];
            } else {
                const property = this[key];

                switch (key) {
                    case '_form':
                        //keep reference
                        clone[key] = this._form;
                        break;
                    default:
                        clone[key] = utils.clone.property(property, override);
                        break;
                }
            }
        }

        //:D
        return clone;
    }

    _build() {
        //add static inputs
        for(let input of this._inputs) {
            this._form._addInput(input);
        }

        //process any dynamic ones
        if (!this._callback) {
            return Promise.resolve(this);
        } else {
            //flag building so we can redirect add calls to form directly
            return utils.promise.result(this._callback.call(this, this._form, this))
            .then(() => this);
        }
    }

    _executeBuildHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeValidateHandler(handler, state) {
        return handler.call(this, this._form, this, state);
    }

    _executeSubmitHandler(handler) {
        return handler.call(this, this._form, this);
    }

    _executeActionHandler(handler, action) {
        return handler.call(this, this._form, this, action.action, action.context);
    }

    //public methods
}

//expose
module.exports = FormePageContainer;