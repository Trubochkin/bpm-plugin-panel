import { MetricsPanelCtrl } from 'app/plugins/sdk';   // eslint-disable-line
import _ from 'lodash';
// import moment from 'moment';
// import angular from 'angular';
import $ from 'jquery';                               // eslint-disable-line
import * as d3 from 'd3';                             // eslint-disable-line
import appEvents from 'app/core/app_events';          // eslint-disable-line

const svgID = 1;

// Expects a template with: <div class="canvas-spot"></div>
export default class ChartsBuildPanelCtrl extends MetricsPanelCtrl {
  constructor($scope, $injector, $q) {
    super($scope, $injector);
    this.q = $q;
    this.mouse = {
      position: null,
      down: null,
    };
    this.svgID = svgID + 1;
    // this.$tooltip = $('<div id="tooltip.' + canvasID + '" class="graph-tooltip">');
    this.$tooltip = $(`<div id="tooltip.${svgID}" class="graph-tooltip">`);

    this.events.on('panel-initialized', this.onPanelInitalized.bind(this));
    this.events.on('refresh', this.onRefresh.bind(this));
    // this.events.on('render', this.onRender.bind(this)); console.log('$tooltip: ',
    // this.$tooltip)
  }

  onPanelInitalized() {
    // console.log("onPanelInitalized()");
    // this.render();
    return this;
  }

  onRefresh() {
    // console.log("onRefresh()");
    this.clear();
    // this.render();
  }

  clearTT() {
    this.$tooltip.detach();
  }

  static normalizeTouchPosition(evt) {
    const position = evt;
    position.offsetX = evt.pageX;
    position.offsetY = evt.pageY;
    let parent = evt.target;
    while (parent.offsetParent) {
      position.offsetX -= parent.offsetLeft - parent.scrollLeft;
      position.offsetY -= parent.offsetTop - parent.scrollTop;
      parent = parent.offsetParent;
    }
    return position;
  }

  getMousePosition(evt) {
    // console.log('GET-MOUSE-POS', evt.currentTarget.getBoundingClientRect(),  evt);
    const elapsed = this.range.to - this.range.from;
    const rect = evt.currentTarget.getBoundingClientRect();
    const x = evt.offsetX; // - rect.left;
    const ts = this.range.from + (elapsed * (x / parseFloat(rect.right - rect.left)));
    const y = evt.clientY - rect.top; // положение курсора по оси Y относительно елемента

    return {
      x,
      y,
      yRel: y / parseFloat(rect.height), // значение по Y от 0 до 1
      ts,
      evt,
    };
  }

  // onMouseClicked(/* where */) {
  //   // console.log("CANVAS CLICKED", where);
  //   this.render();
  // }

  onMouseSelectedRange(range) {
    this.timeSrv.setTime(range);
    this.clear();
  }

  chartAddWrapVis(targetId) {
    // console.log('addWrapVis:', targetId);
    const targetName = this.convertIdToName(targetId);
    let wrapVis;
    if (this.panel.ascData) {
      wrapVis = d3.select(this.elements.$tags.contentWrap)
        .append('div')
        .attr('class', 'wrap-vis')
        .attr('id', `p${this.panel.id}-${targetId}`); // example ID format: 1.1.1-p3
    } else {
      wrapVis = d3.select(this.elements.$tags.contentWrap)
        .insert('div', ':first-child')
        .attr('class', 'wrap-vis')
        .attr('id', `p${this.panel.id}-${targetId}`); // example ID format: 1.1.1-p3
    }

    // console.log('ChartD3', wrapVis);
    // Multicolored chart title (color setting in CSS)
    const title = wrapVis.append('div')
      .attr('class', 'wrap-vis-title');
    title.append('span')
      .html(targetName[0])
      .attr('class', 'city')
      .style('font-size', `${this.panel.textSizeTitles}px`);
    title.append('span').attr('class', 'title-separator').html('-');
    title.append('span')
      .html(targetName[1])
      .attr('class', 'line')
      .style('font-size', `${this.panel.textSizeTitles}px`);
    title.append('span').attr('class', 'title-separator').html('-');
    title.append('span')
      .html(targetName[2])
      .attr('class', 'counter')
      .style('font-size', `${this.panel.textSizeTitles}px`);

    title.append('i')
      .attr('class', 'fa fa-spinner fa-spin')
      .style('font-size', `${this.panel.textSizeTitles}px`)
      .style('margin-left', `${10}px`);
    /* var visMessage = wrapVis.append('span');
        visMessage.append('i')
            .attr('class', 'fa fa-spinner fa-spin')
            .style('font-size', '30px');  */

    /* visMessage.append('span').attr('class', 'msg-no-data')
         .html(`no data ${targetName}`); */
  }

