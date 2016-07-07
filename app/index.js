'use strict';

var util = require('util'),
    path = require('path'),
    fs = require('fs'),
    yeoman = require('yeoman-generator'),
    jsYaml = require('js-yaml'),
    apischema = require('swagger-schema-official/schema'),
    builderUtils = require('swaggerize-routes/lib/utils'),
    wreck = require('wreck'),
    enjoi = require('enjoi'),
    update = require('./update'),
    mockgen = require('./mockgen'),
    SwaggerParser = require('swagger-parser');

var ModuleGenerator = yeoman.generators.Base.extend({
    init: function () {
        this.pkg = yeoman.file.readJSON(path.join(__dirname, '../package.json'));

        this.on('end', function () {
            if (!this.options['skip-install'] && this.only.length === 0) {
                this.npmInstall();
            }
        });
    },

    askFor: function () {
        var self, done, pkg;

        self = this;
        done = this.async();
        this.only = this.options.only;
        this.framework = this.options.framework;
        this.apiPath = this.options.apiPath && path.resolve(this.options.apiPath);
        this.appname = path.basename(process.cwd());

        if (!this.only || this.only === true) {
            this.only = [];
        }
        else {
            this.only = this.only.split(',');
        }

        if (this.only.length > 0) {
            if (fs.existsSync(path.resolve('package.json'))) {
                pkg = yeoman.file.readJSON(path.resolve('package.json'));
                if (pkg.dependencies.hapi) {
                    this.framework = 'hapi';
                }
            }
        }

        function all() {
            return self.only.length === 0;
        }

        console.log('Swaggerize Generator');

        var prompts = [
            {
                name: 'appname',
                message: 'What would you like to call this project:',
                default : this.appname,
                when: all
            },
            {
                name: 'creatorName',
                message: 'Your name:',
                when: all
            },
            {
                name: 'githubUser',
                message: 'Your github user name:',
                when: all
            },
            {
                name: 'email',
                message: 'Your email:',
                when: all
            },
            {
                name: 'apiPath',
                message: 'Path (or URL) to swagger document:',
                required: true,
                default: this.apiPath
            },
            {
                name: 'framework',
                message: 'Express, Hapi or Restify:',
                default: this.framework || 'express',
            }
        ];

        this.prompt(prompts, function (props) {
            var self;

            self = this;

            this.appname = props.appname || this.appname;
            this.creatorName = props.creatorName;
            this.githubUser = props.githubUser;
            this.email = props.email;
            this.framework = props.framework && props.framework.toLowerCase() || 'express';
            this.appRoot = path.basename(process.cwd()) === this.appname ? this.destinationRoot() : path.join(this.destinationRoot(), this.appname);

            if (this.framework !== 'express' && this.framework !== 'hapi' && this.framework !== 'restify') {
                done(new Error('Unrecognized framework: ' + this.framework));
                return;
            }
            
            this.swaggerParser = new SwaggerParser();
            
            this.swaggerParser.validate(props.apiPath).then(function(api) {
                self.api = api;

                if ((/^http.?:\/\//i).test(props.apiPath)) {
                    // Get the API spec (yes, again) in order to have it locally.
                    // Probably could just use the swagger parser, but that is all dereferenced.
                    wreck.get(props.apiPath, function(err, res, body) {
                        if (err) {
                            done(err);
                            return;
                        }
                        if (res.statusCode !== 200) {
                            done(new Error(res.statusCode + ': ' + props.apiPath));
                            return;
                        }
                        self.rawApi = body;
                        self.apiPath = path.join(self.appRoot, 'config/' + props.apiPath.split('/').slice(-1));
                        done();
                    });
                } else {
                    self.apiPath = path.resolve(props.apiPath);
                    done();
                }
            }).catch(function(err) {
               done(err); 
            });
        }.bind(this));
    },

    root: function () {
        if (process.cwd() !== this.appRoot) {
            this.mkdir(this.appRoot);
            process.chdir(this.appRoot);
        }
    },

    validate: function () {
        var done = this.async();

        this.api = this.api || yeoman.file.readJSON(this.apiPath);

        enjoi(apischema).validate(this.api, function (error) {
            done(error);
        });
    },

    app: function () {

        var relativeApiPath = this.apiConfigPath = path.relative(this.appRoot, path.join(this.appRoot, 'config/' + path.basename(this.apiPath)));

        if (this.only.length === 0) {
            this.mkdir('config');

            this.copy('jshintrc', '.jshintrc');
            this.copy('gitignore', '.gitignore');
            this.copy('npmignore', '.npmignore');

            this.template('server_' + this.framework + '.js', 'server.js', {
                apiPath: relativeApiPath
            });
            this.template('_package.json', 'package.json');
            this.template('_README.md', 'README.md');
        }
        
        if (this.rawApi) {
            // The raw api object is already read into a property (like from http)
            this.write(this.apiConfigPath, this.rawApi);
        } else if (fs.existsSync(this.apiPath)) {
            // The source api file exists.
            if (path.relative(this.apiPath, this.apiConfigPath)) {
                // The source api file is a different location than one in the config directory
                this.copy(this.apiPath, this.apiConfigPath);
            }
        }
    },

    handlers: function () {
        var routes;

        if (this.only.length > 0 && this.only.indexOf('handlers') < 0) {
            return;
        }

        routes = {};

        this.mkdir('handlers');

        Object.keys(this.api.paths).forEach(function (path) {
            var pathnames, route;
            var def = this.api.paths[path];

            route = {
                path: path,
                pathname: undefined,
                methods: [],
                handler: undefined
            };

            pathnames = [];

            path.split('/').forEach(function (element) {
                if (element) {
                    pathnames.push(element);
                }
            });

            route.pathname = pathnames.join('/');

            builderUtils.verbs.forEach(function (verb) {
                var operation = this.api.paths[path][verb];

                if (!operation) {
                    return;
                }

                route.methods.push({
                    method: verb,
                    name: operation.operationId || '',
                    description: operation.description || '',
                    parameters: operation.parameters || [],
                    responses: operation.responses || {},
                    produces: operation.produces || this.api.produces || []
                });

                // if handler specified within specification then use that path
                // else default to the route path.
                route.handler = operation['x-handler'] || def['x-handler'] || route.pathname;
            }, this);

            if (routes[route.pathname]) {
                routes[route.pathname].methods.push.apply(routes[route.pathname].methods, route.methods);
                return;
            }

            routes[route.pathname] = route;
        }, this);

        Object.keys(routes).forEach(function (routePath) {
            var handlerName, route, file;

            route = routes[routePath];
            handlerName = route.handler;

            if (handlerName.indexOf('handlers/') < 0) {
                handlerName = 'handlers/' + route.handler;
            }

            if (handlerName.indexOf('.js') < 0) {
                handlerName += '.js';
            }

            file = path.join(this.appRoot, handlerName);

            //if (fs.existsSync(file)) {
            //    fs.writeFileSync(file, update.handlers(file, this.framework, route));
            //    return;
            //}

            this.template('_handler_' + this.framework + '.js', file, {
                route: route,
                mockgen: mockgen
            });
        }, this);
    },

    tests: function () {
        var api, apiPath, handlersPath, resourcePath;

        if (this.only.length > 0 && this.only.indexOf('tests') < 0) {
            return;
        }

        this.mkdir('tests');
        
        apiPath = path.relative(path.join(this.appRoot, 'tests'), path.join(this.appRoot, 'config/' + path.basename(this.apiPath)));
        handlersPath = path.relative(path.join(this.appRoot, 'tests'), path.join(this.appRoot, 'handlers'));
        resourcePath = this.api.basePath;

        Object.keys(this.api.paths).forEach(function (opath) {
            var fileName, operations;

            operations = [];

            builderUtils.verbs.forEach(function (verb) {
                var operation = {};

                if (!this.api.paths[opath][verb]) {
                    return;
                }

                Object.keys(this.api.paths[opath][verb]).forEach(function (key) {
                    operation[key] = this.api.paths[opath][verb][key];
                }.bind(this));

                operation.path = opath;
                operation.method = verb;

                operations.push(operation);
            }, this);

            fileName = path.join(this.appRoot, 'tests/test' + opath.replace(/\//g, '_') + '.js');

            this.template('_test_' + this.framework + '.js', fileName, {
                apiPath: apiPath,
                handlersPath: handlersPath,
                resourcePath: resourcePath,
                operations: operations,
                mockgen: mockgen
            });

        }, this);
    }

});

module.exports = ModuleGenerator;
