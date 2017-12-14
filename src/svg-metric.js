import {MetricsPanelCtrl} from 'app/plugins/sdk';
import _ from 'lodash';
import moment from 'moment';
import angular from 'angular';
import $ from 'jquery';
import d3 from 'd3';

import appEvents from 'app/core/app_events';

var canvasID = 1;
var svgID = 1;

// Expects a template with: <div class="canvas-spot"></div>
export class SvgPanelCtrl extends MetricsPanelCtrl {

    constructor($scope, $injector, $q) {
        super($scope, $injector);

        this.q = $q;
        this.data = null;
        this.mouse = {
            position: null,
            down: null
        };
        this.canvasID = canvasID++;
        this.svgID = svgID++;
        this.$tooltip = $('<div id="tooltip.' + canvasID + '" class="graph-tooltip">');

        this.events.on('panel-initialized', this.onPanelInitalized.bind(this));
        this.events.on('refresh', this.onRefresh.bind(this));
        // this.events.on('render', this.onRender.bind(this)); console.log('$tooltip: ',
        // this.$tooltip)
    }

    onPanelInitalized() {
        //console.log("onPanelInitalized()");
        $('.panel-scroll').css({
            'max-height': (100) + 'px'
        });
        // this.render();
    }

    onRefresh() {
        //console.log("onRefresh()");
        this.clear()
        //this.render();
    }

    clearTT() {
        this
            .$tooltip
            .detach();
    }

    normalizeTouchPosition(evt) {
        var position = evt;
        position.offsetX = evt.pageX;
        position.offsetY = evt.pageY;
        var parent = evt.target;
        while (parent.offsetParent) {
            position.offsetX -= parent.offsetLeft - parent.scrollLeft;
            position.offsetY -= parent.offsetTop - parent.scrollTop;
            parent = parent.offsetParent;
        }
        return position;
    }

    getMousePosition(evt) {
        var elapsed = this.range.to - this.range.from;
        var rect = this.canvas.getBoundingClientRect();
        var x = evt.offsetX; // - rect.left;
        var ts = this.range.from + (elapsed * (x / parseFloat(rect.right - rect.left)));
        var y = evt.clientY - rect.top;

        return {
            x: x,
            y: y,
            yRel: y / parseFloat(rect.height),
            ts: ts,
            evt: evt
        };
    }

    /*onGraphHover(evt, showTT, isExternal) {
     /!*console.log( "HOVER", evt, showTT, isExternal );*!/
     }*/

    onMouseClicked(where) {
        console.log("CANVAS CLICKED", where);
        this.render();
    }

    /*onMouseSelectedRange(range) {
     console.log( "CANVAS Range", range );
    }*/

    chartAddField(targetId) {
        // console.log('ChartD3-this:', this);
        var targetName = this.convertIdToName(targetId);
        var chartSpot = d3.select(this.chartsSpot)
            .append('div')
            .attr('id', 'target-'+targetId)
            .attr('class', 'chartSpot')
            //.attr('width', '100%')
            .style('font-size', this.panel.textSize+'px')
            .style('line-height', this.panel.rowHeight+'px')
            // .style('text-align', 'center')
            .style('background', () => this.lightTheme ? '#f8f8f8' : '#292929');
            
        console.log('ChartD3', chartSpot);
        var spotMessage = chartSpot.append('span');
        spotMessage.append('i').attr('class', 'fa fa-spinner fa-spin');
        spotMessage.append('span').attr('class', 'msg-no-data')
            .html(`no data ${targetName}`);
    }

    chartRemoveField(targetId) {
        var targetIdCorrect = targetId.split('.').join('\\.');  // экранирование точек для корректной выборки
        d3.select(this.chartsSpot)
            .select('#target-'+targetIdCorrect)
            .remove();
        console.log('Remove-SVG:', targetId)
    }

