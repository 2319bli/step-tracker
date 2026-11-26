'use strict';
const S = StepStats, $ = id => document.getElementById(id);
const DAY = {day:'numeric',month:'short'}, WEEK = {weekday:'short'};
const state = {raw:{}, data:null, month:'', view:'overview', compare:[], mode:'average', range:'month', from:'', to:'', logMonth:'all', page:0, records:'dates'};
const weekly = {start:null, period:'all', month:'', year:'', from:null, to:null};
const weekdayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
// Calendar-month accents match Augis viewer/views.py, MONTH_BORDER_COLORS.
const monthColours = ['#25d2c8', '#0158f2', '#7d00ff', '#ff00ed', '#ff006d', '#1aff00', '#c1fe00', '#fee200', '#ffc500', '#ff5900', '#91c6bb', '#8e8e8e'];
const monthColour = date => monthColours[Number(date.slice(5,7))-1];
const monthStyle = date => `--month-colour:${monthColour(date)}`;
const monthDate = date => `<span class="month-date" style="${monthStyle(date)}">${S.dateName(date)}</span>`;
const paths = {
  steps:'M3 18h6v-5h5V8h7', average:'M3 17l5-6 5 3 7-9M16 5h4v4',
  fire:'M13 3c1 5-3 6-2 10 2-1 3-3 3-5 4 3 6 6 5 9a7 7 0 0 1-13-1c0-4 4-6 4-10 1 1 2 2 2 3 1-2 1-4 1-6Z',
  trophy:'M7 4h10v6a5 5 0 0 1-10 0ZM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 15v4M8 20h8',
  calendar:'M4 7h16v13H4ZM7 4v5M17 4v5M4 11h16',
  arrow:'M4 12h15m-5-5 5 5-5 5', left:'m14 6-6 6 6 6', right:'m9 6 6 6-6 6', bolt:'m13 2-9 12h7l-1 8 10-13h-8Z'
};
const icon=k=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[k]}"/></svg>`;
const empty=msg=>`<p class="empty">${msg}</p>`;
const quiet=(action,label)=>`<button type="button" class="quiet" data-act="${action}">${label}</button>`;
const option=(value,label,active)=>`<option value="${value}" ${value===active?'selected':''}>${label}</option>`;
const val=n=>n==null?'—':S.fmt(n);
const link=(target,label)=>`<a class="linklike" href="#${target}">${label} ${icon('arrow')}</a>`;
const monthRows=()=>state.data.byMonth.get(state.month)||[];
const metric=(title,k,number,unit,detail,hero=false,art='')=>`<section class="card metric ${hero?'hero':''}">
  <div class="metric-title"><span class="metric-icon">${icon(k)}</span>${title}</div>
  <div><div class="metric-number">${number} <small>${unit}</small></div><div class="sub">${detail}</div></div>${art}</section>`;
