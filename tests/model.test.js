// Copyright Tax Policy Associates Limited 2026. MIT licence: see LICENSE.
// The accounting tests. Economic expectations are set independently of Cebr's
// published outputs, which appear only as comparisons.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const M={...require('../web/model.js'),...require('../web/comparison.js')};
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('stated inputs give calculated outputs without forcing published targets',()=>{
  const r=M.calculate();near(r.extraSpending,4.131555555555556);near(r.gva,11.568355555555556);near(r.jobs,164242.085048011,1e-6);
  near(r.netFiscal,2.596180977777778);assert.equal(r.tax.toFixed(1),'4.0');assert.equal(r.refunds.toFixed(1),'1.4');
  // Assert what we actually claim, which is that Cebr's own fiscal figures come
  // out. Pinning the total match count would reward keeping a number up, which
  // is the pressure the no-fitting rule exists to remove.
  assert.equal(r.tax.toFixed(1),'4.0');assert.equal(r.staticRefunds.toFixed(1),'1.4');assert.equal(r.netFiscalBaselineRefunds.toFixed(1),'2.6');
  assert.equal(M.DEFAULTS.spending,33.2);near(M.DEFAULTS.visits,43.6*33.2/33.4);assert.equal(M.DEFAULTS.multiplier,2.8);assert.equal(M.DEFAULTS.taxRate,34.4);
  // The default reproduces Cebr's own ledger, so every correction starts off.
  for(const on of ['multiplierOnSpending','twoElasticities','ignoreInducedRefundCost','ignoreSubstitution'])assert.equal(M.DEFAULTS[on],true,on);
  assert.equal(M.DEFAULTS.fee,0,'Cebr deducts no refund fee');
});
test('VAT and fees distinguish refund cost from the consumer saving',()=>{
  const r=M.calculate({spending:.0000001,shoppingShare:100,vat:20,fee:36});near(r.staticRefunds*1e9,100/6);near(r.visitorSaving*1e9,100/6*.64);near(r.discount,.10666666666666667);
});
test('100% fees remove the stimulus, preserving the baseline cost',()=>{const r=M.calculate({fee:100,ignoreInducedRefundCost:false});near(r.extraSpending,0);near(r.tax,0);near(r.refunds,r.staticRefunds);near(r.netFiscal,-r.refunds);});
test('the two responses compound rather than add',()=>{const r=M.calculate();near(r.extraSpending,r.settings.spending*((1+r.arrivalsGrowth)*(1+r.spendingGrowth)-1));near(r.interaction,r.arrivalsSpending*r.spendingGrowth);});
test('a single elasticity is independent of the arrivals coefficient',()=>{const a=M.calculate({twoElasticities:false,arrivalsElasticity:-1}),b=M.calculate({twoElasticities:false,arrivalsElasticity:-3});near(a.extraSpending,b.extraSpending);assert.equal(a.extraVisits,null);assert.equal(b.extraVisits,null);assert.equal(a.arrivalsGrowth,null);assert.equal(a.totalVisits,null);assert.equal(a.arrivalsSpending,null);near(a.extraSpending,a.settings.spending*a.spendingGrowth);near(a.interaction,0);});
test('the price denominator is UK spending alone, with no fare component',()=>{const a=M.calculate({spending:40,visits:40});near(a.denominator,40);assert.equal('fare' in a.settings,false,'the fare control has been removed');assert.equal(a.fareCost,undefined,'and no fare cost is reported');});
test('the value-added conversion and displacement stay separate',()=>{const share=58/113.1;const a=M.calculate(),b=M.calculate({multiplierOnSpending:false}),c=M.calculate({multiplierOnSpending:false,ignoreSubstitution:false,additionalityDirect:40,additionalityIndirect:40,additionalityInduced:40});
  near(b.extraSpending,a.extraSpending);near(b.grossGva,a.gva*share);near(c.gva,a.gva*share*.4);near(c.tax,a.tax*share*.4);});