  chartRemoveWrapVis(targetId) {
    const targetIdCorrect = targetId.split('.').join('\\.'); // экранирование точек для корректной выборки
    d3.select(this.elements.$tags.contentWrap)
      .select(`#p${this.panel.id}-${targetIdCorrect}`)
      .remove();
    // console.log('Remove-SVG:', targetId);
  }

  // dataLine = [[changes1], [changes2], ...]
  drawCanvas(dataLine) {
    const W = +this.elements.$tags.contentWrap.getBoundingClientRect().width;
    const H = +this.panel.svgHeight;
    const dateFrom = this.range.from.clone();
    const dateTo = this.range.to.clone();

    // область визуализации с данными (график)
    const margin = this.elements.sizes.marginAreaVis;
    const widthAreaVis = W - margin.left - margin.right;
    const heightAreaVis = H - margin.top - margin.bottom;
    const heightRowBar = parseInt(heightAreaVis / dataLine.length, 10);

    const xScaleDuration = d3.scaleTime()
      .domain([0, new Date(dateTo).getTime() - new Date(dateFrom).getTime()])
      .range([0, widthAreaVis]);

    const xScaleTime = d3.scaleTime()
      .domain([new Date(dateFrom).getTime(), new Date(dateTo).getTime()])
      .range([0, widthAreaVis]);

    const canvasElement = d3.select(document.createElement('canvas'))
      .attr('width', widthAreaVis)
      .attr('height', heightAreaVis);

    const context = canvasElement.node().getContext('2d');

    // clear canvas
    context.fillStyle = 'rgba(0,0,0, 0)';
    context.rect(0, 0, canvasElement.attr('width'), canvasElement.attr('height'));
    context.fill();

    let top = 0;

    _.forEach(dataLine, (changes) => {
      _.forEach(changes, (d) => {
        context.beginPath();
        context.fillStyle = d.color;
        context.rect(
          xScaleTime(d.start) < 0 ? 0 : xScaleTime(d.start),
          top, xScaleDuration(d.ms),
          heightRowBar,
        );
        context.fill();
        context.closePath();
      });

      top += heightRowBar;
    });
    return canvasElement;
  }

  cloneCanvas(oldCanvas) {
    // create a new canvas
    const newCanvas = document.createElement('canvas');
    const context = newCanvas.getContext('2d');

    // set dimensions
    newCanvas.width = oldCanvas.width;
    newCanvas.height = oldCanvas.height;

    // apply the old canvas to the new one
    context.drawImage(oldCanvas, 0, 0);

    this.elements.$tags.lastCanvasSource = newCanvas;
    // return the new canvas
    return newCanvas;
  }

