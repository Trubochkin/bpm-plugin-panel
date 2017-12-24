import _ from 'lodash';

export default class DistinctPoints {

    constructor(/* id */) {
        // this.target = id;
        this.changes = [];
        this.legendInfo = [];

    // last point we added
        this.last = null;
        this.asc = false;
    }

  // ts: numeric ms,
  // pVal: is the normalized value
    add(pNumVal, ts, pVal, comment, color) {
        if(this.last == null) {
            this.last = {
                pNumVal: +pNumVal,
                pVal: pVal,
                start: +ts,
                ms: 0,
                comment: comment,
                color: color
            };
            this.changes.push(this.last);
        }
        else if(ts == this.last.ts ) {
            console.log('skip point with duplicate timestamp', ts, pVal);
            return;
        }
        else {
            if(this.changes.length === 1) {
                this.asc = ts > this.last.start;
            }

            if( (ts > this.last.start) != this.asc ) {
        // console.log('skip out of order point', ts, pVal);
                return;
            }

      // Same value
            if(pVal == this.last.pVal) {
                if(!this.asc) {
                    this.last.start = ts;
                }
            }
            else {
                this.last = {
                    pNumVal: +pNumVal,
                    pVal: pVal,
                    start: +ts,
                    ms: 0,
                    comment: comment,
                    color: color
                };
                this.changes.push(this.last);
            }
        }
    }

    finish(ctrl) {
        if(this.changes.length<1) {
    //   console.log( "no points found!" );
      /*return;*/
        }

        if(!this.asc) {
            this.last = this.changes[0];
            _.reverse(this.changes);
        }

    // Add a point beyond the controls
        if(this.last && this.last.start < ctrl.range.to) {
            this.changes.push( {
                pVal: this.last.pVal,
                start: ctrl.range.to+1,
                ms: 0
            });
        }

      /*console.log('ctrl.panel.legendMaxValues', ctrl.panel.legendMaxValues);*/
        this.transitionCount = 0;
        var valToInfo = {};
        var lastTS = 0;
        var legendCount = 0;
        var maxLegendSize = ctrl.panel.legendMaxValues;  // количество значений в легенде
        if(!maxLegendSize) {
            maxLegendSize = 20;
        }
        var last = this.changes[0];
        for(var i=1; i<this.changes.length; i++) {
            var pt = this.changes[i];

            var s = last.start;
            var e = pt.start;
            if( s < ctrl.range.from ) {
                s = ctrl.range.from;
            }
            else if(s < ctrl.range.to) {
                this.transitionCount++;
            }

            if( e > ctrl.range.to ) {
                e = ctrl.range.to;
            }

            last.ms = e - s;
            if(last.ms > 0) {
                if(_.has(valToInfo, last.pVal)) {
                    var v = valToInfo[last.pVal];
                    v.ms += last.ms;
                    v.count++;
                }
                else {
                    valToInfo[last.pVal] = { 'pVal': last.pVal, 'ms': last.ms, 'count':1, color: last.color, pNumVal: last.pNumVal};
                    legendCount++;
                }
            }
            last = pt;
        }

        var selectedTime = ctrl.range.to - ctrl.range.from;
        this.selectedTime = selectedTime;

        _.forEach(valToInfo, (value) => {
            value.per = (value.ms/selectedTime);
            this.legendInfo.push( value );
        });
        this.distinctValuesCount = _.size(this.legendInfo);
    /*console.log( "FINISH", valToInfo, this );*/
    }
}