test('equal additionality across rounds is exactly a flat haircut',()=>{for(const share of [0,17,50,100]){const a=M.calculate(),b=M.calculate({ignoreSubstitution:false,additionalityDirect:share,additionalityIndirect:share,additionalityInduced:share});near(b.gva,a.gva*share/100);near(b.additionalShare,share/100);near(b.effectiveMultiplier,2.8*share/100);}});
test('the rounds come from the published Type I and Type II multipliers',()=>{
  const typeOne=126.9/58,typeTwo=160.5/58;
  const onlyDirect=M.calculate({ignoreSubstitution:false,additionalityDirect:100,additionalityIndirect:0,additionalityInduced:0});
  near(onlyDirect.additionalShare,1/typeTwo);
  const noInduced=M.calculate({ignoreSubstitution:false,additionalityDirect:100,additionalityIndirect:100,additionalityInduced:0});
  near(noInduced.additionalShare,typeOne/typeTwo);
  // Dropping the employee-spending round leaves the published Type I figure of 2.2.
  assert.equal(noInduced.effectiveMultiplier.toFixed(1),'2.2');
  near(M.calculate({ignoreSubstitution:false,additionalityDirect:0,additionalityIndirect:0,additionalityInduced:0}).gva,0);
});
test('the first three presets are the published approach, the corrections and our central case',()=>{
  const cebr=M.calculate(M.PRESETS.cebr.values),corrected=M.calculate(M.PRESETS.corrected.values),central=M.calculate(M.PRESETS.central.values);
  near(cebr.netFiscal,2.596180977777778);near(cebr.gva,11.568355555555556);
  assert.equal(cebr.netFiscal.toFixed(1),'2.6');assert.equal(cebr.tax.toFixed(1),'4.0');assert.equal(cebr.refunds.toFixed(1),'1.4');
  assert.ok(corrected.netFiscal<0&&corrected.gva<cebr.gva/3,'corrections remove the surplus');
  assert.ok(central.netFiscal<0&&central.gva<corrected.gva,'our central case is no more favourable');
  for(const key of Object.keys(M.PRESETS))assert.equal(M.presetName(M.PRESETS[key].values),key);
});
test('induced refunds change the ledger, not the ex-ante incentive',()=>{const a=M.calculate({ignoreInducedRefundCost:true}),b=M.calculate({ignoreInducedRefundCost:false});near(a.discount,b.discount);near(a.extraSpending,b.extraSpending);near(b.refunds-a.refunds,b.extraSpending/24);near(a.netFiscal-b.netFiscal,b.extraSpending/24);assert.equal(b.refunds.toFixed(1),'1.6');assert.equal(b.netFiscal.toFixed(1),'2.4');});
test('zero take-up, eligibility, VAT or spending removes the stimulus',()=>{for(const input of [{takeup:0},{eligibility:0},{vat:0},{spending:0}]){const r=M.calculate({...input,ignoreInducedRefundCost:false});near(r.refunds,0);near(r.extraSpending,0);near(r.netFiscal,0);assert.equal(r.taxPerRefund,null);}});
test('values behind an unset switch have no economic effect',()=>{const a=M.calculate(),b=M.calculate({additionalityDirect:0,additionalityIndirect:0,additionalityInduced:0});near(a.netFiscal,b.netFiscal);near(a.extraSpending,b.extraSpending);});
test('the elasticities are plain inputs with no switch between them',()=>{const r=M.calculate({arrivalsElasticity:-0.9,spendingElasticity:-0.7,twoElasticities:false,taxRate:15});assert.equal(r.arrivalsGrowth,null);near(r.spendingGrowth,.7/24);near(r.tax,r.gva*.15);near(r.extraSpending,r.settings.spending*r.spendingGrowth);});
test('normalisation rejects invalid types and clamps bounds',()=>{const n=M.normalise({spending:NaN,visits:0,fee:Infinity,twoElasticities:'true',taxRate:900});assert.equal(n.settings.spending,M.DEFAULTS.spending);assert.equal(n.settings.visits,.01);assert.equal(n.settings.twoElasticities,true);assert.equal(n.settings.taxRate,100);assert.equal(n.notices.length,5);});
test('share URLs preserve the full numerical precision of every setting',()=>{const s={...M.DEFAULTS,spending:33.234567891,fee:37,ignoreSubstitution:false};assert.deepEqual(M.decode('#'+M.encode(s)).settings,s);assert.ok(M.decode('#garbage').notices.length);assert.ok(M.decode(encodeURIComponent(JSON.stringify({v:99,settings:{}}))).notices.length);});
test('presets are complete and the defaults remain immutable',()=>{const before=JSON.stringify(M.DEFAULTS);M.calculate({takeup:50});assert.equal(JSON.stringify(M.DEFAULTS),before);for(const p of Object.values(M.PRESETS))assert.equal(Object.keys(p.values).length,M.CONTROLS.length);assert.equal(M.presetName({...M.DEFAULTS}),'cebr');assert.equal(M.presetName({...M.DEFAULTS,fee:21}),'custom');});
test('rounding cannot resolve the outstanding accounting identities',()=>{
  // Cebr's £7.0bn of shopping excluding VAT is unreachable from a baseline that rounds to £33.2bn.
  assert.ok(33.25*.25/1.2<6.95);
  // Its £1.4bn refund bill cannot include induced purchases: the whole bill exceeds the interval.
  assert.ok(M.calculate().totalRefunds>1.45);
  // Nor can £4.0bn of receipts less the whole bill ever round to its £2.6bn net gain.
  assert.ok(4.05-M.calculate().totalRefunds<2.55);
});
test('both refund bills and both ratios are always reported, whatever the headline switch',()=>{
  for(const ignoreInducedRefundCost of [false,true]){
    const r=M.calculate({ignoreInducedRefundCost});
    near(r.totalRefunds,r.staticRefunds+r.potentialInducedRefunds);
    near(r.netFiscalBaselineRefunds,r.tax-r.staticRefunds-r.admin);
    near(r.netFiscalTotalRefunds,r.tax-r.totalRefunds-r.admin);
    near(r.netPerBaselineRefund,r.grossPerBaselineRefund-1);
    near(r.netPerTotalRefund,r.grossPerTotalRefund-1);
    near(r.netFiscal,ignoreInducedRefundCost?r.netFiscalBaselineRefunds:r.netFiscalTotalRefunds);
  }
});
test('rounding comparison includes its lower bound and excludes its upper bound',()=>{const r=M.calculate();r.tax=3.95;assert.ok(M.reconcile(r).find(x=>x.key==='tax').match);r.tax=4.05;assert.equal(M.reconcile(r).find(x=>x.key==='tax').match,false);});
test('input corners remain finite and preserve the fiscal identity',()=>{for(const takeup of [0,50,100])for(const fee of [0,50,100])for(const twoElasticities of [false,true])for(const ignoreInducedRefundCost of [false,true]){const r=M.calculate({takeup,fee,twoElasticities,ignoreInducedRefundCost});near(r.netFiscal,r.tax-r.refunds-r.admin);assert.ok(r.refunds>=0);assert.ok(r.extraSpending>=0);assert.ok(Number.isFinite(r.gva));}});

