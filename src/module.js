import './lib/jstree/themes/default-dark/style.min.css!';
import './lib/jstree/themes/default/style.min.css!';
import './lib/jstree/jstree.min';
//import './directives/d-tree-view';
import config from 'app/core/config';
import {SvgPanelCtrl} from './svg-metric';
import DistinctPoints from './points';
import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import angular from 'angular';
import kbn from 'app/core/utils/kbn';
import appEvents from 'app/core/app_events';
import {loadPluginCss} from 'app/plugins/sdk';
import * as hash from './lib/hash/object_hash';


loadPluginCss({
    dark: 'plugins/test1-panel/css/bpm.dark.css',
    light: 'plugins/test1-panel/css/bpm.light.css'
});


class BpmPanelCtrl extends SvgPanelCtrl {

    constructor($scope, $injector, $q, $http, alertSrv, datasourceSrv, contextSrv, $rootScope, dashboardSrv, timeSrv) {
        super($scope, $injector, $q);
        this.data = null;
        this.$http = $http;
        this.$scope = $scope;
        this.alertSrv = alertSrv;
        this.appEvents = appEvents;
        this.comment = "";
        this.max = 64;
        this.saveForm = null;
        this.$rootScope = $rootScope;
        this.contextSrv = contextSrv
        this.panel.targets.splice(1);   // deleting all fields of datasource metrics except first
        this.dashboardSrv = dashboardSrv;

        // Set and populate defaults
        var panelDefaults = {
            rowHeight: 30,
            textSize: 16,
            valueMaps: [{value: 'null', op: '=', text: 'N/A'}],
            mappingTypes: [
                {name: 'value to text', value: 1},
                {name: 'range to text', value: 2},
            ],
            colorMaps: [/*{text: 'N/A', color: '#CCC'}*/],
            metricNameColor: '#000000',
            valueTextColor: '#000000',
            backgroundColor: 'rgba(128, 128, 128, 0.1)',
            lineColor: 'rgba(128, 128, 128, 1.0)',
            writeLastValue: true,
            writeAllValues: false,
            writeMetricNames: false,
            showLegend: true,
            showLegendNames: true,
            showLegendValues: true,
            showLegendPercent: true,
            highlightOnMouseover: true,
            legendSortBy: '-ms',
            setOwnColors: false,
            showGraph: true,
            treeHash: '',
            treeState: {
                core: {
                    open: [],
                    scroll: {},
                    selected: []
                }
            },
            selectedCountersId: [],
            selectedLinesId: [],
        };
        
        _.defaults(this.panel, panelDefaults);
        this.externalPT = false;    //флаг положения курсора (false - над текущим графиком, true - над другим)
        this.dataWriteDB = {
            panelId: '',
            user: {
                orgName: contextSrv.user.orgName,
                orgRole: contextSrv.user.orgRole,
                email: contextSrv.user.email,
                login: contextSrv.user.login
            },
            target: '',
            datapoint: {
                pointNumber: "",
                time: "",
                pointName: "",
                commentText: "",
                fillColor: ""
            }
        };

        this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
        this.events.on('render', this.onRender.bind(this));
        this.events.on('data-received', this.onDataReceived.bind(this));
        this.events.on('data-error', this.onDataError.bind(this));
        //this.events.on('refresh', this.onRefresh.bind(this));
        this.updateColorInfo();

        this.lightTheme = contextSrv.user.lightTheme;   // boolean
        this.treeData = [];
        this.treeLoaded = false;
        this.treeStateResumed = false;
        this.treeObject = {};
        this.savedData = {
            counters: {},       // example - {'16.1.2': {received data}, ...}
            statusLines: {},    // example - {'16.1': {received data}, ...}
            brandsLines: {}     // example - {'16.1': {received data}, ...}
        };
        this.timeSrv = timeSrv;

        //console.log('timeSrv: ', timeSrv);
        //console.log('angular.equals ', angular.equals(treeData, treeData2));
        //console.log('convertDataToNestedTree ', this.convertDataToNestedTree(orgData, counters));
    }

