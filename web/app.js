/* Copyright Tax Policy Associates Limited 2026. MIT licence: see LICENSE.*/
(function () {
  'use strict';
  const M = window.ShoppingModel;
  const C = window.ShoppingComparison;
  const $ = id => document.getElementById(id);
  const loaded = M.decode(location.hash);
  let settings = loaded.settings;
  let result;
  let timer;
  const fields = new Map();
  const invalid = new Map();
  const fmt = (n,d=1) => n === null ? 'Not defined' : n.toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d});
  const bn = (n,d=1) => `£${fmt(n,d)}bn`;
  const message = value => { $('announcement').textContent=value; };
  const fieldLabel = c => c.key === 'spendingElasticity'
    ? (settings.twoElasticities ? 'Spending per visitor response' : 'Total spending response') : c.label;
  function sourceLink(c) {
    if (!c.page && !c.source) return null;
    const source=M.SOURCES[c.source || 'cebr'];
    const a=document.createElement('a');
    a.href=source.url+(c.page ? '#page='+c.page : '');
    a.textContent=c.page ? `${c.source==='obr'?'OBR':c.source==='visitbritain'?'VisitBritain':'Cebr'} p.${c.page}` : source.title;
    if (source.url.startsWith('https:')) {a.target='_blank';a.rel='noopener';}
    return a;
  }
  // Explanations moved out of the form and into an info box, because they are too
  // long to read inline and the form has to stay compact enough to embed.
  const INFO_ICON='<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.9" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="4.7" r=".95" fill="currentColor"/><path d="M8 7.3v4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  function openInfo(c) {
    $('info-title').textContent=fieldLabel(c);
    $('info-body').textContent=c.note;
    const links=$('info-links');links.replaceChildren();
    const source=sourceLink(c);
    if(source) links.append(source);
    // The article link goes to the passage about this input, not the top of the page.
    if(c.article){
      const explain=document.createElement('a');
      explain.href=M.ARTICLE.url+c.article;explain.textContent=M.ARTICLE.title;
      explain.target='_blank';explain.rel='noopener';
      // When the model is embedded in the article itself, scroll the page behind the
      // embed rather than opening a second copy of it. Cross-origin access throws, and
      // the plain link then does the job.
      explain.addEventListener('click',ev=>{
        try{
          if(window.top!==window.self && window.top.location.origin===location.origin){
            ev.preventDefault();window.top.location.hash=c.article;$('info').close();
          }
        }catch(err){/* cross-origin embed: follow the href instead */}
      });
      if(links.childNodes.length) links.append(document.createTextNode(' · '));
      links.append(explain);
    }
    const ours=document.createElement('a');
    ours.href=M.DISCUSSION.url+'#'+c.key;ours.textContent=M.DISCUSSION.title;
    ours.target='_blank';ours.rel='noopener';
    if(links.childNodes.length) links.append(document.createTextNode(' · '));
    links.append(ours);
    $('info').showModal();
  }
  function infoButton(c) {
    const b=document.createElement('button');b.type='button';b.className='info';
    b.innerHTML=INFO_ICON;b.setAttribute('aria-label','About '+c.label);
    b.addEventListener('click',()=>openInfo(c));
    return b;
  }
  // One decimal place everywhere. This is a model built from rounded inputs, so
  // more precision than that would be a false promise.
  const money = n => (n<0?'(':'')+'£'+fmt(Math.abs(n),1)+'bn'+(n<0?')':'');
  const million = n => fmt(n,1)+'m';
  const count = n => (Math.round(n/1000)*1000).toLocaleString('en-GB');
  const pct = (n,d=1) => fmt(n,d)+'%';
  // Cebr's published figures carry their own units, so compose them rather than
  // printing a bare number with a unit stuck on the end.
  function published(value,unit,digits) {
    if(value===null) return 'Not defined';
    const sign=value<0?'−':'', n=Math.abs(value);
    const trimmed=d=>Number(n.toFixed(d)).toLocaleString('en-GB',{maximumFractionDigits:d});
    // Money keeps its decimal place even when it is a zero, so a column of
    // figures lines up instead of alternating between £7bn and £6.9bn.
    if(unit==='£bn') return sign+'£'+fmt(n,digits)+'bn';
    if(unit==='£m') return sign+'£'+n.toLocaleString('en-GB',{minimumFractionDigits:digits,maximumFractionDigits:digits})+'m';
    if(unit==='£') return sign+'£'+trimmed(digits);
    if(unit==='%') return sign+trimmed(digits)+'%';
    if(unit==='million') return sign+trimmed(digits)+'m';
    return sign+trimmed(digits);
  }
  function buildControls() {
    for (const [key,p] of Object.entries(M.PRESETS)) {
      const b=document.createElement('button');b.type='button';b.textContent=p.label;b.dataset.preset=key;
      b.addEventListener('click',()=>applyPreset(key));$('presets').append(b);
    }
    for (const [index,group] of M.GROUPS.entries()) {
      const details=document.createElement('details');details.className='control-group';details.open=false;
      const summary=document.createElement('summary');summary.textContent=group.title;details.append(summary);
      details.addEventListener('toggle',syncExpandLabel);
      const container=document.createElement('div');container.className='group-fields';details.append(container);
      const groupControls=M.CONTROLS.filter(c=>c.group===group.id);
      // A switch owns the inputs it enables or disables, so they share a box and
      // it is obvious which numbers belong to which choice.
      const ownerOf=c=>c.enabledBy||c.disabledBy||null;
      const owned=new Set(groupControls.filter(c=>groupControls.some(owner=>owner.key===ownerOf(c))).map(c=>c.key));
      for (const c of groupControls) {
        if (owned.has(c.key)) continue;
        const dependants=groupControls.filter(d=>ownerOf(d)===c.key);
        if (c.type==='boolean') {
          const box=document.createElement('div');box.className='control-box';box.dataset.box=c.key;
          box.append(renderField(c,'box-switch'));
          if (dependants.length) {
            const inner=document.createElement('div');inner.className='box-fields';
            for (const d of dependants) inner.append(renderField(d));
            box.append(inner);
          } else box.dataset.solo='true';
          container.append(box);
        } else container.append(renderField(c));
      }
      $('controls').append(details);
    }
  }
  function renderField(c,extraClass) {
    const row=document.createElement('div');row.className='field field-'+c.type+(extraClass?' '+extraClass:'');row.dataset.field=c.key;
    const head=document.createElement('div');head.className='field-head';
    const label=document.createElement('label');label.className='field-label';label.htmlFor=c.key;label.textContent=c.label;
    head.append(label,infoButton(c));row.append(head);
    let input=document.createElement('input');input.id=c.key;
    let range,state;
    if (c.type==='choice') {
      // A fixed set of amounts rather than a slider, so the model is never asked
      // to price a voucher bigger than the shopping it is supposed to pay for.
      input=document.createElement('select');input.id=c.key;input.className='choice';
      for (const o of c.options) {
        const option=document.createElement('option');option.value=String(o.value);option.textContent=o.label;input.append(option);
      }
      const wrap=document.createElement('div');wrap.className='value-control';wrap.append(input);row.append(wrap);
      input.addEventListener('input',()=>{settings[c.key]=Number(input.value);update(false);});
    } else if (c.type==='boolean') {
      input.type='checkbox';input.setAttribute('role','switch');
      const wrap=document.createElement('div');wrap.className='switch-wrap';
      state=document.createElement('span');state.className='switch-state';state.setAttribute('aria-hidden','true');
      wrap.append(input,state);row.append(wrap);
      input.addEventListener('input',()=>{settings[c.key]=input.checked;update(false);});
    } else {
      input.type='number';input.min=c.min;input.max=c.max;input.step='any';input.inputMode='decimal';
      const wrap=document.createElement('div');wrap.className='value-control';
      const unit=document.createElement('span');unit.className='unit';unit.textContent=c.unit;wrap.append(input,unit);row.append(wrap);
      range=document.createElement('input');range.type='range';range.min=c.min;range.max=c.max;range.step=c.step;
      range.setAttribute('aria-label',c.label+' slider');row.append(range);
      input.addEventListener('input',()=>{
        const value=input.valueAsNumber;
        if (!Number.isFinite(value) || value<c.min || value>c.max) {
          invalid.set(c.key,`${c.label}: enter a number between ${c.min} and ${c.max}.`);input.setAttribute('aria-invalid','true');
        } else { invalid.delete(c.key);input.removeAttribute('aria-invalid');settings[c.key]=value;range.value=value; }
        update(false);
      });
      range.addEventListener('input',()=>{invalid.delete(c.key);input.removeAttribute('aria-invalid');settings[c.key]=Number(range.value);input.value=range.value;update(false);});
    }
    let hint;
    if(c.key==='arrivalsElasticity') {
      hint=document.createElement('p');hint.className='field-hint';hint.id='arrivals-hint';
      hint.textContent='Not used with a total spending response.';row.append(hint);
      input.setAttribute('aria-describedby',hint.id);
    }
    fields.set(c.key,{c,row,input,range,state,label,hint});
    return row;
  }
  function syncExpandLabel(){const allOpen=[...document.querySelectorAll('.control-group')].every(d=>d.open);$('expand').textContent=allOpen?'Collapse all':'Expand all';}
  function syncFields(rewrite) {
    for (const f of fields.values()) {
      const active=M.isActive(f.c,settings);
      f.label.textContent=fieldLabel(f.c);
      if(f.range)f.range.setAttribute('aria-label',fieldLabel(f.c)+' slider');
      if(f.hint)f.hint.hidden=active;
      f.row.classList.toggle('inactive',!active);f.input.disabled=!active;
      if (!active) {invalid.delete(f.c.key);f.input.removeAttribute('aria-invalid');}
      if(f.range) f.range.disabled=!active;
      if(f.c.type==='boolean') {f.input.checked=settings[f.c.key];f.state.textContent=settings[f.c.key]?'On':'Off';}
      else if(f.c.type==='choice') {f.input.value=String(settings[f.c.key]);}
      else if(rewrite || (active && f.active===false)) {
        // Show the input at its own stated precision. Writing the box does not
        // fire an input event, so the stored value keeps every significant digit.
        const shown=f.c.digits===undefined?settings[f.c.key]:Number(settings[f.c.key].toFixed(f.c.digits));
        f.input.value=shown;f.range.value=settings[f.c.key];
        f.input.removeAttribute('aria-invalid');
      }
      f.active=active;
    }
  }
  function cell(row,text,cls) {const td=document.createElement('td');td.textContent=text;if(cls)td.className=cls;row.append(td);return td;}
  // Laid out as a statement of account: headed sections, indented components,
  // ruled subtotals, and one column of right-aligned figures all the way down.
  function renderWorking(r) {
    const s=r.settings, rows=[];
    const head=t=>rows.push({type:'head',label:t});
    const line=(label,value,cls)=>rows.push({type:'line',label,value,cls});
    const total=(label,value)=>rows.push({type:'total',label,value});

    head('The saving a visitor receives');
    line('Visitor spending',money(s.spending));
    if(s.freeMoney){
      line('Visits',million(s.visits));
      line('Cash voucher each',`£${fmt(s.voucher,2)}`);
      total('Vouchers paid by the Exchequer',money(r.voucherCost));
    } else {
      const shopping=s.spending*s.shoppingShare/100;
      line(`Shopping share of that spending, ${pct(s.shoppingShare,0)}`,money(shopping));
      if(s.eligibility!==100) line(`Eligible for a refund, ${pct(s.eligibility,0)}`,money(r.eligibleShopping));
      line(`VAT within it, ${pct(100*r.vatFraction)}`,money(r.eligibleShopping*r.vatFraction));
      if(s.takeup!==100) line(`Claimed, ${pct(s.takeup,0)}`,money(r.staticRefunds));
      total('Refund paid by the Exchequer',money(r.staticRefunds));
      if(s.fee) line(`Less operator and retailer fees, ${pct(s.fee,0)}`,money(-(r.staticRefunds-r.cashRefundToVisitors)));
    }
    if(s.passThrough!==100) line(`Less price offset, ${pct(100-s.passThrough,0)}`,money(-r.priceOffset));
    total('Saving reaching the visitor',money(r.visitorSaving));
    line('As a share of the cost of a visit',pct(r.discount*100));

    head('How visitors respond');
    if(r.extraVisits === null) line('Additional visits', 'Not estimated');
    else line(`Arrivals response (Cebr’s method), ${pct(r.arrivalsGrowth*100)}`,million(r.extraVisits)+' visits');
    if(s.twoElasticities){
      line('Spending by those extra visitors',money(r.arrivalsSpending));
      line(`Spending response of existing visitors, ${pct(r.spendingGrowth*100)}`,money(r.originalVisitorsSpending));
      if(r.interaction) line('Interaction between the two',money(r.interaction));
    } else {
      line(`Aggregate spending response, ${pct(r.spendingGrowth*100)}`,money(r.originalVisitorsSpending));
    }
    total('Additional visitor spending',money(r.extraSpending));

    head('From spending to economic output');
    line('Additional visitor spending',money(r.extraSpending));
    line(`${s.multiplierOnSpending?'Cebr’s GVA ratio':'Illustrative GVA benchmark'}, £${fmt(r.gvaPerPoundSpending,2)} per £1 spent`,money(r.grossGva));
    if(!s.ignoreSubstitution) line(`Less activity displaced elsewhere, ${pct(100*(1-r.additionalShare))}`,money(r.gva-r.grossGva));
    total('Gross value added',money(r.gva));
    line('Supported jobs',count(r.jobs));

    head('The Exchequer account');
    line(`Tax on that output, ${pct(s.taxRate)}`,money(r.tax));
    line(s.freeMoney?'Vouchers to visitors who would have come anyway':'Refunds on purchases made anyway',money(-r.baselineCost));
    // Show the amount being left out rather than a zero, so the omission is visible.
    const inducedLabel=s.freeMoney?'Vouchers to visitors the scheme attracts':'Refunds on purchases the scheme causes';
    if(r.potentialInducedCost===null) line(inducedLabel+', not estimated','Not estimated','muted');
    else line(s.ignoreInducedRefundCost?inducedLabel+', not charged':inducedLabel,
      money(-r.potentialInducedCost),s.ignoreInducedRefundCost?'muted':null);
    total('Net Exchequer impact',money(r.netFiscal));

    $('working').replaceChildren();
    for(const row of rows){
      const tr=document.createElement('tr');tr.className=row.type+(row.cls?' '+row.cls:'');
      if(row.type==='head'){const th=document.createElement('th');th.colSpan=2;th.scope='colgroup';th.textContent=row.label;tr.append(th);}
      else {cell(tr,row.label);cell(tr,row.value,'numeric');}
      $('working').append(tr);
    }
  }
  function renderComparisons(r) {
    const comparisons=C.reconcile(r);$('comparisons').replaceChildren();
    for(const c of comparisons){
      const tr=document.createElement('tr');tr.dataset.comparison=c.key;
      const label=cell(tr,c.label+' ');const a=document.createElement('a');a.href=M.SOURCES.cebr.url+'#page='+c.page;a.textContent=`p.${c.page}`;a.target='_blank';a.rel='noopener';label.append(a);
      const digits=c.step<1 ? Math.round(-Math.log10(c.step)) : 0;
      cell(tr,published(c.target,c.unit,digits),'numeric');
      const unavailableVisits=['arrivalsGrowth','extraVisits','totalVisits','arrivalsSpending','tableVisits'].includes(c.key) && c.value === null;
      cell(tr,unavailableVisits?'Not estimated':published(c.value,c.unit,digits),'numeric');
      // A percentage says how far apart they are; "does not match" does not.
      const gap=c.value===null||!c.target ? null : 100*(c.value-c.target)/c.target;
      const text=c.match ? 'Matches' : gap===null ? 'Not comparable' : `${gap>=0?'+':'−'}${fmt(Math.abs(gap),1)}%`;
      cell(tr,text,'numeric '+(c.match?'status-match':'status-gap'));$('comparisons').append(tr);
    }
  }
  function update(rewrite=true) {
    clearTimeout(timer);
    if($('scenario-url')) { $('load-notice').replaceChildren(); $('load-notice').hidden=true; }
    syncFields(rewrite);
    const errors=[...invalid.values()];$('input-error').hidden=!errors.length;$('input-error').textContent=errors.join(' ');
    document.querySelector('.working-section').hidden=!!errors.length;
    $('reconciliation').hidden=!!errors.length;
    if(errors.length){
      for(const id of ['net','gva-headline','tax','refunds','extra-spending','visitors','jobs'])$(id).textContent='Check input';
      $('download').disabled=true;$('share').disabled=true;message(errors.join(' '));return;
    }
    $('download').disabled=false;$('share').disabled=false;
    result=M.calculate(settings);
    const key=M.presetName(settings);
    document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.preset===key?'true':'false'));
    $('scenario-name').textContent=key==='custom'?'Custom settings':'';
    $('net').textContent=(result.netFiscal>0?'+':result.netFiscal<0?'−':'')+bn(Math.abs(result.netFiscal));
    $('net').classList.toggle('negative',result.netFiscal<0);
    $('tax').textContent=bn(result.tax);$('refunds').textContent=bn(result.refunds);
    // Free lunch is a different scenario, so say so at the top rather than
    // leaving the reader to find the switch that produced these numbers.
    $('refunds-label').textContent=settings.freeMoney?'Cost of cash vouchers':'VAT refunds';
    $('voucher-tile').hidden=!settings.freeMoney;
    document.querySelector('.headline-pair').classList.toggle('has-voucher',settings.freeMoney);
    // whole pounds read cleanly as £100; the cost-matched £31.90 keeps its pence
    $('voucher-headline').textContent='£'+fmt(settings.voucher,Number.isInteger(settings.voucher)?0:2);
    $('gva-headline').textContent=bn(result.gva);
    $('extra-spending').textContent=bn(result.extraSpending);
    $('visitors').textContent=result.extraVisits === null ? 'Not estimated' : fmt(result.extraVisits)+'m';
    $('visitors').classList.toggle('not-estimated',result.extraVisits === null);
    $('visitors-note').textContent=result.extraVisits === null ? '' : 'Cebr’s method';
    $('visitors-help').hidden=result.extraVisits !== null;
    $('jobs').textContent=fmt(Math.round(result.jobs/1000)*1000,0);
    renderWorking(result);renderComparisons(result);
    // Keep the address in sync with the visible result. This also preserves
    // modified settings when a shared scenario is reloaded or bookmarked.
    history.replaceState(null,'','#'+M.encode(settings));
    clearTimeout(timer);timer=setTimeout(()=>message(`Results updated. Net Exchequer ${result.netFiscal<0?'cost':'gain'} ${bn(Math.abs(result.netFiscal))}.`),350);
  }
  function applyPreset(key){invalid.clear();settings={...M.PRESETS[key].values};$('load-notice').hidden=true;update();}
  function download(){
    clearTimeout(timer);
    if(window.top!==window.self) {
      const url=scenarioUrl();url.searchParams.set('export','1');
      const popup=window.open(url.href,'_blank');
      if(popup) {
        try{popup.opener=null;}catch{/* A sandbox can prevent access to the opened tab. */}
        message('Calculation opened in a separate tab. Select Download calculation there.');
      } else showScenarioUrl(url.href,'Your browser blocked the new tab. Open this calculation separately to download it.');
      return;
    }
    const payload={version:M.VERSION,scenario:M.presetName(settings),units:'Money in £bn unless identified; visits in millions; jobs in persons supported.',
      qualification:'Reconstruction and illustrative alternatives. The £1.44 historical GVA benchmark includes government spending and investment in its source totals; it is not a measured marginal visitor-spending effect. Fiscal results depend on the selected benchmark and overall additionality. No fitting to published outputs. See the methodology for sources and limitations.',
      settings,result,reconciliation:C.reconcile(result).map(({get,...row})=>row),controls:M.CONTROLS,sources:M.SOURCES};
    const blob=new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='tax-free-shopping-calculation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Download requested. The JSON includes the inputs and calculation.');
  }
  function scenarioUrl(){const url=new URL(location.href);url.searchParams.delete('export');url.hash=M.encode(settings);return url;}
  function showScenarioUrl(url,description){
    const notice=$('load-notice');notice.hidden=false;
    const label=document.createElement('label');label.htmlFor='scenario-url';label.textContent=description;
    const input=document.createElement('input');input.id='scenario-url';input.type='text';input.readOnly=true;input.value=url;
    const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent='Open calculation in a separate tab';
    notice.replaceChildren(label,input,link);input.focus();input.select();
  }
  async function share(){
    clearTimeout(timer);
    const url=scenarioUrl();
    try{await navigator.clipboard.writeText(url.href);message('Scenario link copied.');$('share').textContent='Link copied';setTimeout(()=>$('share').textContent='Copy scenario link',2000);}
    catch{showScenarioUrl(url.href,'Copy this link to share the current settings.');}
  }
  buildControls();
  if(loaded.notices.length){$('load-notice').hidden=false;$('load-notice').textContent=loaded.notices.join(' ');}
  $('download').addEventListener('click',download);$('share').addEventListener('click',share);
  $('visitors-help').addEventListener('click',()=>openInfo({label:'Why visits are not estimated',note:'The total spending response includes both additional visitors and changes in spending per visitor. It does not tell us how much comes from each.',article:'#method-demand'}));
  $('expand').addEventListener('click',()=>{const groups=[...document.querySelectorAll('.control-group')];const expand=groups.some(d=>!d.open);groups.forEach(d=>d.open=expand);syncExpandLabel();});
  // Section links move around the page; only scenario fragments replace inputs.
  window.addEventListener('hashchange',()=>{if(M.isSectionAnchor(location.hash)){history.replaceState(null,'','#'+M.encode(settings));return;}const next=M.decode(location.hash);settings=next.settings;invalid.clear();$('load-notice').hidden=!next.notices.length;$('load-notice').textContent=next.notices.join(' ');update();});
  update();
  if(new URL(location.href).searchParams.get('export')==='1') {
    $('load-notice').hidden=false;$('load-notice').textContent='Select Download calculation to save the JSON file from this separate tab.';
  }
})();
