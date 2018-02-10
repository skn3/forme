"use strict";

//local imports
const {
    expect,
    TestDriverForm,
    createExpressRequest,
    viewFormSubmitThenView
} = require('../testShared');

//tests
describe('Form', function () {
    describe('#basic', function () {
        it('should view a basic form', function () {
            const form = new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                    },
                ],
            });

            //view the form
            return form.view(createExpressRequest())
            .then(result => {
                const templateVars = result.templateVars;

                expect(result.valid).to.equal(true);
                expect(templateVars).to.be.an('object').that.has.property('children').which.is.an('object');
                expect(templateVars.children).to.have.nested.property('myInput1').that.includes({
                    __formeClass: 'input',
                    type: 'text',
                    alias: 'myInput1',
                    name: 'myInput1',
                });
            });
        });

        it('should execute a basic form', function () {
            const form = new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                    },
                ],
            });

            //view the form
            return form.execute(createExpressRequest({
                body: {
                    myInput1: 'hello world!',
                },
            }))
            .then(result => {
                const values = result.values;

                expect(result.valid).to.equal(true);
                expect(values).to.have.nested.property('myInput1').which.equals('hello world!');
            });
        });
    });

    describe('#validation', function () {
        it('should successfully execute custom input validation handler', function () {
            let called = false;

            const form = new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                        validate: (form, input, state) => called = true,
                    },
                ],
            });

            //view the form
            return form.execute(createExpressRequest())
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(called).to.equal(true);
            });
        });

        it('should successfully execute custom form validation handler', function () {
            let called = false;

            const form = new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                    },
                ],
                validate: (form, state) => called = true,
            });

            //view the form
            return form.execute(createExpressRequest())
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(called).to.equal(true);
            });
        });

        it('should successfully execute custom page validation handler', function () {
            let called = false;

            const form = new TestDriverForm({
                name: 'testForm',
                pages: [
                    {
                        name: 'page1',
                        inputs: [
                            {
                                type: 'text',
                                name: 'myInput1',
                            },
                        ],
                        validate: (form, page, state) => called = true,
                    },
                ],
            });

            //view the form
            return form.execute(createExpressRequest())
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(called).to.equal(true);
            });
        });

        it('should successfully call form, page, input validation handlers in the correct order', function () {
            let called = [];

            const form = new TestDriverForm({
                name: 'testForm',
                pages: [
                    {
                        name: 'page1',
                        inputs: [
                            {
                                type: 'text',
                                name: 'myInput1',
                                validate: (form, input, state) => called.push('input'),
                            },
                        ],
                        validate: (form, page, state) => called.push('page'),
                    },
                ],
                validate: (form, state) => called.push('form'),
            });

            //view the form
            return form.execute(createExpressRequest())
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(called).to.be.an('array').and.deep.equal(['input', 'page', 'form']);
            });
        });
    });

    describe('#store', function () {
        it('should persist a form using session', function () {
            return viewFormSubmitThenView(new TestDriverForm({
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
                    {
                        type: 'text',
                        name: 'myInput2',
                    },
                ],
            }),

            //submit with these values
            {
                myInput2: 'insert_value_here'
            },

            //validate the submit
            result => {
                expect(result.valid).to.equal(false);
                expect(result).to.have.nested.property('_errors').that.is.an('array').with.lengthOf(1).and.nested.property('[0].error').that.equals('CUSTOM_ERROR_TOKEN');
            })

            //test the view
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result).to.have.nested.property('_errors').that.is.an('array').with.lengthOf(1).and.nested.property('[0].error').that.equals('CUSTOM_ERROR_TOKEN');
                expect(result.values).to.have.property('myInput2').that.equals('insert_value_here');
            });
        });

        it('should persist a form using session where inputs are grouped', function () {
            return viewFormSubmitThenView(new TestDriverForm({
                name: 'testForm',
                inputs: [
                    {
                        type: 'text',
                        name: 'myInput1',
                        group: ['group1', 'group2'],
                        required: {
                            required: true,
                            error: 'CUSTOM_ERROR_TOKEN',
                        },
                    },
                    {
                        type: 'text',
                        name: 'myInput2',
                        group: ['group1'],
                    },
                ],
            }),

            //submit with these values
            {
                myInput2: 'insert_value_here',
            },

            //validate the submit
            result => {
                expect(result.valid).to.equal(false);
                expect(result).to.have.nested.property('_errors').that.is.an('array').with.lengthOf(1).and.nested.property('[0].error').that.equals('CUSTOM_ERROR_TOKEN');
            })

            //test the view
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result).to.have.nested.property('_errors').that.is.an('array').with.lengthOf(1).and.nested.property('[0].error').that.equals('CUSTOM_ERROR_TOKEN');
                expect(result.values).to.deep.equal({
                    group1: {
                        group2: {
                            myInput1: null,
                        },
                        myInput2: 'insert_value_here',
                    }
                });
            });
        });
    });
});