    convertDataToNestedTree(data) {
        var orgData = data.orgStructure; 
        var counters = data.counters;
        //const formattedData = {};
        //debugger;
        const arrCities = [];
        var arrLines = [];
        var isNotFoundSameLine = false;
        orgData.forEach((el, iOrg) => {
            var path = '';
            if (el.parentId != null) {
                path = `${el.parentId + '.' + el.id + '.'}`;
            } else {
                path = `${el.id + '.'}`;
            }
            path.split('.').filter(id => id).forEach((curValue, i, arrPath) => {
                // console.log('arrPath',curValue, el);
                    if (arrPath.length - 1 === i) {
                        if (el.parentId != null) {                // проверка если это линия
                            //console.log('childrenLine', arrCounters);
                            if (isNotFoundSameLine) {
                                //console.log('counter',counters, el);
                                var arrCounters = counters.filter(counter => counter.lineId === el.id)  // извлекаем отфильтрованные счётчики
                                .map((curCount, iCount, counters) => {
                                    return {
                                        id: `${el.parentId + '.' + el.id + '.' + curCount.id}`,
                                        text: curCount.name,
                                        type: 'counter',
                                        data: curCount,
                                        isCounter: true // проверить в данных события дерева
                                    }
                                });
                                //console.log('arrCounters2',arrCounters);
                                // счётчики
                                arrLines[iOrg].children = _.uniqBy(arrCounters, 'id');
                            }
                        } else {
                            // города
                            arrCities.push({
                                id: `${el.id}`,
                                text: el.name,
                                parentId: el.parentId,
                                type: 'city',
                                children: arrLines.filter(line => line.parentId === el.id)
                            })
                            //console.log('city', el);
                        }
                        
                    } else {
                        isNotFoundSameLine = (undefined === _.find(arrLines, (line) => {
                            return line.data.id === el.id;
                        }));
                        if (isNotFoundSameLine) {
                            // линии
                            arrLines.push({
                                id: `${el.parentId + '.' + el.id}`,
                                text: el.name,
                                parentId: el.parentId,
                                type: 'line',
                                data: el,
                                children: []
                            });
                        }
                    }
            })
        })
        // console.log('arrCities', arrCities);
        return arrCities
    }

    addSelectedId(data) {
        var countersId = _.uniq(_.filter(data.selected, id => {
            return id.split('.').length === 3;
        }));
        var linesId = _.uniq(_.map(countersId, id => {
            return id.split('.').splice(0, 2).join('.');
        }));
        this.panel.selectedCountersId = _.concat(this.panel.selectedCountersId, _.difference(countersId, this.panel.selectedCountersId));
        this.panel.selectedLinesId = _.concat(this.panel.selectedLinesId, _.difference(linesId, this.panel.selectedLinesId));
        // console.log('ADD:', this.panel.selectedCountersId, this.panel.selectedLinesId);
    }

    removeSelectedId(data) {
        // console.log('before DEL:', this.panel.selectedCountersId, this.panel.selectedLinesId);
        _.remove(this.panel.selectedCountersId, id => {
            return id.indexOf(data.node.id) != -1;
        });
        if (this.panel.selectedCountersId.length != 0) {
            var lineIdSelect = data.node.id.split('.').splice(0, 2).join('.');
            var cityIdSelect = data.node.id.split('.').splice(0, 1).join('.');
            if (data.node.id.split('.').length === 3) {
                var isIncludedLine = false;
                _.forEach(this.panel.selectedCountersId, cId => {
                    if (cId.indexOf(lineIdSelect) != -1) isIncludedLine = true;
                })
                if (!isIncludedLine) {
                    _.remove(this.panel.selectedLinesId, id => {
                        return lineIdSelect === id;
                    });
                }
            } else if (data.node.id.split('.').length === 2) {
                _.remove(this.panel.selectedLinesId, id => {
                    return lineIdSelect === id;
                });
            } else {
                _.remove(this.panel.selectedLinesId, id => {
                    return cityIdSelect === id.split('.')[0];
                });
            }
        } else {
            this.panel.selectedLinesId = [];
        }
        // console.log('after DEL:', this.panel.selectedCountersId, this.panel.selectedLinesId);
    }