const head=(title,sub,extra='')=>`<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div>${extra}</div>`;
const cardHead=(title,sub='',extra='')=>`<div class="section-heading"><div><h2>${title}</h2>${sub?`<p class="caption">${sub}</p>`:''}</div>${extra}</div>`;
const select=(id,label,options)=>`<label class="control-label">${label}<select id="${id}">${options}</select></label>`;
function monthPicker(){
  const months=state.data.months, i=months.indexOf(state.month);
  return `<div class="month-picker" style="${monthStyle(state.month)}"><button class="icon-button" data-act="prev-month" aria-label="Previous month" ${i<=0?'disabled':''}>${icon('left')}</button>
  <select aria-label="Overview month" id="month">${[...months].reverse().map(m=>option(m,S.monthName(m),state.month)).join('')}</select>
  <button class="icon-button" data-act="next-month" aria-label="Next month" ${i>=months.length-1?'disabled':''}>${icon('right')}</button></div>`;
}
function spark(rows){
  if (rows.length<2) return '';
  const hi=Math.max(...rows.map(r=>r.steps),1);
  const points=rows.map((r,i)=>`${(i*185/(rows.length-1)).toFixed(1)},${(100-r.steps*77/hi).toFixed(1)}`).join(' ');
  return `<svg class="spark" preserveAspectRatio="none" viewBox="0 0 185 110" aria-hidden="true"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="var(--month-colour)" stop-opacity=".45"/><stop offset="1" stop-color="var(--month-colour)" stop-opacity=".03"/></linearGradient></defs><polygon points="0,110 ${points} 185,110" fill="url(#fill)"/><polyline points="${points}" fill="none" stroke="var(--month-colour)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}
function logTable(rows, includeEdit=true){
  if (!rows.length) return empty('No entries for this period.');
  return `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Day</th><th class="num">Steps</th><th class="num">Month avg</th>${includeEdit?'<th><span hidden>Action</span></th>':''}</tr></thead><tbody>
    ${rows.map(r=>`<tr><td>${monthDate(r.date)}</td><td>${S.show(r.date,WEEK)}</td><td class="num emphasis">${S.fmt(r.steps)}</td><td class="num">${S.fmt(r.average)}</td>${includeEdit?`<td class="num"><button class="edit-link" data-edit="${r.date}" aria-label="Edit ${S.dateName(r.date)}">Edit</button></td>`:''}</tr>`).join('')}
  </tbody></table></div>`;
}
// Draw real calendar positions, including unlogged days, with breaks across missing values.
function chart(labels,series,{compact=false,days=false,aria='Step chart',defs=''}={}){
  if (!labels.length||!series.some(s=>s.values.some(Number.isFinite))) return empty('No entries for this chart.');
  const w=compact?400:790,h=compact?212:255,L=43,R=9,T=12,B=27,pw=w-L-R,ph=h-T-B;
  const max=Math.max(1,...series.flatMap(s=>s.values).filter(Number.isFinite)), rough=max/4;
  const power=10**Math.floor(Math.log10(rough)), step=[1,2,2.5,5,10].map(x=>x*power).find(x=>x>=rough), ceil=Math.ceil(max/step)*step;
  const x=i=>L+(i+.5)*pw/labels.length, y=v=>T+ph-ph*v/ceil, bw=Math.max(.5,pw/labels.length*.72);
  let visual=defs ? `<defs>${defs}</defs>` : '';
  for(let a=0;a<=ceil;a+=step) visual+=`<line x1="${L}" x2="${w-R}" y1="${y(a)}" y2="${y(a)}" stroke="#dce4dc" stroke-dasharray="3 4"/><text x="${L-7}" y="${y(a)+4}" text-anchor="end">${a>=1000?(a/1000)+'k':a}</text>`;
  const indexLabels=new Set([0,labels.length-1]);
  if(days && labels.length<=31){for(let i=4;i<labels.length-2;i+=5)indexLabels.add(i);}
  else {const count=compact?4:6;for(let n=1;n<count;n++)indexLabels.add(Math.round((labels.length-1)*n/count));}
  for(const i of indexLabels)visual+=`<text x="${x(i)}" y="${h-5}" text-anchor="middle">${labels[i].axis}</text>`;
  for(const s of series){
    if(s.type==='bar'){
      s.values.forEach((v,i)=>{
        if(v==null)return;
        // Divide a record bar equally between months that jointly hold the high.
        const colours=labels[i].colours||[s.colour], width=bw/colours.length;
        colours.forEach((colour,j)=>{visual+=`<rect x="${x(i)-bw/2+j*width}" y="${y(v)}" width="${width}" height="${T+ph-y(v)}" rx="${colours.length===1?Math.min(3,bw/3):0}" fill="${colour}"/>`;});
      });
    }else{
      let path='',start=true;
      s.values.forEach((v,i)=>{if(v==null){start=true;return;}path+=(start?'M':'L')+x(i).toFixed(2)+' '+y(v).toFixed(2)+' ';if(start && (i+1===s.values.length || s.values[i+1]==null))visual+=`<circle cx="${x(i)}" cy="${y(v)}" r="2.6" fill="${s.colour}"/>`;start=false;});
      visual+=`<path class="series-line" d="${path}" fill="none" stroke="${s.colour}" stroke-width="2.5" stroke-dasharray="${s.dash||'none'}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
  }
  const readings=labels.map((d,i)=>[d.name,...series.filter(s=>s.values[i]!=null).map(s=>s.name+' '+S.fmt(s.values[i]))].join(' · '));
  const token=charts.push({readings,L,R,w,labels:labels.length,active:0})-1;
  return `<div class="chartwrap" data-chart="${token}"><svg class="chart plot-hit" tabindex="0" role="img" aria-label="${aria}. Use left and right arrow keys to inspect values." viewBox="0 0 ${w} ${h}">${visual}<line class="cross" y1="${T}" y2="${T+ph}" stroke="#587465" visibility="hidden"/></svg><div class="chart-tooltip"></div></div>`;
}
let charts=[];
function trendChart(){
  const {rows}=state.data;let first,last,month=state.month,selection=state.range;
  if(selection==='month'){first=month+'-01';last=S.dayIn(month,S.lastDay(month));}
  else if(selection==='year'){first=month.slice(0,4)+'-01-01';last=month.slice(0,4)+'-12-31';}
  else if(selection==='custom'){first=state.from;last=state.to;}
  else {first=rows[0]?.date;last=rows.at(-1)?.date;}
  const controls=select('trend-range','Chart period',[['month','Selected month'],['year','Selected year'],['all','All dates'],['custom','Custom range']].map(v=>option(...v,selection)).join(''));
  let inputs='',plot='',barKey='';
  if(selection==='custom')inputs=`<div class="controls"><label class="control-label">From<input type="date" id="from" value="${first}"></label><label class="control-label">To<input type="date" id="to" value="${last}"></label></div>`;
  if(!first||!last||first>last)plot=empty('Choose an end date on or after the start date.');
  else{
    // Limit overly wide user ranges to the recorded span, keeping full month/year calendar views.
    if(selection==='custom' && rows.length){first=first<rows[0].date?rows[0].date:first;last=last>rows.at(-1).date?rows.at(-1).date:last;}
    const dates=[];for(let d=first;d<=last;d=S.add(d,1))dates.push(d);
    const map=new Map(rows.map(r=>[r.date,r]));
    const short=dates.length<=31, multiYear=dates.length>365;
    const activeColours=[...new Set(dates.map(monthColour))];
    if(activeColours.length)barKey=activeColours.length===1?activeColours[0]:`linear-gradient(90deg, ${activeColours.join(', ')})`;
    const labels=dates.map(d=>({name:S.dateName(d),colours:[monthColour(d)],axis:short?S.dayOf(d):S.show(d,multiYear?{month:'short',year:'2-digit'}:DAY)}));
    plot=chart(labels,[{name:'Steps',type:'bar',values:dates.map(d=>map.get(d)?.steps??null)},{name:'Month avg',colour:'#384a48',dash:'6 4',values:dates.map(d=>map.get(d)?.average??null)}],{days:short,aria:'Daily steps and cumulative monthly average'});
  }
  return `<section class="card">${cardHead('Daily activity','',controls)}${inputs}<div class="legend"><span><i class="dot month-swatch" style="background:${barKey||'var(--line)'}"></i>Daily steps</span><span><i class="dash"></i>Month-to-date average</span></div>${plot}</section>`;
}
const keyRow=(k,label,n,detail)=>`<div class="key"><span class="key-icon">${icon(k)}</span><div><div class="small-label">${label}</div><strong>${n}</strong></div><span class="sub">${detail}</span></div>`;
function overview(){
  const d=state.data,rows=monthRows(),m=state.month,total=S.sum(rows),maximum=d.top[0],bm=d.bestMonth;
  const tracked=rows.length, count=d.recordCounts.get(m)||0;
  const leadingCounts=[...new Set(d.recordCounts.values())].sort((a,b)=>b-a).slice(0,3);
  const place=leadingCounts.indexOf(count)+1;
  const badge=place?`<span class="record-medal place-${place}">${ordinal(place)} place</span>`:'';
  const streakRows=d.streaks.filter(s=>s.threshold>=10000).map(s=>{
    const detail=s.ranges.length>1?`${s.ranges.length} tied streaks`:s.ranges.length?rangeName(s.ranges[0]):'—';
    return keyRow('fire',`Longest ${s.threshold/1000}k streak`,S.fmt(s.longest)+(s.longest===1?' day':' days'),detail);
  }).join('');
  const above=rows.filter(r=>r.steps>=20000).length;
  return head('Activity overview',`${S.monthName(m)} · ${tracked} logged ${tracked===1?'day':'days'}`,monthPicker())+
   `<div class="hero-row" style="${monthStyle(m)}">${metric('Total steps','steps',S.fmt(total),'','Across the selected month',true,spark(rows))}
   ${metric('Daily average','average',val(tracked?total/tracked:null),'steps','Per logged day')}
   ${metric('Date records','trophy',S.fmt(count),badge,'Day-of-month highs held')}</div>
   <div class="content-grid"><div class="column">${trendChart()}<section class="card">${cardHead('Daily log',S.monthName(m),link('log','View full log'))}${logTable(rows.slice(-5).reverse())}</section></div>
   <aside class="column"><section class="card">${cardHead('Personal records','All time',link('records','View all'))}
   ${keyRow('trophy','Best day',val(maximum?.steps),maximum?S.dateName(maximum.date):'—')}
   ${keyRow('calendar','Best month average',val(bm?d.monthsums.get(bm)/S.lastDay(bm):null),bm?S.monthName(bm,true):'—')}
   ${streakRows}</section>
   <section class="card">${cardHead('Month highlights',S.monthName(m))}
   ${keyRow('bolt','20k+ days',String(above),'of '+tracked+' logged')}
   ${keyRow('trophy','Best day this month',val(tracked?Math.max(...rows.map(r=>r.steps)):null),tracked?S.show(rows.reduce((a,b)=>a.steps>=b.steps?a:b).date,{weekday:'short',day:'numeric',month:'short'}):'—')}</section></aside></div>`;
}
function weekBounds(){
  const last=state.data.last||S.today();
  return {first:S.startOfWeek(state.data.rows[0]?.date||last),latest:S.startOfWeek(last)};
}
function selectedWeek(){
  const {first,latest}=weekBounds();
  if(!weekly.start || weekly.start>latest)return latest;
  return weekly.start<first ? first : weekly.start;
}
function weekdayRange(){
  const last=state.data.last||S.today();
  switch(weekly.period){
    case 'week':{
      const from=selectedWeek();
      return {from,to:S.add(from,6)};
    }
    case 'month':{
      const month=weekly.month||S.monthOf(last);
      return {from:month+'-01',to:S.dayIn(month,S.lastDay(month))};
    }
    case 'year':{
      const year=weekly.year||last.slice(0,4);
      return {from:year+'-01-01',to:year+'-12-31'};
    }
    case 'custom':return {from:weekly.from,to:weekly.to};
    default:return {from:state.data.rows[0]?.date||last,to:last};
  }
}
function stepBar(value,max,colour='var(--green)'){
  if(value==null)return '';
  const percent=max ? 100*value/max : 0;
  return `<span aria-hidden="true" class="step-bar"><i style="width:${percent}%;background:${colour}"></i></span>`;
}
function weekdayPanel(){
  const {from,to}=weekdayRange();
  const periods=[['all','All dates'],['week','Selected week'],['month','Calendar month'],['year','Calendar year'],['custom','Custom dates']];
  let controls=select('weekday-period','Period',periods.map(([key,name])=>option(key,name,weekly.period)).join(''));
  const months=[...state.data.months].reverse();
  if(weekly.period==='month'){
    controls+=select('weekday-month','Month',months.map(m=>option(m,S.monthName(m),from.slice(0,7))).join(''));
  }else if(weekly.period==='year'){
    const years=[...new Set(months.map(m=>m.slice(0,4)))];
    controls+=select('weekday-year','Year',years.map(y=>option(y,y,from.slice(0,4))).join(''));
  }else if(weekly.period==='custom'){
    controls+=`<label class="control-label">From<input id="weekday-from" type="date" value="${from||''}"></label>
      <label class="control-label">To<input id="weekday-to" type="date" value="${to||''}"></label>`;
  }
  let result;
  if(!from||!to)result=empty('Choose a start and end date.');
  else if(from>to)result=empty('Choose an end date on or after the start date.');
  else{
    const groups=S.weekdayAverages(state.data.rows,from,to);
    const max=Math.max(...groups.map(g=>g.average??0));
    const rows=groups.map(({count,average},i)=>`<tr><th scope="row">${weekdayNames[i]}</th>
      <td class="num">${count}</td><td class="num emphasis">${val(average)}${stepBar(average,max)}</td></tr>`).join('');
    result=`<p class="period-dates">${S.dateName(from)} – ${S.dateName(to)}</p>
      ${groups.some(g=>g.count)?'':empty('No entries in this period.')}
      <table class="week-table"><thead><tr><th>Weekday</th><th class="num">Logged days</th><th class="num">Average steps</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  return `<section class="card">${cardHead('Weekday averages','Each average uses the logged days for that weekday.')}
    <div class="controls">${controls}</div>${result}</section>`;
}
function weeklyPage(){
  if(!state.data.rows.length)return head('Weekly activity','Log a day to see your weeks and weekday averages.');
  const {first,latest}=weekBounds(), start=selectedWeek(), end=S.add(start,6);
  const picker=`<div class="week-picker">
    <button class="icon-button" data-act="prev-week" aria-label="Previous week" ${start===first?'disabled':''}>${icon('left')}</button>
    <label class="control-label">Jump to date<input type="date" id="week-date" min="${first}" max="${S.add(latest,6)}" value="${start}"></label>
    <button class="icon-button" data-act="next-week" aria-label="Next week" ${start===latest?'disabled':''}>${icon('right')}</button></div>`;
  const days=weekdayNames.map((name,i)=>{
    const date=S.add(start,i);
    return {name,date,steps:state.raw[date]??null};
  });
  const logged=days.filter(day=>day.steps!=null), total=S.sum(logged);
  const max=Math.max(0,...logged.map(day=>day.steps));
  const rows=days.map(({name,date,steps})=>`<tr><th scope="row">${name}</th><td>${monthDate(date)}</td>
    <td class="num emphasis">${val(steps)}${stepBar(steps,max,monthColour(date))}</td></tr>`).join('');
  return head('Weekly activity',rangeName({start,end}),picker)+`<div class="weekly-grid"><section class="card">
    ${cardHead('Week summary',logged.length+' of 7 days logged')}
    <dl class="week-totals"><div><dt>Total steps</dt><dd>${val(logged.length?total:null)}</dd></div>
    <div><dt>Daily average</dt><dd>${val(logged.length?total/logged.length:null)}</dd></div></dl>
    <table class="week-table"><thead><tr><th>Day</th><th>Date</th><th class="num">Steps</th></tr></thead><tbody>${rows}</tbody></table></section>
    ${weekdayPanel()}</div>`;
}
function dailyLog(){
  const d=state.data, rows=state.logMonth==='all'?d.rows:(d.byMonth.get(state.logMonth)||[]), reversed=[...rows].reverse(), pages=Math.max(1,Math.ceil(rows.length/31));
  state.page=Math.min(state.page,pages-1);
  const slice=reversed.slice(state.page*31,(state.page+1)*31);
  const options=option('all','All months',state.logMonth)+[...d.months].reverse().map(m=>option(m,S.monthName(m),state.logMonth)).join('');
  const downloads='<div class="actions downloads">'+quiet('portable','Download updated tracker')+quiet('export','Export CSV')+quiet('json','Site data (JSON)')+'</div>';
  const hint=!importedScript?(StepCloud.paired?'This browser saves entries to Cloudflare.':'Entries come from Cloudflare. Connect a browser to edit them.') : deviceStorage?'Edits are saved in this browser. Download an updated tracker to take them to another device.':'Browser storage is unavailable. Download an updated tracker to keep your edits.';
  return head('Daily log',`${S.fmt(d.rows.length)} recorded days${d.last?' · '+S.dateName(d.rows[0].date)+' – '+S.dateName(d.last):''}`,downloads)+
    legacyPanel()+`<section class="card">${cardHead('Step entries',hint,select('log-month','Show',options))}${logTable(slice)}
    <div class="table-footer"><span class="sub">${slice.length?`${state.page*31+1}–${state.page*31+slice.length} of ${rows.length} entries`:'0 entries'}</span>
    <div class="actions"><button class="quiet" data-act="prev-page" ${state.page===0?'disabled':''}>Previous</button><button class="quiet" data-act="next-page" ${state.page===pages-1?'disabled':''}>Next</button></div></div></section>`;
}

function comparison(){
  const d=state.data,months=state.compare,average=state.mode==='average';
  const dayLabels=Array.from({length:31},(_,i)=>({axis:i+1,name:'Day '+(i+1)}));
  const byCalendarMonth=new Map();
  for(const m of months){
    const key=m.slice(5);
    if(!byCalendarMonth.has(key))byCalendarMonth.set(key,[]);
    byCalendarMonth.get(key).push(m);
  }
  const patterns=['none','8 4','2 4','8 4 2 4','12 3'];
  const series=months.map(m=>{
    const map=new Map((d.byMonth.get(m)||[]).map(r=>[S.dayOf(r.date),r]));
    const values=dayLabels.map((_,j)=>map.get(j+1)?.[average?'average':'steps']??null);
    const years=byCalendarMonth.get(m.slice(5));
    const index=years.length-1-years.indexOf(m);
    const dash=patterns[index]||`${index+3} 3 2 3`;
    return {name:S.monthName(m,true),colour:monthColour(m),dash,values};
  });
  const monthChecks=[...d.months].reverse().map(m=>`<label style="${monthStyle(m)}"><input type="checkbox" data-compare="${m}" ${months.includes(m)?'checked':''}>${S.monthName(m,true)}</label>`).join('');
  const controls=`<div class="tabs" aria-label="Comparison metric"><button data-mode="average" aria-pressed="${average}" class="${average?'active':''}">Cumulative average</button><button data-mode="steps" aria-pressed="${!average}" class="${!average?'active':''}">Daily steps</button></div>`;
  const matrix=months.length?`<div class="tablewrap" tabindex="0" aria-label="Scrollable month comparison"><table class="matrix"><thead><tr><th>Day</th>${series.map(s=>`<th class="num month-heading" style="--month-colour:${s.colour}">${s.name}</th>`).join('')}${average?'':'<th class="num">All-time record</th>'}</tr></thead><tbody>${dayLabels.map((_,i)=>`<tr><td>${i+1}</td>${series.map((s,j)=>{
    const n=s.values[i],invalid=i+1>S.lastDay(months[j]),record=!average && n!=null && n===d.records[i][0]?.steps;
    return `<td class="num ${invalid?'invalid':record?'record':''}">${invalid?'':val(n)}</td>`;
  }).join('')}${average?'':`<td class="num emphasis">${val(d.records[i][0]?.steps)}</td>`}</tr>`).join('')}</tbody></table></div>`:empty('Select at least one month.');
  return head('Compare months','Compare the same day of each month across your step history.')+`<div class="section-stack"><section class="card">
    ${cardHead('Monthly comparison','',controls)}<details id="month-choices" ${state.choicesOpen?'open':''}><summary>Choose months (${months.length})</summary><div class="checks">${monthChecks}</div><div class="actions" style="margin-top:10px">${quiet('all-months','Select all')}${quiet('clear-months','Clear')}</div></details>
    ${chart(dayLabels,series,{days:true,aria:average?'Monthly cumulative averages':'Daily steps by month'})}
    <div class="comparison-legend">${series.map(s=>`<span><svg class="line-key" viewBox="0 0 26 8" aria-hidden="true"><path class="series-line" d="M2 4h22" stroke="${s.colour}" stroke-width="3" stroke-dasharray="${s.dash}" stroke-linecap="round"/></svg>${s.name}</span>`).join('')}</div></section>
    <section class="card">${cardHead(average?'Cumulative averages by day':'Raw step totals by day',average?'Average of recorded entries from the first of the month through each date.':'Highlighted values hold the all-time record for that day of the month.')}${matrix}</section></div>`;
}
function livePeriods(d){
  const m=d.bestMonth;
  return {
    week:S.bestWindow(d.rows,7,true), seven:S.bestWindow(d.rows,7),
    month:m?{month:m,average:d.monthsums.get(m)/S.lastDay(m)}:null,
    rolling:S.bestWindow(d.rows,31)
  };
}
const rangeName=r=>S.dateName(r.start)+' – '+S.dateName(r.end);
function ordinal(n){
  const suffix=n>=11 && n<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th');
  return n+suffix;
}
function recordPage(){
  const d=state.data,mode=state.records;
  const tabs=`<div class="tabs" aria-label="Record type">${[['dates','Date records'],['top','Top 30 days'],['periods','Periods & streaks']].map(([v,label])=>`<button data-records="${v}" aria-pressed="${mode===v}" class="${mode===v?'active':''}">${label}</button>`).join('')}</div>`;
  let contents='';
  if (mode==='dates'){
    const winnersTable=`<div class="tablewrap"><table><thead><tr><th>Day of month</th><th class="num">Record</th><th>Set on</th></tr></thead><tbody>${d.records.map((w,i)=>`<tr><td>${ordinal(i+1)}</td><td class="num emphasis">${val(w[0]?.steps)}</td><td>${w.map(r=>monthDate(r.date)+(r.date===d.newestDateRecord?' <span class="pill" title="Most recently set day-of-month record">New</span>':'')).join(', ')||'—'}</td></tr>`).join('')}</tbody></table></div>`;
    const stripeId=colour=>'record-2025-'+colour.slice(1);
    const stripes=monthColours.map(colour=>`<pattern id="${stripeId(colour)}" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
      <rect width="7" height="7" fill="${colour}"/><rect width="2" height="7" fill="#172a26" fill-opacity=".65"/>
      <rect x="2" width="1" height="7" fill="white" fill-opacity=".65"/></pattern>`).join('');
    const labels=d.records.map((winners,i)=>({
      name:'Day '+(i+1),axis:i+1,
      colours:winners.map(({date})=>{
        const colour=monthColour(date);
        return date.startsWith('2025-') ? `url(#${stripeId(colour)})` : colour;
      })
    }));
    contents=`<div class="content-grid"><section class="card">${cardHead('Day-of-month records','Highest count recorded on each of the 31 dates. Diagonal stripes mark 2025 records.') }
    ${chart(labels,[{name:'Record',type:'bar',values:d.records.map(w=>w[0]?.steps??null)}],{days:true,aria:'All-time records by day of the month',defs:stripes})}${winnersTable}</section>
    <section class="card">${cardHead('Records by month','Tied dates credit each holder.')}<div class="record-list">${[...d.recordCounts].sort((a,b)=>b[1]-a[1]||b[0].localeCompare(a[0])).map(([m,n])=>`<div class="record-chip" style="${monthStyle(m)}"><strong>${n} ${n===1?'record':'records'}</strong><span class="sub">${S.monthName(m,true)}</span></div>`).join('')}</div></section></div>`;
  }else if(mode==='top'){
    const cutoff=d.top[29]?.steps??0;
    const ranked=d.top.filter(r=>r.steps>=cutoff);
    let rank=0;
    const rows=ranked.map((r,i)=>{
      if (!i || r.steps!==ranked[i-1].steps) rank=i+1;
      const label=r.historical?' <span class="visually-hidden">Set a new all-time high</span>':'';
      return `<tr${r.historical?' class="record-high"':''}><td class="rank">${rank}</td><td>${monthDate(r.date)}${label}</td><td>${S.show(r.date,WEEK)}</td><td class="num emphasis">${S.fmt(r.steps)}</td></tr>`;
    });
    contents=`<section class="card">${cardHead('All-time top 30','Highlighted days set a new all-time high.')}<div class="tablewrap"><table><thead><tr><th>Rank</th><th>Date</th><th>Day</th><th class="num">Steps</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section>`;
  }else{
    const periods=livePeriods(d);
    const periodNames={week:'Calendar week (Mon–Sun)',seven:'Rolling 7 days',month:'Calendar month',rolling:'Rolling 31 days'};
    const periodRows=Object.entries(periodNames).map(([key,label])=>{
      const r=periods[key];
      const dates=r?(r.month?S.monthName(r.month):rangeName(r)):'—';
      return `<tr><td>${label}</td><td>${dates}</td><td class="num emphasis">${val(r?.average)}</td></tr>`;
    });
    const streakRows=d.streaks.map(s=>`<tr><td>${S.fmt(s.threshold)}+</td><td class="num emphasis">${s.longest}</td><td>${s.ranges.map(rangeName).join('<br>')||'—'}</td></tr>`);
    contents=`<section class="card">${cardHead('Best daily averages','Only complete periods with an entry for every day qualify.')}<div class="tablewrap"><table><thead><tr><th>Period</th><th>Dates</th><th class="num">Steps per day</th></tr></thead><tbody>${periodRows.join('')}</tbody></table></div></section>
    <section class="card">${cardHead('Longest streaks','Consecutive calendar days at or above each step count.')}<div class="tablewrap"><table><thead><tr><th>Daily steps</th><th class="num">Days</th><th>Dates</th></tr></thead><tbody>${streakRows.join('')}</tbody></table></div>
    ${keyRow('fire','10k streak at latest entry',S.fmt(d.run)+(d.run===1?' day':' days'),d.last?S.dateName(d.last):'—')}</section>`;
  }
  const sub=d.last?'Calculated from the daily log through '+S.dateName(d.last)+'.':'Add a daily entry to start tracking records.';
  return head('Personal records',sub)+`<div class="section-stack"><div>${tabs}</div>${contents}</div>`;
}
function updateData(raw){
  state.raw=raw;state.data=S.analyse(raw);
  const months=state.data.months, last=state.data.last||S.today();
  if (!months.includes(state.month))state.month=S.monthOf(last);
  if (weekly.month && !state.data.byMonth.has(weekly.month))weekly.month='';
  if (weekly.year && !months.some(m=>m.startsWith(weekly.year+'-')))weekly.year='';
  if (!state.from)state.from=state.month+'-01';
  if (!state.to)state.to=last;
  if (state.logMonth!=='all'&&!months.includes(state.logMonth))state.logMonth='all';
  state.compare=state.compare.filter(m=>months.includes(m));
}
function render(){
  if (!state.data)return;
  showCloudStatus();
  state.view=location.hash.slice(1);
  if(!['overview','weekly','log','compare','records'].includes(state.view))state.view='overview';
  for(const a of document.querySelectorAll('nav a')){if(a.hash==='#'+state.view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  charts=[];const views={overview,weekly:weeklyPage,log:dailyLog,compare:comparison,records:recordPage};
  $('main').innerHTML=views[state.view]();
  for(const box of document.querySelectorAll('[data-chart]')){
    const svg=box.querySelector('svg'),tip=box.querySelector('.chart-tooltip'),line=box.querySelector('.cross'),c=charts[+box.dataset.chart];
    const inspect=(index)=>{
      c.active=Math.max(0,Math.min(c.labels-1,index));const x=c.L+(c.active+.5)*(c.w-c.L-c.R)/c.labels;
      line.setAttribute('x1',x);line.setAttribute('x2',x);line.setAttribute('visibility','visible');
      tip.textContent=c.readings[c.active];tip.classList.add('active');tip.style.top='3px';tip.style.left=Math.max(0,Math.min(box.clientWidth-tip.offsetWidth,x*box.clientWidth/c.w-tip.offsetWidth/2))+'px';
      svg.setAttribute('aria-label',c.readings[c.active]);
    };
    const hide=()=>{tip.classList.remove('active');line.setAttribute('visibility','hidden');};
    svg.onpointermove=e=>{const r=svg.getBoundingClientRect();inspect(Math.floor(((e.clientX-r.left)/r.width*c.w-c.L)/(c.w-c.L-c.R)*c.labels));};
    svg.onpointerleave=hide;svg.onblur=hide;svg.onfocus=()=>inspect(c.active);
    svg.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();inspect(c.active+(e.key==='ArrowRight'?1:-1));}};
  }
  if($('month-choices'))$('month-choices').ontoggle=e=>{state.choicesOpen=e.target.open;};
}
const importedScript=document.getElementById('imported-steps');
let published=null;
const localKey='steptracker.pages.v1.'+(importedScript?.dataset.snapshot||'public');
let memoryChanges={},deviceStorage=null;
try{deviceStorage=window.localStorage;deviceStorage.getItem(localKey);}catch{deviceStorage=null;}
function validHistory(data, allowDeletion=false){
  if(data===null || typeof data!=='object' || Array.isArray(data))return false;
  return Object.entries(data).every(([day,n])=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
    const date=S.parse(day);
    return Number.isFinite(+date) && S.iso(date)===day && ((allowDeletion && n===null) || (Number.isSafeInteger(n) && n>=0 && n<=2147483647));
  });
}
function localChanges(){
  if(!deviceStorage)return memoryChanges;
  const stored=deviceStorage.getItem(localKey);
  const changes=stored?JSON.parse(stored):{};
  if(!validHistory(changes,true))throw Error('Saved entries could not be read.');
  return changes;
}
function localData(){
  const raw={...published};
  for(const [date,n] of Object.entries(localChanges())){
    if(n===null)delete raw[date];else raw[date]=n;
  }
  return raw;
}
let cloudOnline=true, readVersion=0;
const cacheKey='steptracker.cloud.history.v1';
async function readData(){
  if(importedScript){
    published=JSON.parse(importedScript.textContent);
    if(!validHistory(published))throw Error('Invalid imported step history.');
    return localData();
  }
  const version=++readVersion;
  try{
    const data=await StepCloud.read();
    if(!validHistory(data))throw Error('Invalid cloud history.');
    if(version===readVersion){
      published=data;cloudOnline=true;
      try{deviceStorage?.setItem(cacheKey,JSON.stringify(data));}catch{}
    }
  }catch(error){
    if(version===readVersion)cloudOnline=false;
    if(!published){
      let seed;
      try{seed=JSON.parse(deviceStorage?.getItem(cacheKey)||'null');}catch{}
      if(!validHistory(seed)){
        const fallback=await fetch('data/steps.json');if(!fallback.ok)throw error;
        seed=await fallback.json();if(!validHistory(seed))throw error;
      }
      if(!published)published=seed;
    }
  }
  return published;
}
function pending(){
  if(importedScript)return [];
  return Object.entries(localChanges()).sort(([a],[b])=>a.localeCompare(b));
}
function legacyPanel(){
  const old=pending();
  if(!old.length)return '';
  return '<section class="card legacy"><h2>Earlier browser edits</h2><p class="caption">Choose which totals to keep. A dash means no entry.</p><div class="tablewrap"><table><thead><tr><th>Date</th><th>Browser</th><th>Cloudflare</th><th>Use</th></tr></thead><tbody>'+old.map(([day,count])=>
    '<tr><td>'+S.dateName(day)+'</td><td>'+val(count)+'</td><td>'+val(published?.[day])+'</td><td><button class="quiet" data-legacy="'+day+'" data-use="browser">Browser</button> <button class="quiet" data-legacy="'+day+'" data-use="cloud">Cloudflare</button></td></tr>').join('')+'</tbody></table></div></section>';
}
function showCloudStatus(){
  const box=$('cloud-status');box.textContent='';
  if(importedScript){box.hidden=true;return;}
  if(!cloudOnline)box.textContent='Cloudflare is unavailable. Showing the last available step history. ';
  if(pending().length){
    const a=document.createElement('a');a.href='#log';a.textContent='Review earlier browser edits in Daily log.';box.append(a);
  }
  box.hidden=!box.textContent;
}
function toast(msg){$('toast').textContent=msg;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{$('toast').textContent='';},3200);}
let previous=null, confirming=false, busy=false;
function loadForm(){
  const date=$('entry-date').value;previous=state.raw[date]??null;confirming=false;
  $('entry-count').value=previous??'';$('remove').hidden=previous===null;$('remove').textContent='Remove entry';
  $('entry-hint').textContent=previous===null?'Add a daily total.':'This date already has an entry. Saving updates its total.';
  $('entry-error').textContent='';
}
let nextEdit;
async function edit(date){
  if(busy||!state.data)return;
  if(!importedScript && !StepCloud.paired){
    try{if(!await StepCloud.connected()){nextEdit={date};await openDevice();return;}}
    catch(err){toast(err.message);return;}
  }
  $('entry-date').max=S.today();$('entry-date').value=date||S.today();$('entry-date').disabled=!!date;
  $('dialog-title').textContent=date?'Edit steps':'Log steps';loadForm();$('entry-dialog').showModal();$('entry-count').focus();
}
async function persist(date,steps,expected){
  if(!importedScript){
    await StepCloud.save(date,steps,expected);cloudOnline=true;++readVersion;
    if(steps===null)delete published[date];else published[date]=steps;
    try{deviceStorage?.setItem(cacheKey,JSON.stringify(published));}catch{}
    return;
  }
  const write=()=>{
    const changes=localChanges();
    const actual=Object.hasOwn(changes,date)?changes[date]:(published[date]??null);
    if(actual!==expected && actual!==steps)throw Error('This entry changed in another window. Reopen it to use the latest count.');
    if(steps===(published[date]??null))delete changes[date];else changes[date]=steps;
    if(deviceStorage){try{deviceStorage.setItem(localKey,JSON.stringify(changes));}catch{deviceStorage=null;}}
    if(!deviceStorage)memoryChanges=changes;
  };
  if(navigator.locks)await navigator.locks.request(localKey,write);else write();
}
async function saveEntry(steps){
  if(busy)return;
  const date=$('entry-date').value;busy=true;$('save').disabled=true;$('remove').disabled=true;$('close').disabled=true;
  try{
    await persist(date,steps,previous);
    const raw={...state.raw};if(steps===null)delete raw[date];else raw[date]=steps;
    updateData(raw);if(steps!==null)state.month=S.monthOf(date);
    $('entry-dialog').close();render();toast(!importedScript?(steps===null?'Entry removed from Cloudflare.':'Steps saved to Cloudflare.'):!deviceStorage?'Updated for this session. Download an updated tracker from Daily log to keep it.':steps===null?'Entry removed.':'Steps saved.');
    try {updateData(await readData());render();} catch {}
  }catch(err){
    $('entry-error').textContent=err.message;
    try {updateData(await readData());render();} catch {}
  }finally{busy=false;$('save').disabled=false;$('remove').disabled=false;$('close').disabled=false;}
}
async function savePortable(){
  const copy=document.documentElement.cloneNode(true);
  if(!importedScript){
    const resources=[...copy.querySelectorAll('link[rel="stylesheet"],script[src]')];
    await Promise.all(resources.map(async element=>{
      const isScript=element.tagName==='SCRIPT';
      const response=await fetch(element.getAttribute(isScript?'src':'href'));
      if(!response.ok)throw Error('Could not download all tracker files. Try again.');
      const inline=document.createElement(isScript?'script':'style');
      inline.textContent=await response.text();
      element.replaceWith(inline);
    }));
    copy.querySelector('link[rel="icon"]')?.remove();
  }
  let seed=copy.querySelector('#imported-steps');
  if(!seed){
    seed=document.createElement('script');seed.id='imported-steps';seed.type='application/json';
    copy.querySelector('head').append(seed);
  }
  seed.textContent=JSON.stringify(state.raw);
  seed.dataset.snapshot=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  copy.querySelector('#main').innerHTML='<p class="loading" role="status">Loading your steps…</p>';
  copy.querySelector('#toast').textContent='';
  copy.querySelector('#entry-dialog').removeAttribute('open');
  copy.querySelector('#device-dialog').removeAttribute('open');
  copy.querySelector('#device-sql').textContent='';
  copy.querySelector('#cloud-status').textContent='';
  copy.querySelector('#cloud-status').hidden=true;
  const blob=new Blob(['<!doctype html>\n',copy.outerHTML],{type:'text/html;charset=utf-8'});
  downloadFile(blob,'StepTracker-'+(state.data.last||'entries')+'.html');
}
function downloadFile(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportData(){
  const rows=state.data.rows;
  const blob=new Blob(['Date,Steps,Month average\r\n'+rows.map(r=>[r.date,r.steps,r.average].join(',')).join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});
  downloadFile(blob,'StepTracker-'+(state.data.last||'entries')+'.csv');
}
$('add').onclick=()=>edit();$('close').onclick=()=>$('entry-dialog').close();$('entry-date').onchange=loadForm;
$('entry-dialog').oncancel=e=>{if(busy)e.preventDefault();};
$('entry-form').onsubmit=e=>{e.preventDefault();if($('entry-form').reportValidity())saveEntry(Number($('entry-count').value));};
$('remove').onclick=()=>{
  if(confirming){saveEntry(null);return;}
  confirming=true;$('remove').textContent='Confirm removal';$('entry-hint').textContent='Remove this entry from the log and recalculate the records?';
};
$('main').onclick=e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.legacy){resolveLegacy(b).catch(err=>toast(err.message));return;}
  if(b.dataset.edit){edit(b.dataset.edit);return;}
  if(b.dataset.mode)state.mode=b.dataset.mode;
  if(b.dataset.records)state.records=b.dataset.records;
  const months=state.data?.months||[], i=months.indexOf(state.month);
  switch(b.dataset.act){
    case 'prev-week':weekly.start=S.add(selectedWeek(),-7);break;
    case 'next-week':{
      const next=S.add(selectedWeek(),7);
      weekly.start=next>=weekBounds().latest ? null : next;
      break;
    }
    case 'json':downloadFile(new Blob([JSON.stringify(Object.fromEntries(state.data.rows.map(r=>[r.date,r.steps])),null,2)+'\n'],{type:'application/json'}),'steps.json');return;
    case 'portable':savePortable().catch(()=>toast('Could not download the tracker. Please try again.'));return;case 'export':exportData();return;case 'retry':boot();return;
    case 'prev-month':state.month=months[i-1]||state.month;break;case 'next-month':state.month=months[i+1]||state.month;break;
    case 'prev-page':state.page=Math.max(0,state.page-1);break;case 'next-page':state.page++;break;
    case 'all-months':state.compare=[...months];state.choicesOpen=true;break;case 'clear-months':state.compare=[];state.choicesOpen=true;break;
  }
  render();
  if(b.dataset.act==='prev-week' || b.dataset.act==='next-week'){
    const button=document.querySelector(`[data-act="${b.dataset.act}"]`);
    (button.disabled ? $('week-date') : button).focus();
  }
};
$('main').onchange=e=>{
  const target=e.target;
  if(target.id==='week-date' && target.value && target.validity.valid){
    const start=S.startOfWeek(target.value);
    weekly.start=start===weekBounds().latest ? null : start;
  }
  if(target.id==='weekday-period'){
    if(target.value==='custom' && weekly.from===null){
      const {from,to}=weekdayRange();
      weekly.from=from;weekly.to=to;
    }
    weekly.period=target.value;
  }
  if(target.id==='weekday-month')weekly.month=target.value;
  if(target.id==='weekday-year')weekly.year=target.value;
  if(target.id==='weekday-from')weekly.from=target.value;
  if(target.id==='weekday-to')weekly.to=target.value;
  if(target.id==='month')state.month=target.value;
  if(target.id==='log-month'){state.logMonth=target.value;state.page=0;}
  if(target.id==='trend-range')state.range=target.value;
  if(target.id==='from')state.from=target.value;
  if(target.id==='to')state.to=target.value;
  if(target.dataset.compare){const m=target.dataset.compare;state.compare=target.checked?[...state.compare,m].sort():state.compare.filter(x=>x!==m);state.choicesOpen=true;}
  const focusId=target.id,focusMonth=target.dataset.compare;render();
  if(focusId)$(focusId)?.focus();else if(focusMonth)document.querySelector('[data-compare="'+focusMonth+'"]')?.focus();
};
let approvalId=null;
const approveRoute=()=>location.hash.match(/^#approve\/([0-9a-f]{64})$/)?.[1]||null;
async function openDevice(target=null){
  approvalId=target;
  $('device-error').textContent='';
  $('device-title').textContent=target?'Approve another browser':'Connect this browser';
  $('device-action').textContent=target?'Approve browser':'Check connection';
  $('device-link-area').hidden=!!target;
  $('device-message').textContent=target?'Approve this request only if you opened the link from your other browser. That browser will be able to edit your public step log.':'Open this approval link on a browser you have already connected, then check the connection here.';
  if(!target){
    const id=await StepCloud.id();
    $('device-link').value='https://2319bli.github.io/step-tracker/#approve/'+id;
    $('device-sql').value="INSERT INTO step_devices(id) VALUES ('"+id+"') ON CONFLICT(id) DO NOTHING;";
  }
  if(!$('device-dialog').open)$('device-dialog').showModal();
}
function closeDevice(){
  $('device-dialog').close();approvalId=null;
  if(approveRoute())history.replaceState(null,'',location.pathname+'#overview');
}
$('device-close').onclick=()=>{nextEdit=null;closeDevice();};
$('device-dialog').oncancel=()=>{nextEdit=null;approvalId=null;if(approveRoute())history.replaceState(null,'',location.pathname+'#overview');};
$('copy-device').onclick=async()=>{try{await navigator.clipboard.writeText($('device-link').value);toast('Approval link copied.');}catch{$('device-link').select();}};
$('device-action').onclick=async()=>{
  const b=$('device-action');b.disabled=true;
  try{
    if(!await StepCloud.connected())throw Error(approvalId?'Open this approval link on a browser already connected to StepTracker.':'This browser is awaiting approval.');
    if(approvalId)await StepCloud.approve(approvalId);
    const label=approvalId?'Browser approved.':'This browser is connected.';closeDevice();render();toast(label);
    if(nextEdit){const {date}=nextEdit;nextEdit=null;await edit(date);}
  }catch(err){$('device-error').textContent=err.message;}finally{b.disabled=false;}
};
async function resolveLegacy(button){
  const date=button.dataset.legacy,old=localChanges();if(!Object.hasOwn(old,date))return;
  if(!StepCloud.paired && !await StepCloud.connected()){await openDevice();return;}
  const local=old[date],expected=published[date]??null;
  button.disabled=true;
  try{
    if(button.dataset.use==='browser')await persist(date,local,expected);
    const remaining=localChanges();
    if(remaining[date]===local){delete remaining[date];if(deviceStorage)deviceStorage.setItem(localKey,JSON.stringify(remaining));else memoryChanges=remaining;}
    toast('Browser edit reviewed.');
  }finally{updateData(await readData());render();}
}
async function showRoute(){
  if(location.hash==='#records/2026-11-14') history.replaceState(null,'','#records');
  render();window.scrollTo(0,0);
  if(!importedScript && approveRoute())await openDevice(approveRoute());
}
window.addEventListener('hashchange',()=>showRoute().catch(err=>toast(err.message)));
window.addEventListener('storage',e=>{if(published && e.key===localKey){updateData(importedScript?localData():published);render();}});
let lastRefresh=0;
async function refreshCloud(){
  if(importedScript||!state.data||busy||document.hidden||Date.now()-lastRefresh<10000)return;
  lastRefresh=Date.now();
  try{updateData(await readData());render();}catch{}
}
window.addEventListener('focus',refreshCloud);
document.addEventListener('visibilitychange',refreshCloud);
if(!importedScript)setInterval(refreshCloud,60000);
async function boot(){
  try{
    updateData(await readData());state.compare=state.data.months.slice(-3);
    await showRoute();
    if(!importedScript)StepCloud.connected().then(()=>render()).catch(()=>{});
  }
  catch(err){$('main').innerHTML=empty('Your step history could not be loaded.')+quiet('retry','Retry');$('main').querySelector('p').textContent=err.message;}
}
boot();