  chartBuildSvg(data) {
    if (data.counters.length === 0) return;
    const panelId = this.panel.id;
    const dateFrom = this.range.from.clone();
    const dateTo = this.range.to.clone();
    // const dataBars = data.statusLines[0];

    // canvas rendering
    const renderedCanvasElements = []; // => [{id: '1.1', el: canvasElement}, ...]
    _.forEach(this.panel.selectedLinesId, (id) => {
      // filtering by id
      const dataBrands = _.filter(data.brandsLines, (dataBrand) => {
        const eq = id === dataBrand.targetId;
        return eq;
      })[0].changes;
      // filtering by id
      const dataStatuses = _.filter(data.statusLines, (dataStatus) => {
        const eq = id === dataStatus.targetId;
        return eq;
      })[0].changes;

      renderedCanvasElements.push({
        lineId: id,
        el: this.drawCanvas([dataBrands, dataStatuses]),
      });
    });

    // console.log('!!!d3.scaleOrdinal: ', d3.schemeCategory10[1]);
    // width and height of the whole SVG
    const W = +this.elements.$tags.contentWrap.getBoundingClientRect().width;
    const H = +this.panel.svgHeight;

    // for the data visualization area
    const margin = this.elements.sizes.marginAreaVis;
    const width = W - margin.left - margin.right;
    const height = H - margin.top - margin.bottom;
    // console.log('WIDTH-GRAPH: ', width);


    // Main Chart Scales
    const xScale = d3.scaleTime()
      .domain([new Date(dateFrom).getTime(), new Date(dateTo).getTime()])
      .rangeRound([0, width]);

    const yScale = d3.scaleLinear()
      .rangeRound([height, 0]);

    // Chart Axes
    const xAxis = d3.axisBottom()
      .scale(xScale)
      .ticks(Math.round(width / 70));
    // .tickFormat(d3.timeFormat('%H %M'));

    const yAxis = d3.axisLeft()
      .scale(yScale);
    // d3.format(".2s")(42e6);

    // Area of chart
    const area = d3.area()
      .x(d => xScale(d.t))
      .y0(yScale(0))
      .y1(d => yScale(d.y));
    // .curve(d3.curveCatmullRom.alpha(0.3));

    // Line of chart
    const line = d3.line()
      .x(d => xScale(d.t))
      .y(d => yScale(d.y));
    // .curve(d3.curveCatmullRom.alpha(0.5));


    function fKey(d) {
      return d ? `p${panelId}-${d.targetId}` : this.id;
    }

    d3.select(this.elements.$tags.contentWrap)
      .selectAll('div.wrap-vis')
      .data(data.counters, fKey)
      .each((dCounter, iCounter, eCounter) => {
        // console.log('D3-each:', e);
        // console.log('FORMAT', /* d3.format('.2f')(1) */ Math.round(3.0 * 100) / 100);
        yScale.domain([
          d3.min(dCounter.datapoints.filter(d => !d.fake), d => d.y),
          d3.max(dCounter.datapoints, d => d.y),
        ]);

        const wrapVis = d3.select(eCounter[iCounter]);

        // UPDATE

        // update spinner status
        wrapVis.select('i')
          .classed('loaded', true)
          .style('font-size', `${this.panel.textSizeTitles}px`);

        // update the title text
        wrapVis.select('div .wrap-vis-title')
          .selectAll('span')
          .style('font-size', `${this.panel.textSizeTitles}px`);

        // data binding
        const svgOld = wrapVis.selectAll('.wrap-vis-svg svg')
          .data([dCounter]);

        // update height and width the SVG
        svgOld.attr('height', H)
          .attr('width', W);

        // update the rectangle of clip-path
        svgOld.select(`#p${panelId}-vis-clip rect`)
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
          .attr('id', `p${panelId}-vis-clip`)
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
          .style('margin-left', `${margin.left}px`)
          .style('margin-top', `${margin.top + heightWrapVisTitle}px`)
          .style('opacity', '0.3')
          .node();
        const wrapEl = wrapVis.node();
        wrapEl.insertBefore(canvasCopy, wrapEl.children[0]);


        // append AREA chart
        gSvg.append('g')
          .attr('clip-path', `url(#p${panelId}-vis-clip)`)
          .attr('class', 'areaChart')
          .append('path')
          .attr('d', area(dCounter.datapoints.filter(obj => !obj.fake)))
          .style('fill', 'blue')
          .style('fill-opacity', 0.3);

        // append LINE chart
        gSvg.append('g')
          .attr('clip-path', `url(#p${panelId}-vis-clip)`)
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
          .attr('class', 'tooltip-point');
        tooltipPoint.append('circle')
          .attr('r', 6);
        tooltipPoint.append('text') // !!!!!!! заменить на DIV
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
          .on('mouseover', () => {
            gTooltip.style('display', null);
          })
          .on('mouseout', () => {
            gTooltip.style('display', 'none');
            appEvents.emit('graph-hover-clear');
          })
          .on('mousemove', (dataC, indx, el) => {
            // console.log('event', d3.event);
            const dateFromE = this.range.from.clone();
            const dateToE = this.range.to.clone();
            const gSvgE = d3.select(el[indx].parentNode);
            const rectEl = el[indx];
            const rectHeight = d3.select(rectEl).attr('height');
            const rectWidth = d3.select(rectEl).attr('width');

            const bisectDate = d3.bisector(d => d.t).left;

            const xScaleEvt = d3.scaleTime()
              .domain([new Date(dateFromE).getTime(), new Date(dateToE).getTime()])
              .rangeRound([0, rectWidth]);

            const yScaleEvt = d3.scaleLinear()
              .domain([
                d3.min(dataC.datapoints.filter(d => !d.fake), d => d.y),
                d3.max(dataC.datapoints, d => d.y),
              ])
              .rangeRound([rectHeight, 0]);

            const dataE = dataC.datapoints;
            const x0 = xScaleEvt.invert(d3.mouse(rectEl)[0]);
            const i = bisectDate(dataE, x0, 1);
            const d0 = dataE[i - 1];
            const d1 = dataE[i];

            if (d0 && d1) {
              const dPoint = x0 - d0.t > d1.t - x0 ? d1 : d0;
              gSvgE.select('.tooltip-point').select('circle')
                .attr('transform', `translate(${xScaleEvt(dPoint.t)},${yScaleEvt(dPoint.y)})`);

              gSvgE.select('.tooltip-point').select('text')
                .text(() => dPoint.y)
                .attr('x', d3.mouse(rectEl)[0] + 15)
                .attr('y', d3.mouse(rectEl)[1]);

              gSvgE.select('.g-tooltip .tooltip-line')
                .attr('x1', xScaleEvt(dPoint.t))
                .attr('y1', 0)
                .attr('x2', xScaleEvt(dPoint.t))
                .attr('y2', rectHeight);
            }

            // create and add tooltip
            this.mouse.position = this.getMousePosition(d3.event);
            const info = {
              pos: {
                pageX: d3.event.pageX,
                pageY: d3.event.pageY,
                x: x0,
                y: d3.mouse(rectEl)[1],
                panelRelY: this.mouse.position.yRel,
                // panelRelX: this.mouse.position.xRel
              },
              evt: d3.event,
              panel: this.panel,
            };

            appEvents.emit('graph-hover', info);

            const pageX = d3.mouse(d3.select('body').node())[0];
            const pageY = d3.mouse(d3.select('body').node())[1];

            this.$tooltip.html('<span>TOOLTIP</span>').place_tt(pageX + 20, pageY + 5);
          });
      });
  }

