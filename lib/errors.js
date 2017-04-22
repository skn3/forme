'use strict';

//errors
class FormeError extends Error {
    constructor(message) {
        super(message);
        this.message = message;
        this.name = this.constructor.name;
    }
}

class FormeInputError extends FormeError {
    constructor(message, input) {
        super(message);
        this.message = message;
        this.input = input;
        this.name = this.constructor.name;
    }
}

module.exports = {
    FormeError: FormeError,
    FormeInputError: FormeInputError,
};