test('section anchors are navigation, not malformed saved scenarios',()=>{for(const hash of ['#assumptions','#reconciliation']){assert.ok(M.isSectionAnchor(hash));assert.deepEqual(M.decode(hash).notices,[]);}assert.equal(M.isSectionAnchor('#invalid'),false);});

test('100% pass-through leaves the source-based default unchanged',()=>{const r=M.calculate({passThrough:100});near(r.netFiscal,2.596180977777778);near(r.extraSpending,4.131555555555556);near(r.refunds,1.383333333333333);});
test('partial pass-through changes the incentive and induced refunds, not baseline refunds',()=>{const a=M.calculate({passThrough:100,ignoreInducedRefundCost:false}),b=M.calculate({passThrough:50,ignoreInducedRefundCost:false});near(b.visitorSaving,a.visitorSaving/2);near(b.cashRefundToVisitors,a.cashRefundToVisitors);near(b.priceOffset,a.cashRefundToVisitors/2);near(b.staticRefunds,a.staticRefunds);assert.ok(b.totalRefunds<a.totalRefunds);near(b.netFiscal,.492729346296296);});
test('fee and price-incidence deductions are distinct and multiplicative',()=>{const r=M.calculate({fee:20,passThrough:50});near(r.effectiveConsumerShare,.4);near(r.per100Purchase.fees,10/3);near(r.per100Purchase.cashRefund,40/3);near(r.per100Purchase.priceOffset,20/3);near(r.per100Purchase.effectiveSaving,20/3);near(r.per100Purchase.cashRefund-r.per100Purchase.priceOffset,r.per100Purchase.effectiveSaving);});
test('zero pass-through removes demand effects but not refunds',()=>{const r=M.calculate({passThrough:0,ignoreInducedRefundCost:false});near(r.extraSpending,0);near(r.tax,0);near(r.refunds,r.staticRefunds);near(r.netFiscal,-r.staticRefunds);});
test('unsupported scenario versions restore current defaults',()=>{for(const version of [1,2]){const old={v:version,settings:{...M.DEFAULTS,passThrough:30}};const loaded=M.decode('#'+encodeURIComponent(JSON.stringify(old)));assert.deepEqual(loaded.settings,M.DEFAULTS);assert.ok(loaded.notices.length);}});
test('decoder rejects non-object settings instead of silently accepting them',()=>{assert.ok(M.decode(encodeURIComponent(JSON.stringify({v:M.VERSION,settings:'invalid'}))).notices.length);assert.ok(M.normalise(null).notices.length);assert.ok(M.normalise([]).notices.length);});
test('published comparisons are isolated from the engine',()=>{
  const engine=require('../web/model.js');assert.equal(engine.reconcile,undefined);
  const before=engine.calculate();const rows=M.reconcile(before);rows.forEach(r=>{r.target=-999;});
  assert.deepEqual(engine.calculate(),before);assert.equal(engine.DEFAULTS.gvaPerJob,324e9/4.6e6);
});
test('the presets differ only where the analysis says they should',()=>{
  const cebr=M.PRESETS.cebr.values;
  assert.equal(cebr.twoElasticities,true);
  assert.equal(Object.keys(M.PRESETS).length,4,'three analytical presets plus the free-money test');
  // Preset 2 changes only the four corrections with a determinate answer.
  const corrected=M.PRESETS.corrected.values;
  const changed=M.CONTROLS.map(c=>c.key).filter(k=>cebr[k]!==corrected[k]);
  assert.deepEqual(changed.sort(),['fee','ignoreInducedRefundCost','multiplierOnSpending','twoElasticities'].sort());
  // The fee rate and the value-added share already sit at their sourced values,
  // so each correction is the switch alone rather than a switch plus a number.
  assert.equal(cebr.fee,0,'Cebr deducts no fee');assert.equal(cebr.salience,100,'and assumes visitors expect the lot');
  // Preset 3 adds only the judgment calls, and corrects nothing further.
  const central=M.PRESETS.central.values;
  const added=M.CONTROLS.map(c=>c.key).filter(k=>corrected[k]!==central[k]);
  assert.deepEqual(added.sort(),['eligibility','ignoreSubstitution','spendingElasticity','takeup'].sort());
  assert.equal(central.eligibility,80,'our central case prices the four VisitBritain shopping categories against the three eligibility tests');
  assert.equal(cebr.taxRate,34.4,'Cebr uses the OECD average ratio');
  assert.equal(central.taxRate,34.4,'our central case retains the same illustrative tax yield as Cebr');
  assert.equal(central.passThrough,100,'no further pass-through deduction is stacked on the fee');
});

