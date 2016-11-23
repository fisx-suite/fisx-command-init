fisx-command-init
========

> Init project or files using the given tempalte.

## How to use

### Init project

```shell
fisx init # using the default project template to init project
fisx init spa # init spa project template
fisx init spa --force # force init the not empty project directory
fisx init gitlab:xx/xx # init project using the template from gitlab
fisx init github:xx/xx # init project using the template from github
fisx init ./xx/xx # init project from local template
fisx init npm:xx@1.0.0 # specify the scaffold version
```

The init source syntax is the same as [fisx package install](https://github.com/wuhy/fisx-command-install)

If using gitlab, some custom options you can configure:

```javascript
fis.set('scaffold.gitlabDomain', 'http://<your gitlab domain>');
fis.set('scaffold.gitlabToken', '<private token>');
```

### Init file

```shell
fisx init html index.html # create html file
fisx init js app.js # create js file
```
    
### View help information

```shell
fisx init -h
```

## Custom builtin template

Default builtin template is [fisx-scaffold](https://github.com/fisx-scaffold). You can custom the builtin template type:

* Custom project template

    ```javascript
    fis.set('scaffold.project', {
        spa: {
            uri: 'yourscaffold/xxx', // by default source is github, you can use like github:xx to specify the source type
            description: 'the template descripion, you can see this in help information'
        }
    });
    ```
    
* Custom file template

    ```javascript
    fis.set('scaffold.file', {
        html: {
            uri: 'yourscaffold/xxx.html',
            description: 'the template descripion, you can see this in help information'
        }
    });
    ```

* Custom the deafult template source owner:

    `fisx init abc` is equivalent to `fisx init myrepos/abc`, and is also equivalent to `fisx init github:myrepos/abc`.

    ```javascript
    fis.set('scaffold.namespace', 'myrepos');
    ```

* Custom the scaffold source type

    By default, the default source type is `GitHub`, using the following setting to change:

    ```javascript
    fis.set('scaffold.source', {
        value: 'gitlab',
        options: function () {
            token: 'xx',
            domain: 'http://xx.gitlab.com'
        }
    });
    ```

## Template variable

### Syntax of variable

* `${#variableName#}`: the variable value will be inited in the form of command interaction

* `${#variableName=variable default value#}`: with default value

* `${#varName:boolean=true#}`: specify the type of the variable

* The template is rendered by template engine [etpl](https://github.com/ecomfe/etpl), so it supports the syntax like conditional expression defined in `etpl`.

* You can use the template variable in file name or file content.

### Builtin template variable

* author: by default using the author information from `package.json`, if not found, will try to use the system use name.

* date: the date format is like `YYYY/m/d`

* custom your template variable

    ```javascript
    fis.set('template.xxx', function () {
        return 'xxx';
    });
    fis.set('template.xxx', 'xxx');
    ```
