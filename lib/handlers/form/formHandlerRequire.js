'use strict';

//local imports
const FormHandler = require('../formHandler.js');

//main class
class FormHandlerRequire extends FormHandler {
    constructor(conditions, op, error) {
        super(error);
        this.conditions = conditions;
        this.op = op || 'and';
    }
    
    execute(req, form, finish) {
        //process op
        let group;
        let inputIndex;
        let name;
        let value;

        switch(this.op) {
            case 'and':
                //must have all values specified
                for(let groupIndex = 0;groupIndex < this.conditions.length;groupIndex++) {
                    group = this.conditions[groupIndex];

                    for (inputIndex = 0;inputIndex < group.length;inputIndex++) {
                        name = group[inputIndex];
                        value = form.value(req, name);

                        if (value === null || (typeof value == 'string' && value.length == 0)) {
                            return finish('Required fields were empty');
                        }
                    }
                }
                //sucess
                return finish();
            case 'or':
                //any specified item must exist (item can be single or multiple inputs)
                let found;

                for(let groupIndex = 0;groupIndex < this.conditions.length;groupIndex++) {
                    group = this.conditions[groupIndex];
                    found = true;

                    //sub group uses 'and' as op
                    for (inputIndex = 0;inputIndex < group.length;inputIndex++) {
                        name = group[inputIndex];
                        value = form.value(req, name);

                        if (value === null || (typeof value == 'string' && value.length == 0)) {
                            found = false;
                            break;
                        }
                    }

                    //success
                    if (found) {
                        return finish();
                    }
                }

                //failed
                return finish('Required fields were empty');
        }

        //skip
        return finish();
    }
}

//expose module
module.exports = FormHandlerRequire;