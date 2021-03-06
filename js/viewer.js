/**
 * Main file for viewer application
 *
 * Starts up the viewer and initialises all its modules to be ready for user
 * interations
 *
 * @module Editor
 */
(function () {
    "use strict";

    /**
     * Make sure requirejs doesn't cache any files
     *
     * This cannot be put into config, otherwise the config itself might get
     * cached and this line will make no effect
     */
    require.config({ urlArgs: "bust=" + (new Date()).getTime() });

    // require config and continue initialisation
    requirejs(['config'], function () {
        // load template loader first, so we can show nice loading animation
        requirejs(['util/simple-template'], function (template) {
            // start loading animation
            var $load = template.load('#page');

            // load bootstrap which will initialise on just rendered page
            // and delegate the rest of the initialisation to main()
            requirejs(['bootstrap'], function () { 
                // make sure templates are loaded by this point
                template.init().then(function () { 
                    main(template, $load);
                });
            });
        });
    });

    /**
     * Loads all the required modules and initialises the page
     *
     * @param template {Object} template module
     * @param $load {Promise} loading promise
     */
    function main(template, $load) {
        // load auth and navigation controllers
        var controllers = [ 'share/auth', 'share/nav' ];

        // render page html
        var $html = template.render('viewer');
        $load.resolve($html);

        require(controllers, function (auth, nav) {
            nav.init('viewer-tasks'); // initialise navigation bar
            nav.createOther('editor');

            // try to login
            auth.tryLogin().then(function () {
                // automatically route to the landing page or the hashed page
                nav.login();
            }).fail(function () {
                // go to index page which asks to login
                nav.logout();
            });
        });
    }
})();