    chartBuildSvg() {
        $(this.chartsSpot).empty();
        _.forEach(this.panel.selectedCountersId, targetId => {
            // console.log('ON-RENDERdata', this.savedData.counters[targetId]);
            var targetIdCorrect = targetId.split('.').join('\\.');  // экранирование точек для корректной выборки
            const svg = d3.select(this.chartsSpot)
                .append('div')
                .style('font-size', this.panel.textSize+'px')
                .attr('id', 'target-'+targetId)
                .attr('class', 'chartSpot')
                .style('background', () => this.lightTheme ? '#f8f8f8' : '#292929')
                //.append('text')
                .html(this.convertIdToName(targetId))
                //.text(this.savedData.counters[targetId].targetName)
                .append('svg')
                .attr('height', this.panel.rowHeight)
                .attr('width', '100%')
                //.attr('viewBox', '0 0 800 100')
                .attr('class', 'svg-graph')
                .append('text')
                .text(targetId)
                .attr('x',  '50%')
                .attr('y', 50)
                .attr('text-anchor', 'middle')
                //.style('fill', 'white')
                .style('font-size', `${22}px`);
                //.attr('transform', `translate(${margin.left}, ${margin.top})`);
        })
    }

    link(scope, elem, attrs, ctrl) {
        // console.log('panel-canvasMetric-link-elem', elem);
        this.chartsSpot = elem.find('.charts-spot')[0];
        /*  var timeMouseDown = 0;
        this.wrap = elem.find('.canvas-spot')[0];
        this.canvas = document.createElement("canvas");
        this.wrap.appendChild(this.canvas);
        $(this.canvas).css('cursor', 'pointer');
        $(this.wrap).css('width', '100%');
        this.context = this.canvas.getContext('2d'); */
        /*
        this.canvas.addEventListener('mouseenter', (evt) => {
            if (this.mouse.down && !evt.buttons) {
                this.mouse.position = null;
                this.mouse.down = null;
                this.render();
                this.$tooltip.detach();
                appEvents.emit('graph-hover-clear');
            }
            $(this.canvas).css('cursor', 'pointer');
        }, false);

        this.canvas.addEventListener('mouseout', (evt) => {
            if (this.mouse.down == null) {
                this.mouse.position = null;
                this.render();
                this.$tooltip.detach();
                appEvents.emit('graph-hover-clear');
            } else {
                this.$tooltip.detach();
                appEvents.emit('graph-hover-clear');
            }
        }, false);

        this.canvas.addEventListener('mousemove', (evt) => {
            this.mouse.position = this.getMousePosition(evt);
            var info = {
                pos: {
                    pageX: evt.pageX,
                    pageY: evt.pageY,
                    x: this.mouse.position.ts,
                    y: this.mouse.position.y,
                    panelRelY: this.mouse.position.yRel,
                    panelRelX: this.mouse.position.xRel
                },
                evt: evt,
                panel: this.panel
            };
            appEvents.emit('graph-hover', info);
            if (this.mouse.down != null) {
                $(this.canvas).css('cursor', 'col-resize');
            } else {
                $(this.canvas).css('cursor', 'pointer');
            }
        }, false);
        this.canvas.addEventListener('mouseenter', (evt) => {
            if (this.mouse.down && !evt.buttons) {
                this.mouse.position = null;
                this.mouse.down = null;
                this.render();
                this.$tooltip.detach();
                appEvents.emit('graph-hover-clear');
            }
            $(this.canvas).css('cursor', 'pointer');
        }, false);

        this.canvas.addEventListener('mouseout', (evt) => {
            if (this.mouse.down == null) {
                this.mouse.position = null;
                this.render();
                this.$tooltip.detach();
                appEvents.emit('graph-hover-clear');
            } else {
                this.$tooltip.detach();
                appEvents.emit('graph-hover-clear');
            }
        }, false);

        this.canvas.addEventListener('mousemove', (evt) => {
            this.mouse.position = this.getMousePosition(evt);
            var info = {
                pos: {
                    pageX: evt.pageX,
                    pageY: evt.pageY,
                    x: this.mouse.position.ts,
                    y: this.mouse.position.y,
                    panelRelY: this.mouse.position.yRel,
                    panelRelX: this.mouse.position.xRel
                },
                evt: evt,
                panel: this.panel
            };
            appEvents.emit('graph-hover', info);
            if (this.mouse.down != null) {
                $(this.canvas).css('cursor', 'col-resize');
            } else {
                $(this.canvas).css('cursor', 'pointer');
            }
        }, false); */

        /*
        this.canvas.addEventListener('mousedown', (evt) => {
            timeMouseDown = performance.now();
            this.mouse.down = this.getMousePosition(evt);
        }, false);

        this.canvas.addEventListener('mouseup', (evt) => {
            //console.log('mouseup', evt);
            //console.log('touchend-mouse.position', this.mouse.position);
            //this.$tooltip.detach();
            var up = this.getMousePosition(evt);
            if (this.mouse.down != null) {
                if (up.x == this.mouse.down.x && up.y == this.mouse.down.y) {
                    this.mouse.position = null;
                    this.mouse.down = null;
                    // this.onMouseClicked(up);
                }
                else {
                    if (performance.now() - timeMouseDown > 200) {      // фильтрация на движение мыши
                        var min = Math.min(this.mouse.down.ts, up.ts);
                        var max = Math.max(this.mouse.down.ts, up.ts);
                        var range = {from: moment.utc(min), to: moment.utc(max)};
                        this.mouse.position = up;
                        this.onMouseSelectedRange(range);
                    }
                }
            }
            this.mouse.down = null;
            this.mouse.position = null;
        }, false);

        this.canvas.addEventListener('dblclick', (evt) => {
            // console.log('dblclick');
            this.$tooltip.detach();
            var up = this.getMousePosition(evt);
            this.onMouseClicked(up);
            this.mouse.down = null;
            this.mouse.position = null;
        }, true);

        this.canvas.addEventListener('touchstart', (evt) => {
            event.preventDefault();
            event.stopPropagation();

            // var touchEvt = this.normalizeTouchPosition(evt.changedTouches[0]);
            // /!*console.log('touchStart', touchEvt);*!/
            // appEvents.emit('graph-hover-clear');
            // this.mouse.position = this.getMousePosition(touchEvt);
            // var info = {
            //     pos: {
            //         pageX: touchEvt.pageX,
            //         pageY: touchEvt.pageY,
            //         x: this.mouse.position.ts,
            //         y: this.mouse.position.y,
            //         panelRelY: this.mouse.position.yRel,
            //         panelRelX: this.mouse.position.xRel
            //     },
            //     evt: touchEvt,
            //     panel: this.panel
            // };
            // appEvents.emit('graph-hover', info);
        }, false);

        // this.canvas.addEventListener('touchmove', (evt) => {
        //  event.preventDefault();
        //  event.stopPropagation();

        //  var touchEvt = this.normalizeTouchPosition(evt.changedTouches[0]);
        //  console.log('touchMove', touchEvt);
        //  appEvents.emit('graph-hover-clear');
        //  this.mouse.position = this.getMousePosition(touchEvt);
        //  var info = {
        //  pos: {
        //  pageX: touchEvt.pageX,
        //  pageY: touchEvt.pageY,
        //  x: this.mouse.position.ts,
        //  y: this.mouse.position.y,
        //  panelRelY: this.mouse.position.yRel,
        //  panelRelX: this.mouse.position.xRel
        //  },
        //  evt: touchEvt,
        //  panel: this.panel
        //  };
        //  appEvents.emit('graph-hover', info);

        //  }, false);

        this.canvas.addEventListener('touchend', (evt) => {
            event.preventDefault();
            event.stopPropagation();

            // this.onRender();
            //  this.$tooltip.detach();
            //  appEvents.emit('graph-hover-clear');
        }, false);



        // global events
        appEvents.on('graph-hover', (event) => {

            // ignore other graph hover events if shared tooltip is disabled
            var isThis = event.panel.id === this.panel.id;
            if (!this.dashboard.sharedTooltipModeEnabled() && !isThis) {
                return;
            }

            // ignore if other panels are fullscreen
            if (this.otherPanelInFullscreenMode()) {
                return;
            }

            // Calculate the mouse position when it came from somewhere else
            if (!isThis) {
                if (!event.pos.x) {
                    return;
                }

                var ts = event.pos.x;
                var rect = this.canvas.getBoundingClientRect();
                var elapsed = parseFloat(this.range.to - this.range.from);
                var x = ((ts - this.range.from) / elapsed) * rect.width;

                this.mouse.position = {
                    x: x,
                    y: event.pos.panelRelY * rect.height,
                    yRel: event.pos.panelRelY,
                    ts: ts,
                    gevt: event
                };
                //console.log( "Calculate mouseInfo", event, this.mouse.position);
            }

            this.onGraphHover(event, isThis || !this.dashboard.sharedCrosshairModeOnly(), !isThis);
        }, scope);

        appEvents.on('graph-hover-clear', (event, info) => {
            this.mouse.position = null;
            this.mouse.down = null;
            //this.render();
            this.$tooltip.detach();
        }, scope);

        // scope.$on('$destroy', () => {
        //   this.$tooltip.destroy();
        //   elem.off();
        //   elem.remove();
        // }); */
    }
}
