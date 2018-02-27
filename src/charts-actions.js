import {MetricsPanelCtrl} from 'app/plugins/sdk';
import _ from 'lodash';
// import moment from 'moment';
//import angular from 'angular';
import $ from 'jquery';
import * as d3 from 'd3';
// import * as Chart from './lib/chart/Chart.bundle.min';
// import './lib/chart/chartjs-plugin-stacked100/index';

//import appEvents from 'app/core/app_events';

var canvasID = 1;
var svgID = 1;

// Expects a template with: <div class="canvas-spot"></div>
export class ChartsBuildPanelCtrl extends MetricsPanelCtrl {

    constructor($scope, $injector, $q) {
        super($scope, $injector);

        this.q = $q;
        this.mouse = {
            position: null,
            down: null
        };
        this.canvasID = canvasID++;
        this.svgID = svgID++;
        // this.$tooltip = $('<div id="tooltip.' + canvasID + '" class="graph-tooltip">');
        this.$tooltip = $('<div id="tooltip.' + svgID + '" class="graph-tooltip">');

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
        // console.log("onRefresh()");
        this.clear();
        // this.render();
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
        // console.log('addWrapVis:', targetId);
        var targetName = this.convertIdToName(targetId);
        var wrapVis;
        if (this.panel.ascData) {
            wrapVis = d3.select(this.elements.tags.contentWrap)
                .append('div')
                .attr('class', 'wrap-vis')
                .attr('id', 'p'+ this.panel.id + '-' + targetId); // example ID format: 1.1.1-p3
        } else {
            wrapVis = d3.select(this.elements.tags.contentWrap)
                .insert('div',':first-child')
                .attr('class', 'wrap-vis')
                .attr('id', 'p'+ this.panel.id + '-' + targetId); // example ID format: 1.1.1-p3
        }
            
        // console.log('ChartD3', wrapVis);
        // Multicolored chart title (color setting in CSS)
        var title = wrapVis.append('h3')
            .attr('class', 'wrap-vis-title')
            .style('font-size', this.panel.textSizeTitles+'px');
        title.append('font')
            .html(targetName[0])
            .attr('class', 'city');
        title.append('b').html(' - ');
        title.append('font')
            .html(targetName[1])
            .attr('class', 'line');
        title.append('b').html(' - ');
        title.append('font')
            .html(targetName[2])
            .attr('class', 'counter');
        title.append('b').html(' ');

        var spiner = title.append('span');
        spiner.append('i')
            .attr('class', 'fa fa-spinner fa-spin')
            .style('font-size', '30px')
            .style('font-size', this.panel.textSizeTitles+'px');
        /* var visMessage = wrapVis.append('span');
        visMessage.append('i')
            .attr('class', 'fa fa-spinner fa-spin')
            .style('font-size', '30px');  */
   
        /* visMessage.append('span').attr('class', 'msg-no-data')
         .html(`no data ${targetName}`); */
    }

    chart_removeWrapVis(targetId) {
        var targetIdCorrect = targetId.split('.').join('\\.');  // экранирование точек для корректной выборки
        d3.select(this.elements.tags.contentWrap)
            .select('#p'+this.panel.id+'-'+targetIdCorrect)
            .remove();
        // console.log('Remove-SVG:', targetId);
    }

    // dataLine = [[changes1], [changes2], ...]
    drawCanvas(dataLine) {
        const W = +this.elements.tags.contentWrap.getBoundingClientRect().width;
        const H = +this.panel.svgHeight;
        const dateFrom = this.range.from.clone();
        const dateTo = this.range.to.clone();

        // область визуализации с данными (график)
        const margin = this.elements.sizes.marginAreaVis;
        const widthAreaVis = W - margin.left - margin.right;
        const heightAreaVis = H - margin.top - margin.bottom;
        const heightRowBar = parseInt(heightAreaVis / dataLine.length);

        const xScaleDuration = d3.scaleTime()
            .domain([0, new Date(dateTo).getTime() - new Date(dateFrom).getTime()])
            .range([0, widthAreaVis]);

        const xScaleTime = d3.scaleTime()
            .domain([new Date(dateFrom).getTime(), new Date(dateTo).getTime()])
            .range([0, widthAreaVis]);

        let canvasElement = d3.select(document.createElement('canvas'))
            .attr('width', widthAreaVis)
            .attr('height', heightAreaVis);

        const context = canvasElement.node().getContext('2d');

        // clear canvas
        context.fillStyle = 'rgba(0,0,0, 0)';
        context.rect(0,0,canvasElement.attr('width'),canvasElement.attr('height'));
        context.fill();

        let top = 0;

        _.forEach(dataLine, changes => {
            _.forEach(changes, d => {
                context.beginPath();
                context.fillStyle = d.color;
                context.rect(xScaleTime(d.start) < 0 ? 0 : xScaleTime(d.start), top, xScaleDuration(d.ms), heightRowBar);
                context.fill();
                context.closePath();
            });

            top += heightRowBar;
        });
        return canvasElement;
    }


