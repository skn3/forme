'use strict';

class FormePageLocation {
    constructor(form, destination) {
        this._form = form;
        this._destination = destination;
    };

    //private properties
    get _name() {
        //page location doesn't have a name, so we have to use teh destination instead
        //each destination should be unique (within a single form)
        return this._destination;
    }

    get _inputs() {
        return null;
    }

    get _url() {
        return this._destination;
    }

    //private methods
    _build() {
        return Promise.resolve(this);
    }

    _validate() {
        return Promise.resolve();
    }

    _success() {
        return Promise.resolve();
    }

    _fail() {
        return Promise.resolve();
    }

    _submit() {
        return Promise.resolve();
    }

    _done() {
        return Promise.resolve();
    }

    _nextActionHandler() {
        return Promise.resolve();
    }
}

//expose
module.exports = FormePageLocation;