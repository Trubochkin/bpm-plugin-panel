import './lib/jstree/themes/default-dark/style.min.css!';   // eslint-disable-line
import './lib/jstree/themes/default/style.min.css!';        // eslint-disable-line
import './lib/jstree/jstree.min';
// import './directives/d-tree-view';
// import config from 'app/core/config';
import ChartsBuildPanelCtrl from './charts-actions';
import DistinctPoints from './points';
import _ from 'lodash';   // eslint-disable-line
import $ from 'jquery';   // eslint-disable-line
// import moment from 'moment';
// import angular from 'angular';
// import kbn from 'app/core/utils/kbn';
import appEvents from 'app/core/app_events';      // eslint-disable-line
import { loadPluginCss } from 'app/plugins/sdk';  // eslint-disable-line
import * as hash from './lib/hash/object_hash';
// import * as d3 from 'd3';


loadPluginCss({
  dark: 'plugins/test1-panel/css/bpm.dark.css',
  light: 'plugins/test1-panel/css/bpm.light.css',
});


class BpmPanelCtrl extends ChartsBuildPanelCtrl {
  constructor(
    $scope, $log, $injector, $q, $http, alertSrv, datasourceSrv, contextSrv,
    $rootScope, dashboardSrv, timeSrv,
  ) {
    super($scope, $injector, $q);
    // this.data = null;
    this.$http = $http;
    this.$scope = $scope;
    this.$log = $log;
    this.alertSrv = alertSrv;
    // this.appEvents = appEvents;
    // this.$rootScope = $rootScope;
    this.contextSrv = contextSrv;
    this.panel.targets.splice(1); // deleting all fields of datasource metrics except first
    this.dashboardSrv = dashboardSrv;
    this.datasourceSrv = datasourceSrv;

    // Set and populate defaults
    const panelDefaults = {
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
          selected: [],
        },
      },
      selectedCountersId: [],
      selectedLinesId: [],
      textSizeTitles: 16,
      svgHeight: 200,
      ascData: true, // отображение данных в порядке выбора
    };

    _.defaults(this.panel, panelDefaults);
    this.externalPT = false;
    this.dataWriteDB = {
      panelId: '',
      user: {
        orgName: contextSrv.user.orgName,
        orgRole: contextSrv.user.orgRole,
        email: contextSrv.user.email,
        login: contextSrv.user.login,
      },
      target: '',
      datapoint: {
        pointNumber: '',
        time: '',
        pointName: '',
        commentText: '',
        fillColor: '',
      },
    };

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('render', this.onRender.bind(this));
    this.events.on('data-received', this.onDataReceived.bind(this));
    // this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('init-panel-actions', this.onInitPanelActions.bind(this));
    this.events.on('panel-size-changed', this.onPanelSizeChanged.bind(this));
    // this.events.on('refresh', this.onRefresh.bind(this));
    // this.updateColorInfo();

    this.lightTheme = contextSrv.user.lightTheme; // boolean
    this.btnShowTree = 'disabled'; // active / disabled
    this.treeLoaded = false;
    this.treeStateResumed = false;
    this.treeObject = {};
    this.data = {
      orgStructure: {
        source: {},
        converted: [],
      },
      values: {
        source: {
          counters: [],
          statusLines: [],
          brandsLines: [],
        },
        normalized: { // data after filtered and normalized
          counters: [],
          statusLines: [],
          brandsLines: [],
        },
      },
    };
    this.elements = {
      $tags: {},
      sizes: {
        marginAreaVis: {
          top: 5, right: 20, bottom: 20, left: 40,
        },
      },
    };
    this.timeSrv = timeSrv;

    this.$log.log('this', this);
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
    actions.push({ text: 'Export CSV', click: 'ctrl.exportCsv()' });
    actions.push({ text: 'Toggle legend', click: 'ctrl.toggleLegend()' });
    return this;
  }

  onPanelSizeChanged() {
    // console.log('RESAZE-PANEL-DONE');
    this.updateHeight();
    return this;
  }

  updateHeight() {
    // height update for scroll elements
    const elTreeContainer = $(`#${this.pluginId}-${this.panel.id} .content-header .tree-container`)[0];
    this.elements.sizes.contentHeaderHeight = $(this.elements.$tags.contentHeader)
      .outerHeight(true);
    this.elements.sizes.contentWrapWidth = $(this.elements.$tags.contentWrap).prop('clientWidth');
    $(elTreeContainer).css({ 'max-height': `${this.height - this.elements.sizes.contentHeaderHeight}px` });
    $(elTreeContainer).css({ 'max-width': `${this.elements.sizes.contentWrapWidth}px` });
    $(this.elements.$tags.contentWrap).css({ height: `${this.height - this.elements.sizes.contentHeaderHeight}px` });
  }

  convertDataToNestedTree(data) {
    const { orgStructureCities, orgStructureLines, counters } = data;
    let arrStructTree = [];

    arrStructTree = _.map(orgStructureCities, (city) => {
      const filteredLines = _.filter(orgStructureLines, line => _.trim(`${line.parentId}`) === _.trim(`${city.id}`));
      return {
        id: _.trim(`${city.id}`),
        text: city.name,
        // parentId: obj.parentId,
        type: 'city',
        children: _.map(filteredLines, (line) => {
          const filteredCounters = _.filter(counters, counter => _.trim(`${counter.lineId}`) === _.trim(`${line.id}`));
          return {
            id: _.trim(`${line.parentId}.${line.id}`),
            text: line.name,
            // parentId: line.parentId,
            type: 'line',
            data: line,
            children: _.map(filteredCounters, counter => ({
              id: _.trim(`${line.parentId}.${counter.lineId}.${counter.id}`),
              text: counter.name,
              type: 'counter',
              data: counter,
            })),
          };
        }),
      };
    });
    this.data.orgStructure.converted = arrStructTree;
    return this;
  }

  addSelectedId(data) {
    const countersId = data.instance.get_bottom_checked();
    const linesId = _.uniq(_.map(countersId, id => id.split('.').splice(0, 2).join('.')));
    this.panel.selectedLinesId = linesId;
    // объединяем для соблюдения последовательности отображения
    this.panel.selectedCountersId = _.concat(
      this.panel.selectedCountersId,
      _.difference(countersId, this.panel.selectedCountersId),
    );
  }

  removeSelectedId(data) {
    // console.log('before DEL:', this.panel.selectedCountersId, this.panel.selectedLinesId);
    // удаление ID выбранных счётчиков
    _.remove(this.panel.selectedCountersId, id => id.indexOf(data.node.id) === 0);

    // удаление ID выбранных линий
    if (this.panel.selectedCountersId.length !== 0) {
      const lineIdSelect = data.node.id.split('.').splice(0, 2).join('.');
      const cityIdSelect = data.node.id.split('.')[0];

      if (data.node.id.split('.').length === 3) {
        let isRemainedLines = false;
        _.forEach(this.panel.selectedCountersId, (cId) => {
          if (cId.indexOf(lineIdSelect) !== -1) isRemainedLines = true;
        });

        if (!isRemainedLines) {
          _.remove(this.panel.selectedLinesId, id => lineIdSelect === id);
        }
      } else if (data.node.id.split('.').length === 2) {
        _.remove(this.panel.selectedLinesId, id => lineIdSelect === id);
      } else {
        _.remove(this.panel.selectedLinesId, id => cityIdSelect === id.split('.')[0]);
      }
    } else {
      this.panel.selectedLinesId = [];
    }
    // console.log('after DEL:', this.panel.selectedCountersId, this.panel.selectedLinesId);
  }

  removeUnselectedData(data) {
    // console.log('REMOVE-MAIN', this.datasource.closeRequest());
    const oldSelectedIds = {
      lines: this.panel.selectedLinesId.slice(),
      counters: this.panel.selectedCountersId.slice(),
    };

    this.removeSelectedId(data);
    const selectedIds = {
      lines: _.difference(oldSelectedIds.lines, this.panel.selectedLinesId),
      counters: _.difference(oldSelectedIds.counters, this.panel.selectedCountersId),
    };

    // close requests
    _.forEach(selectedIds.counters, (counter) => {
      const arr = [];
      arr.push(counter);
      // console.log('REMOVE-MAIN', hash.MD5(this.panel.id + arr.sort().join()));
      this.datasource.closeRequest(hash.MD5(this.panel.id + arr.sort().join()));
    });

    this.datasource.closeRequest(hash.MD5(this.panel.id + selectedIds.counters.sort().join()));
    // удаляем данные счётчиков
    _.forEach(selectedIds.counters, (targetId) => {
      _.remove(
        this.data.values.normalized.counters,
        counter => (!_.isEmpty(counter) ? counter.targetId === targetId : false),
      );
      this.chartRemoveWrapVis(targetId); // delete block of counter
    });
    // удаляем данные состояний и брендов
    _.forEach(selectedIds.lines, (targetId) => {
      _.remove(this.data.values.normalized.statusLines, line => line.targetId === targetId);
      _.remove(this.data.values.normalized.brandsLines, line => line.targetId === targetId);
    });
  }

  jsTreeBuildAction(treeData, datasource) {
    // отключаем скрытие меню после нажатия
    // (для мобильных в css убираем div с классом .dropdown-backdrop)
    $(`#jsTree-${this.panel.id}`).on('click', e => $(e.target).hasClass('tree-container') && e.stopPropagation());
    // var $treeview = $("#jsTree");
    if (_.isEmpty(this.treeObject)) {
      this.treeObject = $(`#jsTree-${this.panel.id}`);
      this.treeObject.jstree({
        core: {
          data: treeData, // данные дерева
          animation: 0, // время анимации разворачивания дерева
          dblclick_toggle: true, // разворачивание дерева по двойному клику
          expand_selected_onload: true, // после загрузки раскрыть все выбраные ветви
          themes: {
            dots: true, // соединяющие точки дерева
            name: this.lightTheme ? 'default' : 'default-dark', // выбор темы
            responsive: false, // для мобильных экранов
            stripes: false, // фоновая зебра
          },

          multiple: true, // multiselection
          worker: false, // чтоб не было ошибки - false
        },

        types: {
          counter: { icon: 'fa fa-tachometer', a_attr: { style: 'background: none' } },
          line: { icon: 'fa fa-tasks', a_attr: { style: 'background: none' } },
          city: { icon: 'fa fa-industry', a_attr: { style: 'background: none' } },
        },

        plugins: ['checkbox', 'themes', 'types'/* , 'sort' */],
      })
        // event tree is ready
        .on('ready.jstree', (e, data) => {
          this.treeLoaded = true;
          const state = Object.assign({}, this.panel.treeState);
          // возобновляем состояние дерева (вызывает событие set_state):
          data.instance.set_state(state);
          this.updateHeight();
        })
        // event changed selection
        .on('changed.jstree', (e, data) => {
          this.panel.treeState = data.instance.get_state();
          if (data.action === 'select_node') {
            const oldSelectedIds = {
              lines: this.panel.selectedLinesId.slice(),
              counters: this.panel.selectedCountersId.slice(),
            };

            this.addSelectedId(data);
            const selectedIds = {
              lines: _.difference(this.panel.selectedLinesId, oldSelectedIds.lines),
              counters: _.difference(this.panel.selectedCountersId, oldSelectedIds.counters),
            };

            if (this.treeStateResumed && !_.isEmpty(selectedIds.counters)) {
              // if (_.isEmpty(selectedIds.counters)) return null;
              _.forEach(selectedIds.counters, (targetId) => {
                this.chartAddWrapVis(targetId);
              });

              this.issueQueries(datasource, selectedIds); // запрашиваем данные выбранных счётчиков
            }
          } else if (data.action === 'deselect_node') {
            this.removeUnselectedData(data);
            // this.render('remove'); // !!!!!!!!!! to be continued
          }
        })
        // event open the tree menu
        .on('open_node.jstree', (e, data) => {
          this.panel.treeState = data.instance.get_state();
        })
        // event close the tree menu
        .on('close_node.jstree', (e, data) => {
          this.panel.treeState = data.instance.get_state();
        })
        // event state of the tree was restored
        .on('set_state.jstree', () => {
          // console.log('set_state');
          this.treeStateResumed = true;
          const selectedIds = {
            lines: this.panel.selectedLinesId.slice(),
            counters: this.panel.selectedCountersId.slice(),
          };

          if (_.isEmpty(selectedIds.counters)) return;
          _.forEach(selectedIds.counters, (targetId) => {
            this.chartAddWrapVis(targetId);
          });

          this.issueQueries(datasource, selectedIds); // запрашиваем данные выбранных счётчиков
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
      // format: this.panel.renderer === 'png' ? 'png' : 'json',
      format: 'json',
      maxDataPoints: this.resolution,
      intervalMs: this.intervalMs,
      range: {
        from: this.range.from,
        to: this.range.to,
      },

      user: {
        orgName: this.contextSrv.user.orgName,
        orgRole: this.contextSrv.user.orgRole,
        email: this.contextSrv.user.email,
        login: this.contextSrv.user.login,
      },

      // targets: this.panel.targets,
      targets: {},
      cacheTimeout: this.panel.cacheTimeout,
      panelType: this.panel.type,
    };

    // проверям загружено ли дерево
    if (this.treeLoaded) {
      const orgNameFirst = this.dataRequest.user.orgName.split('.')[0]; // используем только первую часть имени
      this.dataRequest.user.orgName = orgNameFirst;

      // запрос по событию autorefresh
      if (_.isEmpty(targets)) {
        this.dataRequest.targets = {
          statusLines: this.panel.selectedLinesId,
          brandsLines: this.panel.selectedLinesId,
          counters: this.panel.selectedCountersId,
        };
        if (_.isEmpty(this.dataRequest.targets.counters)) return null;

        return datasource.query(this.dataRequest, '/query/targets');
      }
      // запрос по событию выбра в дереве
      this.dataRequest.targets = {
        statusLines: targets.lines,
        brandsLines: targets.lines,
        counters: targets.counters,
      };

      this.loading = true; // для отображения статуса (спинера) загрузки
      return datasource.query(this.dataRequest, '/query/targets')
        .then((data) => {
          this.loading = false;
          this.onDataReceived(data.data);
          // this.onRender();
        }).catch((err) => {
          if (err.cancelled) {
            this.loading = false;
            this.$log.warn('HTTP_REQUEST_CANCELLED');
          }
          // return;
        });
    }

    const dataUserRequest = {};
    dataUserRequest.user = this.dataRequest.user;
    return datasource.query(dataUserRequest, '/query/tree')
      .catch((err) => {
        // this.error = err.data.error + " [" + err.status + "]";
        this.alertSrv.set('Error', 'Data of "counters tree" wasn\'t loaded', 'warning', 6000); // error, warning, success, info
        this.$log.warn('Data of counters tree wasn\'t loaded', err);
      });
  }

  convertIdToName(targetId) {
    const arrFlatTree = this.treeObject.jstree().get_json('#', { flat: true }); // flat array of tree object
    const arrTargetId = _.split(targetId, '.');
    let cityName;
    let lineName;
    try {
      cityName = arrFlatTree[_.findIndex(arrFlatTree, obj => obj.id === _.split(targetId, '.', 1).pop())].text;
      lineName = arrFlatTree[_.findIndex(arrFlatTree, obj => obj.id === _.split(targetId, '.', 2).join('.'))].text;
      if (arrTargetId.length === 3) {
        const counterName = arrFlatTree[_.findIndex(arrFlatTree, obj => obj.id === _.split(targetId, '.', 3).join('.'))].text;
        return [cityName, lineName, counterName];
      }
    } catch (error) {
      this.$log.warn('Failed to convert tree ID to Name. The text of the tree is not found', error);
    }
    // return cityName+' - '+lineName;
    return [cityName, lineName];
  }

  normalizeDataCounter(data) {
    let datapoints = _.map(data.datapoints, d => ({
      t: d[1],
      y: _.round(d[0], 2),
    }));

    if (datapoints.length) {
      datapoints.unshift({
        t: datapoints[0].t - 1,
        y: 0,
        fake: true,
      });

      datapoints.push({
        t: datapoints[datapoints.length - 1].t + 1,
        y: 0,
        fake: true,
      });
    }

    datapoints = datapoints.sort((a, b) => {
      if (a.t < b.t) { return -1; }
      if (a.t > b.t) { return 1; }
      return 0;
    });

    let dataProps = {};
    _.forEach(this.data.orgStructure.converted, (city) => {
      _.forEach(city.children, (line) => {
        _.forEach(line.children, (counter) => {
          if (counter.id === data.target) {
            dataProps = counter.data;
          }
        });
      });
    });

    return {
      dataProps,
      datapoints,
      targetId: data.target,
      targetName: this.convertIdToName(data.target),
    };
  }

  onDataReceived(dataReceived) {
    // $('svg').css('cursor', 'pointer');
    // обработка данных дерева и построение дерева
    if ('orgStructureCities' in dataReceived && 'orgStructureLines' in dataReceived && 'counters' in dataReceived) {
      this.data.orgStructure.source = dataReceived;
      const hashCode = hash.MD5(this.data.orgStructure.source);
      if (this.data.orgStructure.source.counters &&
        this.data.orgStructure.source.counters.length !== 0) {
        // преобразуем полученные данные в массив дерева:
        this.convertDataToNestedTree(this.data.orgStructure.source);
        // проверяем изменились ли данные дерева (по хэш коду объекта):
        if (this.panel.treeHash !== hashCode) {
          // обновляем хэш код и сбрасываем состояние дерева
          this.panel.treeHash = hashCode;
          this.panel.treeState = {/* core: {selected: []} */};
          this.panel.selectedCountersId = [];
          this.panel.selectedLinesId = [];
        }
        this.jsTreeBuildAction(this.data.orgStructure.converted, this.datasource); // строим дерево
        this.btnShowTree = 'active'; // делаем кнопку активной

        // создаём ссылки на основные элементы страницы для работы с ними в дальнейшем
        const mainWrap = $(`#${this.pluginId}-${this.panel.id}`)[0];
        const contentHeader = $(`#${this.pluginId}-${this.panel.id} .content-header`)[0];
        const contentWrap = $(`#${this.pluginId}-${this.panel.id} .content-wrap`)[0];
        this.elements.$tags.mainWrap = mainWrap;
        this.elements.$tags.contentHeader = contentHeader;
        this.elements.$tags.contentWrap = contentWrap;
        // this.onPanelSizeChanged();      // height update for scroll elements
      }
      // return null;
    } else if ('brandsLines' in dataReceived && 'statusLines' in dataReceived && 'counters' in dataReceived) {
      // сохраняем полученные данные брендов, состояний линий и счётчиков
      this.data.values.source = dataReceived;
      // brands lines
      _.forEach(this.data.values.source.brandsLines, (line) => {
        const brands = new DistinctPoints();
        _.forEach(line.datapoints, (point) => {
          // point: [0]-valNum, [1]-time, [2]- valString, [3]-commentText, [4]-fillColor
          brands.add(point[0], +point[1], point[2], point[3], point[4]);
        });
        brands.finish(this);
        brands.targetId = line.target;
        brands.targetName = this.convertIdToName(line.target);
        const numVal = this.panel.selectedLinesId.indexOf(line.target);
        if (numVal > -1) {
          this.data.values.normalized.brandsLines[numVal] = brands;
        }
      });
      // status lines
      _.forEach(this.data.values.source.statusLines, (line) => {
        const statuses = new DistinctPoints();
        _.forEach(line.datapoints, (point) => {
          // point: [0]-valNum, [1]-time, [2]- valString, [3]-commentText, [4]-fillColor
          statuses.add(point[0], +point[1], point[2], point[3], point[4]);
        });
        statuses.finish(this);
        statuses.targetId = line.target;
        statuses.targetName = this.convertIdToName(line.target);
        const numVal = this.panel.selectedLinesId.indexOf(line.target);
        if (numVal > -1) {
          this.data.values.normalized.statusLines[numVal] = statuses;
        }
      });
      // counters
      _.forEach(this.data.values.source.counters, (counter) => {
        const numVal = this.panel.selectedCountersId.indexOf(counter.target);
        if (numVal > -1) {
          this.data.values.normalized.counters[numVal] = this.normalizeDataCounter(counter);
        }
      });
      this.onRender('update');
    }
  }

  onRender() {
    // change visibility for parent element of panel
    // $(this.panel.mainWrap).closest('.panel-content').css('overflow', 'visible');
    if (!this.data.values.normalized || _.isEmpty(this.data.values.normalized.counters)) {
      return null;
    }

    this.$log.log('ON-RENDER');
    this.updateHeight();
    this.chartBuildSvg(this.data.values.normalized);
    return this;
  }

  // onDataError(err) {
  //     console.log('onDataError-test1', err);
  // }

  randomColor() {
    const letters = 'ABCDE'.split('');
    let color = '#';
    for (let i = 0; i < 3; i + 1) {
      color += letters[Math.floor(Math.random() * letters.length)];
    }
    this.color = color;
    return color;
  }

  onConfigChanged() {
    // console.log('onConfigChanged', this.panel.treeStates.state1);
    /* this.timeSrv.refreshDashboard(); */
    this.render();
    // this.tableRender();
  }

  clear() {
    // console.log("clear()");
    this.mouse.position = null;
    this.mouse.down = null;
    this.hoverPoint = null;
    // $(this.canvas).css('cursor', 'wait');
    appEvents.emit('graph-hover-clear');
    this.render();
  }
}
BpmPanelCtrl.templateUrl = 'partials/module.html';
export { BpmPanelCtrl as PanelCtrl };   // eslint-disable-line

