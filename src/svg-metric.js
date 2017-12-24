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
        // console.log("onPanelInitalized()");
        // this.render();
    }

    onRefresh() {
        //console.log("onRefresh()");
        this.clear();
        //this.render();
    }

    clearTT() {
        this.$tooltip.detach();
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

    onMouseClicked(/* where */) {
        // console.log("CANVAS CLICKED", where);
        this.render();
    }

    /*onMouseSelectedRange(range) {
     console.log( "CANVAS Range", range );
    }*/

    chart_addWrapVis(targetId) {
        // console.log('ChartD3-this:', this);
        // var targetName = this.convertIdToName(targetId);
        var wrapVis = d3.select(this.wrapAllVis)
            .append('div')
            .attr('id', 'target-'+targetId)
            .attr('class', 'wrap-vis')
            //.attr('width', '100%')
            //.style('font-size', this.panel.textSize+'px')
            .style('line-height', this.panel.rowHeight+'px');
            // .style('text-align', 'center')
            //.style('background', () => this.lightTheme ? '#f8f8f8' : '#292929');
            
        // console.log('ChartD3', wrapVis);
        var visMessage = wrapVis.append('span');
        visMessage.append('i')
            .attr('class', 'fa fa-spinner fa-spin')
            .style('font-size', '30px');
        /* visMessage.append('span').attr('class', 'msg-no-data')
         .html(`no data ${targetName}`); */
    }

    chart_removeWrapVis(targetId) {
        var targetIdCorrect = targetId.split('.').join('\\.');  // экранирование точек для корректной выборки
        d3.select(this.wrapAllVis)
            .select('#target-'+targetIdCorrect)
            .remove();
        // console.log('Remove-SVG:', targetId)
    }

    chartBuildSvg(data) {
        // ширина и высота всей области SVG
        const W = this.wrapAllVis.getBoundingClientRect().width,
            H = this.panel.rowHeight;

        // область визуализации с данными (график)
        const margin = { top: 5, right: 20, bottom: 20, left: 40 };
        const width = +W - margin.left - margin.right;
        const height = +H - margin.top - margin.bottom;

        let bisectDate = d3.bisector(d => d.t).left;
        // console.log('FORMAT', /* d3.format('.2f')(1) */ Math.round(3.0 * 100) / 100);

        $(this.wrapAllVis).empty();

        _.forEach(this.panel.selectedCountersId, (targetId, i) => {
            // console.log('ON-RENDERdata', data);
            const dataNorm = data.counters[i].datapoints;
            // console.log('dataNorm', dataNorm);
            const dataExtent = d3.extent(dataNorm, d => d.t);   // [min, max]
            //Main Chart Scales
            const xScale = d3.scaleTime()
                .domain(dataExtent)
                .rangeRound([0, width]);

            const yScale = d3.scaleLinear()
                .domain([d3.min(_.filter(dataNorm, obj => !obj.fake), d => d.v), d3.max(dataNorm, d => d.v)])
                .rangeRound([height, 0]);
            
            // Chart Axes
            const xAxis = d3.axisBottom()
                .scale(xScale)
                .ticks(Math.round(width / 70))
                .tickFormat(d3.timeFormat('%H %M'));

            const yAxis = d3.axisLeft()
                .scale(yScale);
                //d3.format(".2s")(42e6);

            // Area of chart
            const area = d3.area()
                .x(d => xScale(d.t))
                .y0(yScale(0))
                .y1(d => yScale(d.v));
                //.curve(d3.curveCatmullRom.alpha(0.3));

            // Line of chart
            const line = d3.line()
                .x(d => xScale(d.t))
                .y(d => yScale(d.v));
                //.curve(d3.curveCatmullRom.alpha(0.5));
            
            // var targetIdCorrect = targetId.split('.').join('\\.');  // экранирование точек для корректной выборки
            const wrapVis = d3.select(this.wrapAllVis)
                .append('div')
                .attr('id', 'target-'+targetId)
                .attr('class', 'wrap-vis');
            wrapVis.append('h3')
                .attr('class', 'title-wrap-vis')
                .html(this.convertIdToName(targetId))
                .style('font-size', this.panel.textSizeTitles+'px');
                //.style('background', () => this.lightTheme ? '#f8f8f8' : '#292929')
                //.append('text')
                
            const svg = wrapVis.append('svg')
                .attr('height', H)
                .attr('width', W)
                .attr('class', 'svg-area');
                // вставка группы для всего визуального содержимого (note: g elements do NOT have dimensions)
            const svgVis = svg.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);
                // .attr('transform', `translate(${margin.left}, ${margin.top})`);

            // Вставка прямоугольника видимости графика
            svgVis.append('clipPath')
                .attr('id', 'vis-clip')
                .append('rect')
                .attr('width', width)
                .attr('height', height)
                .attr('transform', 'translate(1, -1)');

            // Вставка оси X
            svgVis.append('g')
                .classed('x axis', true)
                .attr('transform', `translate(0, ${height})`)
                .call(xAxis);
    
            // Вставка оси Y
            svgVis.append('g')
                .classed('y axis', true)
                .attr('transform', 'translate(0, 0)')
                .call(yAxis);

            // Вставка области заливки графика
            svgVis.append('g')
                .attr('clip-path', 'url(#vis-clip)') // задание области видимости
                .attr('class', 'areaChart')
                .append('path')
                .datum(dataNorm.filter(obj => !obj.fake))
                .style('fill', 'blue')
                .style('fill-opacity', 1)
                .attr('d', area(dataNorm.filter(obj => !obj.fake)));
                // .attr('stroke-width', '2px')
                // .attr('stroke', '#1400C7')
                //.attr('transform', `translate(${margin.left}, ${margin.top})`);
            
            // Вставка линии графика
            svgVis.append('g')
                .attr('clip-path', 'url(#vis-clip)') // задание области видимости
                .attr('class', 'lineChart')
                .append('path')
                .attr('d', line(dataNorm.filter(obj => !obj.fake)))
                .style('stroke', '#006cd1')
                .style('stroke-width', 1)
                .style('fill-opacity', 0);

            // Отображение tooltip и линии при наведении на график
            const focus = svgVis.append('g')
                .attr('class', 'focus')
                .style('display', 'none');
        
            const focusLine = focus.append('g')
                .attr('class', 'focus-line');

            focusLine.append('line')
                .attr('class', 'x-hover-line hover-line')
                .attr('y1', 0)
                .attr('y2', height);
        
            focusLine.append('line')
                .attr('class', 'y-hover-line hover-line')
                .attr('x1', width)
                .attr('x2', width);
        
            const focusPoint = focus.append('g')
                .attr('class',  'focus-point');

            focusPoint.append('circle')
                .attr('r', 7.5);
        
            focusPoint.append('text')
                .attr('x', 15)
                .attr('dy', '.31em');
            
            svgVis.append('rect')
                .attr('class', 'overlay')
                .attr('width', width)
                .attr('height', height)
                .style('pointer-events', 'all')
                .style('fill', 'none')
                .on('mouseover', () => focus.style('display', null))
                .on('mouseout', () => focus.style('display', 'none'))
                .on('mousemove', mousemove);

            function mousemove() {
                let data = dataNorm.filter(obj => !obj.fake);
                
                let x0 = xScale.invert(d3.mouse(this)[0]),
                    i = bisectDate(data, x0, 1),
                    d0 = data[i - 1],
                    d1 = data[i];
                    //d = { 't': 0, 'v': 0 };

                if (d0 && d1) {
                    var d = x0 - d0.t > d1.t - x0 ? d1 : d0;
                    focusPoint.select('circle').attr('transform', 'translate(' + xScale(d.t) + ',' + yScale(d.v) + ')');
                    focusPoint.select('text')
                        .text(function() { return d.v; })
                        .attr('x', d3.mouse(this)[0]+15)
                        .attr('y', d3.mouse(this)[1]);
                    // focus.select('.x-hover-line').attr('y2', height - yScale(d.v));
                    focusLine.attr('transform', 'translate(' + xScale(d.t) + ', 0)');
                    focusLine.select('.y-hover-line').attr('x2', width + width);
                }

                
            }
        });
    }

    

    link(scope, elem/* , attrs, ctrl */) {
        // console.log('panel-canvasMetric-link-elem', elem);
        this.wrapAllVis = elem.find('.wrap-all-vis')[0];
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