  //------------------
  // Mouse Events
  //------------------

  showTooltip(evt, point, isExternal) {
    /* console.log("showTooltip - point.val", point.val); */
    let from = point.start;
    let to = point.start + point.ms;
    let time = point.ms;  // eslint-disable-line
    let { val } = point;

    if (this.mouse.down != null) {
      from = Math.min(this.mouse.down.ts, this.mouse.position.ts);
      to = Math.max(this.mouse.down.ts, this.mouse.position.ts);
      time = to - from;
      val = 'Zoom To:';
    }

    let body = '<div>';
    body += `<div style="background-color:${this.getColor(point)}; width:10px; height:10px; display:inline-block;"></div>`
          + `<b>${val}</b></br>`;

    body += `<b style="display: inline-block; width: 40px">From: </b> ${this.dashboard.formatDate(null/* moment(from) */)} <br/>`;
    body += `<b style="display: inline-block; width: 40px">To: </b> ${this.dashboard.formatDate(null/* moment(to) */)} <br/>`;
    body += `<b>Duration: </b> ${null/* moment.duration(time).humanize() */} </br>`;
    body += `<div style="padding:0px 5px; margin:0px; background-color:#00fff0; color:#000"><b> ${point.comment} </b></div>`;
    body += '</div>';

    let pageX = 0;
    let pageY = 0;
    if (isExternal) {
      const rect = this.canvas.getBoundingClientRect();
      pageY = rect.top + (evt.pos.panelRelY * rect.height);
      if (pageY < 0 || pageY > $(window).innerHeight()) {
        // Skip Hidden tooltip
        this.$tooltip.detach();
        return;
      }
      pageY += $(window).scrollTop();

      const elapsed = this.range.to - this.range.from;
      const pX = (evt.pos.x - this.range.from) / elapsed;
      pageX = rect.left + (pX * rect.width);
    } else {
      pageX = evt.evt.pageX;  // eslint-disable-line
      pageY = evt.evt.pageY;  // eslint-disable-line
    }
    this.$tooltip.html(body).place_tt(pageX + 20, pageY + 5);
  }

