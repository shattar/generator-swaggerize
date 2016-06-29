'use strict';

var test = require('tape'),
    path = require('path'),
    express = require('express'),
    jsYaml = require('js-yaml'),
    fs = require('fs'),
    enjoi = require('enjoi'),
    swaggerize = require('swaggerize-express'),
    request = require('supertest');

test('api', function (t) {
    var app = express();

    <%_.forEach(operations, function (operation) { if (operation.method.toLowerCase() === 'post' || operation.method.toLowerCase() === 'put') { %>
    app.use(require('body-parser')());<%}});%>

    app.use(swaggerize({
        api: path.join(__dirname, './<%=apiPath.replace(/\\/g, "/")%>'),
        handlers: path.join(__dirname, '<%=handlers.replace(/\\/g, "/")%>')
    }));

    <%_.forEach(operations, function (operation) {%>
    t.test('test <%=operation.method%> <%=operation.path%>', function (t) {
        <%
        var path = operation.path;
        var body;
        var responseCode = operation.responses && Object.keys(operation.responses)[0];
        var response = responseCode && operation.responses[responseCode];
        var responseSchema = response && response.schema;
        if (operation.parameters && operation.parameters.length) {
            _.forEach(operation.parameters, function (param) {
                
                var derefParam = param;
                
                if (param.$ref && param.$ref.startsWith('#/parameters')) {
                    var paramKey = param.$ref.split('/').slice(2).join('/');
                    if (parameters.hasOwnProperty(paramKey)) {
                        derefParam = parameters[paramKey];
                    }
                }
                
                if (derefParam.in === 'path') {
                    path = operation.path.replace(/{([^}]*)}*/, function (p1, p2) {
                        switch (derefParam.type) {
                            case 'integer':
                            case 'number':
                            case 'byte':
                                return 1;
                            case 'string':
                                return 'helloworld';
                            case 'boolean':
                                return true;
                            default:
                                return '{' + p2 + '}';
                        }
                    });
                } else if (derefParam.in === 'body' && derefParam.schema) {
                    var ref = derefParam.schema.$ref;
                    //Get the $ref from the items for array definitions
                    if (derefParam.schema.type === 'array' && derefParam.schema.items) {
                        ref = derefParam.schema.items.$ref;
                    }
                    if (ref) {
                        body = models[ref.slice(ref.lastIndexOf('/') + 1)];
                    }
                }
            });
        }
        if (body && (operation.method.toLowerCase() === 'post' || operation.method.toLowerCase() === 'put')) {%>
        var body = {<%_.forEach(Object.keys(body).filter(function (k) { return !!body[k]; }), function (k, i) {%>
            '<%=k%>': <%=JSON.stringify(body[k])%><%if (i < Object.keys(body).filter(function (k) { return !!body[k]; }).length - 1) {%>, <%}%><%})%>
        };
        <%} if (responseSchema) {%>
        var responseSchema = enjoi({<%_.forEach(Object.keys(responseSchema), function (k, i) {%>
            '<%=k%>': <%=JSON.stringify(responseSchema[k])%><%if (i < Object.keys(responseSchema).length - 1) {%>, <%}%><%})%>
        }, {
                subSchemas: {
                    '#': <%if (apiPath.indexOf('.yaml') === apiPath.length - 5 || apiPath.indexOf('.yml') === apiPath.length - 4) {%> jsYaml.load(fs.readFileSync(path.join(__dirname, './<%=apiPath.replace(/\\/g, "/")%>'))) <% }else{ %> require(path.join(__dirname, './<%=apiPath.replace(/\\/g, "/")%>')) <% } %>
                }
        });
        <%}%>

        request(app).<%=operation.method.toLowerCase()%>('<%=resourcePath%><%=path%>')<%if (body && (operation.method.toLowerCase() === 'post' || operation.method.toLowerCase() === 'put')){%>.send(body)<%}%>
        .end(function (err, res) {
            t.ok(!err, '<%=operation.method.toLowerCase()%> <%=operation.path%> no error.');
            <%if (responseCode === 'default') {%>t.ok(res.statusCode, '<%=operation.method.toLowerCase()%> <%=operation.path%> <%=responseCode%> status.');<%} else {%>
            t.strictEqual(res.statusCode, <%=responseCode%>, '<%=operation.method.toLowerCase()%> <%=operation.path%> <%=responseCode%> status.');<%}%><%if (responseSchema) {%>
            responseSchema.validate(res.body, function (error) {
                t.ok(!error, 'Response schema valid.');
            });<%}%>
            t.end();
        });
    });
    <%});%>

});
