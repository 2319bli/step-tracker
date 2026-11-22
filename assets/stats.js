// Calendar calculations use UTC dates so BST changes never affect day differences.
const StepStats = (() => {
  const nf = new Intl.NumberFormat('en-GB');
  const fmt = n => nf.format(Math.round(n));
  const parse = d => new Date(d + 'T00:00:00Z');
  const iso = d => d.toISOString().slice(0, 10);
  const add = (d, n) => iso(new Date(+parse(d) + n * 86400000));
  const dayOf = d => Number(d.slice(8));
  const monthOf = d => d.slice(0, 7);
  const lastDay = m => new Date(Date.UTC(+m.slice(0,4), +m.slice(5,7), 0)).getUTCDate();
  const dayIn = (m, n) => m + '-' + String(n).padStart(2, '0');
  const formats=new Map();
  const show=(date,options)=>{
    const key=JSON.stringify(options);
    if(!formats.has(key))formats.set(key,new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',...options}));
    return formats.get(key).format(parse(date));
  };
  const dateName = d => show(d, {day:'numeric',month:'short',year:'numeric'});
  const monthName = (m, short=false) => show(m+'-01', {month:short?'short':'long',year:'numeric'});
  const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const sum = rows => rows.reduce((s,r)=>s+r.steps,0);
  function analyse(raw) {
    const byMonth = new Map(), records = Array.from({length:31},()=>[]), rows = [];
    const monthsums = new Map();
    const streaks = [5000,10000,15000,20000,25000].map(threshold=>({
      threshold, run:0, start:null, longest:0, ranges:[]
    }));
    let high=-1, prev=null, newestDateRecord=null;
    for (const date of Object.keys(raw).sort()) {
      const steps=raw[date], m=monthOf(date);
      if (!byMonth.has(m)) {byMonth.set(m,[]);monthsums.set(m,0);}
      const group=byMonth.get(m), total=monthsums.get(m)+steps;
      monthsums.set(m,total);
      const average=Math.round(total/(group.length+1));
      const row={date,steps,average,historical:steps>high};
      high=Math.max(high,steps);
      rows.push(row);group.push(row);
      const winners=records[dayOf(date)-1];
      if (!winners.length || steps>winners[0].steps) {
        winners.splice(0,winners.length,row);
        newestDateRecord=date;
      }
      else if (steps===winners[0].steps) winners.push(row);
      const consecutive=prev!==null && add(prev,1)===date;
      for (const streak of streaks) {
        if (!consecutive || steps<streak.threshold) streak.run=0;
        if (steps<streak.threshold) continue;
        if (streak.run===0) streak.start=date;
        streak.run++;
        if (streak.run<streak.longest) continue;
        if (streak.run>streak.longest) streak.ranges=[];
        streak.longest=streak.run;
        streak.ranges.push({start:streak.start,end:date});
      }
      prev=date;
    }
    const recordCounts=new Map();
    for (const winners of records) {
      for (const row of winners) {
        const month=monthOf(row.date);
        recordCounts.set(month,(recordCounts.get(month)||0)+1);
      }
    }
    const months=[...byMonth.keys()];
    const top=[...rows].sort((a,b)=>b.steps-a.steps || a.date.localeCompare(b.date));
    const complete=months.filter(m=>byMonth.get(m).length===lastDay(m));
    const bestMonth=complete.sort((a,b)=>monthsums.get(b)/lastDay(b)-monthsums.get(a)/lastDay(a))[0];
    const {longest,run}=streaks.find(s=>s.threshold===10000);
    return {rows,byMonth,months,monthsums,records,recordCounts,top,bestMonth,streaks,longest,run,last:prev,newestDateRecord};
  }
  function bestWindow(rows, length, calendarWeek=false) {
    let total=0,best=null,start=0;
    for (let i=0;i<rows.length;i++) {
      if (i && add(rows[i-1].date,1)!==rows[i].date) {start=i;total=0;}
      total+=rows[i].steps;
      if (i-start+1>length) total-=rows[start++].steps;
      if (i-start+1===length && (!calendarWeek || parse(rows[start].date).getUTCDay()===1) && (!best || total>best.total))
        best={start:rows[start].date,end:rows[i].date,total,average:total/length};
    }
    return best;
  }
  return {fmt,parse,iso,add,dayOf,monthOf,lastDay,dayIn,show,dateName,monthName,today,sum,analyse,bestWindow};
})();
if (typeof module !== 'undefined' && module.exports) module.exports=StepStats;
