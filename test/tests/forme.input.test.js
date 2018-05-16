"use strict";

//local imports
const {expect, executeFormActions, blueprints} = require('../testShared');

//tests
describe('Input', function () {
    describe('#value', function () {
        it('should set default input value', function () {
            return blueprints.view.withInputDefaultValue()
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.have.nested.property('input1').which.equals('theDefaultValue');
            });
        });
    });

    describe('#process', function () {
        it('should succeed with valid input json', function () {
            const data = {
                hello: 'world',
            };
            return blueprints.submit.withInputJson({
                input1: JSON.stringify(data),
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.have.nested.property('input1').that.deep.equals(data);
            });
        });

        it('should fail with invalid input json', function () {
            const data = 'INVALID_JSON_HERE';
            return blueprints.submit.withInputJson({
                input1: data,
            })
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.errors).to.be.an('array').with.lengthOf(1).and.have.nested.property('[0].error').that.equals('CUSTOM_JSON_ERROR');
            });
        });
    });

    describe('#validation', function () {
        it('should should catch required input', function () {
            let called = false;
            return blueprints.submit.withInputRequired()
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.errors).to.be.an('array').with.lengthOf(1).and.have.nested.property('[0].error').that.equals('CUSTOM_REQUIRED_ERROR');
            });
        });

        it('should validate required input that has a string value', function () {
            return blueprints.submit.withInputRequired({
                input1: 'valueHere',
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result).to.have.property('errors').that.is.an('array').with.lengthOf(0);
            });
        });

        it('should validate required input that has a numerical value', function () {
            return blueprints.submit.withInputRequired({
                input1: 123456,
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result).to.have.property('errors').that.is.an('array').with.lengthOf(0);
            });
        });

        it('should validate required input that has a (valid) boolean false value', function () {
            return blueprints.submit.withInputRequired({
                input1: false,
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result).to.have.property('errors').that.is.an('array').with.lengthOf(0);
            });
        });

        it('should fail validation with blacklisted value', function () {
            return blueprints.submit.withInputBlacklist({input1: 'I_AM_NOT_ALLOWED!!!'})
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.errors).to.be.an('array').with.lengthOf(1).and.have.nested.property('[0].error').that.equals('CUSTOM_BLACKLIST_ERROR');
            });
        });

        it('should fail validation with invalid option', function () {
            return blueprints.submit.withInputWhitelist({input1: 'I_AM_NOT_ALLOWED!!!'})
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.errors).to.be.an('array').with.lengthOf(1).and.have.nested.property('[0].error').that.equals('CUSTOM_OPTIONS_ERROR');
            });
        });
    });

    describe('#output', function () {
        it('should modify input output', function () {
            let called = false;
            return blueprints.submit.withInputOutput()
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.have.nested.property('input1').that.equals('CHANGED');
            });
        });

        it('should modify permanent input output', function () {
            let called = false;
            return blueprints.submit.withInputPermanentOutput()
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.have.nested.property('input1').that.equals('CHANGED');
            });
        });

        it('should fail to modify input output', function () {
            let called = false;
            return blueprints.submit.withInputOutputError()
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.errors).to.be.an('array').with.lengthOf(1).and.have.nested.property('[0].error').that.equals('CUSTOM_OUTPUT_ERROR');
            });
        });

        it('should convert string value "true" to bool true', function () {
            return blueprints.submit.withInputBool({
                input1: "true",
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.have.nested.property('input1').that.equals(true);
            });
        });

        it('should convert string value "false" to bool false', function () {
            return blueprints.submit.withInputBool({
                input1: "false",
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.have.nested.property('input1').that.equals(false);
            });
        });

        it('should convert string value "TrUe" to bool true', function () {
            return blueprints.submit.withInputBool({
                input1: "TrUe",
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.have.nested.property('input1').that.equals(true);
            });
        });

        it('should convert string value "foo" to bool true', function () {
            return blueprints.submit.withInputBool({
                input1: "foo",
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.have.nested.property('input1').that.equals(true);
            });
        });
    });

    describe('#checkbox', function () {
        it('should submit two checkboxes but with only 1 selected', function () {
            return blueprints.submitView.withTwoCheckboxes({
                checkbox1: 'checked',
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.templateVars).to.have.nested.property('children.checkbox1.type').that.equals('checkbox');
                expect(result.templateVars).to.have.nested.property('children.checkbox2.type').that.equals('checkbox');
                expect(result.templateVars).to.have.nested.property('children.checkbox1.checked').that.equals(true);
                expect(result.templateVars).to.have.nested.property('children.checkbox2.checked').that.equals(false);
            });
        });

        it('should maintain checkbox selection after navigating back to page', function () {
            return blueprints.runCommands.withTwoPagesFourInputsTwoCheckboxes([
                {
                    command: 'view',
                },
                {
                    command: 'execute',
                    values: {
                        checkbox1: 'checked',
                    },
                    page: 'next',
                },
                {
                    command: 'view',
                },
                {
                    command: 'execute',
                    values: {
                        input1: 'value1',
                    },
                    page: 'prev',
                },
                {
                    command: 'view',
                },
            ])
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.templateVars).to.have.nested.property('children.checkbox1.type').that.equals('checkbox');
                expect(result.templateVars).to.have.nested.property('children.checkbox2.type').that.equals('checkbox');
                expect(result.templateVars).to.have.nested.property('children.checkbox1.checked').that.equals(true);
                expect(result.templateVars).to.have.nested.property('children.checkbox2.checked').that.equals(false);
            });
        });

        it('should append selected checkboxes to previous selections', function () {
            return blueprints.runCommands.withTwoPagesFourInputsTwoCheckboxes([
                {
                    command: 'view',
                },
                {
                    command: 'execute',
                    values: {
                        checkbox1: 'checked',
                    },
                    page: 'next',
                },
                {
                    command: 'view',
                },
                {
                    command: 'execute',
                    values: {
                        input1: 'value1',
                    },
                    page: 'prev',
                },
                {
                    command: 'view',
                },
                {
                    command: 'execute',
                    values: {
                        checkbox2: 'checked',
                    },
                    page: 'next',
                },
                {
                    command: 'view',
                },
            ])
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.templateVars).to.have.nested.property('children.input1.type').that.equals('text');
                expect(result.templateVars).to.have.nested.property('children.input1.value').that.equals('value1');//make sure the middle step worked
                expect(result.values).to.have.property('checkbox1').that.equals('checked');
                expect(result.values).to.have.property('checkbox2').that.equals('checked');
            });
        });
    });

    describe('#errors', function () {
        it('should get element errors', function () {
            return blueprints.submit.withInputRequired()
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.errors).to.be.an('array').with.lengthOf(1).and.have.nested.property('[0].error').that.equals('CUSTOM_REQUIRED_ERROR');
            });
        });
    });
});