    jsTreeBuildAction(treeData, datasource) {
        // отключаем скрытие меню после нажатия
        $(document).on('click', '.dropdown-menu', function (e) {
            $(this).hasClass('container') && e.stopPropagation();
        });
        // var $treeview = $("#jsTree");
        this.treeObject = $("#jsTree-"+this.panel.id);
        this.treeObject.jstree({
            'core' : {
                "data" : treeData,
                "animation" : 100,              // время анимации разворачивания дерева
                "dblclick_toggle" : true,       // разворачивание дерева по двойному клику
                "expand_selected_onload": true, // после загрузки раскрыть все выбраные ветви
                "themes" : {
                    "dots" : true,              // соединяющие точки дерева
                    "name" : this.lightTheme ? "default" : "default-dark",    // выбор темы
                    "responsive" : false,        // для мобильных экранов
                    "stripes" : false            // фоновая зебра
                },
                "multiple" : true,              // multiselection
                "worker" : false,               // чтоб не было ошибки
            },
            "types" : {
                "counter" : { "icon" : "fa fa-tachometer", "a_attr" : { "style": "background: none" }},
                "line" : { "icon" : "fa fa-tasks", "a_attr" : { "style": "background: none" }},
                "city" : { "icon" : "fa fa-industry", "a_attr" : { "style": "background: none" }},
            },
            "plugins" : ["checkbox", "themes", "types"/* "ui" */]

        }).on('ready.jstree', (e, data) => {
            this.treeLoaded = true;                             
            var state = Object.assign({}, this.panel.treeState);
            data.instance.set_state(state);                             // возобновляем состояние дерева (после вызывает событие set_state)
            // console.log('treeReady', e, data, this.panel.treeState);
            //this.issueQueries(datasource);                            // запрашиваем данные выбранных счётчиков

        }).on('changed.jstree', (e, data) => {
            // console.log('changed', data);
            this.timeSrv.setAutoRefresh(this.dashboard.refresh);        // сбрасываем таймер автообновления
            this.panel.treeState = data.instance.get_state();
            if (data.action == "select_node") {
                //console.log('select_node', data);
                var oldSelectedIds = {
                    statusLines: this.panel.selectedLinesId.slice(),
                    counters: this.panel.selectedCountersId.slice(),
                };
                this.addSelectedId(data);
                var diffSelectedIds = {
                    statusLines: _.difference(this.panel.selectedLinesId, oldSelectedIds.statusLines),
                    counters: _.difference(this.panel.selectedCountersId, oldSelectedIds.counters)
                }
                // console.log('diffSelectedIds', diffSelectedIds);
                if (this.treeStateResumed) {
                    this.issueQueries(datasource, diffSelectedIds);     // запрашиваем данные выбранного счётчика
                }
            } else if (data.action == "deselect_node") {
                // console.log('deselect_node', data);
                this.removeSelectedId(data);
                this.onRender();                                        // !!!!!!!!!! to be continued
            }

        }).on('open_node.jstree', (e, data) => {
            this.panel.treeState = data.instance.get_state();
        }).on('close_node.jstree', (e, data) => {
            this.panel.treeState = data.instance.get_state();
        }).on('set_state.jstree', (e, data) => {
            // console.log('set_state', data);
            this.treeStateResumed = true;
            var selectedIds = {
                statusLines: this.panel.selectedLinesId.slice(),
                counters: this.panel.selectedCountersId.slice(),
            };
            this.issueQueries(datasource, selectedIds);                 // запрашиваем данные выбранных счётчиков
        });
    }

    // Copied from Metrics Panel, only used to expand the 'from' query
    issueQueries(datasource, targets) {
        //console.log('Panel-issueQueries: ', typeReq);
        this.datasource = datasource;
        if (!this.panel.targets || this.panel.targets.length === 0) {
            return this.$q.when([]);
        }
        var range = {
            from: this.range.from.clone(),
            to: this.range.to
        };
        var dataRequest = {
            panelId: this.panel.id,
            //format: this.panel.renderer === 'png' ? 'png' : 'json',
            format: 'json',
            maxDataPoints: this.resolution,
            intervalMs: this.intervalMs,
            range: range,
            user: {
                orgName: this.contextSrv.user.orgName,
                orgRole: this.contextSrv.user.orgRole,
                email: this.contextSrv.user.email,
                login: this.contextSrv.user.login
            },
            //targets: this.panel.targets,
            targets: {},
            cacheTimeout: this.panel.cacheTimeout,
            panelType: this.panel.type
        };

        // проверям загружено ли дерево
        if (this.treeLoaded) {
            if (!targets) {
                // запрос по событию autorefresh
                dataRequest.targets = {
                    statusLines: this.panel.selectedLinesId,
                    counters: this.panel.selectedCountersId
                };
                return datasource.query(dataRequest, '/query/targets');
            } else {
                // запрос по событию выбра в дереве
                dataRequest.targets = targets;
                return datasource.query(dataRequest, '/query/targets')
                    .then(data => {
                        this.onDataReceived(data.data);
                    });
            }

            
        } else {
            var dataUserRequest = {};
            dataUserRequest.user = dataRequest.user;
            return datasource.query(dataUserRequest, '/query/tree')
            /* .then((data) => {
                var hashCode = hash.MD5(data.data);                                 // генерируем хэш код полученных данных
                // проверяем есть ли данные счётчиков
                if (data.data.counters && data.data.counters.length != 0) {
                    this.treeData = this.convertDataToNestedTree(data.data);        // преобразуем полученные данные в массив дерева
                    if (this.panel.treeHash != hashCode) {                          // проверяем изменились ли данные дерева (по хэш коду объекта)
                        //обновляем хэш код и сбрасываем состояние дерева
                        this.panel.treeHash = hashCode;
                        this.panel.treeState = {core: {selected: []}};
                        console.log('panel-treeHash-updated', this);
                    }
                    this.jsTreeBuildAction(this.treeData, this.datasource);         // строим дерево
                    return data;
                }
            }, */
            .catch (err => {
                //this.error = err.data.error + " [" + err.status + "]";
                this.alertSrv.set('No connection', '"tree" data wasn\'t loaded', 'warning', 6000); //error, warning, success, info
                console.warn("Server unavailable. Tree wasn't loaded", err);
                return;
            });
        }
    }

