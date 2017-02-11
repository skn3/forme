'use strict';

class FormeRequest {
    constructor(req, form) {
        this._req = req;
        this._form = form;

        this._session = {
            raw: {},
            values: {},
            errors: [],
            first: false,
        };

        //form values
        this._raw = [];
        this._values = {};
        this._errors = [];
        this._stored = false;
        this._first = false;
    };

    //public methods
    template() {
        return this._form._buildTemplate(this);
    }

    errors(name) {
        return this._form.errors(this._req, name);
    }

    values() {
        return this._form.values(this._req);
    }

    value(name) {
        return this._form.value(this._req, name);
    }
}

//expose
module.exports = FormeRequest;