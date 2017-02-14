'use strict';

//local imports
const utils = require('./utils');

class FormeBase {
    constructor(name) {
        this._name = name;
        this._label = this._name;
        this._context = {};
    }

    //private methods
    _clone(override) {
        //by ref
        return this;
    }

    //public methods
    name(name) {
        this._name = name;

        //chain
        return this;
    }

    label(label) {
        this._label = label;

        //chain
        return this;
    }

    context() {
        //get or set a context
        if (arguments.length == 1) {
            //get
            if (this._context[arguments[0]] !== undefined) {
                return this._context[arguments[0]];
            } else {
                return null;
            }
        } else if (arguments.length == 2) {
            //set
            this._context[arguments[0]] = arguments[1];
        }
    }
}

module.exports = FormeBase;