    onDataReceived(dataReceived) {
        $(this.canvas).css('cursor', 'pointer');

        console.log('onDataReceived', dataReceived);
        // обработка данных дерева
        if ('counters' in dataReceived && 'orgStructure' in dataReceived) {
            var hashCode = hash.MD5(dataReceived);                              // генерируем хэш код полученных данных
            if (dataReceived.counters && dataReceived.counters.length != 0) {   // проверяем есть ли счётчики
                this.treeData = this.convertDataToNestedTree(dataReceived);     // преобразуем полученные данные в массив дерева
                if (this.panel.treeHash != hashCode) {                          // проверяем изменились ли данные дерева (по хэш коду объекта)
                    //обновляем хэш код и сбрасываем состояние дерева
                    this.panel.treeHash = hashCode;
                    this.panel.treeState = {/* core: {selected: []} */};
                    this.panel.selectedCountersId = [];
                    this.panel.selectedLinesId = [];
                    console.log('%c The Tree was changed! Save it ', 'background: blue; color: yellow');
                    // return data;
                }
                this.jsTreeBuildAction(this.treeData, this.datasource);         // строим дерево
            }
        } else {
            // сохраняем полученные данные брендов, состояний линий и счётчиков
            _.forEach(dataReceived.brandsLines, obj => {
                this.savedData.brandsLines[obj.target] = obj;
                this.savedData.brandsLines[obj.target].targetName = this.convertToTargetName(obj.target);
            });
            _.forEach(dataReceived.statusLines, obj => {
                this.savedData.statusLines[obj.target] = obj;
                this.savedData.statusLines[obj.target].targetName = this.convertToTargetName(obj.target);
            });
            _.forEach(dataReceived.counters, obj => {
                this.savedData.counters[obj.target] = obj;
                this.savedData.counters[obj.target].targetName = this.convertToTargetName(obj.target);
            });
            console.log('this.savedData', this.savedData);
            
        }
/*
         var dataGraph = [];
        _.forEach(dataList, (metric) => {
            if ('table' === metric.type) {
                if ('time' != metric.columns[0].type) {
                    throw 'Expected a time column from the table format';
                }
                var last = null;
                for (var i = 1; i < metric.columns.length; i++) {
                    var res = new DistinctPoints(metric.columns[i].text);
                    for (var j = 0; j < metric.rows.length; j++) {
                        var row = metric.rows[j];
                        res.add(row[0], this.formatValue(row[i]));
                    }
                    res.finish(this);
                    dataGraph.push(res);
                }
            }
            else {
                var res = new DistinctPoints(metric.target);
                _.forEach(metric.datapoints, (point) => {
                    // point: [0]-valNum, [1]-time, [2]- valString, [3]-commentText, [4]-fillColor
                    res.add(+point[1], this.formatValue(point[2]), point[3], point[4], point[0]);
                });
                res.finish(this);
                dataGraph.push(res);
            }
        });
        //console.log( 'data-received', this.data);
        this.data = dataGraph;

        this.render(); 
*/
    }

    convertToTargetName(targetId) {
        var arrFlatTree = this.treeObject.jstree().get_json('#', { 'flat': true }); // плоский массив объектов дерева
        var arrTargetId = _.split(targetId, '.');
        try {
            var cityName = arrFlatTree[_.findIndex(arrFlatTree, obj => obj.id === _.split(targetId, '.', 1).pop())].text;
            var lineName = arrFlatTree[_.findIndex(arrFlatTree, obj => obj.id === _.split(targetId, '.', 2).join('.'))].text;
            if (arrTargetId.length === 3) {
                var counterName = arrFlatTree[_.findIndex(arrFlatTree, obj => obj.id === _.split(targetId, '.', 3).join('.'))].text;
                // console.log('NAME-Counter',cityName + '.' + lineName + '.' + counterName);
                return cityName+'.'+lineName+'.'+counterName;
            }
        } catch (error) {
            console.warn('Failed to convert tree ID to Name. The text of the tree is not found', error);
        }
        // console.log('NAME-Line',cityName + '.' + lineName);
        return cityName+'.'+lineName;
    }

