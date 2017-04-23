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

    get _loadHandlers() {
        return null;
    };

    get _buildHandlers() {
        return null;
    };

    get _actionHandlers() {
        return null;
    };

    get _processHandlers() {
        return null;
    };

    get _validateHandlers() {
        return null;
    };

    get _executeHandlers() {
        return null;
    };

    get _successHandlers() {
        return null;
    };

    get _failHandlers() {
        return null;
    };

    get _submitHandlers() {
        return null;
    };

    get _doneHandlers() {
        return null;
    };

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