"use strict";

//local imports
const {expect, TestDriverForm, trackInputConfigurationCalls, blueprints} = require('../testShared');

//tests
describe('Configuration', function () {
    describe('#configuringElement', function () {
        it('should re order configuration properties into percieved order #1', function () {
            expect(trackInputConfigurationCalls({
                int: true,
                required: true,
                empty: 'hello',
                label: 'hello',
            })).to.deep.equal(['int', 'empty', 'require', 'label']);
        });

        it('should re order configuration properties into percieved order #2', function () {
            expect(trackInputConfigurationCalls({
                label: 'hello',
                required: true,
                empty: 'hello',
                int: true,
            })).to.deep.equal(['int', 'empty', 'require', 'label']);
        });
    });
});