    onDataError(err) {
        console.log("onDataError-test1", err);
    }

    onInitEditMode() {
        this.addEditorTab('Options', 'public/plugins/test1-panel/partials/editor.html', 2);
        this.addEditorTab('Legend', 'public/plugins/test1-panel/partials/legend.html', 3);
        this.addEditorTab('Colors', 'public/plugins/test1-panel/partials/colors.html', 4);
        this.addEditorTab('Mappings', 'public/plugins/test1-panel/partials/mappings.html', 5);
        this.editorTabIndex = 1;
        this.refresh();
    }

    onRender() {
        //$('.panel-scroll').css({'max-height': (this.height) +'px'});
        if (this.panel.showGraph) {
            if (!(this.context)) {
                //console.log('render-no-context');
                return;
            }
            if (!this.data) {
                //console.log('render-data-empty', this.data);
                return;
            }

            //console.log( 'render-data-OK');

            var rect = this.wrap.getBoundingClientRect();
            var rows = this.data.length;
            var rowHeight = this.panel.rowHeight;

            var height = rowHeight * rows;
            var width = rect.width;
            this.canvas.width = width;
            this.canvas.height = height;
            var ctx = this.context;
            ctx.lineWidth = 1;
            ctx.textBaseline = 'middle';
            ctx.font = this.panel.textSize + 'px "Open Sans", Helvetica, Arial, sans-serif';

            /*ctx.shadowOffsetX = 1;
             ctx.shadowOffsetY = 1;
             ctx.shadowColor = "rgba(0,0,0,0.3)";
             ctx.shadowBlur = 3;*/

            var top = 0;

            var elapsed = this.range.to - this.range.from;

            _.forEach(this.data, (metric) => {
                var centerV = top + (rowHeight / 2);
                // The no-data line
                ctx.fillStyle = this.panel.backgroundColor;
                ctx.fillRect(0, top, width, rowHeight);

                if (!this.panel.writeMetricNames) {
                    ctx.fillStyle = "#111111";
                    ctx.textAlign = 'left';
                    ctx.fillText("No Data", 10, centerV);
                }

                var lastBS = 0;
                var point = metric.changes[0];

                for (var i = 0; i < metric.changes.length; i++) {
                    point = metric.changes[i];
                    if (point.start <= this.range.to) {
                        var xt = Math.max(point.start - this.range.from, 0);
                        /*console.log( 'point', point);*/
                        point.x = (xt / elapsed) * width;
                        /* ctx.fillStyle = this.getColor( point.val );*/
                        ctx.fillStyle = this.panel.setOwnColors ? this.getColor(point) : point.color;
                        ctx.fillRect(point.x, top, width, rowHeight);

                        if (this.panel.writeAllValues) {
                            ctx.fillStyle = this.panel.valueTextColor;
                            ctx.textAlign = 'left';
                            ctx.fillText(point.val, point.x + 7, centerV);
                        }
                        lastBS = point.x;
                    }
                }

                if (top > 0) {
                    ctx.strokeStyle = this.panel.lineColor;
                    ctx.beginPath();
                    ctx.moveTo(0, top);
                    ctx.lineTo(width, top);
                    ctx.stroke();
                }

                ctx.fillStyle = "#000000";
                if (this.panel.writeMetricNames &&
                    this.mouse.position == null &&
                    (!this.panel.highlightOnMouseover || this.panel.highlightOnMouseover )
                ) {
                    ctx.fillStyle = this.panel.metricNameColor;
                    ctx.textAlign = 'left';
                    ctx.fillText(metric.name.split('.').join(' - '), 10, centerV);
                }
                ctx.textAlign = 'right';
                if (this.mouse.down == null) {
                    /*console.log( 'this.mouse.position', this.mouse.position);*/
                    if (this.panel.highlightOnMouseover && this.mouse.position != null) {
                        point = metric.changes[0];
                        var next = null;
                        for (var i = 0; i < metric.changes.length; i++) {
                            if (metric.changes[i].start > this.mouse.position.ts) {
                                next = metric.changes[i];
                                break;
                            }
                            point = metric.changes[i];
                        }

                        // Fill canvas using 'destination-out' and alpha at 0.05
                        ctx.globalCompositeOperation = 'destination-out';
                        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                        ctx.beginPath();
                        ctx.fillRect(0, top, point.x, rowHeight);
                        ctx.fill();
                        if (next != null) {
                            ctx.beginPath();
                            ctx.fillRect(next.x, top, width, rowHeight);
                            ctx.fill();
                        }
                        ctx.globalCompositeOperation = 'source-over';

                        // Now Draw the value
                        ctx.fillStyle = "#000000";
                        ctx.textAlign = 'left';
                        ctx.fillText(point.val, point.x + 7, centerV);
                    }
                    else if (this.panel.writeLastValue) {
                        ctx.fillText(point.val, width - 7, centerV);
                    }
                }

                top += rowHeight;
            });


            if (this.mouse.position != null) {
                if (this.mouse.down != null) {
                    var xmin = Math.min(this.mouse.position.x, this.mouse.down.x);
                    var xmax = Math.max(this.mouse.position.x, this.mouse.down.x);

                    // Fill canvas using 'destination-out' and alpha at 0.05
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
                    ctx.beginPath();
                    ctx.fillRect(0, 0, xmin, height);
                    ctx.fill();

                    ctx.beginPath();
                    ctx.fillRect(xmax, 0, width, height);
                    ctx.fill();
                    ctx.globalCompositeOperation = 'source-over';
                }
                else {
                    ctx.strokeStyle = '#111';
                    ctx.beginPath();
                    ctx.moveTo(this.mouse.position.x, 0);
                    ctx.lineTo(this.mouse.position.x, height);
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(this.mouse.position.x, 0);
                    ctx.lineTo(this.mouse.position.x, height);
                    ctx.strokeStyle = '#e22c14';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    // если положение курсора находится на другом графике и если рядов больше 1 - показывать точку
                    if (this.externalPT && rows > 1) {
                        ctx.beginPath();
                        ctx.arc(this.mouse.position.x, this.mouse.position.y, 3, 0, 2 * Math.PI, false);
                        ctx.fillStyle = '#e22c14';
                        ctx.fill();
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = '#111';
                        ctx.stroke();
                    }
                }
            }
        }
        //this.tableRender();
    }