test('unestimated visits remain null in reconciliation and exports',()=>{const r=M.calculate(M.PRESETS.corrected.values);const rows=M.reconcile(r);for(const key of ['arrivalsGrowth','extraVisits','totalVisits','arrivalsSpending','tableVisits']){const row=rows.find(x=>x.key===key);assert.equal(row.value,null,key);assert.equal(row.match,false,key);}assert.equal(JSON.parse(JSON.stringify(r)).extraVisits,null);assert.equal(M.isActive(M.CONTROLS.find(c=>c.key==='arrivalsElasticity'),r.settings),false);});

/* ---- Free money: a cash voucher per arrival in place of the refund ---- */
const VOUCHER_COST = v => v*(43.6*33.2/33.4)/1000;
test('free money is off everywhere except its own preset, and changes nothing when off',()=>{
  assert.equal(M.DEFAULTS.freeMoney,false);assert.equal(M.DEFAULTS.voucher,100,'the scenario opens on a £100 voucher');
  for(const key of ['cebr','corrected','central']){
    assert.equal(M.PRESETS[key].values.freeMoney,false,key);
    // The reconstruction must be untouched by the presence of the new branch,
    // whatever voucher value is sitting behind the unset switch.
    const base=M.calculate(M.PRESETS[key].values);
    const other=M.calculate({...M.PRESETS[key].values,voucher:150});
    const outputs=r=>{const {settings,...rest}=JSON.parse(JSON.stringify(r));return rest;};
    assert.deepEqual(outputs(other),outputs(base),key+': a voucher value is inert while free money is off');
  }
});
test('free money replaces the refund with a flat payment per arrival',()=>{
  const r=M.calculate({freeMoney:true,voucher:100});
  near(r.staticRefunds,0);near(r.voucherCost,VOUCHER_COST(100));near(r.baselineCost,VOUCHER_COST(100));
  near(r.visitorSaving,VOUCHER_COST(100));near(r.discount,VOUCHER_COST(100)/33.2);
  near(r.netFiscal,r.tax-r.refunds-r.admin);
});
test('the cost-matched voucher reproduces Cebr’s published result',()=>{
  // On Cebr's assumptions nothing is lost to fees, take-up or pass-through, so a
  // refund IS a cash transfer and an equal-cost voucher is indistinguishable.
  // The identity is exact at Cebr's own refund bill per visitor.
  const refund=M.calculate();
  const exact=refund.staticRefunds*1000/M.DEFAULTS.visits;
  near(exact*M.DEFAULTS.visits/1000,refund.staticRefunds);
  assert.equal(exact.toFixed(2),'31.92','Cebr’s refund bill spread over every visit');
  // The offered button rounds that to £31.90, which reproduces every published
  // figure at the precision Cebr publishes them.
  const voucher=M.calculate({...M.PRESETS.freeMoney.values,voucher:31.9});
  assert.equal(voucher.settings.voucher,31.9);
  for(const key of ['extraSpending','gva','tax','refunds','netFiscal'])
    assert.equal(voucher[key].toFixed(1),refund[key].toFixed(1),key);
  for(const key of ['discount','extraSpending','gva','tax','refunds','netFiscal'])
    assert.ok(Math.abs(voucher[key]/refund[key]-1)<1e-3,`${key} within the rounding of £31.92 to £31.90`);
});
test('the voucher is a fixed set of options, not a free number',()=>{
  const c=M.CONTROLS.find(x=>x.key==='voucher');
  assert.equal(c.type,'choice');
  assert.deepEqual(c.options.map(o=>o.value),[0,31.9,50,100,150]);
  assert.equal(c.enabledBy,'freeMoney');
  assert.equal(M.normalise({voucher:75}).settings.voucher,M.DEFAULTS.voucher,'an unoffered amount falls back');
  assert.ok(M.normalise({voucher:75}).notices.length);
  assert.equal(M.normalise({voucher:150}).settings.voucher,150);
  assert.equal(M.isActive(c,{freeMoney:false}),false);assert.equal(M.isActive(c,{freeMoney:true}),true);
});
test('the VAT-refund inputs have no effect once free money is on',()=>{
  const base={freeMoney:true,voucher:100};
  const a=M.calculate(base);
  for(const input of [{shoppingShare:0},{eligibility:0},{vat:0},{takeup:0},{fee:100}]){
    const b=M.calculate({...base,...input});
    near(b.netFiscal,a.netFiscal);near(b.extraSpending,a.extraSpending);near(b.refunds,a.refunds);
    assert.equal(M.isActive(M.CONTROLS.find(c=>c.key===Object.keys(input)[0]),b.settings),false,Object.keys(input)[0]+' is greyed out');
  }
});
test('pass-through and salience still bite on a voucher',()=>{
  const a=M.calculate({freeMoney:true,voucher:100});
  const b=M.calculate({freeMoney:true,voucher:100,passThrough:50});
  const c=M.calculate({freeMoney:true,voucher:100,salience:50});
  near(b.visitorSaving,a.visitorSaving/2);near(c.discount,a.discount/2);
  // The Exchequer still pays the full voucher even if none of it changes behaviour.
  near(M.calculate({freeMoney:true,voucher:100,passThrough:0}).baselineCost,VOUCHER_COST(100));
  near(M.calculate({freeMoney:true,voucher:100,passThrough:0}).extraSpending,0);
});
test('vouchers paid to induced arrivals follow the same switch as induced refunds',()=>{
  const off=M.calculate({freeMoney:true,voucher:100,ignoreInducedRefundCost:true});
  const on=M.calculate({freeMoney:true,voucher:100,ignoreInducedRefundCost:false});
  near(off.discount,on.discount);near(off.extraSpending,on.extraSpending);
  near(on.potentialInducedCost,on.extraVisits*100/1000);
  near(on.refunds-off.refunds,on.potentialInducedCost);
  // With one aggregate elasticity there is no arrivals count, so the cost of
  // vouchers to induced visitors cannot be estimated and is reported as such.
  const aggregate=M.calculate({freeMoney:true,voucher:100,twoElasticities:false,ignoreInducedRefundCost:false});
  assert.equal(aggregate.extraVisits,null);assert.equal(aggregate.potentialInducedCost,null);
  near(aggregate.refunds,aggregate.baselineCost);
});
test('the free-money preset is Cebr’s approach with the switch thrown and nothing else',()=>{
  const free=M.PRESETS.freeMoney.values,cebr=M.PRESETS.cebr.values;
  const changed=M.CONTROLS.map(c=>c.key).filter(k=>cebr[k]!==free[k]);
  assert.deepEqual(changed,['freeMoney']);
  assert.equal(free.voucher,100);
  assert.equal(M.presetName(free),'freeMoney');
  const r=M.calculate(free);
  assert.ok(r.netFiscal>0,'Cebr’s method makes a cash handout profitable');
  assert.ok(r.tax/r.refunds>2.79,'and the return per pound exceeds the q*M*e floor');
});
test('correcting both errors is what stops free money paying for itself',()=>{
  const v={freeMoney:true,voucher:100};
  assert.ok(M.calculate(v).netFiscal>0,'as published');
  assert.ok(M.calculate({...v,multiplierOnSpending:false}).netFiscal>0,'multiplier alone is not enough');
  assert.ok(M.calculate({...v,twoElasticities:false}).netFiscal>0,'double counting alone is not enough');
  assert.ok(M.calculate({...v,multiplierOnSpending:false,twoElasticities:false}).netFiscal<0,'both together');
});
test('every offered voucher stays within eligible shopping, so the goods restriction never binds',()=>{
  for(const preset of ['cebr','central']){
    const s=M.PRESETS[preset].values;
    const eligiblePerVisitor=s.spending*s.shoppingShare/100*s.eligibility/100*1000/s.visits;
    for(const o of M.CONTROLS.find(c=>c.key==='voucher').options)
      assert.ok(o.value<=eligiblePerVisitor,`£${o.value} exceeds £${eligiblePerVisitor.toFixed(2)} of eligible shopping under ${preset}`);
  }
});
test('free money keeps the fiscal identity across the option set',()=>{
  for(const voucher of [0,31.9,50,100,150])for(const twoElasticities of [false,true])for(const ignoreInducedRefundCost of [false,true]){
    const r=M.calculate({freeMoney:true,voucher,twoElasticities,ignoreInducedRefundCost});
    near(r.netFiscal,r.tax-r.refunds-r.admin);
    assert.ok(r.refunds>=0);assert.ok(r.extraSpending>=0);assert.ok(Number.isFinite(r.gva));
    assert.ok(r.discount<1,'every offered voucher stays below a 100% discount');
  }
});
