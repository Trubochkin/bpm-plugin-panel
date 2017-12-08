import '../lib/jstree/themes/default-dark/style.min.css!';
import '../lib/jstree/themes/default/style.min.css!';
import '../lib/jstree/jstree.min';
import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';


angular.module('grafana.directives').directive("dTreeView", function () {
        return {
            templateUrl: 'public/plugins/test1-panel/directives/partials/tree-view.html',
            restrict: 'E',
            controller: function ($scope) {
                console.log('this-controller-directive', this);
                // когда страница загрузилась
                $(document).ready(function () {
                    /* // отключаем скрытие меню 
                    $(this).on('click', '.dropdown-menu', function (e) {
                        $(this).hasClass('container') && e.stopPropagation(); // This replace if conditional.
                    }); */

                    var ctrl = $scope.ctrl.moduleCtrl;
                    //console.log('treeData', $("#mytreee").jstree());
                    var $treeview = $("#jsTree");
                    $treeview.jstree({
                        'core' : {
                            "data" : ctrl.treeData,
                            "animation" : 100,              // время анимации разворачивания дерева
                            "dblclick_toggle" : true,       // разворачивание дерева по двойному клику
                            "themes" : {
                                "dots" : true,              // соединяющие точки дерева
                                "name" : ctrl.lightTheme ? "default" : "default-dark",    // выбор темы
                                "responsive" : false,        // для мобильных экранов
                                "stripes" : true            // затемнение чётных строк
                            },
                            "multiple" : true,              // multiselection
                            "worker" : false,               // чтоб не было ошибки
                            "types" : {
                                "mytype" : { "a_attr" : { "class": "myClass" } }
                            }
                        },
                        "plugins" : ["checkbox", "themes", "types"/* "ui" */]

                    }).on('open_node.jstree', (e, data) => {
                        console.log('after_open', e, data);
                        // ctrl.panel.treeState = $treeview.jstree().get_state();
                    }).on('close_node.jstree', (e, data) => {
                        console.log('close_node', e, data);
                        // ctrl.panel.treeState = $treeview.jstree().get_state();
                        // $treeview.jstree('open_all');
                    }).on('changed.jstree', (e, data) => {
                        console.log('changed', e, data);
                        // ctrl.panel.treeState = $treeview.jstree().get_state();
                    }).on('ready.jstree', (e, data) => {
                        console.log('ready', e, data);
                        // var state = Object.assign({}, ctrl.panel.treeState);
                        // data.instance.set_state(state, () => {console.log('set-state')});
                        
                        /* data.instance.set_state({ 
                            core : { 
                                opened : [full array of nodes here to open and load from the server], 
                                selected : [array of nodes to select] 
                            } 
                        }); */
                    });
                });

                // this.textSize = this.moduleCtrl;
                /* console.log('ctrlDirective: ', this);
                this.log = function () {
                    console.log(this);
                }; */

            },
            bindToController: true,
            controllerAs: 'ctrl',
            scope: {
                moduleCtrl: "="
            }
        };
    });