    showLegandTooltip(pos, info) {
        var body = '<div class="graph-tooltip-time">' + info.val + '</div>';

        body += "<center>";
        if (info.count > 1) {
            body += info.count + " times<br/>for<br/>";
        }
        body += moment.duration(info.ms).humanize();
        if (info.count > 1) {
            body += "<br/>total";
        }
        body += "</center>"

        this.$tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
    }

    formatValue(val, stats) {
        /*if(_.isNumber(val) && this.panel.rangeMaps) {
         for (var i = 0; i < this.panel.rangeMaps.length; i++) {
         var map = this.panel.rangeMaps[i];

         // value/number to range mapping
         var from = parseFloat(map.from);
         var to = parseFloat(map.to);
         if (to >= val && from <= val) {
         return map.text;
         }
         }
         }*/

        var isNull = _.isNil(val);
        if (!isNull && !_.isString(val)) {
            val = val.toString(); // convert everything to a string
        }

        for (var i = 0; i < this.panel.valueMaps.length; i++) {
            var map = this.panel.valueMaps[i];
            // special null case
            if (map.value === 'null') {
                if (isNull) {
                    return map.text;
                }
                continue;
            }

            if (val == map.value) {
                return map.text;
            }
        }

        if (isNull) {
            return "null";
        }
        return val;
    }

    getColor(info) {
        if (_.has(this.colorMap, info.val) && this.panel.setOwnColors) {
            return this.colorMap[info.val];
        }
        return info.color;
        /*var palet = [
         '#FF4444',
         '#9933CC',
         '#32D1DF',
         '#ed2e18',
         '#CC3900',
         '#F79520',
         '#33B5E5'
         ];

         return palet[ Math.abs(this.hashCode(info.val+'')) % palet.length ];*/
    }

    randomColor() {
        var letters = 'ABCDE'.split('');
        var color = '#';
        for (var i = 0; i < 3; i++) {
            color += letters[Math.floor(Math.random() * letters.length)];
        }
        return color;
    }

