'use strict';

//import this early!
const testShared = require('./testShared');

//root tests :D
describe('Forme', function() {
    require('./tests/forme.utils.test');
    require('./tests/forme.base.test');
    require('./tests/forme.configuration.test');
    require('./tests/forme.form.test');
    require('./tests/forme.page.test');
    require('./tests/forme.component.test');
    require('./tests/forme.input.test');
    require('./tests/forme.container.test');
    require('./tests/forme.template.test');
});