'use strict';

class FormeRequest {
    constructor(form) {
        this._form = form;
        this._page = null;
        this._stored = false;
        this._first = false;
        this._raw = [];
        this._values = {};
        this._errors = [];
        this._actions = [];

        this._session = {
            raw: {},
            values: {},
            errors: [],
            first: false,
            page: null,
        };
    };

    //public methods
    template() {
        return this._form._buildTemplate();
    }

    errors(name) {
        return this._form.errors(name);
    }

    values() {
        return this._form.values();
    }

    value(name) {
        return this._form.value(name);
    }
}

//expose
module.exports = FormeRequest;