'use strict';

//base errors
class FormeError extends Error {
    constructor(message) {
        super(message);
        this.message = message;
        this.name = this.constructor.name;
    }
}

class FormeDriverError extends FormeError {
}

class FormeConfigurationError extends FormeError {
    constructor(method, param, what) {
        super(`configure method '${method.label}'${param?" '"+param.label:"'"}' ${what}`);
    }
}

class FormeContextError extends FormeError {
    constructor(message, context) {
        super(message);
        this.context = context;
    }
}

class FormeFormError extends FormeContextError {
    get form() {
        return this.context;
    }
}

class FormePageError extends FormeContextError {
    get page() {
        return this.context;
    }
}

class FormeInputError extends FormeContextError {
    get input() {
        return this.context;
    }
}

class FormeComponentError extends FormeContextError {
    get component() {
        return this.context;
    }
}

class FormeValidationError extends FormeContextError {
}

//expose
module.exports = {
    FormeError: FormeError,
    FormeDriverError: FormeDriverError,
    FormeConfigurationError: FormeConfigurationError,
    FormeContextError: FormeContextError,
    FormeFormError: FormeFormError,
    FormePageError: FormePageError,
    FormeInputError: FormeInputError,
    FormeComponentError: FormeComponentError,
    FormeValidationError: FormeValidationError,
};