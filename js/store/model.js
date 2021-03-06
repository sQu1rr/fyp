/**
 * Model Store
 *
 * Handles the interaction between server and client, and stores the
 * intermediate results
 *
 * @module Store
 */
define(['jquery', 'util/util'], function ($, util) {
    "use strict";

    var models = {}; // model storage
    var $def = null; // global deferred object

    var URL = '/ProcessEngine/processModels'; // base URL

    /**
     * Clone model as a new one with a given name
     *
     * @param hanle {Integer} model handle
     * @param name {String} new model name
     *
     * @return {Promise}
     */
    function cloneModel(handle, name) {
        var model = models[handle]; // get model

        // convert to string, replace name and remove meta info
        var str = new XMLSerializer().serializeToString(model.xml);
        str = util.replaceAttr(str, 'name', model.name, name);
        str = util.replaceAttr(str, 'handle');
        str = util.replaceAttr(str, 'owner');
        str = util.replaceAttr(str, 'uuid');

        return createModel(str); // delegate to creation function
    }

    /**
     * Rename existing model
     *
     * @param handle {Integer} model handle
     * @param name {String} new model name
     *
     * @return {Promise}
     */
    function renameModel(handle, name) {
        var model = models[handle]; // get model

        // convert to string, replace name and remove meta info
        var str = new XMLSerializer().serializeToString(model.xml);
        str = util.replaceAttr(str, 'name', model.name, name);
        
        var url = URL + '/' + handle;
        return util.upload(url, 'processUpload', str).then(function () {
            models[handle].name = name;
            models[handle].xml.documentElement.setAttribute('name', name);
        });
    }

    /**
     * Update existing model with XML
     * Does not change the name
     *
     * @param handle {Integer} model handle
     * @param str {String} model xml
     *
     * @return {Promise}
     */
    function updateModel(handle, str) {
        var url = URL + '/' + handle;
        return util.upload(url, 'processUpload', str).then(function () {
            var xml = $.parseXML(str);
            models[handle].xml = xml;
            models[handle].uuid = xml.documentElement.getAttribute('uuid');
        });
    }

    /**
     * Create new model with given XML
     *
     * @param xml {String} model xml
     *
     * @return {Promise}
     */
    function createModel(xml) {
        var $def = $.Deferred(); // sucess on model re-fetch
        util.upload(URL, 'processUpload', xml).then(function (model) {
            var $xml = $(model); // newly fetched model
            var handle = $xml.attr('handle'); // now we know its handle
            fetchModel(handle, $xml.attr('name')).then(function () {
                $def.resolve(handle); // success
            });
        }).fail(function (e) { $def.reject(e); });
        return $def;

    }

    /**
     * Download model
     *
     * @param handle {Integer} model handle
     * @param name {String} model name
     *
     * @return {Promise}
     */
    function fetchModel(handle, name) {
        var url = URL + '/' + handle;
        return $.get(url).then(function (xml) {
            // test framework workaround
            if (typeof xml == 'string') xml = $.parseXML(xml);

            // store
            models[handle] = {
                handle: handle,
                name: name,
                uuid: xml.documentElement.getAttribute('uuid'),
                xml: xml
            };
        });
    }

    /**
     * Remove existing model
     *
     * @param handle {Integer} model handle
     *
     * @return {Promise}
     */
    function deleteModel(handle) {
        return $.ajax({ // special REST method delete, so only $.ajax
            url: URL + '/' + handle,
            type: 'DELETE'
        }).then(function () { delete models[handle]; });
    }

    /**
     * Update the whole list
     *
     * @return {Promise}
     */
    function update() {
        // we need list of deferreds
        $def = $.Deferred();
        var deferreds = [];

        $.get(URL).then(function (xml) {
            models = {}; // empty list
            $(xml).find('processModel').each(function () {
                var handle = $(this).attr('handle'); // get handle
                // fetch model
                deferreds.push(fetchModel(handle, $(this).attr('name')));
            });
            $.when.apply($, deferreds).then(function () {
                // notify that everything is resolved
                $def.resolve(models);
            }).fail(function (e) {
                $def.reject(e);
                console.error('Cannot update models', e);
            });
        }).fail(function (e) {
            $def.reject(e);
            console.error('Cannot update models', e);
        });

        return $def;
    }

    // export
    return {
        getList: function () { return $def ? $def : this.update(); },
        update: update,

        // model manipulation
        renameModel: renameModel,
        updateModel: updateModel,
        createModel: createModel,
        deleteModel: deleteModel,
        cloneModel: cloneModel,
        getModel: function (id) { return models[id]; },

        // reset
        reset: function () { $def = null; models = []; }
    };
});
