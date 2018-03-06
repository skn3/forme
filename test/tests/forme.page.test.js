"use strict";

//local imports
const {expect, blueprints, runFormCommands} = require('../testShared');

//tests
describe('Page', function () {
    describe('#singleForm', function () {
        it('should create a form with multiple pages', function () {
            return blueprints.view.withTwoPagesFourInputsKeepTwo()
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.totalPages).to.equal(2);
                expect(result.pageIndex).to.equal(0);
            });
        });

        it('should create a form with multiple pages but only inputs from page 1', function () {
            return blueprints.view.withTwoPagesFourInputsKeepTwo()
            .then(result => {
                expect(result.valid).to.equal(true);

                expect(Object.keys(result.templateVars.children)).to.deep.equal(['input1', 'input2']);

                expect(result.templateVars).to.have.nested.property('children.input1').that.includes({
                    __formeClass: 'input',
                    type: 'text',
                    alias: 'input1',
                    name: 'input1',
                });

                expect(result.templateVars).to.have.nested.property('children.input2').that.includes({
                    __formeClass: 'input',
                    type: 'text',
                    alias: 'input2',
                    name: 'input2',
                });
            });
        });

        it('should submit to the next page', function () {
            return blueprints.runCommands.withTwoPagesFourInputsKeepTwo([
                {
                    command: 'execute',
                    page: 'next',
                },
                {
                    command: 'view',
                }
            ])
            .then(result => {
                expect(result.valid).to.equal(true);

                expect(Object.keys(result.templateVars.children)).to.deep.equal(['input3', 'input4']);

                expect(result.templateVars).to.have.nested.property('children.input3').that.includes({
                    __formeClass: 'input',
                    type: 'text',
                    alias: 'input3',
                    name: 'input3',
                });

                expect(result.templateVars).to.have.nested.property('children.input4').that.includes({
                    __formeClass: 'input',
                    type: 'text',
                    alias: 'input4',
                    name: 'input4',
                });
            });
        });

        it('should keep values from inputs on previous page marked with keep', function () {
            return blueprints.runCommands.withThreePagesSixInputsKeepThree([
                {
                    command: 'view',
                },
                {
                    command: 'execute',
                    values: {
                        input1: 'value1YES',
                        input2: 'value2NO',
                    },
                    page: 'next',
                },
                {
                    command: 'view',
                },
                {
                    command: 'execute',
                    values: {
                        input3: 'value3YES',
                        input4: 'value4NO',
                    },
                },
            ])
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.values).to.deep.equal({
                    input1: 'value1YES',
                    input3: 'value3YES',
                    input4: 'value4NO'
                });
            });
        });

        it('should redirect to last visited page when visiting page out of sequence', function () {
            return blueprints.runCommands.withThreePagesSixInputsKeepThree([
                {
                    command: 'view',
                },
                {
                    command: 'execute',
                    page: 'next',//need this otherwise the form will just as if it has been submitted! (and finish)
                    goto: 'page3',//this will attempt to goto page3, before page2 has been completed (which will cause an invalid result)
                },
                {
                    command: 'view',
                },
            ])
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.reload).to.equal(true);
                expect(result.future).to.equal('page2');
                expect(result.totalPages).to.equal(3);
            });
        });
    });

    describe('#externalPages', function () {
        it('should submit next through multiple external pages', function () {
            const form1 = blueprints.create.withExternalPageOneOfThree();
            const form2 = blueprints.create.withExternalPageTwoOfThree();
            const form3 = blueprints.create.withExternalPageThreeOfThree();

            return runFormCommands([
                //page1
                {//#0
                    originalUrl: 'website.com/page1.html',
                    form: form1,
                    command: 'view',
                    expectPageIndex: 0,
                },
                {//#1
                    form: form1,
                    command: 'execute',
                    values: {
                        input1: 'value1YES',
                        input2: 'value2NO',
                    },
                    page: 'next',
                    expectPageIndex: 0,
                },

                //page2
                {//#2
                    form: form2,
                    command: 'view',
                    expectPageIndex: 1,
                },
                {
                    form: form2,
                    command: 'execute',
                    values: {
                        input3: 'value3YES',
                        input4: 'value4NO',
                    },
                    page: 'next',
                    expectPageIndex: 1,
                },

                //page3
                {
                    form: form3,
                    command: 'view',
                    expectPageIndex: 2,
                },
                {
                    form: form3,
                    command: 'execute',
                    values: {
                        input5: 'value5YES',
                        input6: 'value6NO',
                    },
                    page: 'next',
                    expectPageIndex: 2,
                },
            ])
            .then(result => {
                expect(result.valid).to.equal(true);
                expect(result.future).to.equal(null);
                expect(result.values).to.deep.equal({
                    input1: 'value1YES',
                    input3: 'value3YES',
                    input5: 'value5YES',
                    input6: 'value6NO',
                });
            });
        });

        it('should fail when invalid external page is given', function () {
            const form1 = blueprints.create.withExternalPageOneOfThree();
            const form2 = blueprints.create.withInput();//this one doesnt have page information so will fail!
            const form3 = blueprints.create.withExternalPageThreeOfThree();

            return expect(runFormCommands([
                //page1
                {//#0
                    originalUrl: 'website.com/page1.html',
                    form: form1,
                    command: 'view',
                    expectPageIndex: 0,
                },
                {//#1
                    form: form1,
                    command: 'execute',
                    page: 'next',
                    expectPageIndex: 0,
                },

                //page2
                {//#2
                    form: form2,
                    command: 'view',
                    expectPageIndex: 1,
                },
                {//#3
                    form: form2,
                    command: 'execute',
                    page: 'next',
                    expectPageIndex: 1,
                },

                //page3
                {//#4
                    form: form3,
                    command: 'view',
                    expectPageIndex: 2,
                },
                {//#5
                    form: form3,
                    command: 'execute',
                    page: 'next',
                    expectPageIndex: 2,
                },
            ])).to.eventually.be.rejectedWith(/^unexpected page index '-1' for command #2/);
        });

        it('should redirect back to last valid page if visiting out of order', function () {
            const form1 = blueprints.create.withExternalPageOneOfThree();

            return runFormCommands([
                {
                    originalUrl: 'website.com/page3.html',
                    form: form1,
                    command: 'view',
                },

            ])
            .then(result => {
                expect(result.valid).to.equal(false);
                expect(result.reload).to.equal(true);
                expect(result.pageIndex).to.equal(-1);//epic fail as we have tried to start a form in the middle
                expect(result.totalPages).to.equal(3);
            });
        });
    });
});