'use strict';

//local imports
const utils = require('./utils');

const FormeContainer = require('./container');

class FormePage extends FormeContainer {
    constructor(form, name, callback) {
        super(form, name);
        this._callback = callback;
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

    _build(storage) {
        const form = this._form;

        //callback adds to the the page
        if (!this._callback) {
            return Promise.resolve(this);
        } else {
            return utils.promise.result(this._callback.call(this, storage, form, this))
            .then(() => {
                //add inputs to the request
                for(let input of this._inputs) {
                    this._inputs.push(input);
                }

                //chain
                return this;
            });
        }
    }

    //public methods
}

//expose
module.exports = FormePage;