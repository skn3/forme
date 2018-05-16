'use strict';

//main class
class ExecuteHandler {
    constructor(error=null) {
        this._index = null;//order added to element
        this.error = error;
    }

    //properties
    get configuration() {
        return undefined;
    }
}

//expose module
module.exports = ExecuteHandler;