'use strict';

//local imports
const utils = require('./utils');

const FormeContainer = require('./container');

class FormePage extends FormeContainer {
    constructor(form, name, callback) {
        super(form, name);
        this._callback = callback;
        this._building = false;
    };

    //private methods
    _clone(override) {
        //create copy
        const clone = new FormePage();

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
            this._building = true;
            return utils.promise.result(this._callback.call(this, this._form._storage, this._form, this))
            .then(() => {
                this._building = false;
                return this;
            });
        }
    }

    //public methods
    add(name) {
        if (!this._building) {
            return super.add(name);
        } else {
            //redirect to form
            return this._form.add(name);
        }
    }
}

//expose
module.exports = FormePage;