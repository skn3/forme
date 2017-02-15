'use strict';

class FormeRequest {
    constructor(form) {
        this._form = form;
        this._page = null;
        this._saved = false;
        this._first = true;
        this._raw = [];
        this._values = {};
        this._errors = [];
        this._actions = [];
    };

    //private methods
    _load() {
        if (this._form._sessionHandler) {
            //let session handler do load
            return this._sessionHandler.load(this)
            .then(session => {
                //copy data from session
                this._request._errors = session.errors;
                this._request._first = session.first;
                this._request._page = session.page;

                //clear the session
                return this._sessionHandler.clear(this)
            })
            .then(() => true);
        } else {
            //we don't have a session handler so do the best we can
            return Promise.resolve(false);
        }
    }

    _save() {
        if (this._form._sessionHandler) {
            return this._sessionHandler.save(this, {
                raw: this._form._fetchValues(true, false, true, null),
                values: this._form._fetchValues(true, false, false, null),
                errors: this._form._request._errors,
                first: this._form._request._first,
                page: this._form._page._name,
            })
            .then(() => true);
        } else {
            return Promise.resolve(false);
        }
    }

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