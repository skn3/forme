'use strict';

//classes
class FormeResult {
    constructor(form, templateVars = null) {
        //this needs to create a snapshot of data as the form could be reset after the result is created
        this._form = form;
        this._driver = form._currentDriver;
        this._storage = form._currentDriver._storage;
        this._token = form._request._token;
        this._future = form._request._future;
        this._valid = form._request._valid;
        this._saved = form._request._saved;
        this._reload = form._request._reload;
        this._destination = form._makeDestination();//pre calc the destination
        this._values = form.getValue();
        this._errors = form.getAllErrors();
        this._actions = form._request._actions.slice();
        this._inputs = form.getInputs();
        this._inputTypes = form.getInputTypes();
        this._templateVars = templateVars;//filled in by FormeResult.createWithPromise ... only bother generating template when viewing
    };

    //static
    static createWithPromise(form) {
        //do we need to generate template vars?
        if (!form._request._view) {
            //nope!
            return Promise.resolve(new this(form));
        } else {
            //yup
            return form.templateVars()
            .then(vars => new this(form, vars))
        }
    }

    //properties
    get form() {
        return this._form;
    }

    get storage() {
        return this._storage;
    }

    get valid() {
        return this._valid;
    }

    get reload() {
        return this._reload;
    }

    get templateVars() {
        return this._templateVars;
    }

    get destination() {
        return this._destination;
    }

    get values() {
        return this._values;
    }

    get failed() {
        return !this._valid;
    }

    get errors() {
        return this._errors;
    }

    get actions() {
        return this._actions;
    }

    get inputs() {
        return this._inputs;
    }

    get inputTypes() {
        return this._inputTypes;
    }
}

//expose
module.exports = FormeResult;