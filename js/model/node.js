define(['jquery', 'joint', 'model/dialogue', 'lodash'],
       function ($, joint, Dialogue, _) {
    "use strict";

    var SIZE = 30;

    var NodeClass = joint.dia.Element.extend({
        markup: '<g class="rotatable">' +
                    '<image width="' + SIZE + '" height="' + SIZE + '" ' +
                           'xlink:href="svg/end.svg"/>' +
                    '<text x="15" y="17" font-family="sans-serif" ' +
                          'font-size="7" text-anchor="middle"></text>' +
                '</g>',

        defaults: joint.util.deepSupplement({
            type: 'Node'
        }, joint.dia.Element.prototype.defaults)
    });

    var Base = Backbone.Model.extend({
        type: null,
        linkLimit: { input: 1, output: 1 },
        canEdit: false,

        create: function (offset) {
            this.label = null;
            this.cell = new NodeClass({
                position: offset,
                attrs: { image: { 'xlink:href': 'svg/' + this.type + '.svg' } }
            });
        },

        tooltip: function (callback) {
            callback(this.cell.position().x, this.cell.position().y);
        },

        fromXml: function ($xml) {}
    });

    /*
     * Start Node
     */

    var Start = Base.extend({
        type: 'start',
        linkLimit: { input: 0, output: 1 },
        toXml: function () {
            return $('<start>', {
                id: this.cid,
                x: this.cell.attributes.position.x,
                y: this.cell.attributes.position.y
            })
        }
    });

    /*
     * Block
     */

    function addItem($cell, $item, value, name, result) {
        if (result) {
            var rname = 'r_' + name;
            $('<result>', {
                xpath: '/values/' + name + '/text()',
                name: rname
            }).appendTo($cell);
        }
        var dname = 'd_' + name;
        $('<define>', { name: dname }).append(value).appendTo($cell);
        $('<attribute>', {
            'xmlns:jbi': 'http://adaptivity.nl/ProcessEngine/activity',
            value: dname,
            name: name
        })
    }

    var Block = Base.extend({
        type: 'block',
        canEdit: true,

        edit: function (storage) {
            var self = this;
            new Dialogue.Block(this, storage, function (label) {
                self.setText(label);
            });
        },

        setText: function (text) {
            var id = this.cell.findView(this.paper).id;
            $('#' + id).find('text').get(0).textContent = text;
        },

        fromXml: function ($xml, $model) {
            var attrs = { elements: [] };
            if ($xml.attr('label')) attrs.label = $xml.attr('label');

            var defines = {};

            $model.find('pe\\:define,define').each(function () {
                var name = $(this).attr('name');
                defines[name] = this.textContent;
            });

            var elements = [];
            $xml.find('umh\\:item,item').each(function () {
                var element = {};

                var label = $(this).attr('name');
                var type = $(this).attr('type');

                element.label = label;
                element.type = type;
                $(this).find('jbi\\:attribute,attribute').each(function () {
                    var attribute = $(this).attr('name');
                    var value = $(this).attr('value');

                    if (defines[value]) value = defines[value];

                    element[attribute] = value;
                });

                elements.push(element);
            });
            attrs.elements = elements;

            this.attrs = attrs;
        },

        toXml: function (predecessors) {
            var params = {
                id: this.cid,
                x: this.cell.attributes.position.x,
                y: this.cell.attributes.position.y,
            };

            if (this.attrs.label) params['label'] = this.attrs.label;
            if (predecessors.length == 1) {
                params['predecessor'] = predecessors[0].cid;
            }

            var $cell = $('<activity>', params);

            if (!this.attrs.elements.length) return $cell;

            var $message = $('<message>', {
                type: 'application/soap+xml',
                serviceNS: 'http://adaptivity.nl/userMessageHandler',
                serviceName: 'userMessageHandler',
                endpoint: 'internal',
                operation: 'postTask'
            }).appendTo($cell);
            
            var $envelope = $('<Envelope>', {
                'xmlns:env': 'http://www.w3.org/2003/05/soap-envelope',
                encodingStyle: 'http://www.w3.org/2003/05/soap-encoding'
            }).appendTo($message);

            var $body = $('<Body>').appendTo($envelope);
            var $postTask = $('<postTask>', {
                'xmlns:umh': 'http://adaptivity.nl/userMessageHandler'
            }).appendTo($body);

            var $repliesParam = $('<repliesParam>').appendTo($postTask);
            $('<element>', {
                'xmlns:jbi': 'http://adaptivity.nl/ProcessEngine/activity',
                value: 'endpoint'
            }).appendTo($repliesParam);

            var $taskParam = $('<taskParam>').appendTo($postTask);
            var $task = $('<task>').appendTo($taskParam);
            $('<attribute>', {
                'xmlns:jbi': 'http://adaptivity.nl/ProcessEngine/activity',
                value: 'instancehandle',
                name: 'instancehandle'
            }).appendTo($task);
            $('<attribute>', {
                'xmlns:jbi': 'http://adaptivity.nl/ProcessEngine/activity',
                value: 'handle',
                name: 'remotehandle'
            }).appendTo($task);
            $('<attribute>', {
                'xmlns:jbi': 'http://adaptivity.nl/ProcessEngine/activity',
                value: 'owner',
                name: 'owner'
            }).appendTo($task);

            $.each(this.attrs.elements, function (i, val) {
                var $item = $('<item>', {
                    name: val.name,
                    type: val.type
                }).appendTo($task)
                if (val.label) {
                    addItem($cell, $item, val.label, 'label');   
                }
                if (val.value) {
                    addItem($cell, $item, val.value, 'value', true);   
                }
            }); 

            return $cell;
        }
    });

    /*
     * Gate
     */

    var Gate = Base.extend({
        canEdit: true,

        edit: function () {
            new Dialogue.Gate(this);
        },

        fromXml: function ($xml) {
            this.attrs = { min: -1, max: -1 };
            if ($xml.attr('label')) this.attrs.label = $xml.attr('label');
            if ($xml.attr('min')) this.attrs.min = $xml.attr('min') - 0;
            if ($xml.attr('max')) this.attrs.max = $xml.attr('max') - 0;
        },

        toXml: function (predecessors) {
            var params = {
                id: this.cid,
                x: this.cell.attributes.position.x,
                y: this.cell.attributes.position.y
            };
            if (this.attrs.min >= 0) params.min = this.attrs.min;
            if (this.attrs.max >= 0) params.max = this.attrs.max;
            if (predecessors.length == 1) {
                params['predecessor'] = predecessors[0].cid;
            }
            var $cell = $('<' + this.type + '>', params);

            if (predecessors.length > 1) {
                $.each(predecessors, function (i, val) {
                    $('<predecessor>' + val.cid + '</predecessor>')
                        .appendTo($cell);
                });
            }
            return $cell;
        },
    });

    var Split = Gate.extend({
        type: 'split',
        linkLimit: { input: 1, output: -1 },
    });

    var Join = Gate.extend({
        type: 'join',
        linkLimit: { input: -1, output: 1 },
    });

    /*
     * End Node
     */

    var End = Base.extend({
        type: 'end',
        linkLimit: { input: 1, output: 0 },
        toXml: function (predecessors) {
            var params = {
                id: this.cid,
                x: this.cell.attributes.position.x,
                y: this.cell.attributes.position.y
            };
            if (predecessors.length) {
                params['predecessor'] = predecessors[0].cid;
            }
            return $('<end>', params);
        }
    });

    /*
     * Export
     */

    return {
        Start: Start,
        Block: Block,
        Join: Join,
        Split: Split,
        End: End,
        SIZE: SIZE
    };
});
