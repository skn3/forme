# Forme

Forme has been designed to offer a sane way for handling forms in nodejs. A form can be built to handle a user input or even manage data from api requests. Forme does not dictate to you how a form should build, process or render. With forme you can handle forms in the way that suites you.

Your form object is created in such a way that it can be reused for multiple instances of that form. The request object will be used to store any live data when processing a particular instance of the form. You can also create a form per request if you need to add a dynamic set of fields.

Forme has no concept of rendering but does provide a simple way to build an template vars. The object containing all the variables can then be passed to the appropriate templating engine of choice.

- Create static or dynamic form objects to handle input in a generic fashion.
- Easily apply built in input handlers to process and validate your data.
- Integrate into the templating system of your choice.
- Not limited to any specific frameworks.
- Semi-Automatic session data handling using extendable session handler. 

The project is still in development so use with caution, however the functionality is there so feel free to have a play!

## Custom Errors

Most input methods allow you to provide a custom error string. For example:
```javascript
const forme = require('forme');

const form = forme('login').post('form/process.html');
form.add('username').label('Username').require().is('username','{label} is invalid');
```

You can see see in this example we have added a second argument *'{label} is invalid'* to the **.is()** method. This is our custom error that will be returned should the input fail the **.is()** test. Custom error messages can contain placeholder tokens, which will be automatically converted to useful information.
 
**Placeholder tokens**
- **{label}** the current label for this input, defined with **.label('My Label')**
- **{name}** the current name for this input. This is the id or machine-name for the input.

## Input Type

Forme will intelligently try to guess the input 'type' you have defined. It does this by looking at the API's you have called on the input. You can override the type by calling **.type('email')**. The type is only used when returning the template vars with **forme.template()**, it does not alter how forme handles the input.

When Forme is guessing the input type, it lets the most recently called API take precedence. So for example if we call **.is('email')** and then **.secure()**, the guessed type will be *'password'* and not *'email'*. 

As well as your type being defined by various methods that you have called, the following rules exist. The rules are checked in order, when one of these conditions is met, subsequent conditions are ignored.

- If you have called **.hidden()** on an input, then the type will always return *'hidden'* *(unless overridden with .type())*.
- If you have called **.checked()** on an input, then the type will always return *'checkbox'* *(unless overridden with .type())*.
- If you have called **.secure()** on an input, then the type will always return *'password'* *(unless overridden with .type())*.

**Examples**
```javascript
form.add('some_input').label('Some Input').int() //type="number";
form.add('some_input').label('Some Input').checked() //type="checkbox";
form.add('some_input').label('Some Input').secure() //type="password";
form.add('some_input').label('Some Input').is('email') //type="email";
form.add('some_input').label('Some Input').is('email').secure() //type="password";
form.add('some_input').label('Some Input').is('email').secure().type('date') //type="date";
```

## Form.Require() Validation

When you specify **form.require(*conditions, op*)** for a form, you are telling Forme to apply input requirement tests upon validation. This lets you do and/or tests on specific sets of inputs. For each call to **.require()** the form MUST pass that particular test; so if you had multiple .require() then they would all have to pass.
 
```javascript
 const forme = require('forme');
 const form = forme('login').post('form/process.html').require([['input1'],['input2']],'or');
 ```
 
When we call **.require()** we provide conditions to match and also an operator to match them with. Conditions are defined like so:
 ```javascript
 const conditions = [
     //group1
     [
         'input1',
         'input2',
     ],
     
     //group2
     [
         'input1',
         'input3',         
     ]
 ];
 
 const forme = require('forme');
 const form = forme('login').post('form/process.html').require(conditions,'or');
 ```
 
 The above example translates to hte following conditional check:
 ```javascript
 if ((input1.Length && input2.Length) || (input1.Length && input3.Length)) {
 
 }
 ````
 
 If we changed the op to **'and'** then it would be the equivalent of:
  ```javascript
  if ((input1.Length || input2.Length) && (input1.Length || input3.Length)) {
  
  }
  ````
 
## Static Form Example

