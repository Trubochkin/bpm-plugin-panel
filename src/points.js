import _ from 'lodash';

export default class DistinctPoints {
  constructor(dataName/* id */) {
    // this.target = id;
    this.changes = [];
    this.legendInfo = [];
    this.dataName = dataName;
    // last point we added
    this.last = null;
    this.asc = false;
    // console.log('POINTS: ', this);
  }

  // ts: numeric ms,
  // pVal: is the normalized value
  add(pNumVal, ts, pVal, comment, color) {
    if (this.last == null) {
      this.last = {
        pNumVal: +pNumVal,
        pVal,
        start: +ts,
        ms: 0,
        comment,
        color,
      };
      this.changes.push(this.last);
    } else if (ts == this.last.ts) {
      // console.log('skip point with duplicate timestamp', ts, pVal);

    } else {
      if (this.changes.length === 1) {
        this.asc = ts > this.last.start;
      }

      if ((ts > this.last.start) != this.asc) {
        // console.log('skip out of order point', ts, pVal);
        return;
      }

      // Same value
      if (pVal == this.last.pVal) {
        if (!this.asc) {
          this.last.start = ts;
        }
      } else {
        this.last = {
          pNumVal: +pNumVal,
          pVal,
          start: +ts,
          ms: 0,
          comment,
          color,
        };
        this.changes.push(this.last);
      }
    }
  }

  finish(ctrl) {
    if (this.changes.length < 1) {
    //   console.log( "no points found!" );
      /* return; */
    }

    if (!this.asc) {
      const i = 0;
      this.last = this.changes[i];
      _.reverse(this.changes);
    }

    // Add a point beyond the controls
    if (this.last && this.last.start < ctrl.range.to) {
      this.changes.push({
        pVal: this.last.pVal,
        start: ctrl.range.to + 1,
        ms: 0,
      });
    }

    /* console.log('ctrl.panel.legendMaxValues', ctrl.panel.legendMaxValues); */
    this.transitionCount = 0;
    const valToInfo = {};
    // var maxLegendSize = ctrl.panel.legendMaxValues;  // количество значений в легенде
    // if(!maxLegendSize) {
    //     maxLegendSize = 20;
    // }
    let last = this.changes[0];
    for (let i = 1; i < this.changes.length; i += 1) {
      const pt = this.changes[i];

      let s = last.start;
      let e = pt.start;
      if (s < ctrl.range.from) {
        s = ctrl.range.from;
      } else if (s < ctrl.range.to) {
        this.transitionCount += 1;
      }

      if (e > ctrl.range.to) {
        e = ctrl.range.to;
      }

      last.ms = e - s;
      if (last.ms > 0) {
        if (_.has(valToInfo, last.pVal)) {
          const v = valToInfo[last.pVal];
          v.ms += last.ms;
          v.count += 1;
        } else {
          valToInfo[last.pVal] = {
            pVal: last.pVal, ms: last.ms, count: 1, color: last.color, pNumVal: last.pNumVal,
          };
        }
      }
      last = pt;
    }

    const selectedTime = ctrl.range.to - ctrl.range.from;
    this.selectedTime = selectedTime;

    _.forEach(valToInfo, (value, i) => {
      valToInfo[i].per = (value.ms / selectedTime);
      this.legendInfo.push(value);
    });
    this.distinctValuesCount = _.size(this.legendInfo);
  }
}
