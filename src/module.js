import './lib/jstree/themes/default-dark/style.min.css!';
import './lib/jstree/themes/default/style.min.css!';
import './lib/jstree/jstree.min';
// import './directives/d-tree-view';
// import config from 'app/core/config';
import {SvgPanelCtrl} from './svg-metric';
import DistinctPoints from './points';
import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
// import angular from 'angular';
// import kbn from 'app/core/utils/kbn';
import appEvents from 'app/core/app_events';
import {loadPluginCss} from 'app/plugins/sdk';
import * as hash from './lib/hash/object_hash';
// import * as d3 from 'd3';


loadPluginCss({
    dark: 'plugins/test1-panel/css/bpm.dark.css',
    light: 'plugins/test1-panel/css/bpm.light.css'
});


class BpmPanelCtrl extends SvgPanelCtrl {

    constructor($scope, $log, $injector, $q, $http, alertSrv, datasourceSrv, contextSrv, $rootScope, dashboardSrv, timeSrv) {
        super($scope, $injector, $q);
        // this.data = null;
        this.$http = $http;
        this.$scope = $scope;
        this.$log = $log;
        this.alertSrv = alertSrv;
        // this.appEvents = appEvents;
        // this.$rootScope = $rootScope;
        this.contextSrv = contextSrv;
        this.panel.targets.splice(1);   // deleting all fields of datasource metrics except first
        this.dashboardSrv = dashboardSrv;
        this.datasourceSrv = datasourceSrv;

        // Set and populate defaults
        var panelDefaults = {
        /* // rowHeight: 200,
            // textSize: 16,
            // valueMaps: [{value: 'null', op: '=', text: 'N/A'}],
            // mappingTypes: [
            //     {name: 'value to text', value: 1},
            //     {name: 'range to text', value: 2},
            // ],
            // colorMaps: [{text: 'N/A', color: '#CCC'}],
            // metricNameColor: '#000000',
            // valueTextColor: '#000000',
            // backgroundColor: 'rgba(128, 128, 128, 0.1)',
            // lineColor: 'rgba(128, 128, 128, 1.0)',
            // writeLastValue: true,
            // writeAllValues: false,
            // writeMetricNames: false,
            // showLegend: true,
            // showLegendNames: true,
            // showLegendValues: true,
            // showLegendPercent: true,
            // highlightOnMouseover: true,
            // legendSortBy: '-ms',
            // setOwnColors: false,
            // showGraph: true, 
        */
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
            textSizeTitles: 16,
            svgHeight: 200,
            ascData: true,             // отображение данных в порядке выбора
        };
        
        _.defaults(this.panel, panelDefaults);
        this.externalPT = false;    // флаг положения курсора (false - над текущим графиком, true - над другим)
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
                pointNumber: '',
                time: '',
                pointName: '',
                commentText: '',
                fillColor: ''
            }
        };

        this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
        this.events.on('render', this.onRender.bind(this));
        this.events.on('data-received', this.onDataReceived.bind(this));
        // this.events.on('data-error', this.onDataError.bind(this));
        this.events.on('init-panel-actions', this.onInitPanelActions.bind(this));
        this.events.on('panel-size-changed', this.onPanelSizeChanged.bind(this));
        // this.events.on('refresh', this.onRefresh.bind(this));
        // this.updateColorInfo();

        this.lightTheme = contextSrv.user.lightTheme;   // boolean
        this.btnShowTree = 'disabled';                  // active / disabled
        this.treeLoaded = false;
        this.treeStateResumed = false;
        this.treeObject = {};
        this.data = {
            orgStructure: {
                source: {},
                converted: []
            },
            values: {
                source: {
                    counters: [],       // format - [{target:'X.X.X', datapoints:[[value,time], ...]}, ...]
                    statusLines: [],    // format - [{target:'X.X', datapoints:[[pointNumber,time,'pointName','comment','color'], ...]}, ...]
                    brandsLines: []     // format - [{target:'X.X', datapoints:[[pointNumber,time,'pointName','comment','color'], ...]}, ...]
                },
                normalized: {           // data after filtered and normalized
                    counters: [],
                    statusLines: [],
                    brandsLines: []
                }
            }
        };
        this.elements = {
            tags: {},
            sizes: {
                marginAreaVis: { top: 5, right: 20, bottom: 20, left: 40 }
            }
        };
        this.timeSrv = timeSrv;     // using to reset timer of autorefresh         
        
        this.$log.log('this', this);
        // this.text = 'Hello!';
        // setInterval(() => {
        //     // this.$scope.$apply(() => {
        //         this.text = this.text + ' ' + Math.round(Math.random() * 100);
        //         this.$scope.$digest();
        //     // });
        // }, 1000);
        //console.log('convertDataToNestedTree ', this.convertDataToNestedTree(orgData, counters));
    }

    onInitEditMode() {
        this.addEditorTab('Options', 'public/plugins/test1-panel/partials/editor.html', 2);
        // this.addEditorTab('Legend', 'public/plugins/test1-panel/partials/legend.html', 3);
        // this.addEditorTab('Colors', 'public/plugins/test1-panel/partials/colors.html', 4);
        // this.addEditorTab('Mappings', 'public/plugins/test1-panel/partials/mappings.html', 5);
        this.editorTabIndex = 1;
        this.refresh();
    }

    onInitPanelActions(actions) {
        // console.log('onInitPanelActions');
        actions.push({text: 'Export CSV', click: 'ctrl.exportCsv()'});
        actions.push({text: 'Toggle legend', click: 'ctrl.toggleLegend()'});
    }

    onPanelSizeChanged() {
        //console.log('RESAZE-PANEL-DONE');
        //this.heightUpdate();
    }

    heightUpdate() {
        // height update for scroll elements
        let elTreeContainer = $('#' + this.pluginId + '-' + this.panel.id + ' .content-header .tree-container')[0];
        let headerHeight = $(this.elements.tags.contentHeader).prop('clientHeight');
        let contentWrapWidth = $(this.elements.tags.contentWrap).prop('clientWidth');
        $(elTreeContainer).css({'max-height': (this.height - headerHeight) +'px'});
        $(elTreeContainer).css({'max-width': contentWrapWidth +'px'});
        $(this.elements.tags.contentWrap).css({'max-height': (this.height - headerHeight) +'px'});
    }

    convertDataToNestedTree(data) {
        var orgCities = data.orgStructureCities;
        var orgLines = data.orgStructureLines;
        var counters = data.counters;
        var arrStructTree = [];

        arrStructTree = _.map(orgCities, city => {
            var filteredLines = _.filter(orgLines, line => {
                return _.trim(line.parentId + '') === _.trim(city.id + '');
            });
            return {
                id: _.trim(city.id + ''),
                text: city.name,
                //parentId: obj.parentId,
                type: 'city',
                children: _.map(filteredLines, line => {
                    var filteredCounters = _.filter(counters, counter => {
                        return  _.trim(counter.lineId + '') ===  _.trim(line.id + '');
                    });
                    return {
                        id: _.trim(line.parentId + '.' + line.id),
                        text: line.name,
                        //parentId: line.parentId,
                        type: 'line',
                        data: line,
                        children: _.map(filteredCounters, counter => {
                            return {
                                id: _.trim(line.parentId + '.' + counter.lineId + '.' + counter.id),
                                text: counter.name,
                                type: 'counter',
                                data: counter,
                            };
                        })
                    };
                })
            };
        });
        return arrStructTree;
    }

    addSelectedId(data) {
        // console.log('ADD-MAIN1', data.instance.get_bottom_checked());
        // var countersId = _.uniq(_.filter(data.selected, id => {
        //     return id.split('.').length === 3;
        // }));
        var countersId = data.instance.get_bottom_checked();
        var linesId = _.uniq(_.map(countersId, id => {
            return id.split('.').splice(0, 2).join('.');
        }));
        this.panel.selectedLinesId = linesId;
        // объединяем для соблюдения последовательности отображения
        this.panel.selectedCountersId = _.concat(this.panel.selectedCountersId, _.difference(countersId, this.panel.selectedCountersId));
        // this.panel.selectedLinesId = _.concat(this.panel.selectedLinesId, _.difference(linesId, this.panel.selectedLinesId));
    }

    removeSelectedId(data) {
        // console.log('before DEL:', this.panel.selectedCountersId, this.panel.selectedLinesId);
        // удаление ID выбранных счётчиков
        _.remove(this.panel.selectedCountersId, id => {
            return id.indexOf(data.node.id) === 0;
        });

        // удаление ID выбранных линий
        if (this.panel.selectedCountersId.length != 0) {
            var lineIdSelect = data.node.id.split('.').splice(0, 2).join('.');
            var cityIdSelect = data.node.id.split('.')[0];

            if (data.node.id.split('.').length === 3) {
                var isRemainedLines = false;
                _.forEach(this.panel.selectedCountersId, cId => {
                    if (cId.indexOf(lineIdSelect) != -1) isRemainedLines = true;
                });
                if (!isRemainedLines) {
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

    removeUnselectedData(data) {
        // console.log('REMOVE-MAIN', this.datasource.closeRequest());
        var oldSelectedIds = {
            lines: this.panel.selectedLinesId.slice(),
            counters: this.panel.selectedCountersId.slice(),
        };
        this.removeSelectedId(data);
        var selectedIds = {
            lines: _.difference(oldSelectedIds.lines, this.panel.selectedLinesId),
            counters: _.difference(oldSelectedIds.counters, this.panel.selectedCountersId)
        };
        
        // close requests
        _.forEach(selectedIds.counters, counter => {
            const arr = [];
            arr.push(counter);
            // console.log('REMOVE-MAIN', hash.MD5(this.panel.id + arr.sort().join()));
            this.datasource.closeRequest(hash.MD5(this.panel.id + arr.sort().join()));
        });
        this.datasource.closeRequest(hash.MD5(this.panel.id + selectedIds.counters.sort().join()));
        
        // удаляем данные счётчиков
        _.forEach(selectedIds.counters, targetId => {
            _.remove(this.data.values.normalized.counters, counter => {
                return !_.isEmpty(counter) ? counter.targetId === targetId : false;
            });
            this.chart_removeWrapVis(targetId);     // delete block of counter
        });
        // удаляем данные состояний и брендов
        _.forEach(selectedIds.lines, targetId => {
            _.remove(this.data.values.normalized.statusLines, line => {
                return line.targetId === targetId;
            });
            _.remove(this.data.values.normalized.brandsLines, line => {
                return line.targetId === targetId;
            });
        });
    }

    jsTreeBuildAction(treeData, datasource) {
        // отключаем скрытие меню после нажатия (для мобильных в css убираем div с классом .dropdown-backdrop)
        $('#jsTree-'+this.panel.id).on('click', function (e) {
            $(this).hasClass('tree-container') && e.stopPropagation();
        });
        // var $treeview = $("#jsTree");
        if(_.isEmpty(this.treeObject)) {
            this.treeObject = $('#jsTree-'+this.panel.id);
            this.treeObject.jstree({
                'core' : {
                    'data' : treeData,              // данные дерева
                    'animation' : 0,              // время анимации разворачивания дерева
                    'dblclick_toggle' : true,       // разворачивание дерева по двойному клику
                    'expand_selected_onload': true, // после загрузки раскрыть все выбраные ветви
                    'themes' : {
                        'dots' : true,              // соединяющие точки дерева
                        'name' : this.lightTheme ? 'default' : 'default-dark',    // выбор темы
                        'responsive' : false,       // для мобильных экранов
                        'stripes' : false           // фоновая зебра
                    },
                    'multiple' : true,              // multiselection
                    'worker' : false,               // чтоб не было ошибки
                },
                'types' : {
                    'counter' : { 'icon' : 'fa fa-tachometer', 'a_attr' : { 'style': 'background: none' }},
                    'line' : { 'icon' : 'fa fa-tasks', 'a_attr' : { 'style': 'background: none' }},
                    'city' : { 'icon' : 'fa fa-industry', 'a_attr' : { 'style': 'background: none' }},
                },
                'plugins' : ['checkbox', 'themes', 'types'/* "ui" */]

            // tree is ready
            }).on('ready.jstree', (e, data) => {
                this.treeLoaded = true;                
                var state = Object.assign({}, this.panel.treeState);
                data.instance.set_state(state);                             // возобновляем состояние дерева (вызывает событие set_state)

            // changed selection
            }).on('changed.jstree', (e, data) => {
                //console.log('changed', this.datasource.backendSrv.inFlightRequests);
                // this.timeSrv.setAutoRefresh(this.dashboard.refresh);        // сбрасываем таймер автообновления
                this.panel.treeState = data.instance.get_state();
                if (data.action == 'select_node') {
                    // console.log('select_node', this.treeObject.jstree().get_bottom_selected(true));
                    var oldSelectedIds = {
                        lines: this.panel.selectedLinesId.slice(),
                        counters: this.panel.selectedCountersId.slice(),
                    };
                    this.addSelectedId(data);
                    var selectedIds = {
                        lines: _.difference(this.panel.selectedLinesId, oldSelectedIds.lines),
                        counters: _.difference(this.panel.selectedCountersId, oldSelectedIds.counters)
                    };
                    // console.log('selectedIds', selectedIds);
                    if (this.treeStateResumed) {
                        if(_.isEmpty(selectedIds.counters)) return;
                        _.forEach(selectedIds.counters, targetId => {
                            this.chart_addWrapVis(targetId);
                        });
                        this.issueQueries(datasource, selectedIds);     // запрашиваем данные выбранных счётчиков
                    }
                } else if (data.action == 'deselect_node') {
                    // console.log('deselect_node', data);
                    this.removeUnselectedData(data);
                    //this.render('remove');                                        // !!!!!!!!!! to be continued
                }

            }).on('open_node.jstree', (e, data) => {
                this.panel.treeState = data.instance.get_state();
            }).on('close_node.jstree', (e, data) => {
                this.panel.treeState = data.instance.get_state();
            // state of the tree was retored
            }).on('set_state.jstree', () => {
                // console.log('set_state');
                this.treeStateResumed = true;
                var selectedIds = {
                    lines: this.panel.selectedLinesId.slice(),
                    counters: this.panel.selectedCountersId.slice(),
                };
                if (_.isEmpty(selectedIds.counters)) return;
                _.forEach(selectedIds.counters, targetId => {
                    this.chart_addWrapVis(targetId);
                });
                this.issueQueries(datasource, selectedIds);                 // запрашиваем данные выбранных счётчиков
            });
        }
    }

    issueQueries(datasource, targets) {
        // console.log('issueQueries datasource: ', datasource);
        this.datasource = datasource;
        if (!this.panel.targets || this.panel.targets.length === 0) {
            return this.$q.when([]);
        }

        this.dataRequest = {
            panelId: this.panel.id,
            //format: this.panel.renderer === 'png' ? 'png' : 'json',
            format: 'json',
            maxDataPoints: this.resolution,
            intervalMs: this.intervalMs,
            range: {
                from: this.range.from,
                to: this.range.to
            },
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
            this.dataRequest.user.orgName = this.dataRequest.user.orgName.split('.')[0];  // используем только первую часть имени
            // запрос по событию autorefresh
            if (_.isEmpty(targets)) {
                
                this.dataRequest.targets = {
                    statusLines: this.panel.selectedLinesId,
                    brandsLines: this.panel.selectedLinesId,
                    counters: this.panel.selectedCountersId
                };
                if(_.isEmpty(this.dataRequest.targets.counters)) return;
                return datasource.query(this.dataRequest, '/query/targets');
            // запрос по событию выбра в дереве
            } else {
                this.dataRequest.targets = {
                    statusLines: targets.lines,
                    brandsLines: targets.lines,
                    counters: targets.counters
                };
                this.loading = true;    // для отображения статуса (спинера) загрузки
                return datasource.query(this.dataRequest, '/query/targets')
                    .then(data => {
                        this.loading = false;
                        this.onDataReceived(data.data);
                        this.onRender();
                    }).catch (err => {
                        if (err.cancelled) {
                            this.loading = false;
                            this.$log.warn('HTTP_REQUEST_CANCELLED');
                        }
                        //return;
                    });
            }
        } else {
            var dataUserRequest = {};
            dataUserRequest.user = this.dataRequest.user;
            return datasource.query(dataUserRequest, '/query/tree')
            .catch (err => {
                //this.error = err.data.error + " [" + err.status + "]";
                this.alertSrv.set('Error', 'Data of "counters tree" wasn\'t loaded', 'warning', 6000); //error, warning, success, info
                this.$log.warn('Data of counters tree wasn\'t loaded', err);
                return;
            });
        }
    }

    convertIdToName(targetId) {
        var arrFlatTree = this.treeObject.jstree().get_json('#', { 'flat': true }); // плоский массив объектов дерева
        var arrTargetId = _.split(targetId, '.');
        try {
            var cityName = arrFlatTree[_.findIndex(arrFlatTree, obj => obj.id === _.split(targetId, '.', 1).pop())].text;
            var lineName = arrFlatTree[_.findIndex(arrFlatTree, obj => obj.id === _.split(targetId, '.', 2).join('.'))].text;
            if (arrTargetId.length === 3) {
                var counterName = arrFlatTree[_.findIndex(arrFlatTree, obj => obj.id === _.split(targetId, '.', 3).join('.'))].text;
                // return cityName+' - '+lineName+' - '+counterName;
                return [cityName, lineName, counterName];
            }
        } catch (error) {
            this.$log.warn('Failed to convert tree ID to Name. The text of the tree is not found', error);
        }
        // return cityName+' - '+lineName;
        return [cityName, lineName];
    }

    normalizeDataCounter(data) {
        /* const dateFrom = this.range.from.clone(),
            dateTo = this.range.to.clone(); */

        let datapoints = _.map(data.datapoints, d => {
            return {
                t: d[1],
                y: _.round(d[0], 2)
            };
        });
        if (datapoints.length) {
            datapoints.unshift(
                /* {
                    t: new Date(dateFrom).getTime(),
                    y: 0,
                    fake: true
                }, */
                {
                    t: datapoints[0].t - 1,
                    y: 0,
                    fake: true
                }
            );
            datapoints.push(
                {
                    t: datapoints[datapoints.length - 1].t + 1,
                    y: 0,
                    fake: true
                }/* ,
                {
                    t: new Date(dateTo).getTime(),
                    y: 0,
                    fake: true
                } */
            );
        }
        datapoints = datapoints.sort((a, b) => {
            if (a.t < b.t)
                return -1;
            if (a.t > b.t)
                return 1;
            return 0;
        });

        let dataProps = {};
        _.forEach(this.data.orgStructure.converted, city => {
            _.forEach(city.children, line => {
                _.forEach(line.children, counter => {
                    if (counter.id === data.target) {
                        dataProps = counter.data;
                    }
                });
            });
        });
        // console.log('NORMILIZE', dataProps);
        return {
            dataProps,
            datapoints, 
            targetId: data.target,
            targetName: this.convertIdToName(data.target)
        };
    }

    onDataReceived(dataReceived) {
        // $('svg').css('cursor', 'pointer');
        // console.log('onDataReceived', dataReceived);
        // обработка данных дерева и построение дерева
        if ('orgStructureCities' in dataReceived && 'orgStructureLines' in dataReceived && 'counters' in dataReceived) {
            this.data.orgStructure.source = dataReceived;
            var hashCode = hash.MD5(this.data.orgStructure.source);
            if (this.data.orgStructure.source.counters && this.data.orgStructure.source.counters.length != 0) {
                this.data.orgStructure.converted = this.convertDataToNestedTree(this.data.orgStructure.source);    // преобразуем полученные данные в массив дерева
                if (this.panel.treeHash != hashCode) {                                          // проверяем изменились ли данные дерева (по хэш коду объекта)
                    //обновляем хэш код и сбрасываем состояние дерева
                    this.panel.treeHash = hashCode;
                    this.panel.treeState = {/* core: {selected: []} */};
                    this.panel.selectedCountersId = [];
                    this.panel.selectedLinesId = [];
                    // console.log('%c Data of tree was changed! Save it ', 'background: blue; color: yellow');
                }
                this.jsTreeBuildAction(this.data.orgStructure.converted, this.datasource);                      // строим дерево
                this.btnShowTree = 'active';                                                // делаем кнопку активной

                // создаём ссылки на основные элементы страницы для работы с ними в дальнейшем
                this.elements.tags.mainWrap = $('#' + this.pluginId + '-' + this.panel.id)[0];
                this.elements.tags.contentHeader = $('#' + this.pluginId + '-' + this.panel.id + ' .content-header')[0];
                this.elements.tags.contentWrap = $('#' + this.pluginId + '-' + this.panel.id + ' .content-wrap')[0];
                //this.onPanelSizeChanged();      // height update for scroll elements
            }
            return;
        }
        // сохраняем полученные данные брендов, состояний линий и счётчиков
        if ('brandsLines' in dataReceived && 'statusLines' in dataReceived && 'counters' in dataReceived) {
            this.data.values.source = dataReceived;
            // brands lines
            _.forEach(this.data.values.source.brandsLines, line => {
                var brands = new DistinctPoints();
                _.forEach(line.datapoints, (point) => {
                    // point: [0]-valNum, [1]-time, [2]- valString, [3]-commentText, [4]-fillColor
                    brands.add(point[0], +point[1], point[2], point[3], point[4]);
                });
                brands.finish(this);
                brands.targetId = line.target;
                brands.targetName = this.convertIdToName(line.target);
                var numVal = this.panel.selectedLinesId.indexOf(line.target);
                if (numVal > -1) {
                    this.data.values.normalized.brandsLines[numVal] = brands;
                }
            });
            // status lines
            _.forEach(this.data.values.source.statusLines, line => {
                var statuses = new DistinctPoints();
                _.forEach(line.datapoints, (point) => {
                    // point: [0]-valNum, [1]-time, [2]- valString, [3]-commentText, [4]-fillColor
                    statuses.add(point[0], +point[1], point[2], point[3], point[4]);
                });
                statuses.finish(this);
                statuses.targetId = line.target;
                statuses.targetName = this.convertIdToName(line.target);
                var numVal = this.panel.selectedLinesId.indexOf(line.target);
                if (numVal > -1) {
                    this.data.values.normalized.statusLines[numVal] = statuses;
                }
            });
            // counters
            _.forEach(this.data.values.source.counters, counter => {
                var numVal = this.panel.selectedCountersId.indexOf(counter.target);
                if (numVal > -1) {
                    this.data.values.normalized.counters[numVal] = this.normalizeDataCounter(counter);
                }
            });
            this.onRender('update');
        }
    }

    onRender(action) {
        //$(this.panel.mainWrap).closest('.panel-content').css('overflow', 'visible');    // change visibility for parent element of panel
        //console.log('!ON-RENDER', '');
        this.heightUpdate();

        if (!this.data.values.normalized) {
            return;
        }
        if (_.isEmpty(this.data.values.normalized.counters) && !action) {
            //console.log('ON-RENDER-NODATA');
            return;
        }
        if (action) {
            this.$log.log('ON-RENDER-BUILD ');
            this.chartBuildSvg(this.data.values.normalized);
        }
        if (!_.isEmpty(this.data.values.normalized.counters) && !action) {
            this.$log.log('ON-RENDER-UPDATE ');
            this.chartBuildSvg(this.data.values.normalized);
        }

/* 
        //$('.panel-main-wrap').css({'max-height': (this.height) +'px'});
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

            // ctx.shadowOffsetX = 1;
            //  ctx.shadowOffsetY = 1;
            //  ctx.shadowColor = "rgba(0,0,0,0.3)";
            //  ctx.shadowBlur = 3;

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
                        // console.log( 'point', point);
                        point.x = (xt / elapsed) * width;
                        // ctx.fillStyle = this.getColor( point.val );
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
                    // console.log( 'this.mouse.position', this.mouse.position);
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
*/
        //this.tableRender();
    }

    // onDataError(err) {
    //     console.log('onDataError-test1', err);
    // }

    showLegandTooltip(pos, info) {
        var body = '<div class="graph-tooltip-time">' + info.val + '</div>';

        body += '<center>';
        if (info.count > 1) {
            body += info.count + ' times<br/>for<br/>';
        }
        body += moment.duration(info.ms).humanize();
        if (info.count > 1) {
            body += '<br/>total';
        }
        body += '</center>';

        this.$tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
    }

    randomColor() {
        var letters = 'ABCDE'.split('');
        var color = '#';
        for (var i = 0; i < 3; i++) {
            color += letters[Math.floor(Math.random() * letters.length)];
        }
        return color;
    }

    onConfigChanged() {
        //console.log('onConfigChanged', this.panel.treeStates.state1);
        /*this.timeSrv.refreshDashboard();*/
        this.render();
        //this.tableRender();
    }


    clear() {
        //console.log("clear()");
        this.mouse.position = null;
        this.mouse.down = null;
        this.hoverPoint = null;
        // $(this.canvas).css('cursor', 'wait');
        appEvents.emit('graph-hover-clear');
        this.render();
    }  

}
BpmPanelCtrl.templateUrl = 'partials/module.html';
export {
    BpmPanelCtrl as PanelCtrl
};


