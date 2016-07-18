'use strict';

//main class
class FormHandler {
    constructor(error) {
        this.error = error || null;
    }

    execute(req, form, finish) {
        return finish();
    }
}

//expose module
module.exports = FormHandler;