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
                emptyValue: 'hello',
                label: 'hello',
            })).to.deep.equal(['int', 'emptyValue', 'require', 'label']);
        });

        it('should re order configuration properties into percieved order #2', function () {
            expect(trackInputConfigurationCalls({
                label: 'hello',
                required: true,
                emptyValue: 'hello',
                int: true,
            })).to.deep.equal(['int', 'emptyValue', 'require', 'label']);
        });
    });
});