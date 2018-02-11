"use strict";

//local imports
const {expect, TestDriverForm, createExpressRequest, blueprints} = require('../testShared');

//tests
describe('Form', function () {
    describe('#basic', function () {
        it('should view a basic form', function () {
            return blueprints.view.withInput()
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.templateVars).to.be.an('object').that.has.property('children').which.has.nested.property('input1').that.includes({
                    __formeClass: 'input',
                    type: 'text',
                    alias: 'input1',
                    name: 'input1',
                });
            });
        });

        it('should execute a basic form', function () {
            return blueprints.submit.withInput({
                input1: 'hello world!',
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.have.nested.property('input1').which.equals('hello world!');
            });
        });
    });

    describe('#validation', function () {
        it('should successfully execute custom input validation handler', function () {
            let called = false;
            return blueprints.submit.withInputConfiguration(null, {
                validate: (form, input, state) => called = true,
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(called).to.equal(true);
            });
        });

        it('should successfully execute custom form validation handler', function () {
            let called = false;
            return blueprints.submit.withConfiguration(null, {
                validate: (form, state) => called = true,
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(called).to.equal(true);
            });
        });

        it('should successfully execute custom page validation handler', function () {
            let called = false;
            return blueprints.submit.withPageConfiguration(null, {
                validate: (form, page, state) => called = true,
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(called).to.equal(true);
            });
        });

        it('should successfully call form, page, input validation handlers in the correct order', function () {
            let called = [];
            return blueprints.submit.withConfiguration(null, {
                page: {
                    name: 'page1',
                    input: {
                        type: 'text',
                        name: 'input1',
                        validate: (form, input, state) => called.push('input'),
                    },
                    validate: (form, page, state) => called.push('page'),
                },
                validate: (form, state) => called.push('form'),
            })
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(called).to.be.an('array').and.deep.equal(['input', 'page', 'form']);
            });
        });
    });

    describe('#store', function () {
        it('should persist a form using session', function () {
            return blueprints.submitThenView.withTwoInputsOneRequired({
                input2: 'insert_value_here'
            })
            .then(result => {
                //after view
                expect(result.valid).to.equal(true);
                expect(result).to.have.nested.property('errors').that.is.an('array').with.lengthOf(1).and.has.nested.property('[0].error').that.equals('CUSTOM_REQUIRED_ERROR');
                expect(result.values).to.have.property('input2').that.equals('insert_value_here');
            });
        });

        it('should persist a form using session where inputs are grouped', function () {
            return blueprints.submitThenView.withTwoGroupedInputsOneRequired({
                group1: {
                    input2: 'insert_value_here',
                },
            })
            .then(result => {
                //after view
                expect(result.valid).to.equal(true);
                expect(result).to.have.nested.property('errors').that.is.an('array').with.lengthOf(1).and.has.nested.property('[0].error').that.equals('CUSTOM_REQUIRED_ERROR');
                expect(result.values).to.deep.equal({
                    group1: {
                        group2: {
                            input1: null,
                        },
                        input2: 'insert_value_here',
                    }
                });
            });
        });
    });
});