  binSearchIndexPoint(arrChanges, mouseTimePosition) {
    if ((arrChanges.length === 0)
      || (mouseTimePosition < arrChanges[0].start)
      || (mouseTimePosition > arrChanges[arrChanges.length - 1].start)) {
      return null;
    }

    let first = 0;
    let last = arrChanges.length;
    // Если просматриваемый участок не пуст, first < last
    while (first < last) {
      const mid = Math.floor(first + ((last - first) / 2));
      if (mouseTimePosition <= arrChanges[mid].start) last = mid;
      else first = mid + 1;
    }
    // Теперь last может указывать на искомый элемент массива.
    if (arrChanges[last].start >= mouseTimePosition) return last - 1;

    return this;
  }

  onGraphHover(evt, showTT, isExternal) {
    /* console.log( 'onGraphHover-evt', evt); */
    this.externalPT = false;
    if (this.data) {
      let hover = null;
      let j = Math.floor(this.mouse.position.y / this.panel.rowHeight);
      if (j < 0) {
        j = 0;
      }

      if (j >= this.data.length) {
        j = this.data.length - 1;
      }

      hover = this.data[j].changes[0];  // eslint-disable-line

      // Линейный поиск (менее быстрый)
      for (let i = 0; i < this.data[j].changes.length; i += 1) {
        if (this.data[j].changes[i].start > this.mouse.position.ts) {
          break;
        }
        hover = this.data[j].changes[i];
      }

      // Бинарный поиск (более быстрый)
      const i = this.binSearchIndexPoint(this.data[j].changes, this.mouse.position.ts);
      if (i) {
        hover = this.data[j].changes[i];
      }
      this.hoverPoint = hover;

      if (showTT) {
        this.externalPT = isExternal;
        this.showTooltip(evt, hover, isExternal);
      }

      /* var time = performance.now(); */
      this.render(); // refresh the view
      /* time = performance.now() - time;
             console.log('Время выполнения onRender = ', time); */
    } else {
      this.$tooltip.detach(); // make sure it is hidden
    }
  }


  link(scope/* , elem, attrs, ctrl */) {
    // global events
    appEvents.on('graph-hover', (event) => {
      // console.log('Calculate mouseInfo', event, this.dashboard.sharedCrosshairModeOnly());
      // ignore other graph hover events if shared tooltip is disabled
      const isThis = event.panel.id === this.panel.id;
      if (/* !this.dashboard.sharedTooltipModeEnabled() && */ !isThis) { // without any shared
        return;
      }

      // ignore if other panels are fullscreen
      if (this.otherPanelInFullscreenMode()) {
        return;
      }

      // Calculate the mouse position when it came from somewhere else
      /* if (!isThis) {
                if (!event.pos.x) {
                    return;
                }

                var ts = event.pos.x;
                var rect = this.elements.$tags.contentWrap.getBoundingClientRect();
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
            } */

      // this.onGraphHover(event, isThis || !this.dashboard.sharedCrosshairModeOnly(), !isThis);
    }, scope);

    appEvents.on('graph-hover-clear', (/* event, info */) => {
      this.mouse.position = null;
      this.mouse.down = null;
      // this.render();
      this.$tooltip.detach();
    }, scope);
  }
}
