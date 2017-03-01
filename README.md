# Forme

Forme has been designed to offer a sane way for handling forms in nodejs using **promises**. A form can be built to handle a user input or even manage data from api requests. Forme does not dictate to you how a form should build, process or render. With forme you can handle forms in the way that suites you.

Your form object is created in such a way that it can be reused for multiple instances of that form. You simply provide a storage object and Forme will use it to store any live data when processing a particular instance of the form. You can create one static form or if you want, you can create a form per page request. With both modes, Forme provides a way for you to add inputs dynamically. 

Forme has no hardcoded concept of rendering. It provides you with a simple way to generate an object containing all the information about your form. This object can then be passed to your template engine of choice.

- Create static or dynamic form objects to handle input in a generic fashion.
- Easily apply built in input handlers to process and validate your data.
- Create multi-page forms with 1 command.
- Integrate into the templating system of your choice.
- Not limited to any specific frameworks.
- Extensible internal works.

The project is still in development but feel free to have a play!


## Upgrading From Version 1.x

If you have been using version 1.x then please review the entire readme. We have rewritten large portions of it. Below is a list of changes that may need some attention in your projects:

- renamed the submit starting method from `form.validate(req)` to `form.submit(storage)`
- no longer have to pass the `req`/`storage` object around to **every** API method.
- renamed `form.session()` to `form.driver()` and revamped the abilities of custom integration. (see [here](#customDriversIntegration))
- callbacks no longer require a promise to be returned (a positive response will be assumed)
- manual save has been renamed from `form.store(req)` to `form.save()`
- the result object produced by `form.submit(storage).then(result => {})` and `form.view(storage).then(result => {})`, are now an *instanceof* FormeResult. (see [here](#apiResult))


## Index

**Topics**
- [Hello World](#helloWorld)
- [Working Form (+express)](#workingForm)
- [Pages](#pages)
- [Dynamic Forms](#dynamicForms)
- [Grouping and Referencing Inputs](#groupingAndReferencingInputs)
- [Input Type](#inputType)
- [Custom Validation](#customFormValidation)
- [Custom Submit Handling](#customSubmitHandling)
- [Actions](#actions)
- [Custom Errors](#customErrors)
- [Order of Validation](#orderOfExecution)
- [Template](#template)
- [Form Require Validation (and / or)](#requireValidation)
- [Validation in final .then()](#validationInFinalThen)
- [Manually calling form.next() / form.prev() / form.reset()](#manuallyCallingSpecialActions)
- [Custom Drivers / Integration](#customDriversIntegration)

**API / Reference**
- [Form](#apiForm)
- [Page](#apiPage)
- [Input](#apiInput)
- [Result](#apiResult)
- [Module](#apiModule)


## <a name="helloWorld"></a> Hello World 

Forme is split into two main modes of operation. `.view()` and `.submit()`. These are self explanatory modes our form may be in. For simplicities sake, lets start with a basic pseudo example.
```javascript
const forme = require('forme');

const form = forme('form1');
form.add('hello').value('world');

function get(req, res) {
    return form.view(req).then(result => {
        if (result.reload) {
            res.redirect(result.destination);
        } else {
            //render the form
        }
    });
}

function post(req, res) {
    return form.submit(req).then(result => {
        if (result.reload) {
            res.redirect(result.destination);
        } else {
            //success
        }
    });
}
```

For this to work we would have to hook the `get()` and `post()` up to our web server code.

The only thing Forme assumes of your code, is a `storage` container to store/retrieve certain pieces of vital information. You can see here we are passing the `req` object into `.view()` and `.submit()`. Forme will make sure not to pollute your storage object, and will store everything within one root property `storage.forme`.

Forme has taken out all of the work and left us with the bare minimum of code to write. The only thing we really need to check for is if `result.reload` is indicating that the form needs reloading. Now while we could have designed Forme to handle page redirects, we chose to retain the agnostic approach!

## <a name="workingForm"></a> Working Form 

The next step is to visualise and process your form data. As Forme has been designed to go anywhere, we are free to choose our rendering/templating method of choice. The example below is fully functional, using express and html5 template literals.

```javascript
const express = require("express");
const session = require('express-session');
const bodyParser = require('body-parser');
const forme = require('forme');

//app
const app = express();
app.use(session({secret: 'keyboard cat', resave: true, saveUninitialized: true}));
app.use(bodyParser.urlencoded({extended: true}));

//form
const form = forme('myForm');
form.add('field1').require();

//routes
app.get('/myForm', (req, res) => {
    return form.view(req)
    .then(result => {
        if (result.reload) {
            res.redirect(result.destination);
        } else {
            //display form
            const form = result.template.form;
            const field1 = result.template.input.field1;
            const errors = ''.concat(...field1.errors.map(error => `<li>${error}</li>`));

            res.send(`
                <form name="${form.name}" method="${form.method}">
                    <div>
                        <label for="${field1.id}">${field1.label}</label>
                        <input id="${field1.id}" name="${field1.name}" type="${field1.type}" value="${field1.value || ''}" />
                        <ul>${errors}</ul>
                    </div>
                    <div>
                        <input type="submit" value="Submit" />
                    </div>
                </form>
            `);
        }
    });
});

app.post('/myForm', (req, res) => {
    return form.submit(req)
    .then(result => {
        if (result.reload) {
            res.redirect(result.destination);
        } else {
            //success, display the form
            res.send(JSON.stringify(result.values));
        }
    });
});

//start server
app.listen(3000, function () {
    console.log('Forme test app listening on port 3000!')
})
```

## <a name="pages"></a> Pages 

With forme we can split our form onto multiple pages. This can be done with one of two methods:

**One form**
```javascript
const form = forme('myForm');

const page1 = form.page('page1');
page1.add('field1').keep();
page1.add('next').next();

const page2 = form.page('page2');
page2.add('field2').keep();
page2.add('prev').prev();
```

**Multiple forms**

*/form/page1*
```javascript
const form = forme('formPage1');
form.page(['/form/page1', '/form/page2'], true);

form.add('field1').keep();
form.add('next').next();
```

*/form/page2*
```javascript
const form = forme('formPage2');
form.page(['/form/page1', '/form/page2'], true);

form.add('field2').keep();
form.add('prev').prev();
```

We mark the fields we want to retain between pages using `input.keep()`. This instructs Forme to save the values in storage. You will notice that we have special `input.prev()` and `input.next()`. These tell Forme to watch for when the input has a submitted value, and then perform a special action. As long as we are following the `result.reload` pattern described [here](#helloWorld), then Forme will do the rest.

<a name="specialActions"></a>
- `input.prev()` - allows the form to go back a page. This will alter the type/value of the input.
- `input.next()` - allows the form to go forwards a page. This will alter the type/value of the input.
- `input.reset()` - resets the form and goes to the first page. This will alter the type/value of the input.
- `input.submit()` - doesn't currently perform any special action. This will alter the type/value of the input.

When creating a single form with multiple pages we use `form.page('pageName')`. This will return a page object in which we can chain further API calls. We can do most things with this page, including: inputs, build handlers, validation handlers, submit handlers and more. 


## <a name="dynamicForms"></a> Dynamic Forms 

Most simple forms can be designed using the methods already discussed. Forme has been designed to make this as painless as possible. When we start to really want to push the boundaries and produce dynamic forms, Forme can adapt. We can create dynamic forms in two ways:

**Use .build() handlers**
```javascript
const form = forme('formDynamic');

form.build(form => {
    for(let index = 0; index < 10; index++) {
        form.add('field'+index);
    }
})

//get
form.view(req).then(result => {});

//post
form.submit(req).then(result => {});
```

**Recreate the form, each page request**
```javascript
function createForm(count) {
    const form = forme('formDynamic');

    for(let index = 0; index < count; index++) {
        form.add('field'+index);
    }
    
    return form;
}

//get
createForm(10).view(req).then(result => {});

//post
createForm(10).submit(req).then(result => {});
```

Both methods will work adequately for most scenarios. Things start to get a bit more complicated when you need dynamic pages. We advise to use the `.build()` handlers for these circumstances.

- `form.build(form => {})`
- `page.build((form, page) => {})`

Just like a form, we can call `page.build()` to add dynamic inputs.

```javascript
const form = forme('myForm');

const page1 = form.page('page1');
page1.build((form, page) => {
    for(let index = 0; index < 10; index++) {
        page.add('field'+index);
    }
});
```


## <a name="groupingAndReferencingInputs"></a> Grouping and Referencing inputs

Forme lets you add inputs to groups and also rename input results via aliases. With these two powerful mechanisms we can have our value data and output generated in a clean way. For example:

```javascript
const forme = require('forme');
const form = forme('someForm');
 
//add 10 unique inputs
for(let index = 0;index < 3;index++) {
   form.add('items__item'+index+'__field1').label('Field1').group(['items','item'+index]).alias('field1').value('foo');
   form.add('items__item'+index+'__field2').label('Field2').group(['items','item'+index]).alias('field2').value('bar');
}
```

You can see in this example we are creating 3 sets of inputs each with a unique name. Now we could go ahead and reference the inputs using their name, but that's not entirely sane for long term development. Who the hell wants to keep typing `items__item0__field1` all day long! Instead, we use `input.group()` and `input.alias()` for this input. You can chain multiple `input.group('a').group('b').group('c')` or provide an array of strings. 

When Forme generates any output, it will now group the values using whatever has been defined. So continuing from the example above:

```javascript
form.validate(storage)
.then((result) => {
    console.log(result.values);
});
```

This would produce the following output:

```javascript
   {
       items: {
           item_0: {
               field1: 'foo',
               field2: 'bar',
           },
           item_1: {
               field1: 'foo',
               field2: 'bar',
           },
           item_2: {
               field1: 'foo',
               field2: 'bar',
           }
       }
   };
```

The final piece of the puzzle is how do we now refer to these grouped/aliased inputs? Simple, we just use the group/alias in any function that lets us reference an input. For example:
 
```javascript
const field1 = form.value('items.item0.field1');
const field2 = form.value(['items','item0','field2']);
```

We can pass a group path as a string separated with `.`, or an array of group segments. The final segment of the array/path should be the alias or name of the input you are referencing.


## <a name="inputType"></a> Input Type

Forme will intelligently try to guess the input 'type' you have defined. It does this by looking at the API's you have called on the input. You can override the type by calling `input.type('foo')`. The type is only used when returning the template vars with `forme.template()`, it does not alter how forme handles the input.

When Forme is guessing the input type, it lets the most recently called API take precedence. So for example if we call `input.is('email').secure()`, the guessed type will be `password` and not `email`. 

There are internal rules that exist when determining the input type. The rules are checked in order, when one of these conditions is met, subsequent conditions are ignored.

1. If you have called `input.hidden()` on an input, then the type will always return `hidden` *(unless overridden with `input.type()`)*.
2. If you have called `input.prev()`, `input.next()`, `input.reset()` on an input, then the type will always return `button` *(unless overridden with `input.type()`)*.
3. If you have called `input.submit()` on an input, then the type will always return `submit` *(unless overridden with `input.type()`)*.
4. If you have called `input.checked()` on an input, then the type will always return `checkbox` *(unless overridden with `input.type()`)*.
5. If you have called `input.secure()` on an input, then the type will always return `password` *(unless overridden with `input.type()`)*.

**Examples**
```javascript
form.add('some_input').label('Some Input').int() //type="number";
form.add('some_input').label('Some Input').checked() //type="checkbox";
form.add('some_input').label('Some Input').secure() //type="password";
form.add('next').next() //type="button";
form.add('some_input').label('Some Input').is('email') //type="email";
form.add('some_input').label('Some Input').is('email').secure() //type="password";
form.add('some_input').label('Some Input').is('email').secure().type('date') //type="date";
```


## <a name="customValidation"></a> Custom Validation 

Forme lets you define custom form validation. Try using:

- `form.validate((form, state) => {}, error)`
- `page.validate((form, page, state) => {}, error])`
- `input.validate((form, input, state) => {}, error)`

*Form*

```javascript
const forme = require('forme');

const form = forme('testForm');

form.add('value1');
form.add('value2');

form.validate((form, state) => {
	if (state.values.value1 == 'database' || state.values.value2 == 'database') {
	    return Promise.reject(new Error('form contained a reserved word'));
 	}
 }, 'Invalid values');
```

```javascript
state: {
    values: {} //all submitted values
}
```

*Page*

```javascript
const forme = require('forme');

const form = forme('testForm');

const page1 = form.page1('page1');
page1.add('value1');

page1.validate((form, page, state) => {
	if (state.values.value1 == 'testing') {
	    return Promise.reject(new Error('no testing!'));
 	}
 }, 'Invalid values');
```

```javascript
state: {
    values: {} //all submitted values
}
```

*Input*

```javascript
const forme = require('forme');

const form = forme('testForm');

form.add('input1').validate((form, input, state) => {
	if (state.values.input1 == 'boombox') {
	    return Promise.reject(new Error('sorry to loud!'));
 	}
 }, 'Invalid values');
```

```javascript
state: {
    value: ''//the submitted value
}
```

<a name="customInputValidationDetails"></a>
 
Notice in the examples above we are using Promise.reject to indicate an error. This allows you to perform async operations and signal to Forme if there is an error. If you dont return a promise, Forme will assume the result was positive.

If you would like to provide a custom error message from within the callback, simply `Promise.reject(new Error())`. Forme lets you use the same placeholder tokens as described in the [Custom Errors](#customErrors) section.

If you want to alter the submitted values, simply modify `state.values` or `state.value`. 


## <a name="customSubmitHandling"></a> Custom Submit Handling 

Just like most other aspects of Forme, you can specify `.submit()` handlers. You do this with: 
- `form.submit(form => {})`
- `page.submit((form, page) => {})`
- `input.submit((form, input) => {})`

These handlers are executed at the very last moment before Forme returns to your successful `form.submit(req).then(result => {})`.

**Form**

```javascript
const forme = require('forme');

const form = forme('myForm').submit((form, input) => {
    //do something awesome
});
```

**Page**

```javascript
const forme = require('forme');

const form = forme('myForm').page('page1').submit((form, page) => {
    //do something awesome
});
```

**Input**

```javascript
const forme = require('forme');

const form = forme('myForm').add('field1').submit((form, input) => {
    //do something awesome
});
```


## <a name="actions"></a> Actions 

As you may have already read in this document, Forme lets you watch for special actions. There are built in actions to handle `input.prev()`, `input.next()`, `input.reset()` and `input.submit()` (*see [special actions](#specialActions)*). You can also create your own custom actions:

**Form**

```javascript
const forme = require('forme');

const form = forme('myForm');

form.add('field1').action('myAction', 'hello world', {optional:'context', data:'can', go:'here'})

form.action('myAction',(form, action, context) => {
    console.log('myAction was triggered!');
});
```

**Page**

```javascript
const forme = require('forme');

const form = forme('myForm');
const page1 = form.page('page1')

page1.add('field1').action('myAction', 'hello world', {optional:'context', data:'can', go:'here'})

page1.action('myAction',(form, page, action, context) => {
    console.log('myAction was triggered!');
});
```

In the examples above we are attaching an action to our input. We are saying that the action `myAction` should be triggered after validation, when the input `field1` contains the value `hello world`. We can optionally pass in a single context argument which will be available to any action callbacks. If you replaced `hello world` with `null` then this action would trigger, as long as the input value exists in the submitted form.

Next you will see that we adding an action callback to the form/page. This is where we run our code to handle whatever the action may do. It is possible to capture multiple actions at once, like so:

```javascript
const forme = require('forme');

const form = forme('myForm').action(['action1', 'action2', 'action3'],(form, action, context) => {
    console.log(action+' was triggered!');
});
```


## <a name="customErrors"></a> Custom Errors 

Many input methods allow you to provide a custom error string. For example:
```javascript
const forme = require('forme');

const form = forme('login').post('form/process.html');
form.add('username').label('Username').require().is('username','{label} is invalid');
```

You can see see in this example we have added a second argument *'{label} is invalid'* to the **.is()** method. This is our custom error that will be returned should the input fail the **.is()** test. Custom error messages can contain placeholder tokens, which will be automatically converted to useful information.
 
You can also use placeholder tokens with a small selection of form methods. For example when you call `form.validate(callback, error)`.
 
**Form Placeholder tokens:**
- **{label}** the current label for the form, defined with **form.label('My Label')**
- **{name}** the current name for the form. This is the machine-name for the form.
 
**Input Placeholder tokens:**
- **{label}** the current label for this input, defined with **input.label('My Label')**
- **{name}** the current name for this input. This is the machine-name for the input.


## <a name="requireValidation"></a> `form.require()` and `page.require()` Validation

When you specify **form.require(*conditions, op*)** or **page.require(*conditions, op*)**, you are telling Forme to apply input requirement tests upon validation. This lets you do and/or tests on specific sets of inputs. For each call to `.require()` the form **must** pass that particular test; so if you had multiple `.require()` then they would all have to pass.
 
```javascript
const forme = require('forme');

const form = forme('login').require([['input1'],['input2']],'or');
form.add('input1');
form.add('input2');
```
 
When we call `.require()` we provide conditions and an operator to match them with. Conditions are defined like so:
```javascript
conditions = [
    //group1
    ['input1','input2'],
    
    //group2
    ['input1','input3'],
];
```
 
The above example translates to the following conditional check:
```javascript
if ((input1.Length && input2.Length) || (input1.Length && input3.Length)) {
}
```

If we changed the op to `'and'` then it would be the equivalent of:
```javascript
if ((input1.Length || input2.Length) && (input1.Length || input3.Length)) {
}
```


## <a name="orderOfExecution"></a> Order of Execution 

Forme has a downright sensible order of execution. The order is as follows:

`form.submit(storage).then(result => {})`
1. call `form.submit(storage)`
2. execute `form.load(callback)` in order defined.
3. execute `page.load(callback)` in order defined.
4. execute `form.build(callback)` in order defined.
5. execute `page.build(callback)` in order defined.
6. execute `input.validate(callback)` in order defined.
7. execute `page.validate(callback)` in order defined.
8. execute `form.validate(callback)` in order defined.
9. execute `input.submit(callback)` in order defined.
10. execute `page.submit(callback)` in order defined.
11. execute `form.submit(callback)` in order defined.
12. execute `page.action(action, callback)` in order defined.
13. execute `form.action(action, callback)` in order defined.
14. return promise to `form.submit(storage).then(result => {})`.

During the above execution order, forme might fail the process and skip to the last step. The result will contain various states but check for `result.reload = false` to see if the form needs reloading.


## <a name="template"></a> Template 

Forme does not dictate how your form should be rendered. We provide a mechanism for you to get a comprehensive overview of your form; you can then pass this to your template engine of choice.

```javascript
template = {
    form: {
        name: '',
        method: '',
        action: '', //not to be confused with Forme actions
        first: true/false, //is this the first time the form is being viewed
        context: {
            any: 'data',
            added: 'to',
            the: 'form',
            using: 'form.context()',
        },
        errors: [
            {
                name: '',
                error: 'form error',
            },
            {
                name: 'field1',
                error: 'input error',
            },
        ],
    },
    input: {
        field1: {
            id: '',//default: 'forme_input__' + input._name
            name: '',
            alias: '',//default: to input._name 
            className: 'cssClass1 cssClass2',
            label: '',//default: input._name 
            help: '',
            type: '',
            placeholder: '',
            required: true/false,
            readonly: true/false,
            value: null,
            checked: true/false,
            errors: ['error1', 'error2', 'error3'],
            options: [
                {
                    label: 'label1',
                    value: 'value1',
                },
                {
                    label: 'label2',
                    value: 'value2',
                },
            ],
            context: {
                any: 'data',
                added: 'to',
                the: 'input',
                using: 'input.context()',
            },
        },
        group1: {
            field2: {
                //input details here
            },
            alias1: {
                //input details here                
            }
        }
    },
}
```



## <a name="validationInFinalThen"></a> Validation/form error in your final `validate.then()`

Forme provides more sensible ways to add custom validation code ([here](#customValidation)), but if you want to validate in the final step and produce an error, then you will have to manually `.save()` the form.

```javascript
function route(storage, res, next) {
    return form.validate(storage)
    .then(result => {    
        if (result.reload) {
            res.redirect(result.destination);
        } else {
            return doSomethingGood()
            .catch(err => {
                //failed
                result.form.error(storage, err.message);
                
                //save and redirect
                return result.form.save()
                .then(result => res.redirect('back'));
            });
        }
    });
}
```


## <a name="manuallyCallingSpecialActions"></a> Manually calling `form.next()` / `form.prev()` / `form.reset()`

Most of the time you can let Forme handle special actions by just applying the API's to your inputs (e.g. `input.next()`), but sometimes you may want to control this your self. Forme provides the following form API:

- `form.prev()`
- `form.next()`
- `form.reset()`

You can call these within a validate/submit/action handler or in the final `.then()` (e.g. `form.view(storage).then(result => {})`) If you call these special actions within a handler, then you don't need to do anything else. If you call in the final `.then()`, you will have to manually handle the redirect. 

**Submit handler**

```javascript
const forme = require('forme');

const form = forme('testForm');
form.submit(form => {
    //attempt to goto next page
    form.next();
});
```

**Final `.then()`**

```javascript
const forme = require('forme');

const form = forme('testForm');

function post(req, res) {
    return form.submit(req)
    .then(result => {
        if (result.reload) {
            //the form is already doing a reload
            res.redirect(result.destination);
        } else {
            //manual .next() action
            return result.form.next()
            .then(destination => {
                if (destination === false) {
                    //didnt redirect, we need to do something!
                } else {
                    res.redirect(destination);
                }
            });
        }
    });
}
```

In the second example we can see that we have to do a lot more. Forme might not always be able to perform a special action, so when calling in the final `.then()` make sure to handle when `destination === false`.

## <a name="customDriversIntegration"></a> Custom Drivers / Integration

As has been stated many times, Forme has been designed to go anywhere. Do Anything! We have abstracted out all of the functionality required to speak to your 3rd party module/sdk/project. This functionality can be found in the `FormeDriver` class (see *lib/driver.js*).

Forme is being developed using *express*, but eventually we plan to write additional drivers. If you would like to integrate into your own codebase, then just extend `FormeDriver` and apply it to your form using `form.driver(FormeDriver)`. The `FormeDriver` you pass to `form.drive()` **must** be a pointer to (**not** instance of) an es6 class. When Forme comes to build your active form, it will create a disposable instance of this class. 

```javascript
const forme = require('forme');
const CustomDriver = require('./customDriver');

const form = forme('myForm').driver(CustomDriver);
```

If you want to change the driver for all your forms then you can use one of two methods:

**Global**
```javascript
const forme = require('forme');

class CustomDriver extends forme.FormeDriver {   
}

forme.driver(CustomDriver);
```

**Local wrapper utility**

*formeUtil.js*
```javascript
const forme = require('forme');

class CustomDriver extends forme.FormeDriver {   
}

module.exports = function(name) {
    return forme(name).driver(CustomDriver);
};
```

```javascript
const forme = require('.formeUtil');
const form = forme('myForm');
```


## <a name="apiForm"></a> Form API 
- **.name(** name **)** - change the form's name
- **.label(** label **)** - sets the forms label used in error messages and template vars
- **.get(** address **)** - set the form to get and specify the action address
- **.post(** address **)** - set the form to post and specify the action address *(a form will default the method to POST)*
- **.driver(** driverClass **)** - change the driver this form uses. 
- **.require(** array/object, operator, *[error]* **)** - and/or validation on single, multiple or groups of inputs
- **.add(** name **)** - add a new input to the form with the given name
- **.context(** name, value **)** - store a named context value in this form. *(accessible in `form.template()` and anywhere we have the form object)*
- **.context(** name **)** - retrieve a named context value from this form. *(accessible in form.template() and anywhere we have the form object)*
- **.context(** name, undefined **)** - delete a context entry.
- **.view(** storage, *[values]* **)** - process viewing the form and then return a promise. An object of values can be provided as the second argument. This will replace all non permanent values when processing the form.
- **.submit(** storage, *[values]* **)** - submit the form. An object of values can be provided as the second argument. This will replace all non permanent values when processing the form.
- **.load(** form => {} **)** - callback will be called when the form has loaded. Allows for custom code before the form is built.
- **.build(** form => {} **)** - callback will be called in order, when the form is being built. Allows for dynamic inputs to be added.
- **.validate(** (form, state) => {} **)**, *[error]* **)** - custom validation callback.
- **.submit(** form => {} **)** - callback will be called when a form successfully validates. It will be called just before returning back to the `form.submit(storage).then()`
- **.action(** action, (form, action) => {} **)** - callback will be called when the input action is triggered.
- **.save(** **)** - process storing the form session and then return a promise
- **.values(** **)** - get all the current values for the form
- **.value(** input/string/path **)** - get the current submitted value for a specific input. 
- **.value(** input/string/path, value **)** - set the current submitted value for a specific input
- **.error(** error **)** - add an error to the form
- **.error(** input/string/path, error **)** - add a named error. This does not need to be the name of an input, if no match is found, the error will be saved with the name you specified.
- **.inputs()** - returns an array of input names (including the current page)
- **.template(** **)** - builds all template vars for the form
- **.errors(** *[name]* **)** - gets all errors in the form. If a name is provided, then only errors with that matching name are returned. Name can be an input name/alias, or name defined in `input.pipe()`.
- **.page(** name **)** - adds a chainable page object to the form.
- **.page(** name, true **)** - adds a single page location to the form. This is when you want to handle a paged form across multiple separate forms.
- **.page(** array **)** - adds multiple page locations to the form. This is when you want to handle a paged form across multiple separate forms.
- **.prev(** **)** - starts a promise and forces the form to goto the previous page. Returns false or a destination. If a destination is returned, user code should handle redirect. If called from a Forme validate/submit/action handler, you do not need to handle the redirect.
- **.next(** **)** - starts a promise and forces the form to goto the next page. Returns false or a destination. If a destination is returned, user code should handle redirect. If called from a Forme validate/submit/action handler, you do not need to handle the redirect.
- **.reset(** **)** - starts a promise and forces the form to reset. Returns false or a destination. If a destination is returned, user code should handle redirect. If called from a Forme validate/submit/action handler, you do not need to handle the redirect.
- **.reload(** destination **)** - forces a form `result.reload` to be true. The destination you set is the destination that will be returned in `result.destination`.
- **.url(** **)** - returns the url for the current page.
- **.url(** page **)** - returns the url for a particular page.


## <a name="apiPage"></a> Page API 
- **.name(** name **)** - change the page name
- **.label(** label **)** - sets the page label potentially used in error messages and template vars
- **.require(** array/object, operator, *[error]* **)** - and/or validation on single, multiple or groups of inputs
- **.add(** name **)** - add a new input to the page with the given name
- **.context(** name, value **)** - store a named context value in this page.
- **.context(** name **)** - retrieve a named context value from this page.
- **.context(** name, undefined **)** - delete a context entry.
- **.load(** (form, page) => {} **)** - callback will be called when the form has loaded. Allows for custom code before the form is built.
- **.build(** (form, page) => {} **)** - called when the page is building
- **.validate(** (form, page, state) => {} **)**, *[error]* **)** - called when the page is validating
- **.submit(** (form, page) => {} **)** - called when the page is submitting
- **.action(** action, (form, page, action) => {} **)** - callback when an action is triggered.
- **.inputs()** - returns an array of input names for this page


## <a name="apiInput"></a> Input API 
- **.id(** string **)** - override the id that is generated for template vars. If no id id set the default id will be *'forme_input__[input.name]'* (minus square brackets)
- **.className(** string/array **)** - adds a className(s) to the input *(only used in form.template())* 
- **.label(** string **)** - sets the inputs label used in error messages and template vars
- **.help(string)** - sets the inputs help text *(only used in `form.template()`)*  
- **.require(** value, *[error]* **)** - makes sure the input value exists when validated
- **.size(** size, *[error]* **)** - the input value has to be exactly this size when validated
- **.min(** size, *[error]* **)** - the input value has to be at least exactly this size when validated
- **.max(** size, *[error]* **)** - the input value has to be at no greater than this size when validated
- **.is(** string, *[error]* **)** - ensures the input value is of a particular *type* when validated. Uses [validator](https://github.com/chriso/validator.js)
- **.match(** string, *[error]* **)** - ensures the input value matches the target input value when validated.
- **.options(** array/object, *[error]* **)** - ensures the input is one of the specified values when validating. Also provides values to the template vars
- **.blacklist(** array, *[error]* **)** - value must not be one of the provided values
- **.validate(** (form, input, state) => {}, *[error]* **)** - allow for custom validation routines to be added to inputs
- **.submit(** (form, input) => {} **)** - allow for custom submit routines to be added to inputs. These are called in order just before a valid form returns to your main validate function
- **.secure(** *[flag]* **)** - prevents storing of this value between page views/sessions
- **.checked(** *[flag]* **)** - sets a checkbox defaults checked state
- **.readonly(** *[flag]* **)** - set input template var *readonly* *(currently only used in `form.template()` vars. e.g. &lt;input readonly /&gt;)*
- **.hidden(** *[flag]* **)** - set input template var *type* to *'hidden'* *(currently only used in form.template() vars. e.g. &lt;input readonly /&gt;)*
- **.type(** string **)** - override input template var *type*. By default forme will guess a type based on the input properties that you have defined. 
- **.bool()** - converts the value to a bool
- **.int()** - converts the value to an int
- **.string()** - converts the value to a string
- **.float()** - converts the value to a float
- **.group(** string/array **)** - specifies a group for values and template vars. Forme will automatically group value/template information when you specify a group, even if there is only 1 item in the group. You can chain multiple calls to .group() or provide an array of group names. This allows you to create groups at any depth.
- **.alias(** string **)** - lets you override the *name* of the input when built in template vars or form.values(). Forme still uses the inputs real name internally.
- **.permanent(** value **)** - forces the input to always have this value
- **.context(** string, value **)** - store a named context value in this input. *(Accessible in `form.template()` and `input.validate()`)*
- **.context(** string **)** - retrieve a named context value from this input. *(Accessible in `form.template()` and `input.validate()`)*
- **.context(** name, undefined **)** - delete a context entry.
- **.value(** value **)** - set the default value. This will only when the form is inactive. (**not** currently in `form.view()` or `form.submit()`)
- **.value(** **)** - gets current value for an active form (a form currently in `form.view()` or `form.submit()`)
- **.value(** value **)** - change the current value for the in an active form (a form currently in `form.view()` or `form.submit()`)
- **.pipe(** false/true/string **)** - pipe errors generated for this input to a specified target. (false: to self, true: to form, string: to input with matching name. The string can also be any string, these errors can be retrieved with `form.errors('name')`)
- **.action(** action/array, null/value, context **)** - add an action to the input.
- **.prev(** **)** - special action to go back a page. This will alter the input's type and default value.
- **.next(** **)** - special action to go forward a page. This will alter the input's type and default value.
- **.reset(** **)** - special action to reset the form. This will alter the input's type and default value.
- **.submit(** **)** - special action that is reserved for future usage. This will alter the input's type and default value.
- **.ignore(** *[flag]* **)** - the input wont be included in the end result. The input will however, be included in any callbacks. 


## <a name="apiResult"></a> Result API 

- **result.form** - the `Forme` instance.
- **result.storage** - the storage object you originally passed into `form.submit(storage)` or `form.view(storage)`.
- **result.valid** - was the form valid.
- **result.reload** - does the form need reloading.
- **result.template** - the template vars for the form (as if you called `form.template()`).
- **result.destination** - the destination, if the form needs reloading.
- **result.values** - the current values of the form (including values from all submitted pages).
- **result.errors** - any errors produced.
- **result.actions** - any actions that were triggered.


## <a name="apiModule"></a> Module API 

When you import forme with `const forme = require('forme)` you then use `forme(name)` to construct your forms. You also get a few extra utilities: 

- **forme.driver(** FormeDriver **)** - change the global driver that forme uses.
- **forme.FormeDriver** - the Forme driver class, for extending.
- **forme.FormeError** - the Forme form error class, for comparison (`instanceof`).
- **forme.FormeInputError** - the Forme input error class, for comparison (`instanceof`).