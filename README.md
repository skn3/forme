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


## Index

**Topics**
- [Change Log](#changeLog)
- [Hello World](#helloWorld)
- [Working Form (+express)](#workingForm)
- [Pages](#pages)
- [Configuring Form Objects With a Single Call](#configuringFormObjectsWithASingleCall)
- [Dynamic Forms](#dynamicForms)
- [Grouping and Referencing Inputs](#groupingAndReferencingInputs)
- [Input Type](#inputType)
- [Input Is](#inputIs)
- [Custom Validation](#customFormValidation)
- [Custom Submit Handling](#customSubmitHandling)
- [Actions](#actions)
- [Custom Errors](#customErrors)
- [Order of Execution](#orderOfExecution)
- [.load(), .success(), .fail() and .done()?](#loadSuccessFailAndDone)
- [Template](#template)
- [Form Require Validation (and / or)](#requireValidation)
- [Validation in final .then()](#validationInFinalThen)
- [Manually calling form.next() / form.prev() / form.reset()](#manuallyCallingSpecialActions)
- [Custom Drivers / Integration](#customDriversIntegration)
- [Session Management](#sessionManagement)
- [Components](#components)

**API / Reference**
- [Form](#apiForm)
- [Page](#apiPage)
- [Input](#apiInput)
- [Component](#apiComponent)
- [Result](#apiResult)
- [Module](#apiModule)


## <a name="changeLog"></a> Change Log

## Breaking changes in version 2.8.1
- Changed `FormeInput` class to have page argument in constructor. Can be ignored unless you are extendeding the FormeInput class via `FormeDriver`.
- Changed the `.compose()` handler pattern as introduced in 2.8.0 (yes I know :P). See [Components](#components) for more details.
- Changed all `component().foo()` input configuration methods to `component().inputFoo()`. Previously it was only overlapping methods! See [Components](#components) for more details.
- Changed `FormeComponent` now extends from `FormeContainer` so we treat a component to be a container of inputs.
- Added `FormeBase.container` and `FormeBase.parent` properties for retrieving relation info for forme objects.

## Breaking changes in version 2.8.0
- Added `form.component()`, `page.component()`, `form.compose()`, `page.compose()` and `FormeDriver.compose()`. See [Components](#components) for more details
- Changed `form.page()` so it can only be called from inactive form. previously you could add pages to a form that had already started. It might have worked, but it more then likely would have fallen over!
- Added `form.externalPage()` which replaces calling `form.page(name, true)` to add a page *location*.
- Added `form.pages()` and `form.externalPages()` method aliases.
- Added `input.actions()` and `input.required()` method aliases.
- Changed `form.page()` to only create pages physically attached to the form. *Page locations* are now added via `form.externalPage()`.
- Replaced `input.submit()` (without params) to `input.submitter()`. The `input.submit()` still exists for adding submit handlers to the input.
- Added more detailed FormeError types for errors produced at various stages.
- Fixed spelling mistakes, code typos, general javascript errors.

## New in version 2.7.2
- Added `result.inputs(type)` get the inputs for this request. Type is optional and can be a string or array of strings.
- Fixed `result.inputTypes` bug.

## New in version 2.7.1
- Fixed `input.require()` bug.

## Breaking changes in version 2.7.0
- Changed `form.template()` if input has no errors the `input.errors` template var will now be `null` instead of empty array.
- Renamed `FormePageContainer` to `FormePage`.
- Added public exports for `FormePage`, `FormeInput`, `FormeConfigurableMethod`, `FormeConfigurableOverride`, `FormeConfigurableParam`, `FormeConfigurableBool`, `FormeConfigurableInt`, `FormeConfigurableFloat`, `FormeConfigurableString`, `FormeConfigurableObject`, `FormeConfigurableArray`, `FormeConfigurableCallbacks` and `FormeConfigurableStrings`. 
- Added `static get FormeDriver.formClass` to define the class used to construct form objects. 
- Added `static get FormeDriver.pageClass` to define the class used to construct page objects.
- Added `static get FormeDriver.inputClass` to define the class used to construct input objects.
- Added `input.template()` to generate template vars for a speciffic input.
- Added `input.icon()` to set an icon template var for an input.
- Added `input.callingConfigureMethod()` this is used if you are extending the FormeInput object, it allows you to validate when custom configure methods are being called.
- Added form template var `input.stateClassName` to `form.template()` output. This has only the `form.errorClassName()` and `form.requiredClassName()` for the given input.
- Added form template var `input.icon`.
- Added `form.inputClassName()` adds a class name to all inputs (not including `button` and `submit` types). Defaults to `forme-button`.
- Added `form.buttonClassName()` adds a class name to all buttons. Defaults to `forme-input`.
- Added `form.errorClassName()` adds a class name to all inputs that have an error. Defaults to `forme-error`.
- Added `form.requiredClassName()` adds a class name to all inputs that are required. Defaults to `forme-required`.

## New in version 2.6.7
- Added `result.inputTypes()` to FormeRequest object. This returns a list of unique input types used in the form.
- Fixed `form.inputs()` and `page.inputs()` using an invalid property.

## New in version 2.6.6
- Added `FormeDriver.saveRequestReference()` method that deals with saving a reference to the forme request in your storage object. By default it is `storage.forme[form.name]`.

## New in version 2.6.5
- Changed `form.context()`, `page.context()` and `input.context()` now accepts a keyed object for setting multiple values.

## Breaking changes in version 2.6.1
- Changed `input.unrequire()` to `input.unrequire(flag)` this allows us to specify unrequire with a yes/no flag.
- Updated organisation of API reference docs

## Breaking changes in version 2.6.0
- Updated all API reference docs to detail configuration key names.
- Changed `input.require(error)` to `input.require(flag, error)` this allows us to specify require with a yes/no flag.
- Changed `forme()` constructor, now accepts info object to configure the new form.
- Changed `form.add()` now accepts info object to add and configure an input.
- Changed `form.add()` now accepts array of info objects to create multiple inputs.
- Changed `form.add()` now accepts array of names to create and configure multiple inputs.
- Changed `form.page()` now accepts info object to create and configure a page.
- Changed `form.page()` now accepts array of info object to create and configure multiple pages.
- Changed `page.add()` now accepts info object to create and configure an input.
- Changed `page.add()` now accepts array of info objects to create and configure multiple inputs.
- Changed `page.add()` now accepts array of names to create multiple inputs.
- Added `form.configure(object)` that allows configuring with single info object.
- Added `page.configure(object)` that allows configuring with single info object.
- Added `input.configure(object)` that allows configuring with single info object.
- Added documentation for `.configure()`.

## New in version 2.5.8
- Added `input.path()` gets the current path to access the input.

## New in version 2.5.7
- Added `form.method(method, action)` as an alternative to `form.get()` and `form.post()`. 

## New in version 2.5.5
- Added `input.rerun()` to add a new "special" action. This action "rerun" allows the form to submit and then reload to the start.
- Added `form.rerun()` for manually triggering a rerun (only if valid)

## New in version 2.5.4
- Added `input.min()` to get lowest min handler.
- Added `input.max()` to get highest max handler.
- Added `form.remove(what)` to remove validation handlers by type.
- Added `page.remove(what)` to remove validation handlers by type.
- Added `input.remove(what)` to remove validation handlers by type.

## New in version 2.5.3
- Added `input.group(groups, atEnd=true)` added atEnd flag that defaults to true. This allows to insert the groups at the start! 

## New in version 2.5.1
- Added `input.override(value)` this sets the forms value upon submit. Differs from `in 

## Breaking changes in version 2.5.0
- renamed `form.value(name)` to `form.getValue(name, unsafe)` and added an unsafe flag for reading without enforcing teh input exists.
- renamed `form.value(name, value)` to `form.setValue(name, value)`

## New in version 2.4.3
- Added `input.valid(callback)` for adding a custom callback to be called when the input succeeds validation. This is different to `input.success()` which always gets called when a form succeeds.

## New in version 2.4.2
- Added `input.invalid(callback)` for adding a custom callback to be called when the input fails validation. This is different to `input.fail()` which always gets called when the form fails for any reason.

## New in version 2.4
- Revamped the page handling so that we can safely navigate to pages prev/next/arbitrary and the form will invalidate pages where needed. 
- Added `form.completedPage(page)` which returns true if a particular page has been successfully submitted
- Changed `form.visited(page)` to `form.visitedPage(page)`. This now returns true if a page has been visited at least once!
- Cleaned up various bits

## New in version 2.3.12
- Added `form.visited(page)` that allows us to determine if a page has already been visited

## New in version 2.3.10
- Added `form.unrequire()` that allows us to override all required inputs. Useful for debugging

## New in version 2.3.9
- Added `input.empty(value)` for specifying what happens when an *empty* value is submitted. 

## New in version 2.3.5
- Added global `forme.sessions(timeout, prune)` session management. This allows us to configure how forme should deal with sessions that are considered old or spam. [read here](#sessionManagement)

## Breaking changes in version 2.3
- added 'strict' flag to `input.match()`, `input.options()` and `input.blacklist()`. If `true`, values will be compared for exact match using `===`. If `false` then the following would match `123 == "123"`. Defaults to `false`. 

## Breaking changes in version 2.2
- introduced result.failed flag into form results object. This should now be checked when `form.view()` and expecting to produce errors in custom handlers.
- `input.bool()`, `input.int()`, `input.float()` and `input.string()` now default to forcing the value to exist. If you want to allow null value as well, call `input.bool(true)`.
- `input.is(type, options, error)` now supports all isFoo() methods provided by the validator module. `input.is()` function arguments changed from `input.is(type, error)` 

## New in version 2.1
- Added .load(), .success(), .fail() and .done() handlers. These let you add callbacks to various stages of execution. [read here](#loadSuccessFailAndDone)

## Upgrading From Version 1.x

If you have been using version 1.x then please review the entire readme. We have rewritten large portions of it. Below is a list of changes that may need some attention in your projects:

- renamed the submit starting method from `form.validate(req)` to `form.submit(storage)`
- no longer have to pass the `req`/`storage` object around to **every** API method.
- renamed `form.session()` to `form.driver()` and revamped the abilities of custom integration. (see [here](#customDriversIntegration))
- callbacks no longer require a promise to be returned (a positive response will be assumed. Returning an error will cause a reject)
- manual save has been renamed from `form.store(req)` to `form.save()`
- the result object produced by `form.submit(storage).then(result => {})` and `form.view(storage).then(result => {})`, are now an *instanceof* FormeResult. (see [here](#apiResult))


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
            if (result.failed) {
                //failed preparing to view the form
            } else {
                //render the form                
            }
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

Forme has taken out all of the work and left us with the bare minimum of code to write. The only thing we really need to check for are the `result.reload` and `result.failed` flags. These result states indicate that the form needs reloading or there was an error building the form. Now while we could have designed Forme to handle page redirects and error output, we chose to retain the agnostic approach!

It is only important to check for `result.failed` when you are *viewing* the form and have custom handlers that might produce a fail, before teh form has been built. The flag does not need to be checked when the form is submitting.

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
            if (result.failed) {
                //todo: make a nice error page to output the errors in dev mode
                res.status(500).send('internal form error');
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
- `input.rerun()` - fully submits the form and then restarts if valid.

When creating a single form with multiple pages we use `form.page('pageName')`. This will return a page object in which we can chain further API calls. We can do most things with this page, including: inputs, build handlers, validation handlers, submit handlers and more. 


## <a name="configuringFormObjectsWithASingleCall"></a> Configuring Form Objects With a Single Call

**New in version 2.6.0** we can now configure forms, pages and inputs with a single call to `form.configure()`, `page.configure()` or `input.configure()`. This allows us to change any and all of the features supported by the object. We can also now pass in a configuration info object to `form.add()`, `form.page()` and `page.add()`.

An example of using `input.configure()` could be to set the label of an existing input using:

```javascript
input.label('Input Label Here');
```

```javascript
input.configure({ label: 'Input Label Here' });
```

The beauty of this is that we can specify a large number of configuration options in one call. You could use this in your application code to build a configuration object, alter it over time, and then finally send it to Forme for processing. For example:
```javascript
const info = {
    label: 'Input Label Here',
    validate: (form, input, state) => {},
};

if (option === 'do something') {
    info.require = true;
}

input.configure(info);
```

To understand what configuration methods you can call on an object, the answer is ALL of them! The *key* to use in your info object should match the name of the method you would be calling. So if you would call `input.secure(true)` then your info object would look like `{secure: true}`.

Configuration methods that can take a single argument should be defined like so `{method:argument}`. If you need to provide multiple arguments then you should specify this as a nested object. For example:

```javascript
input.data('htmlDataAttribute1', 'my value here');
input.require(true, 'this input is required');
```

```javascript
input.configure({
    data: {
        name: 'htmlDataAttribute1',
        value: 'my value here',
    },
    require: {
        require: true,
        error: 'this input is required',
    },
});
```

Please use the [Api Reference](#apiReference) to see what your attribute keys should be named as.

When we call a method that would add something to the form, such as `form.add()` we can now specify a configuration object:

```javascript
form.add('input1').label('Input One');
```

```javascript
form.add({
    name: 'input1',
    label: 'Input One',
});
```

We can now also add multiple objects at the same time using:

```javascript
form.add([
    {
        name: 'input1',
        label: 'Input One',
    },
    {
        name: 'input2',
        label: 'Input Two',
    },
]);
```

There is only 1 more thing to consider, what if we want to create and configure an entire form with 1 call. Yes we can!

```javascript
const form = new forme({
    name: 'myForm',
    pages: [
        {
            name: 'page1',
            validate: (form, page) => { /*custom page validation*/ }, 
            inputs: [
                {
                    name: 'input1',
                    label: 'Input One',
                },
                {
                    name: 'input2',
                    label: 'Input Two',
                },
            ],
        },
    ],
})
```

You can see in the example above we have two special configuration keys `pages:` and `inputs:`. These are shortcuts to the `.page()` and `.add()` methods. They do the same thing but have just been renamed so everything is logical within your *configuration* object!


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
const field1 = form.getValue('items.item0.field1');
const field2 = form.getValue(['items','item0','field2']);
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


## <a name="inputIs"></a> Input Is

You can define your inputs with `input.is(foo)`. This will allow you to specify built in validation methods for various types of value. Forme has built in `.is(foo)` methods, but if no match is found then it will fallback to methods in the <a href='https://www.npmjs.com/package/validator' target='_blank'>validator</a> module. If you call `input.is('Monkey', options)` then Forme will attempt to call the validator method `validator.isMonkey(value, options)`.

The second parameter for `input.is(foo, options)`, is currently used to define optional details as described on the <a href='https://www.npmjs.com/package/validator' target='_blank'>validator</a> documentation.
  
**Recognised validation methods:**
- uk-postcode
- alphanumeric
- email
- username
- subdomain
- isodate
- text
- boolean
- bool
- int
- float
- decimal
- number
- color
- telephone
- tel


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
 
Notice in the examples above we are using Promise.reject to indicate an error. This allows you to perform async operations and signal to Forme if there is an error. If you dont return a promise, Forme will assume the result was positive (unless an error object is returned).

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
7. **(validation failed)** execute `input.invalid(callback)` specifically for the failing input, in order defined.
8. **(validation success)** execute `input.valid(callback)` specifically for the successful input, in order defined.
9 execute `page.validate(callback)` in order defined.
10. execute `form.validate(callback)` in order defined.  

11. **(form success)** execute `form.success(callback)` in order defined.
12. **(form success)** execute `page.success(callback)` in order defined.
13. **(form success)** execute `input.success(callback)` in order defined.
14. **(form success)** execute `input.submit(callback)` in order defined.
15. **(form success)** execute `page.submit(callback)` in order defined.
16. **(form success)** execute `form.submit(callback)` in order defined.
17. **(form success)** execute `page.action(action, callback)` in order defined.
18. **(form success)** execute `form.action(action, callback)` in order defined.  

19. **(form fail)** execute `form.fail(callback)` in order defined.
20. **(form fail)** execute `page.fail(callback)` in order defined.
21. **(form fail)** execute `input.fail(callback)` in order defined.  

22. **(form success)** execute `input.done(callback)` in order defined.
23. **(form success)** execute `page.done(callback)` in order defined.
24. **(form success)** execute `form.done(callback)` in order defined.  

25. return promise to `form.submit(storage).then(result => {})`.

During the above execution order, Forme might fail the process and skip to the fail steps. The result will contain various states but check for `result.reload = false` to see if the form needs reloading.


## <a name="loadSuccessFailAndDone"></a> .load(), .success(), .fail() and .done()? 

With version *2.1* forme introduced various additional callback steps to form execution. These are important as you may want to really modularise your forms. The extra scope of these callbacks, allows you to organise the stages of your form sanely! Or in other words, Forme is now less restrictive!?

- **.load()**  
This allows you to perform your custom actions right at the start before any processing occurs. This is called for both `form.view()` and `form.submit()`. At this point, no `.build()` handlers will have been called yet.

- **.success()**  
When you call `form.submit()` and all validation is successful, Forme will fire the `.success()` handlers. These callbacks will be fired just before the `.submit()` handlers are fired. This can be useful for preparing your form for a successful submit.

- **.fail()**  
When you call `form.submit()` and **any** validation handlers *fail*, Forme will fire the `.fail()` handlers. These callbacks will be fired just before  handlers are fired. This can be useful if you need to add custom code just before an invalid form returns to your `form.submit(storage).then(form => {})`.

- **.done()**  
When you call `form.submit()` and all validation is successful, Forme will fire the `.done()` handlers right at the end, just before Forme returns to your `form.submit(storage).then(form => {})`. This could be useful for modularising something like a success message.


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
            stateClassName: 'forme-error forme-required',
            icon: 'fa fa-star',
            data: {'data-foo':'bar', 'data-hello':'world'},
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


## <a name="sessionManagement"></a> Session Management

Forme is clever, it stores your form session using you supplied `FormeDriver`. This means that with zero code, your form can withstand page refresh, the apocalypse and generally remain alive in a hostile web environment. Now the nature of forms is usually quite loose, we could up creating waste sessions that stay saved in your `FormeDriver` storage... *forever*. Forme combats that by running session management code each time a form is processed.
 
By default Forme will expire form sessions that are **12 hours old**. To prevent people spamming, potentially filling up your database, by default Forme will allow a maximum of **50 sessions** to be stored. These are fairly high estimates so you may want to configure this!
 
**Session management is done on a per user basis, so by default Forme allows a user to have 50 active form sessions at once**
 
If you would like to modify the session management properties, you can do the following:

```javascript
const forme = require('forme');
forme.sessions(1000*60*5,1);
```

The above example would set session management for *all future forms* to max **5 minutes old**, and only **1 session** allowed at a time (even if you had multiple tabs open).


## <a name="components"></a> Components

**Warning: currently under development**

Since version 2.8 forme has added the ability to build complex input types via *components*. A component in forme is built by hooking into a `.compose()` operation and then build out your inputs in response to the components type. This is best explained in a code snippet:

```javascript
//create form
const form = forme('myForm');

//add compose handler
form.compose((form, component, details) => {
    switch(details.type) {
        case 'mySpecialComponent':
            container.add([
                {
                    name: 'theName',
                    label: 'The Name',
                    value: details.value.name || null,
                },
                {
                    name: 'theValue',
                    label: 'The Value',
                    value: details.value.value || null,
                },
            ]);
    }
});

//lets add two instances of this component (using the new 2.7+ configuration api)
form.component([
    {
		type: 'mySpecialComponent',
        name: 'field1',
        value: {
            theName: 'age',
            theValue: 18,
        },
    },
    {
		type: 'mySpecialComponent',
        name: 'field2',
        value: {
            theName: 'name',
            theValue: 'John Smith',
        },
    },
]);
```

You can see in this example we have added a `.compose()` handler to our form. The job of a `.compose()` handler is to make changes to the `component` object passed to it. How the `.compose()` handler does this is upto you. In the example above we are checking`details.type`, and then responding by calling `component.add()`. A more advanced example could be to dynamically `require()` a file based from the `details.type`.

After all `.compose()` handlers have been executed, forme will then further process any inputs that were added via `component.add()`. With this extra processing we can perform some magic:

```javascript
form.component({ type: 'myComponent1' }).inputLabel('A Label');
```

In this example, when we add our `.component()` to the form, we are chaining `.inputLabel()`. This will modify the label of **all** inputs that get created for this component by `.compose()` handlers. In our previous example, it would change the label on both the `theName` and `theValue` inputs. For a single input component this is highly useful as we can use **all** input configuration methods to customise. We simply prefix any input configuration method with *input*. e.g. `component().inputRequire()`.

If a component returns multiple inputs then we have to be careful as chaining `.inputFoo()` calls will modify all inputs. In the future we may improve this.

Components provide a mechanism for us to configure our inputs at the point of calling `form.component()`. We can use `component().param({ foo: bar })` to attach parameters to the component. These params are then stored in the `details.params` that is passed to `.compose()` handlers.

```javascript
form.compose((form, component, details) => {
    switch(details.type) {
        case 'mySpecialComponent':
            return container.add([
                {
                    name: 'theName',
                    label: details.params.nameLabel || 'The Name',
                    value: details.value.name || null,
                },
                {
                    name: 'theValue',
                    label: details.params.valueLabel || 'The Value',
                    value: details.value.value || null,
                },
            ]);
    }
});

form.component([
    {
        name: 'field1',
        type: 'mySpecialComponent',
        value: {
            theName: 'age',
            theValue: 18,
        },
        params: {
            nameLabel: 'Custom Name Label',
            valueLabel: 'Custom Value Label',
        },
    },
]);
```

You can see in this example we are now allowing the component to apply custom labels via the params object. As with every other part of forme, we are trying not to dictate how you should work. With this component approach you can customise your own plugin system!

Components have one more thing to consider, *how do we set the value of a component?* This could be achieved by storing the value as a `component().param('value', 'myValue')` but instead we have provided `component().value()`. This value is passed to `.compose()` handlers in `details.value`. Remember this is just the default `input.value()`, after a form submits the value will be different as you will have active form data.


## <a name="apiReference"></a> API Reference
Here we have a complete reference to all methods available for all form objects.


## <a name="apiForm"></a> Form API

### Configuration
- **.configure(** object **)** - allows complete configuration of the form using 1 info object.
- **.name(** name **)** - change the form's name
- **.label(** label **)** - sets the forms label used in error messages and template vars
- **.method(** method, action **)** - set the form method and specify the action
- **.get(** action **)** - set the form to get and specify the action
- **.post(** action **)** - set the form to post and specify the action *(a form will default the method to POST)*
- **.add(** name/configuration **)** - add a new input to the form with the given name
- **.require(** conditions, operator, *[error]* **)** - and/or validation on single, multiple or groups of inputs
- **.unrequire(** *[unrequire]* **)** - override all inputs and set them all to not required. Useful for debugging!
- **.context(** name, value **)** - store a named context value in this form. *(accessible in `form.template()` and anywhere we have the form object)*
- **.context(** name, undefined **)** - delete a context entry.
- **.context(** context **)** - set multiple context values by passing in a keyed object. *(accessible in `form.template()` and anywhere we have the form object)*
- **.page(** name/configuration **)** - adds a chainable page object to the form. The *argument* can be a page name, array of page names, page configuration object or array of page configuration objects.
- **.externalPage(** location **)** - adds a single external page to the form. This is when you want to handle a paged form across multiple separate forms.
- **.driver(** driver **)** - change the driver this form uses. 

### Templating *(Configuration)*
- **.template(** **)** - builds all template vars for the form.
- **.inputClassName(** className **)** - add a className to all inputs generated from `form.template()`. Accepts array of strings and string of class names separated by space. Defaults to `forme-input`.
- **.inputClassName(**  **)** - removes all previous and default input class names when called without an argument (undefined).
- **.buttonClassName(** className **)** - add a className to all inputs that are of button or submit type. This is included in `form.template()`. Accepts array of strings and string of class names separated by space. Defaults to `forme-button`.
- **.buttonClassName(**  **)** - removes all previous and default input button class names when called without an argument (undefined).
- **.errorClassName(** className **)** - add a className to all inputs that have an error. This is included in `form.template()`. Accepts array of strings and string of class names separated by space. Defaults to `forme-error`.
- **.errorClassName(**  **)** - removes all previous and default input error class names when called without an argument (undefined).
- **.requiredClassName(** className **)** - add a className to all inputs that have an required. This is included in `form.template()`. Accepts array of strings and string of class names separated by space. Defaults to `forme-required`.
- **.requiredClassName(**  **)** - removes all previous and default input required class names when called without an argument (undefined).

### Callbacks *(configuration)*
- **.load(** callback **)** - `form => {}` callback will be called when the form has loaded. Allows for custom code before the form is built. Also accepts array of functions.
- **.build(** callback **)** - `form => {}` callback will be called in order, when the form is being built. Allows for dynamic inputs to be added. Also accepts array of functions.
- **.validate(** callback **)**, *[error]* **)** - `(form, state) => {}` custom validation callback. Also accepts array of functions.
- **.success(** callback **)** - `form => {}` callback will be called in order, when a form has validated successfully (before any.submit() handlers are called). Also accepts array of functions.
- **.fail(** callback **)** - `form => {}` callback will be called in order, when a form has failed validation. Also accepts array of functions.
- **.submit(** callback **)** - `form => {}` callback will be called when a form successfully validates. It will be called just before returning back to the `form.submit(storage).then()`. Also accepts array of functions.
- **.action(** action, callback **)** - `(form, action) => {}` callback will be called when the input action string is triggered. Also accepts array of functions and array of action strings.
- **.done(** callback **)** - `form => {}` callback will be called in order, when a form has fully validated & submitted. Also accepts array of functions.

### Commands
- **.view(** storage, *[values]* **)** - process viewing the form and then return a promise. An object of values can be provided as the second argument. This will replace all non permanent values when processing the form.
- **.submit(** storage, *[values]* **)** - submit the form. An object of values can be provided as the second argument. This will replace all non permanent values when processing the form.
- **.save(** **)** - process storing the form session and then return a promise
- **.prev(** **)** - starts a promise and forces the form to goto the previous page. Returns false or a destination. If a destination is returned, user code should handle redirect. If called from a Forme validate/submit/action handler, you do not need to handle the redirect.
- **.next(** **)** - starts a promise and forces the form to goto the next page. Returns false or a destination. If a destination is returned, user code should handle redirect. If called from a Forme validate/submit/action handler, you do not need to handle the redirect.
- **.reset(** **)** - starts a promise and forces the form to reset. Returns false or a destination. If a destination is returned, user code should handle redirect. If called from a Forme validate/submit/action handler, you do not need to handle the redirect.
- **.rerun(** **)** - starts a promise and forces the form to rerun. Returns false or a destination. If a destination is returned, user code should handle redirect. If called from a Forme validate/submit/action handler, you do not need to handle the redirect.
- **.reload(** destination **)** - forces a form `result.reload` to be true. The destination you set is the destination that will be returned in `result.destination`.
- **.remove(** what **)** - remove all validation handlers of the specified type. `What` is the method name used to apply that validation to the form. Eg to remove all `form.require()` validation handlers we would call `form.remove('require')`. Use `form.remove('validate')` to remove all custom validation handlers.
- **.error(** error **)** - add an error to the form
- **.error(** input/string/path, error **)** - add a named error. This does not need to be the name of an input, if no match is found, the error will be saved with the name you specified.
- **.setValue(** input/string/path, value **)** - set the current submitted value for a specific input

### State
- **.getValue(** input/string/path, unsafe **)** - get the current submitted value for a specific input. The unsafe flag allows us to skip to see if the input exists, useful for fetching the value in the build phase when the input hasn't actually been added yet.
- **.context(** name **)** - retrieve a named context value from this form. *(accessible in form.template() and anywhere we have the form object)*
- **.values(** **)** - get all the current values for the form
- **.errors(** *[name]* **)** - gets all errors in the form. If a name is provided, then only errors with that matching name are returned. Name can be an input name/alias, or name defined in `input.pipe()`.
- **.inputs()** - returns an array of input names (including the current page) 
- **.url(** **)** - returns the url for the current page.
- **.url(** page **)** - returns the url for a particular page.
- **.pageVisited(** page **)** - tells us if a page has been visited and is safe to revisit.
- **.pageCompleted(** page **)** - tells us if a page has validated and successfully submitted.
- **.storage(** **)** - the original storage object passed to `form.view` or `form.submit()`


## <a name="apiPage"></a> Page API 

### Configuration
- **.configure(** object **)** - allows complete configuration of the page using 1 info object.
- **.name(** name **)** - change the page name
- **.label(** label **)** - sets the page label potentially used in error messages and template vars
- **.require(** conditions, op, *[error]* **)** - and/or validation on single, multiple or groups of inputs
- **.context(** name, value **)** - store a named context value in this page.
- **.context(** name, undefined **)** - delete a context entry.
- **.context(** context **)** - set multiple context values by passing in a keyed object. *(accessible in `form.template()` and anywhere we have the page object)*

### Callbacks *(configuration)*
- **.load(** callback **)** - `(form, page) => {}` callback will be called when the form has loaded. Allows for custom code before the form is built. Also accepts array of functions.
- **.build(** callback **)** - `(form, page) => {}` callback called when the page is building. Also accepts array of functions.
- **.validate(** callback, *[error]* **)** - `(form, page, state) => {}` callback called when the page is validating. Also accepts array of functions.
- **.success(** callback **)** - `(form, page) => {}` callback will be called in order, when a form has validated successfully (before any.submit() handlers are called). Also accepts array of functions.
- **.fail(** callback **)** - `(form, page) => {}` callback will be called in order, when a form has failed validation. Also accepts array of functions.
- **.submit(** callback **)** - `(form, page) => {}` called when the page is submitting. Also accepts array of functions.
- **.action(** action, callback **)** - `(form, page, action) => {}` callback when an action string is triggered. Also accepts array of functions and array of action strings.
- **.done(** callback **)** - `(form, page) => {}` callback will be called in order, when a form has fully validated & submitted. Also accepts array of functions.

### Commands
- **.add(** name/configuration **)** - add a new input to the page with the given name.
- **.remove(** what **)** - remove all validation handlers of the specified type. `What` is the method name used to apply that validation to the page. Eg to remove all `page.require()` validation handlers we would call `page.remove('require')`. Use `page.remove('validate')` to remove all custom validation handlers.

### State
- **.context(** name **)** - retrieve a named context value from this page.
- **.inputs()** - returns an array of input names for this page


## <a name="apiInput"></a> Input API

### Configuration
- **.configure(** object **)** - allows complete configuration of the input using 1 info object.
- **.label(** label **)** - sets the inputs label used in error messages and template vars.
- **.group(** group, *[append]* **)** - specifies a group for values and template vars. Forme will automatically group value/template information when you specify a group, even if there is only 1 item in the group. You can chain multiple calls to .group() or provide an array of group names. This allows you to create groups at any depth. The `append` flag (defaults to true) allows you to add groups at the start of the chain, if specified as false.
- **.alias(** alias **)** - lets you override the *name* of the input when built in template vars or form.values(). Forme still uses the inputs real name internally.
- **.value(** value **)** - (when building) set the default value. This will only when the form is inactive. (**not** currently in `form.view()` or `form.submit()`)
- **.permanent(** value **)** - forces the input to always have this value
- **.override(** value **)** - overrides the inputs value upon submit. Useful for displaying a dummy value on a form that has a fixed value in your results!
- **.type(** type **)** - override input template var *type*. By default forme will guess a type based on the input properties that you have defined. 
- **.bool(** *[null]* **)** - converts the value to a bool. If `.bool(true)` then null value will be allowed. 
- **.int(** *[null]* **)** - converts the value to an int. If `.int(true)` then null value will be allowed.
- **.float(** *[null]* **)** - converts the value to a float. If `.float(true)` then null value will be allowed.
- **.string(** *[null]* **)** - converts the value to a string. If `.string(true)` then null value will be allowed.
- **.secure(** *[secure]* **)** - prevents storing of this value between page views/sessions.
- **.checked(** *[checked]* **)** - sets a checkbox defaults checked state.
- **.readonly(** *[readonly]* **)** - set input template var *readonly* *(currently only used in `form.template()` vars. e.g. &lt;input readonly /&gt;)*
- **.ignore(** *[ignore]* **)** - the input wont be included in the end result. The input will however, be included in any callbacks.
- **.context(** name, value **)** - store a named context value in this input. *(Accessible in `form.template()` and `input.validate()`)*
- **.context(** name, undefined **)** - delete a context entry.
- **.context(** context **)** - set multiple context values by passing in a keyed object. *(accessible in `form.template()` and anywhere we have the input object)*
- **.pipe(** pipe **)** - pipe errors generated for this input to a specified target. Pipe can be `false`: to self, `true`: to form, `string`: to input with matching name. The string can also be any string, these errors can be retrieved with `form.errors('name')`)
- **.empty(** value **)** - if the value of the input is `false`, `null`, `undefined`, `0` or `''` then it will be replaced with the `.empty(value)` you provide. This could be useful for having empty inputs return as null. 

### Validation *(Configuration)*
- **.require(** *[require]*, *[error]* **)** - makes sure the input value exists when validated. Defaults to require `true` unless flag is specified false.
- **.size(** size, *[error]* **)** - the input value has to be exactly this size when validated
- **.min(** min, *[error]* **)** - the input value has to be at least exactly this size when validated
- **.min(** **)** - get the lowest `.min()` validation handler size or null if none.
- **.max(** max, *[error]* **)** - the input value has to be at no greater than this size when validated
- **.max(** **)** - get the highest `.max()` validation handler size or null if none.
- **.is(** type, options, *[error]* **)** - ensures the input value is of a particular *type* when validated. Uses [validator](https://github.com/chriso/validator.js). Read the [Input Is](#inputIs) section for more information.
- **.match(** target, *[strict]*, *[error]* **)** - ensures the input value matches the target input value when validated. The target can be an input name or path.
- **.options(** options, *[strict]*, *[error]* **)** - ensures the input is one of the specified values when validating. Also provides values to the template vars
- **.blacklist(** blacklist, *[strict]*, *[error]* **)** - value must not be one of the provided values

### Templating *(Configuration)*
- **.template(** **)** - builds template vars for this input.
- **.id(** id **)** - override the id that is generated for template vars. If no id id set the default id will be *'forme_input__[input.name]'* (minus square brackets)
- **.hidden(** *[hidden]* **)** - set input template var *type* to *'hidden'* *(currently only used in form.template() vars. e.g. &lt;input readonly /&gt;)*
- **.help(** help **)** - sets the inputs help text *(only used in `form.template()`)*
- **.className(** className **)** - adds a className(s) to the input. Also accepts array of strings. *(only used in form.template())*
- **.icon(** icon **)** - adds an `input.icon` template var to the input *(only used in form.template())*
- **.data(** name, value **)** - adds html5 `data-name="value"` tags to the template values. *(only used in form.template())*
- **.data(** data **)** - adds multiple html5 `data-name="value"` tags defined in an object containing key/value. *(only used in form.template())*

### Callbacks *(configuration)*
- **.validate(** callback, *[error]* **)** - `(form, input, state) => {}` callback allows for custom validation routines to be added to inputs. Also accepts array of functions.
- **.invalid(** callback **)** - `(form, input) => {}` callback will be called in order, when the input fails validation. Not to be confused with `input.fail()` which gets called for any form fail.
- **.valid(** callback **)** - `(form, input) => {}` callback will be called in order, when the input succeeds validation. Not to be confused with `input.success()` which gets called for any form success.
- **.success(** callback **)** - `(form, input) => {}` callback will be called in order, when a form has validated successfully (before any.submit() handlers are called). Also accepts array of functions.
- **.fail(** callback **)** - `(form, input) => {}` callback will be called in order, when a form has failed validation. Also accepts array of functions.
- **.submit(** callback **)** - `(form, input) => {}` allow for custom submit routines to be added to inputs. These are called in order just before a valid form returns to your main validate function. Also accepts array of functions.
- **.done(** callback **)** - `(form, input) => {}` callback will be called in order, when a form has fully validated & submitted. Also accepts array of functions.

### Actions *(configuration)*
- **.action(** action, *[value]*, *[context]* **)** - add an action to the input. When the input has the specified value, then the specified actions will trigger.
- **.prev(** **)** - special action to go back a page. This will alter the input's type and default value.
- **.next(** **)** - special action to go forward a page. This will alter the input's type and default value.
- **.reset(** **)** - special action to reset the form. This will alter the input's type and default value.
- **.rerun(** **)** - special action to rerun the form. This will alter the input's type and default value.
- **.submit(** **)** - special action that is reserved for future usage. This will alter the input's type and default value.
 
### Commands
- **.value(** value **)** - (when active) change the current value for the in an active form (a form currently in `form.view()` or `form.submit()`)
- **.remove(** what **)** - remove all validation handlers of the specified type. `What` is the method name used to apply that validation to the input. Eg to remove all `input.max()` validation handlers we would call `input.remove('max')`. Use `input.remove('validate')` to remove all custom validation handlers.
 
### State
- **.context(** string **)** - retrieve a named context value from this input. *(Accessible in `form.template()` and `input.validate()`)*
- **.path(** **)** - get the currently defined path for this input. Path is in the format of `group1.group2.alias`. If no alias has been set then a path will be `group1.group2.name`. If no groups have been set then the path will be just the alias or name.
- **.value(** **)** - gets current value for an active form (a form currently in `form.view()` or `form.submit()`)
 

## <a name="apiComponent"></a> Component API 

A component can call **any** input configuration methods by using the same naming convention. Simply prefix with *"input"*:

E.g.:
- **.inputName()**
- **.inputValue()**

See [Input API](#apiInput) for a complete list of all available configuration methods.
 

### Component Configuration
- **.type(** type **)** - the type of the component. Used to identify your component during `.compose()` handlers.
- **.name(** name **)** - this is a unique name for this instance of the component. It is also the group that all of the component's inputs will be added to. This is equivilant to calling `input.group('name')`.
- **.value(** value **)** - a value passed to `.compose()` handlers in `details.value`. Should be used to initilise your `input.value()` configuration.
- **.param(** name, value **)** - params passed to `.compose()` handlers in `details.params`.
- **.param(** params **)** - multiple params stored in an object, passed to `.compose()` handlers in `details.params`.


## <a name="apiResult"></a> Result API 

### Properties
- **result.form** - the `Forme` instance.
- **result.storage** - the storage object you originally passed into `form.submit(storage)` or `form.view(storage)`.
- **result.valid** - was the form valid.
- **result.reload** - does the form need reloading.
- **result.template** - the template vars for the form (as if you called `form.template()`).
- **result.destination** - the destination, if the form needs reloading.
- **result.values** - the current values of the form (including values from all submitted pages).
- **result.errors** - any errors produced.
- **result.actions** - any actions that were triggered.
- **result.inputTypes** - a list of all unique input types in the form.

### Methods
- **result.inputs(** *[type]* **)** - get the inputs for this request. Type is optional and can be a string or array of strings. If type is specified, only inputs of that type are returned. 


## <a name="apiModule"></a> Module API 

When you import forme with `const forme = require('forme)` you then use `forme(name)` to construct your forms. You also get a few extra utilities: 
  
- **forme.driver(** FormeDriver **)** - change the global driver class that forme uses. This should be the class and not an instance of the driver.  
- **forme.sessions(** timeout, prune **)** - allow configuration of session management. Timeout: how long a forme session will remain alive in ms *(`1000*60*60 = 1 hour`)*, defaults to 12 hours. Prune: maximum number of forme sessions that can exist, defaults to 50.
- **forme.FormeDriver** - the Forme driver class, for extending.
- **forme.FormeError** - the Forme form error class, for comparison (`instanceof`).
- **forme.FormeInputError** - the Forme input error class, for comparison (`instanceof`).