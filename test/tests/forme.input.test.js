"use strict";

//local imports
const {expect, TestDriverForm, createExpressRequest} = require('../testShared');

//tests
describe('Input', function () {
    describe('#value', function () {
        it('should set default input value', function () {
            const form = new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                        value: 'theDefaultValue',
                    },
                ],
            });

            //view the form
            return form.view(createExpressRequest())
            .then(result => {
                const values = result.values;

                expect(result.valid).to.equal(true);
                expect(values).to.have.nested.property('myInput1').which.equals('theDefaultValue');
            });
        });
    });

    describe('#.required()', function () {
        it('should should catch required input', function () {
            let called = false;

            const form = new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                        required: {
                            required: true,
                            error: 'CUSTOM_ERROR_TOKEN',
                        },
                    },
                ],
            });

            //view the form
            return form.execute(createExpressRequest())
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result).to.have.nested.property('_errors').that.is.an('array').with.lengthOf(1).and.nested.property('[0].error').that.equals('CUSTOM_ERROR_TOKEN');
            });
        });

        it('should validate required input that has a string value', function () {
            let called = false;

            const form = new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                        required: {
                            required: true,
                        },
                    },
                ],
            });

            //view the form
            return form.execute(createExpressRequest({
                body: {
                    myInput1: 'valueHere',
                },
            }))
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result).to.have.nested.property('_errors').that.is.an('array').with.lengthOf(0);
            });
        });

        it('should validate required input that has a numerical value', function () {
            let called = false;

            const form = new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                        required: {
                            required: true,
                            error: 'CUSTOM_ERROR_TOKEN',
                        },
                    },
                ],
            });

            //view the form
            return form.execute(createExpressRequest({
                body: {
                    myInput1: 12345,
                },
            }))
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result).to.have.nested.property('_errors').that.is.an('array').with.lengthOf(0);
            });
        });

        it('should validate required input that has a (valid) boolean false value', function () {
            let called = false;

            const form = new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                        required: {
                            required: true,
                            error: 'CUSTOM_ERROR_TOKEN',
                        },
                    },
                ],
            });

            //view the form
            return form.execute(createExpressRequest({
                body: {
                    myInput1: false,
                },
            }))
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result).to.have.nested.property('_errors').that.is.an('array').with.lengthOf(0);
            });
        });
    });
});