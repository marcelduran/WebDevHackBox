YUI().use('node', 'event', 'event-delegate', 'tabview', 'webdev-hackbox', function (Y) {
    var heightTimers,
        wdhb = Y.namespace('WDHB'),

        // elements
        pageUrl = Y.one('#url'),
        absolute = Y.one('#absolute'),
        recursive = Y.one('#recursive'),
        outputTabs = new Y.TabView({
            srcNode: '#output'
        }),

        // test changes on url
        test = function () {
            var config = {
                    url: pageUrl.get('value'),
                    absolute: absolute.get('checked'),
                    recursive: recursive.get('checked'),
                    container: {
                        changedView: Y.one('#changed-view'),
                        changedCode: Y.one('#changed-code-area'),
                        originalView: Y.one('#original-view'),
                        originalCode: Y.one('#original-code-area')
                    },
                    blocks: [],
                    replaces: []
                };

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

            // request url and changes
            wdhb.exec(config);

            // start auto height timers
            if (!heightTimers) {
                heightTimers = {
                    changed: Y.later(3000, null, function () {
                        wdhb.setHeight(Y.one('#changed-view .wdhb-frame'));
                    }, null, true),
                    original: Y.later(3000, null, function () {
                        wdhb.setHeight(Y.one('#original-view .wdhb-frame'));
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

    Y.one('#height-btn').on('click', function (e) {
        bespin.useBespin('changed-code-area', {syntax: 'html'});
    });
});