    cloneCanvas(oldCanvas) {
        //create a new canvas
        var newCanvas = document.createElement('canvas');
        var context = newCanvas.getContext('2d');

        //set dimensions
        newCanvas.width = oldCanvas.width;
        newCanvas.height = oldCanvas.height;
    
        //apply the old canvas to the new one
        context.drawImage(oldCanvas, 0, 0);
    
        //return the new canvas
        return newCanvas;
    }


    chartBuildSvg(data) {
        if (data.counters.length == 0) return;
        const panelId = this.panel.id;
        const dateFrom = this.range.from.clone();
        const dateTo = this.range.to.clone();
        // const dataBars = data.statusLines[0];

        // canvas rendering 
        let renderedCanvasElements = [];    // => [{id: '1.1', el: canvasElement}, ...]
        _.forEach(this.panel.selectedLinesId, id => {
            // filtering by id
            let dataBrands = _.filter(data.brandsLines, dataBrand => {
                return id == dataBrand.targetId;
            })[0].changes;
            // filtering by id
            let dataStatuses = _.filter(data.statusLines, dataStatus => {
                return id == dataStatus.targetId;
            })[0].changes;

            renderedCanvasElements.push({
                lineId: id,
                el: this.drawCanvas([dataBrands, dataStatuses])
                // el: this.drawCanvas([_.map(dataStatuses.map(a => (Object.assign({}, a))), d => _.assign(d, {color: d3.schemeCategory10[Math.round(Math.random() * 10)]})), _.map(dataStatuses.map(a => (Object.assign({}, a))), d => _.assign(d, {color: d3.schemeCategory10[Math.round(Math.random() * 10)]})), _.map(dataStatuses.map(a => (Object.assign({}, a))), d => _.assign(d, {color: d3.schemeCategory10[Math.round(Math.random() * 10)]})), dataStatuses])
            });
        });
        
        // console.log('!!!d3.scaleOrdinal: ', d3.schemeCategory10[1]);
        // width and height of the whole SVG
        const W = +this.elements.tags.contentWrap.getBoundingClientRect().width;
        const H = +this.panel.svgHeight;

        // for the data visualization area
        const margin = this.elements.sizes.marginAreaVis;
        const width = W - margin.left - margin.right;
        const height = H - margin.top - margin.bottom;
        // console.log('WIDTH-GRAPH: ', width);


        //Main Chart Scales
        const xScale = d3.scaleTime()
            .domain([new Date(dateFrom).getTime(), new Date(dateTo).getTime()])
            .rangeRound([0, width]);

        const yScale = d3.scaleLinear()
            // .domain([d3.min(dCounter.datapoints.filter(d => !d.fake), d => d.y), d3.max(dCounter.datapoints, d => d.y)])
            .rangeRound([height, 0]);

        // Chart Axes
        const xAxis = d3.axisBottom()
            .scale(xScale)
            .ticks(Math.round(width / 70));
            // .tickFormat(d3.timeFormat('%H %M'));

        const yAxis = d3.axisLeft()
            .scale(yScale);
            //d3.format(".2s")(42e6);

        // Area of chart
        const area = d3.area()
            .x(d => xScale(d.t))
            .y0(yScale(0))
            .y1(d => yScale(d.y));
            //.curve(d3.curveCatmullRom.alpha(0.3));

        // Line of chart
        const line = d3.line()
            .x(d => xScale(d.t))
            .y(d => yScale(d.y));
            //.curve(d3.curveCatmullRom.alpha(0.5));


        const fKey = function (d) {
            return d ? 'p'+panelId + '-' + d.targetId : this.id; 
        };

        d3.select(this.elements.tags.contentWrap)
            .selectAll('div.wrap-vis')
            .data(data.counters, fKey)
            .each( (dCounter, iCounter, eCounter) => {
                //console.log('D3-each:', e);
                // console.log('FORMAT', /* d3.format('.2f')(1) */ Math.round(3.0 * 100) / 100);
                yScale.domain([d3.min(dCounter.datapoints.filter(d => !d.fake), d => d.y), d3.max(dCounter.datapoints, d => d.y)]);
                
                const wrapVis = d3.select(eCounter[iCounter]);

                // UPDATE

                wrapVis.select('span').classed('loaded', true);     // hide spinner status

                // update the title text
                wrapVis.select('h3')
                    .attr('class', 'wrap-vis-title')
                    .style('font-size', this.panel.textSizeTitles+'px');

                // data binding
                const svgOld = wrapVis.selectAll('.wrap-vis-svg svg')
                    .data([dCounter]);
                
                // update height and width the SVG
                svgOld.attr('height', H)
                    .attr('width', W);

                // update the rectangle of clip-path
                svgOld.select('#p'+panelId+'-vis-clip rect')
                    .attr('width', width)
                    .attr('height', height)
                    .attr('transform', 'translate(1, -1)');

                // update x-axis
                svgOld.select('g.x.axis')
                    .attr('transform', `translate(0, ${height})`)
                    .call(xAxis);

                // update y-axis
                svgOld.select('g.y.axis')
                    .attr('transform', 'translate(0, 0)')
                    .call(yAxis);

                // update area-chart
                svgOld.select('.areaChart path')
                    .attr('d', area(dCounter.datapoints.filter(obj => !obj.fake)));

                // update line-chart
                svgOld.select('.lineChart path')
                    .attr('d', line(dCounter.datapoints.filter(obj => !obj.fake)));

                // update the overlay rectangle for mouse events
                svgOld.selectAll('g rect.overlay')
                    .data([dCounter])
                    .attr('width', width)
                    .attr('height', height);

                // ENTER

                // create SVG element in div wrap
                const svgEl = svgOld.enter()
                    .append('div')
                    .attr('class', 'wrap-vis-svg')
                    .append('svg')
                    .attr('width', W)
                    .attr('height', H);

                // append g element for all svg content (g элементы не имеют размеров)
                const gSvg = svgEl.append('g')
                    .attr('transform', `translate(${margin.left},${margin.top})`);

                // append clip-path rectangle
                gSvg.append('clipPath')
                    .attr('id', 'p'+panelId+'-vis-clip')
                    .append('rect')
                    .attr('width', width)
                    .attr('height', height)
                    .attr('transform', 'translate(1, -1)');
                // append x-axis
                gSvg.append('g')
                    .classed('x axis', true)
                    .attr('transform', `translate(0, ${height})`)
                    .call(xAxis);

                // append y-axis
                gSvg.append('g')
                    .classed('y axis', true)
                    .attr('transform', 'translate(0, 0)')
                    .call(yAxis);

                // clear background CANVAS chart
                wrapVis.selectAll('canvas')
                    .remove();

                // clone and append the background CANVAS chart
                const heightWrapVisTitle = $(wrapVis.select('.wrap-vis-title').node()).outerHeight(true);
                const canvasOrigEl = renderedCanvasElements[0].el.node();
                const canvasCopy = d3.select(this.cloneCanvas(canvasOrigEl))
                    .style('margin-left', margin.left + 'px')
                    .style('margin-top', margin.top + heightWrapVisTitle + 'px')
                    .style('opacity', '0.3')
                    .node();
                const wrapEl = wrapVis.node();
                wrapEl.insertBefore(canvasCopy, wrapEl.children[0]);

    
                // append AREA chart
                gSvg.append('g')
                    .attr('clip-path', 'url(#p'+panelId+'-vis-clip)')
                    .attr('class', 'areaChart')
                    .append('path')
                    .attr('d', area(dCounter.datapoints.filter(obj => !obj.fake)))
                    .style('fill', 'blue')
                    .style('fill-opacity', 0.3);
        
                // append LINE chart
                gSvg.append('g')
                    .attr('clip-path', 'url(#p'+panelId+'-vis-clip)')
                    .attr('class', 'lineChart')
                    .append('path')
                    .attr('d', line(dCounter.datapoints.filter(obj => !obj.fake)))
                    .style('stroke', 'rgba(0, 80, 255, 0.4)')
                    .style('stroke-width', 2)
                    .style('fill-opacity', 0);


                // append group for tooltip elements
                const gTooltip = gSvg.append('g')
                    .attr('class', 'g-tooltip')
                    .style('display', 'none');

                // append a vertical line
                gTooltip.append('line')
                    .attr('class', 'tooltip-line');

                // append a point circle
                const tooltipPoint = gTooltip.append('g')
                    .attr('class',  'tooltip-point');
                tooltipPoint.append('circle')
                    .attr('r', 6);
                tooltipPoint.append('text')             // !!!!!!! заменить на DIV
                    .attr('x', 15)
                    .attr('dy', '.31em');
                
                // append an overlay rectangle for mouse events
                gSvg.selectAll('g rect.overlay')
                    .data([dCounter])
                    .enter().append('rect')
                    .attr('class', 'overlay')
                    .attr('width', width)
                    .attr('height', height)
                    .style('pointer-events', 'all')
                    .style('fill', 'none')
                    .on('mouseover', () => gTooltip.style('display', null))
                    .on('mouseout', () => gTooltip.style('display', 'none'))
                    .on('mousemove', (dataC, indx, el) => {
                        // console.log('event', data);
                        const dateFrom = this.range.from.clone();
                        const dateTo = this.range.to.clone();
                        
                        const parentRect = d3.select(el[indx].parentNode);
                        const rectEl = el[indx];
                        const rectHeight = d3.select(rectEl).attr('height');
                        const rectWidth = d3.select(rectEl).attr('width');
    
                        const bisectDate = d3.bisector(d => d.t).left;
                        
                        const xScaleEvt = d3.scaleTime()
                            .domain([new Date(dateFrom).getTime(), new Date(dateTo).getTime()])
                            .rangeRound([0, rectWidth]);
    
                        const yScaleEvt = d3.scaleLinear()
                            .domain([d3.min(dataC.datapoints.filter(d => !d.fake), d => d.y), d3.max(dataC.datapoints, d => d.y)])
                            .rangeRound([rectHeight, 0]);
    
                        const data = dataC.datapoints;
                        
                        const x0 = xScaleEvt.invert(d3.mouse(rectEl)[0]),
                            i = bisectDate(data, x0, 1),
                            d0 = data[i - 1],
                            d1 = data[i];
                            //d = { 't': 0, 'v': 0 };
    
                        if (d0 && d1) {
                            const dPoint = x0 - d0.t > d1.t - x0 ? d1 : d0;
                            parentRect.select('.tooltip-point').select('circle')
                                .attr('transform', 'translate(' + xScaleEvt(dPoint.t) + ',' + yScaleEvt(dPoint.y) + ')');
                            parentRect.select('.tooltip-point').select('text')
                                .text(function() { return dPoint.y; })
                                .attr('x', d3.mouse(rectEl)[0]+15)
                                .attr('y', d3.mouse(rectEl)[1]);

                            parentRect.select('.g-tooltip .tooltip-line')
                                .attr('x1', xScaleEvt(dPoint.t))
                                .attr('y1', 0)
                                .attr('x2', xScaleEvt(dPoint.t))
                                .attr('y2', rectHeight);
                        }
                    });
            });
    }

    link(/*scope, elem , attrs, ctrl */) {

        /* this.chartContainer = elem.find('.chart-container')[0];
        this.canvasElem = document.createElement('canvas');
        $(this.canvasElem).prop('id', 'myChart');
        $(this.canvasElem).css('cursor', 'pointer');
        this.chartContainer.appendChild(this.canvasElem);
        
        $(this.chartContainer).css('width', '100%');
        //$(this.chartContainer).css('max-height', '250px');
        this.context2d = this.canvasElem.getContext('2d'); */

        //this.wrapAllVis = elem.find('#wrap-container-'+this.panel.id);
        
        //this.wrapAllVis = $('#wrap-container-'+this.panel.id);
        //console.log('link-function', elem.find('#wrap-container-'+scope.ctrl.panel.id));

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
