YUI.add('webdev-hackbox', function (Y) {
    var wdhb = Y.namespace('WDHB'),

        // regular expressions
        rePath = /([\s:](?:src|href|url)\s*[=(]\s*["']?)([\w\d\/\-].{0,10})/gi,
        reProtocol = /^[A-Za-z]+:\/{0,3}/,
        reUri = /^(?:([A-Za-z]+:))?(\/{0,3})?([0-9.\-A-Za-z]+)?(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/,
        reIframe = /<iframe [^>]*(src\s*=\s*["']?([^"' >]*)['"]?)[^>]*>/gi,
        reId = /id\s*=\s*["']?([^"' >]*)['"]?/i,

        // set iframe height based on content
        setHeight = function (frame) {
            var currentHeight, idoc, newHeight;

            if (!frame) {
                return;
            }

            idoc = frame._node.contentWindow.document;
            currentHeight = parseInt(frame.getStyle('height'));
            newHeight = parseInt(Math.max(idoc.documentElement.offsetHeight, idoc.body.offsetHeight), 10) || 600;

            if (newHeight !== currentHeight) {
                frame.setStyle('height', newHeight + 'px');
            }
        },

        // the html constructor
        Html = function (content) {
            this.value = content || '';
        },

        // insert blocks into html and do replacements and changes
        applyChanges = function (html, conf) {
            // replaces
            if (conf.replaces) {
                Y.Array.each(conf.replaces, function (r) {
                    html.replace(r.search, r.replace);
                });
            }

            // turns relative links into absolute
            if (conf.absolute) {
                html.relativeIntoAbsolute(conf);
            }

            // runs iframes recursively
            if (conf.recursive) {
                html.recursive(conf);
            }

            // insert blocks
            if (conf.blocks) {
                Y.Array.each(conf.blocks, function (block) {
                    html[block.order](block.location, block.content);
                });
            }
        },

        // build iframe recreating old ones to avoid new history entries
        buildIframe = function (container) {
            var frame = container.one('.wdhb-frame');

            if (frame) {
                frame.remove(true);
            }
            frame = Y.Node.create('<iframe class="wdhb-frame" frameborder="0" scrolling="no"></iframe>');
            frame.on('load', function () {
                setHeight(frame);
            });
            container.append(frame);

            return frame;
        },

        // write content into iframe
        writeIframe = function (frame, content) {
            var idoc = frame._node.contentWindow.document;

            idoc.open();
            try {
                idoc.write(content);
            } catch (e) {
                Y.log(e);
            } finally {
                idoc.close();
            }
        },

        // render html content in iframes applying changes
        renderContent = function (response, conf) {
            Y.log('render: ' + conf.url);
            Y.log(conf);
            Y.log(response.query.results);
            var container = conf.container || {},
                html = new Html(response.query.results.result);

            // render original view and code
            if (container.originalView) {
                writeIframe(buildIframe(container.originalView), html.toString());
            }
            if (container.originalCode) {
                container.originalCode.set('value', html.toString());
            }

            // apply changes on html
            applyChanges(html, conf);

            // recursive iframes
            if (conf.iframe) {
                writeIframe(conf.iframe, html.toString());
                return;
            }

            // render changed view and code
            if (container.changedView) {
                writeIframe(buildIframe(container.changedView), html.toString());
            }
            if (container.changedCode) {
                container.changedCode.set('value', html.toString());
            }
        },

        // get uri path from url
        getUriPath = function (url) {
            var parts = reUri.exec(url) || [],
                scheme = parts[1],
                slash = parts[2],
                host = parts[3],
                port = parts[4],
                path = parts[5];

                return (host || path) && (
                    (scheme || 'http') + (slash || '//') + (host || '') +
                    (port && ':' + port || '') + (path && '/' + path || '')) || url;
        },

        // normalize url
        normalizeUrl = function (url) {
            return reProtocol.test(url) ? url : 'http://' + url;
        },

        // execute changes
        exec = function (conf) {
            var url = normalizeUrl(conf.url),
                q = 'use "http:/' + '/sandbox.javascriptrules.com/yql/raw.xml";select * from raw where url="' + url + '"',
                yql = 'http:/' + '/query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(q) + '&format=json';

            conf.uri = getUriPath(url);

            // request raw page from yql
            Y.jsonp(yql, {
                on: {
                    success: renderContent
                },
                args: [conf]
            });
        };

    // the html methods
    Html.prototype = {
        constructor: Html,

        // generic inline block insert
        insertContent: function (tag, content, last) {
            var custom, pos,
                v = this.value;

            // check for custom
            if (tag.indexOf('<') === 0) {
                tag = tag.slice(1, tag.length - (tag.lastIndexOf('>') === tag.length - 1 ? 1 : 0));
                custom = true;
            }

            // get insert position
            if (last) {
                if (custom) {
                    pos = (pos = v.indexOf('<' + tag)) > -1 ? pos : 0;
                } else {
                    pos = (pos = v.lastIndexOf('</' + tag + '>')) > -1 ? pos : v.length;
                }
            } else {
                pos = (pos = v.indexOf('<' + tag)) > -1 ? v.indexOf('>', pos) + 1 : 0;
            }

            this.value = v.slice(0, pos) + content + v.slice(pos); 

            return this;
        },

        // prepend content into tag as first child
        prepend: function (tag, content) {
            return this.insertContent(tag, content);
        },

        // append content into tag as last child
        append: function (tag, content) {
            return this.insertContent(tag, content, true);
        },

        // turns relative paths into absolute
        relativeIntoAbsolute: function (conf) {
            this.value = this.value.replace(rePath, function (match, attr, value) {
                return reProtocol.test(value) ? match : attr + conf.uri + (value.indexOf('/') === 0 ? '' : '/') + value;
            });

            return this;
        },

        // make iframes recursive
        recursive: function (conf) {
            var block = '<script src="http://yui.yahooapis.com/3.1.1/build/yui/yui-min.js"></script>' +
                    '<script src="http://localhost:8080/js/wdhb.js"></script>',
                abs = conf.absolute ? ',absolute:true' : '',
                rec = conf.recursive ? ',recursive:true' : '',
                exec = '';
            
            // remove src and get/add id for iframes
            this.value = this.value.replace(reIframe, function (match, attr, src) {
                var id = ((id = reId.exec(match)) && id[1]),
                    idx = match.indexOf(attr),
                    idAttr = '';

                if (!id) {
                    id = Y.guid();
                    idAttr = 'id="' + id + '"';
                }
                exec += 'wdhb.exec({url:"' + src + '"' + abs + rec + ',iframe:Y.one("#' + id + '")});';

                return match.slice(0, idx) + idAttr + match.slice(idx + attr.length);
            });

            // append block of execution into body
            if (exec.length) {
                exec = '<script>YUI().use("node","webdev-hackbox",function(Y){var wdhb=Y.namespace("WDHB");' + exec + '});</script>';
                this.append('body', block + exec);
            }

            return this;
        },

        // make replacements strings, regexp and function (any combination)
        replace: function (search, replace) {
            search = search.type === 'regexp' ? new RegExp(search.content, search.flags || '') : search.content;
            replace = replace.type === 'function' ? new Function(replace.args || [], replace.content) : replace.content;
            this.value = this.value.replace(search, replace);

            return this;
        },

        toString: function () {
            return this.value;
        }
    };

    // expose API
    wdhb.exec = exec;
    wdhb.setHeight = setHeight;
}, '0.0.1', {
    gallery: 'gallery-2010.02.10-01',
    requires: ['node', 'event', 'gallery-jsonp']
});