    hashCode(str) {
        var hash = 0;
        if (str.length == 0) return hash;
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    removeColorMap(map) {
        var index = _.indexOf(this.panel.colorMaps, map);
        this.panel.colorMaps.splice(index, 1);
        this.updateColorInfo();
    }

    removeAllColorMap() {
        this.panel.colorMaps.splice(0);
        this.updateColorInfo();
    }

    updateColorInfo() {
        var cm = {};
        for (var i = 0; i < this.panel.colorMaps.length; i++) {
            var m = this.panel.colorMaps[i];
            if (m.text) {
                cm[m.text] = m.color;
            }
        }
        this.colorMap = cm;
        this.render();
    }

    addColorMap(what) {
        if (what == 'curent') {
            _.forEach(this.data, (metric) => {
                /*console.log('metric.legendInfo', metric.legendInfo);*/
                if (metric.legendInfo) {
                    _.forEach(metric.legendInfo, (info) => {
                        if (_.findIndex(this.panel.colorMaps, function (obj) {
                                return obj.text == info.val;
                            }) == -1) {
                            this.panel.colorMaps.push({text: info.val, color: this.getColor(info)});
                        }
                        /*if(!_.has(info.val)) {
                         this.panel.colorMaps.push({text: info.val, color: this.getColor(info) });
                         }*/
                    });
                }
            });
        }
        else {
            this.panel.colorMaps.push({text: '???', color: this.randomColor()});
        }
        this.updateColorInfo();
    }

    removeValueMap(map) {
        var index = _.indexOf(this.panel.valueMaps, map);
        this.panel.valueMaps.splice(index, 1);
        this.render();
    }

    addValueMap() {
        this.panel.valueMaps.push({value: '', op: '=', text: ''});
    }

    onConfigChanged() {
        //console.log('onConfigChanged', this.panel.treeStates.state1);
        /*this.timeSrv.refreshDashboard();*/
        this.render();
        //this.tableRender();
    }

    getLegendDisplay(info, metric) {
        /*console.log('getLegendDisplay', info, metric);*/
        /* console.log('getLegendDisplay', info);*/
        var disp = info.val;
        if (this.panel.showLegendPercent || this.panel.showLegendCounts || this.panel.showLegendTime) {
            disp += " (";
            var hassomething = false;
            if (this.panel.showLegendTime) {
                disp += moment.duration(info.ms).humanize();
                hassomething = true;
            }

            if (this.panel.showLegendPercent) {
                if (hassomething) {
                    disp += ", ";
                }

                var dec = this.panel.legendPercentDecimals;
                if (_.isNil(dec)) {
                    if (info.per > .98 && metric.changes.length > 1) {
                        dec = 2;
                    }
                    else if (info.per < 0.02) {
                        dec = 2;
                    }
                    else {
                        dec = 0;
                    }
                }
                disp += kbn.valueFormats.percentunit(info.per, dec);
                hassomething = true;
            }

            if (this.panel.showLegendCounts) {
                if (hassomething) {
                    disp += ", ";
                }
                disp += info.count + "x";
            }
            disp += ")";
        }
        return disp;
    }

    //------------------
    // Mouse Events
    //------------------

    showTooltip(evt, point, isExternal) {
        /*console.log("showTooltip - point.val", point.val);*/
        var from = point.start;
        var to = point.start + point.ms;
        var time = point.ms;
        var val = point.val;

        if (this.mouse.down != null) {
            from = Math.min(this.mouse.down.ts, this.mouse.position.ts);
            to = Math.max(this.mouse.down.ts, this.mouse.position.ts);
            time = to - from;
            val = "Zoom To:";
        }

        var body = '<div>';
        body += '<div style="background-color:' + this.getColor(point) + '; width:10px; height:10px; display:inline-block;"></div>' +
            '<b>' + '  ' + val + '</b></br>';

        body += '<b style="display: inline-block; width: 40px">From: </b>' + this.dashboard.formatDate(moment(from)) + "<br/>";
        body += '<b style="display: inline-block; width: 40px">To: </b>' + this.dashboard.formatDate(moment(to)) + "<br/>";
        body += '<b>Duration: </b>' + moment.duration(time).humanize() + '</br>';
        body += '<div style="padding:0px 5px; margin:0px; background-color:#00fff0; color:#000"><b>' + point.comment + '</b></div>';
        body += '</div>';

        var pageX = 0;
        var pageY = 0;
        if (isExternal) {
            var rect = this.canvas.getBoundingClientRect();
            pageY = rect.top + (evt.pos.panelRelY * rect.height);
            if (pageY < 0 || pageY > $(window).innerHeight()) {
                // Skip Hidden tooltip
                this.$tooltip.detach();
                return;
            }
            pageY += $(window).scrollTop();

            var elapsed = this.range.to - this.range.from;
            var pX = (evt.pos.x - this.range.from) / elapsed;
            pageX = rect.left + (pX * rect.width);
        }
        else {
            pageX = evt.evt.pageX;
            pageY = evt.evt.pageY;
        }
        this.$tooltip.html(body).place_tt(pageX + 20, pageY + 5);
    }

    binSearchIndexPoint(arrChanges, mouseTimePosition) {
        if ((arrChanges.length == 0) || (mouseTimePosition < arrChanges[0].start) || (mouseTimePosition > arrChanges[arrChanges.length - 1].start)) {
            return null;
        }
        var first = 0;
        var last = arrChanges.length;
        // Если просматриваемый участок не пуст, first < last
        while (first < last) {
            var mid = Math.floor(first + (last - first) / 2);
            if (mouseTimePosition <= arrChanges[mid].start)
                last = mid;
            else
                first = mid + 1;
        }
        // Теперь last может указывать на искомый элемент массива.
        if (arrChanges[last].start >= mouseTimePosition)
            return last - 1;
        else
            return null;
    };

    onGraphHover(evt, showTT, isExternal) {
        /*console.log( 'onGraphHover-evt', evt);*/
        this.externalPT = false;
        if (this.data) {
            var hover = null;
            var j = Math.floor(this.mouse.position.y / this.panel.rowHeight);
            if (j < 0) {
                j = 0;
            }
            if (j >= this.data.length) {
                j = this.data.length - 1;
            }
            hover = this.data[j].changes[0];

            // Линейный поиск (менее быстрый)
            /*for(var i=0; i<this.data[j].changes.length; i++) {
             if(this.data[j].changes[i].start > this.mouse.position.ts) {
             break;
             }
             hover = this.data[j].changes[i];
             }*/
            // Бинарный поиск (более быстрый)
            var i = this.binSearchIndexPoint(this.data[j].changes, this.mouse.position.ts)
            if (i) {
                hover = this.data[j].changes[i];
            }
            this.hoverPoint = hover;

            if (showTT) {
                this.externalPT = isExternal;
                this.showTooltip(evt, hover, isExternal);
            }

            /*var time = performance.now();*/
            this.render(); // refresh the view
            /*time = performance.now() - time;
             console.log('Время выполнения onRender = ', time);*/
        }
        else {
            this.$tooltip.detach(); // make sure it is hidden
        }
    }

    writeToDB(data) {
        this.$http({
            url: this.datasource.url + '/update/line-status',
            method: 'POST',
            data: data,
            headers: {
                "Content-Type": "application/json"
            }
        }).then((rsp) => {
            //console.log("saved", rsp);
            if (rsp.data[0].statusWrite == 'error'){
                this.alertSrv.set('Database Error', 'Data not saved!', 'warning', 6000);
                return;
            }
            this.alertSrv.set('Saved', 'Successfully saved the comment', 'success', 3000);
            this.$rootScope.$broadcast('refresh');
        }, err => {
            //console.log("errorrrrrrr", err);
            this.error = err.data.error + " [" + err.status + "]";
            this.alertSrv.set('Oops', 'Something went wrong: ' + this.error, 'error', 6000);
        });
    }

    onMouseClicked(where) {
        var pt = this.hoverPoint;

        if (this.data) {
            var dataPoint = null;
            var j = Math.floor(where.y / this.panel.rowHeight);
            if (j < 0) {
                j = 0;
            }
            if (j >= this.data.length) {
                j = this.data.length - 1;
            }
            dataPoint = this.data[j].changes[0];

            // Бинарный поиск (более быстрый)
            var i = this.binSearchIndexPoint(this.data[j].changes, where.ts)
            if (i) {
                dataPoint = this.data[j].changes[i];
            }
            /*console.log("dataPoint", dataPoint);*/
        }

        var modalScope = this.$scope.$new(true);
        modalScope.ctrl = this;
        modalScope.ctrl.dataWriteDB.datapoint.fillColor = dataPoint.color;
        modalScope.ctrl.dataWriteDB.datapoint.commentText = dataPoint.comment;
        modalScope.ctrl.dataWriteDB.datapoint.pointName = dataPoint.val;
        modalScope.ctrl.dataWriteDB.datapoint.pointNumber = dataPoint.numVal;
        modalScope.ctrl.dataWriteDB.datapoint.time = dataPoint.start;
        modalScope.ctrl.dataWriteDB.target = this.data[j].name;
        modalScope.ctrl.dataWriteDB.panelId = this.panel.id;
        /*console.log("panel-onMouseClicked-modalScope", modalScope);*/

        this.publishAppEvent('show-modal', {
            src: 'public/plugins/test1-panel/partials/addComment.html',
            scope: modalScope,
            modalClass: 'modal--narrow confirm-modal'
        });

    }

    onMouseSelectedRange(range) {
        this.timeSrv.setTime(range);
        this.clear();
    }

    clear() {
        //console.log("clear()");
        this.mouse.position = null;
        this.mouse.down = null;
        this.hoverPoint = null;
        $(this.canvas).css('cursor', 'wait');
        appEvents.emit('graph-hover-clear');
        this.render();
    } 
}
BpmPanelCtrl.templateUrl = 'partials/module.html';
export {
    BpmPanelCtrl as PanelCtrl
};


