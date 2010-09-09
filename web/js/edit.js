YUI().use('node', 'event', 'event-delegate', 'tabview', 'gallery-fiddler', function (Y) {
    var heightTimers,

        // elements
        pageUrl = Y.one('#url'),
        absoluteAttr = Y.one('#absoluteAttr'),
        recursive = Y.one('#recursive'),
        showOriginalPage = Y.one('#show-original-page'),
        showOriginalCode = Y.one('#show-original-code'),
        showChangedCode = Y.one('#show-changed-code'),
        outputTabs = new Y.TabView({
            srcNode: '#main-tabs'
        }),

        // fill code
        fillCode = function (container, html) {
            // TODO: set beautifier as ption w/ auto-beautifier
            container.set('value', style_html(html));
        },

        // test changes on url
        test = function () {
            var url = pageUrl.get('value'),
                config = {
                    absolute: absoluteAttr.get('checked'),
                    recursive: recursive.get('checked'),
                    render: {
                        changed: Y.one('#changed-page'),
                    },
                    blocks: [],
                    replaces: []
                },
                originalIframe = Y.one('#original-page iframe');

            if (showOriginalPage.get('checked')) { 
                config.render.original = Y.one('#original-page');
            } else if (originalIframe) {
                originalIframe.remove(true);
            }

            // get blocks of changes
            Y.all('.block').each(function (block) {
                var location = location = block.one('.location:checked').get('value');

                config.blocks.push({
                    order: block.one('.order:checked').get('value'),
                    location: (location === 'custom' ? block.one('.custom').get('value') : location),
                    content: block.one('textarea').get('value')
                });
            });
            if (!config.blocks.length) {
                delete config.blocks;
            }

            // get replaces
            Y.all('.replace').each(function (replace) {
                config.replaces.push({
                    search: {
                        type: replace.one('.search-type:checked').get('value'),
                        content: replace.one('.replace-from').get('value'),
                        flags: replace.one('.flags').get('value')
                    },
                    replace: {
                        type: replace.one('.replace-type:checked').get('value'),
                        content: replace.one('.replace-to').get('value'),
                        args: replace.one('.args').get('value')
                    }
                });
            });
            if (!config.replaces.length) {
                delete config.replaces;
            }
           
            // show codes
            config.on = {};
            if (showOriginalCode.get('checked')) {
                config.on.fetch = Y.bind(fillCode, this, Y.one('#original-code-area'));
            } else {
                Y.one('#original-code-area').set('value', '');
            }
            if (showChangedCode.get('checked')) {
                config.on.change = Y.bind(fillCode, this, Y.one('#changed-code-area'));
            } else {
                Y.one('#changed-code-area').set('value', '');
            }

            // request url and changes
            Y.fiddler(url, config);

            // start auto height timers
            if (!heightTimers) {
                heightTimers = {
                    changed: Y.later(3000, null, function () {
                        Y.fiddler.setHeight(Y.one('#changed-page .wdhb-frame'));
                    }, null, true),
                    original: Y.later(3000, null, function () {
                        Y.fiddler.setHeight(Y.one('#original-page .wdhb-frame'));
                    }, null, true)
               }; 
            }
        };

    // listeners
    Y.one('body').delegate('click', function (e) {
        e.halt();
        switch (e.currentTarget.get('id')) {
            case 'test-btn': test(); break;
        }
    }, 'button');

    // tabview
    outputTabs.render();
    Y.one('#tabs').removeClass('hidden');
});