A simple static login form.

**setup the static form**
```javascript
const forme = require('forme');

const form = forme('login').post('form/process.html');
form.add('username').label('Username').placeholder('User').require().is('username');
form.add('password').type('password').label('Password').placeholder('Password').require().secure();
```

**render the form (using pug/jade)**
```javascript
const pug = require('pug');

form.view(request, function() {
    const options = {};
    const locals = form.template();
    
    //render
    const html = pug.renderFile('login.pug', merge(options, locals));
});
```

**pug template (using bootstrap)**
```pug
div.panel.panel-default
    div.panel-heading Login
    div.panel-body
        form(name=forme.login.form.name, method=forme.login.form.method, action=forme.login.form.action)
            div.form-group
                input.form-control(type=forme.login.input.username.type, name=forme.login.input.username.name, placeholder=forme.login.input.username.placeholder, value=forme.login.input.username.value)

            div.form-group
                input.form-control(type=forme.login.input.password.type, name=forme.login.input.password.name, placeholder=forme.login.input.password.placeholder, value=forme.login.input.password.value)

            input.btn.btn-primary(type='submit', value='Login')
```

**process the form (using)**
```javascript
form.validate(request, function(validated, values, errors){
    if (!validated) {
        //form validation failed, redirect back to login form
    } else {
        //form validated, so try login 
        if (!login(values.username, values.password)) {
            //failed, so store form data using session handler
            form.store(req, function(){
                //redirect back to login form
            });
        } else {
            //success, do something here
        }
    }
});
```

## Input API
- **.value(** value, *[error]* **)** - sets the default value of this input
- **.className(** string/array **)** - adds a className(s) to the input *(only used in form.template())* 
- **.label(string)** - sets the inputs label used in error messages and template vars
- **.require(** value, *[error]* **)** - makes sure the input value exists when validated
- **.size(** size, *[error]* **)** - the input value has to be exactly this size when validated
- **.min(** size, *[error]* **)** - the input value has to be at least exactly this size when validated
- **.max(** size, *[error]* **)** - the input value has to be at no greater than this size when validated
- **.is(** string, *[error]* **)** - ensures the input value is of a particular *type* when validated. Uses [validator](https://github.com/chriso/validator.js)
- **.match(** string, *[error]* **)** - ensures the input value matches the target input value when validated.
- **.options(** array/object, *[error]* **)** - ensures the input is one of the specified values when validating. Also provides values to the template vars
- **.blacklist(** array, *[error]* **)** - value must not be one of the provided values
- **.callback(** function **)** - allows custom callback to be executed upon validation
- **.secure(** *[flag]* **)** - prevents storing of this value between page views/sessions
- **.checked(** *[flag]* **)** - sets a checkbox defaults checked state
- **.readonly(** *[flag]* **)** - set input template var *readonly* *(currently only used in form.template() vars. e.g. &lt;input readonly /&gt;)*
- **.hidden(** *[flag]* **)** - set input template var *type* to *'hidden'* *(currently only used in form.template() vars. e.g. &lt;input readonly /&gt;)*
- **.type(** string **)** - override input template var *type*. By default forme will guess a type based on the input properties that you have defined. 
- **.bool()** - converts the value to a bool
- **.int()** - converts the value to an int
- **.string()** - converts the value to a string
- **.float()** - converts the value to a float
- **.group(** string **)** - specifies a group name for values and template vars. When multiple inputs have the same group name, forme will convert these entries to an object with properties
- **.permanent(** value **)** - forces the input to always have this value


## Form API
- **.name(** string **)** - change the form's name
- **.get(** string **)** - set the form to get and specify the action address
- **.post(** string **)** - set the form to post and specify the action address *(a form will default the method to POST)*
- **.session(** sessionHandler **)** - set the session handler to use. If called with no arguments *(e.g. .session())* then the default session handler will be used. Forms will use teh default session handler unless changed.
- **.require(** array/object, operator, *[error]* **)** - and/or validation on single, multiple or groups of inputs
- **.add(** string **)** - add a new input to the form with the given name