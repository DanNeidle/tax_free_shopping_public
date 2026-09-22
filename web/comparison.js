/* Copyright Tax Policy Associates Limited 2026. MIT licence: see LICENSE.
   Cebr's published results, for comparison only.  */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShoppingComparison = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Precision follows the printed table, not exact equality with a rounded figure.
  // The £1.54 row tests one reading of Cebr's ratio, not a known workbook formula.
  // Both ledgers are calculated without reference to anything below.
  const TARGETS = [
    {key:'baseline',label:'Visitor spending baseline',get:r=>r.settings.spending,target:33.2,step:0.1,unit:'£bn',page:19},
    {key:'eligibleShopping',label:'Eligible shopping',target:8.3,step:0.1,unit:'£bn',page:19},
    {key:'netShopping',label:'Shopping excluding VAT',target:7.0,step:0.1,unit:'£bn',page:19},
    {key:'shoppingPerVisitor',label:'Shopping per visitor',target:192,step:1,unit:'£',page:19},
    {key:'netShoppingPerVisitor',label:'Shopping per visitor excluding VAT',target:160,step:1,unit:'£',page:19},
    {key:'vatPerVisitor',label:'VAT per visitor',target:32,step:1,unit:'£',page:19},
    {key:'discount',label:'Visitor price reduction',get:r=>r.discount*100,target:4.2,step:0.1,unit:'%',page:19},
    {key:'arrivalsGrowth',label:'Arrivals increase',get:r=>r.arrivalsGrowth === null ? null : r.arrivalsGrowth*100,target:5.4,step:0.1,unit:'%',page:19},
    {key:'extraVisits',label:'Additional visits (headline)',target:2.3,step:0.1,unit:'million',page:19},
    {key:'totalVisits',label:'Visits after the change',target:46,step:1,unit:'million',page:19},
    {key:'arrivalsSpending',label:'Spending from additional visits',target:1.8,step:0.1,unit:'£bn',page:19},
    {key:'spendingGrowth',label:'Spending response',get:r=>r.spendingGrowth*100,target:6.7,step:0.1,unit:'%',page:20},
    {key:'spendingTerm',label:'Further spending term',target:2.3,step:0.1,unit:'£bn',page:20},
    {key:'extraSpending',label:'Combined extra spending (headline)',target:4.1,step:0.1,unit:'£bn',page:20},
    {key:'gva',label:'GVA (headline)',target:11.5,step:0.1,unit:'£bn',page:20},
    {key:'jobs',label:'Supported jobs (headline)',target:153000,step:1000,unit:'jobs',page:20},
    {key:'tableVisits',label:'Additional visits (national table)',get:r=>r.extraVisits === null ? null : r.extraVisits*1e6,target:2350000,step:10000,unit:'visits',page:22},
    {key:'tableSpending',label:'Extra spending (national table)',get:r=>r.extraSpending*1000,target:4136,step:1,unit:'£m',page:22},
    {key:'tableGva',label:'GVA (national table)',get:r=>r.gva*1000,target:11476,step:1,unit:'£m',page:22},
    {key:'tableJobs',label:'Supported jobs (national table)',get:r=>r.jobs,target:152900,step:100,unit:'jobs',page:22},
    {key:'tax',label:'Additional tax receipts',target:4.0,step:0.1,unit:'£bn',page:21},
    {key:'staticRefunds',label:'VAT refunds (Cebr’s published bill: baseline purchases only)',target:1.4,step:0.1,unit:'£bn',page:21},
    {key:'netFiscalBaselineRefunds',label:'Net Exchequer gain (on that baseline-only bill)',target:2.6,step:0.1,unit:'£bn',page:21},
    {key:'netPerTotalRefund',label:'Net gain per £1 of the whole refund bill (possible interpretation of Cebr’s £1.54)',target:1.54,step:0.01,unit:'£',page:21}
  ];
  function reconcile(r) { return TARGETS.map(t=>{const value=t.get?t.get(r):r[t.key];return {...t,value,match:value!==null && value>=t.target-t.step/2-1e-10 && value<t.target+t.step/2-1e-10};}); }
  return {reconcile};
});
