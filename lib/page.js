'use strict';

class FormePage {
    constructor(storage, form) {
        this._req = storage;
        this._form = form;
    };
}

//expose
module.exports = FormePage;