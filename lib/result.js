'use strict';

//classes
class FormeResult {
    constructor(form, templateVars = null) {
        //this needs to create a snapshot of data as the form could be reset after the result is created
        const request = form._request;

        this._form = form;
        this._driver = form._currentDriver;
        this._storage = form._currentDriver._storage;
        this._token = request._token;
        this._future = request._future;
        this._valid = request._valid;
        this._saved = request._saved;
        this._reload = request._reload;
        this._destination = form._makeDestination();//pre calc the destination
        this._errors = form._getAllErrors();
        this._actions = request._actions.slice();
        this._templateVars = templateVars;//filled in by FormeResult.createWithPromise ... only bother generating template when viewing

        this._totalPages = form.totalPages;
        this._pageIndex = form.pageIndex;

        //add stuff dependant on if the form has started (to avoid invalid calls)
        if (!request || !request._started) {
            this._values = {};
            this._namedValues = {};
            this._inputs = [];
            this._inputTypes = [];
        } else {
            this._values = form.getValue();
            this._namedValues = form.getNamedValues();
            this._inputs = form.getInputs();
            this._inputTypes = form.getInputTypes();
        }
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

    get namedValues() {
        return this._namedValues;
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

    get totalPages() {
        return this._totalPages;
    }

    get pageIndex() {
        return this._pageIndex;
    }

    get future() {
        return this._future;
    }
}

//expose
module.exports = FormeResult;