'use strict';

//main class
class FormHandler {
    constructor(error) {
        this.error = error || null;
    }

    execute(storage, form, state) {
        return Promise.resolve();
    }
}

//expose module
module.exports = FormHandler;