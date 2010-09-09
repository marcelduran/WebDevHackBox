YUI.add('gallery-fiddler', function (Y) {
    var
        // regular expressions
        rePathAttr = /([\s:](?:src|href)\s*=\s*["']?)([\w\d\/\-].{0,10})/gi,
        rePathStyle = /([\s:]url\s*\(\s*["']?)([\w\d\/\-].{0,10})/gi,
        rePathJS = /(\.(?:src|href)\s*=\s*["'])([\w\d\/\-].{0,10})/gi,
        reProtocol = /^[A-Za-z]+:\/{0,3}/,
        reUri = /^(?:([A-Za-z]+:))?(\/{0,3})?([0-9.\-A-Za-z]+)?(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/,
        reIframe = /<iframe [^>]*(src\s*=\s*["']?([^"' >]*)['"]?)[^>]*>/gi,
        reId = /id\s*=\s*["']?([^"' >]*)['"]?/i,
        reLink = /<link[^>]*(?:rel=["']?stylesheet["']?[^>]*href=["']?([^>"']*)["']?|href=["']?([^>"']*)["']?[^>]*rel=["']?stylesheet["']?)[^>]*>/gi,

        // set iframe height based on content
        setHeight = function (frame) {
            var currentHeight, idoc, newHeight;

            if (!frame) {
                return;
            }

            idoc = Y.Node.getDOMNode(frame.get('contentWindow.document'));
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
            // links
            if (true) {
                html.links(conf);
            }

            // replaces
            if (conf.replaces) {
                Y.Array.each(conf.replaces, function (r) {
                    html.replace(r.search, r.replace);
                });
            }

            // TODO: split absolute options: attr, style and js
            if (conf.absolute) {
                // turns relative attributes (src and href) into absolute
                html.absolute(rePathAttr, conf);
                // turns relative style url into absolute
                html.absolute(rePathStyle, conf);
                // turns relative js properties (src and href) into absolute
                html.absolute(rePathJS, conf);
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
        buildIframe = function (render) {
            var frame,
                YN = Y.Node,
                tagName = render.get('tagName');

            // check if node is already an iframe and return it
            if (tagName === 'IFRAME' || tagName === 'STYLE') {
                return render;
            }
            
            // get iframe inside container and remove
            // it to avoid new history entries
            if (frame = render.one('iframe')) {
                frame.remove(true);
            }

            // build iframe setting height on load
            // and append into container
            frame = Y.Node.create('<iframe class="wdhb-frame" frameborder="0" scrolling="no"></iframe>');
            frame.on('load', Y.bind(setHeight, null, frame));
            render.append(frame);

            return frame;
        },

        // write content into iframe
        writeIframe = function (frame, content) {
            var idoc;

                Y.log(frame);
            if (frame.get('tagName') === 'IFRAME') {
                idoc = Y.Node.getDOMNode(frame.get('contentWindow.document'));
                idoc.open();
                try {
                    idoc.write(content);
                } catch (e) {
                    Y.log(e);
                } finally {
                    idoc.close();
                }
            } else {
                frame.setContent(content);
            }
        },

        // fiddle html content in iframes applying changes
        fiddleContent = function (conf, response) {
            Y.log('fiddling: ' + conf.url);
            var beforeChange, changed, onChange, onFetch, original,
                html = new Html(response.query.results.result),
                htmlString = html.toString(),
                on = conf.on,
                render = conf.render;

            if (render) {
                original = render.original;
                changed = render.changed;
            }

            if (on) {
                onFetch = on.fetch;
                beforeChange = on.beforeChange;
                onChange = on.change;
            }

            // execute onFetch event
            if (onFetch) {
                onFetch.apply(on.context, [htmlString].concat(conf.args));
            }

            // render original
            if (original) {
                writeIframe(buildIframe(original), htmlString);
            }

            // execute beforeChange event
            if (beforeChange) {
                beforeChange.apply(on.context, [html].concat(conf.args));
            }

            // apply changes on html
            applyChanges(html, conf);
            htmlString = html.toString();

            // execute onChange event
            if (onChange) {
                onChange.apply(on.context, [htmlString].concat(conf.args));
            }

            // render changed content
            Y.log(changed);
            if (changed) {
                writeIframe(buildIframe(changed), htmlString);
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
        exec = function (url, config) {
            var yql,
                conf = Y.clone(config);
            
            conf.url = normalizeUrl(url);
            yql = 'use "http:/' + '/sandbox.javascriptrules.com/yql/raw.xml";select * from raw where url="' + conf.url + '"';
            conf.uri = getUriPath(url);
            conf.args = conf.args || [];

            // request raw page from yql
            Y.YQL(yql, Y.bind(fiddleContent, null, conf));
        };

    // the html methods
    Html.prototype = {
        constructor: Html,

        // generic inline block insert
        insertContent: function (tag, content, last) {
            var custom, pos,
                v = this.value;

            if (tag) {
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
            } else {
                pos = last ? v.length - 1 : 0;
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
        absolute: function (re, conf) {
            this.value = this.value.replace(re, function (match, attr, value) {
                return reProtocol.test(value) ? match : attr + conf.uri + (value.indexOf('/') === 0 ? '' : '/') + value;
            });

            return this;
        },

        // make iframes recursive
        recursive: function (conf) {
            var block = '<script src="http://yui.yahooapis.com/combo?3.2.0/build/yui/yui-min.js&3.2.0/build/loader/loader-min.js"></script>' +
                    '<script src="file:///Users/marcell/work/WebDevHackBox/web/js/gallery-fiddler.js"></script>',
                abs = conf.absolute ? 'absolute:true,' : '',
                rec = conf.recursive ? 'recursive:true,' : '',
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
                exec += 'Y.fiddler("' + src + '",{' + abs + rec + 'render:{changed:Y.one("#' + id + '")}});';

                return match.slice(0, idx) + idAttr + match.slice(idx + attr.length);
            });

            // append block of execution into body
            if (exec.length) {
                exec = '<script>YUI().use("node","gallery-fiddler",function(Y){' + exec + '});</script>';
                this.append('body', block + exec);
            }

            return this;
        },

        // links into styles
        links: function (conf) {
            this.value = this.value.replace(reLink, function (tag, href1, href2) {
                var id = Y.guid(),
                    exec = 'Y.fiddler("' + (href1 || href2) + '",{render:{changed:Y.one("#' + id + '")},blocks:[{order:"append",content:"#header{background-color:green;}"}]});';
                    block = '<script src="http://yui.yahooapis.com/combo?3.2.0/build/yui/yui-min.js&3.2.0/build/loader/loader-min.js"></script>' +
                        '<script src="file:///Users/marcell/work/WebDevHackBox/web/js/gallery-fiddler.js"></script>',

                exec = '<script>YUI().use("node","gallery-fiddler",function(Y){' + exec + '});</script>';

                return '<style type="text/css" id="' + id + '"></style>' + block + exec;
            });
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
    Y.fiddler = exec;
    Y.fiddler.setHeight = setHeight

}, '0.0.1', {
    requires: ['node', 'event', 'yql']
});
