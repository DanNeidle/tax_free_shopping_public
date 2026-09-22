/* Copyright Tax Policy Associates Limited 2026. MIT licence: see LICENSE.
   Reconstruction of Cebr's tax-free shopping calculation. Money in £bn, visits in
   millions. Runs in the browser and in Node. Not an independently calibrated costing. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShoppingModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 6;
  // Our own benchmark, from VisitBritain's tourism economy study. It publishes both
  // multiplier types for UK tourism GVA, so a footprint splits into its three rounds
  // with nothing invented: Type I is 126.9/58.0, Type II 160.5/58.0 (p.11 and Figure
  // 4.2.2b, p.29). As shares they sum to one. This is evidence for our corrections,
  // not Cebr's source: Cebr derives its own multiplier, described in the notes below.
  const TYPE_I = 126.9 / 58, TYPE_II = 160.5 / 58;
  // Same study, p.11: £58.0bn of direct tourism value added against £113.1bn of
  // tourist spending. Correcting the multiplier base needs this share.
  const DIRECT_VALUE_ADDED = 58 / 113.1;
  const ROUNDS = Object.freeze({
    direct: 1 / TYPE_II,
    indirect: (TYPE_I - 1) / TYPE_II,
    induced: (TYPE_II - TYPE_I) / TYPE_II
  });
  const SOURCES = {
    cebr: { title: 'Cebr report, September 2026', url: 'https://holba.london/content/images/Cebr-report-for-Heart-of-London-Business-Alliance.pdf' },
    visitbritain: { title: 'VisitBritain: the economic contribution of the tourism economy, 2013', url: 'https://www.visitbritain.org/sites/ind/files/2023-08/The%20economic%20contribution%20of%20the%20tourism%20economy%20in%20the%20UK.pdf' },
    obr: { title: 'OBR costing review, 2024', url: 'https://obr.uk/docs/dlm_uploads/VAT_RES_costing_review_.pdf' },
    passthrough: { title: 'Our pass-through review', url: 'https://github.com/DanNeidle/tax_free_shopping_public' },
    foresight: { title: 'VisitBritain Foresight 112, February 2013', url: 'https://www.visitbritain.org/media/2356/download?attachment' },
  };
  // The public code and article provide the supporting explanation.
  const DISCUSSION = { title: 'See the code', url: 'https://github.com/DanNeidle/tax_free_shopping_public' };
  // Each control carries an `article` anchor so its info box opens our write-up at the
  // passage explaining that input. The ?p= form survives a change of permalink.
  const ARTICLE = { title: 'Read the explanation', url: 'https://taxpolicy.org.uk/?p=31363' };

  // Governing rule: never fit a parameter or a precision choice to reproduce an
  // output, by hand or by algorithm. Inputs come from reported assumptions or
  // independent evidence. Published results live in comparison.js alone.
  const DEFAULTS = Object.freeze({
    spending: 33.2, visits: 43.6 * 33.2 / 33.4, shoppingShare: 25, eligibility: 100,
    vat: 20, takeup: 100, fee: 0,
    passThrough: 100, salience: 100,
    arrivalsElasticity: -1.3, spendingElasticity: -1.6,
    twoElasticities: true,
    multiplier: 2.8, multiplierOnSpending: true,
    ignoreSubstitution: true,
    additionalityDirect: 50, additionalityIndirect: 50, additionalityInduced: 50,
    taxRate: 34.4, ignoreInducedRefundCost: true,
    gvaPerJob: 324e9 / 4.6e6,
    freeMoney: false, voucher: 100
  });
  const GROUPS = [
    { id: 'scenario', title: 'Free money: a test of the method' },
    { id: 'errors', title: 'What we think Cebr got wrong' },
    { id: 'judgment', title: 'Assumptions' },
    { id: 'inputs', title: 'Baseline data' }
  ];
  const number = (key, group, label, min, max, step, unit, note, extra = {}) => ({ key, group, label, type: 'number', min, max, step, unit, note, ...extra });
  const toggle = (key, group, label, note, extra = {}) => ({ key, group, label, type: 'boolean', note, ...extra });
  const choice = (key, group, label, options, unit, note, extra = {}) => ({ key, group, label, type: 'choice', options, unit, note, ...extra });
  // A fixed set, not a free number: every option sits below eligible shopping per
  // visitor, so the goods restriction never binds. £31.90 is Cebr's own cost per visitor.
  const VOUCHER_OPTIONS = Object.freeze([
    {value:0,label:'No voucher'},{value:31.9,label:'£31.90 (cost-matched)'},
    {value:50,label:'£50'},{value:100,label:'£100'},{value:150,label:'£150'}
  ]);
  const CONTROLS = [
    toggle('freeMoney','scenario','Give every visitor a cash voucher instead','Cebr’s method values a policy by one number: how much cheaper it makes a trip. Nothing in it knows that a VAT refund is tied to shopping, and nothing needs to, because money is fungible. So we can hand the method a policy that is transparently not worth doing and see what it says. Switch this on and the refund scheme disappears. In its place every arriving visitor is given a cash voucher to spend on goods. At Cebr’s own assumptions nothing is lost to fees, every claim is made and the whole refund reaches the shopper, which means a refund simply is a cash transfer: set the voucher to the cost-matched £31.90 and every figure on this page matches the refund scheme exactly.',{article:'#free-money'}),
    choice('voucher','scenario','Cash voucher per arriving visitor',VOUCHER_OPTIONS,'£','How much each visitor is handed on arrival. £31.90 is what Cebr’s refund scheme costs the Exchequer, spread equally over every visit, so it is a like-for-like test of the same money spent a different way. The larger amounts are there to show what the method does as the giveaway grows: the tax returned per pound handed over rises rather than falls, and there is no size at which it turns into a loss. Every option stays below the shopping a typical visitor already does, so the restriction to goods never binds.',{enabledBy:'freeMoney',article:'#free-money'}),
    toggle('multiplierOnSpending','errors','Apply the GVA multiplier to spending','Cebr takes a multiplier of 2.8, applies it to everything visitors spend, and treats the answer as GVA. Nothing in the UK generates £2.80 of GVA from £1 of spending. In the ONS input-output tables £1 of final demand produces at most £1 of GVA through direct and supply-chain effects, and that is an accounting ceiling rather than the largest figure observed: GVA, imports and taxes on products sum to exactly £1. Scotland’s tables, which add the induced round, reach £1.32 at most across all 98 industries, and the industries visitors actually spend in sit between 0.5 and 0.9. Cebr says it derives the 2.8 from WTTC data, dividing tourism’s international contribution by international visitor spending. Value added is much smaller than spending: buy a £100 handbag and most of the £100 pays for the bag, often imported, and for other costs. Switch this off and the model converts spending to value added before the multiplier runs, using the 51% that VisitBritain’s tourism study reports.',{page:20,article:'#err-multiplier'}),
    toggle('twoElasticities','errors','Apply two elasticities','Cebr adds two demand responses together: more visitors arrive, and each visitor spends more. Both effects are real. The difficulty is the evidence behind the second. Its −1.6 comes from Gago and others, where it is the response of total visitor spending, and total spending already contains whatever the extra visitors spend. Adding it on top of the arrivals response counts the same money twice. The combination implies a 1% price cut raises total visitor spending by about 3%, against the −0.6 for the UK that Cebr’s own report quotes. Switch this off to apply the spending elasticity once, to total spending, as its source measures it.',{page:19,article:'#err-double-count'}),
    number('fee','errors','Refund fees charged by intermediaries',0,100,1,'%','Refund operators and the shops themselves keep a share of the VAT a visitor reclaims, so the saving reaching the shopper is smaller than the refund leaving the Exchequer. Cebr assumes nothing is taken, which is why this starts at zero. Three figures have been published: 20% used by the OBR in its 2024 review, 36% reported by a Treasury minister in 2023, and 39% in an HMRC survey of people who had tried to claim. The fee changes how strongly visitors respond. It does not reduce what a successful claim costs the Exchequer.',{disabledBy:'freeMoney',source:'obr',page:5,article:'#err-fees'}),
    toggle('ignoreInducedRefundCost','errors','Ignore the cost of refunds on induced spending','VAT is refunded on every qualifying purchase, including purchases by the visitors the scheme itself attracted. Cebr’s text says its £1.4bn covers all of them. Its arithmetic does not. On its own assumptions the whole bill is £1.56bn, and £1.4bn is the cost of refunding purchases that would have happened anyway. Switch this off to charge the whole bill, which costs about £0.17bn more.',{page:21,article:'#err-induced-refunds'}),
    toggle('ignoreSubstitution','errors','Ignore substitution effects','Cebr counts every pound of extra activity as new to the country. That holds only if the workers, premises and equipment were sitting idle in the right places at the right times. Otherwise a shop busy serving a visitor is a shop not serving somebody else, and Britain gains less than the footprint suggests. Switching this off splits the multiplier into the three rounds VisitBritain’s tourism study publishes and lets each be treated separately. Nobody can tell you the right numbers. What the model can tell you is how much of the activity has to be genuinely new before the Exchequer result turns negative.',{page:20,article:'#assume-additionality'}),
    number('additionalityDirect','errors','Shops and hotels: how much is genuinely new',0,100,1,'%','The shops, hotels, restaurants and attractions the visitor actually spends money in. This is money arriving from outside the country, so of the three it has the best claim to being new business rather than business moved from somewhere else in Britain. It is still a judgment. If the staff and the space were already fully occupied, serving a visitor means not serving somebody else.',{disabledBy:'ignoreSubstitution',article:'#assume-additionality'}),
    number('additionalityIndirect','errors','Their suppliers: how much is genuinely new',0,100,1,'%','The wholesaler, the delivery firm, the laundry, the people who made the thing on the shelf. There is no obvious reason this behaves differently from the businesses they supply, so most of the time it should sit at or near the figure on the left.',{disabledBy:'ignoreSubstitution',article:'#assume-additionality'}),
    number('additionalityInduced','errors','Wages their staff spend: how much is genuinely new',0,100,1,'%','The shop assistant gets paid and spends it on a haircut. No money comes into the country at this stage. It is British earnings going round again, so it only adds to national output if there was somebody idle to cut the hair. Leave the other two at 100 and set this one to zero, and the multiplier becomes 2.21, close to the 2.19 that study itself publishes for exactly that case.',{disabledBy:'ignoreSubstitution',source:'visitbritain',page:29,article:'#assume-additionality'}),
    number('arrivalsElasticity','judgment','Arrivals response coefficient',-5,0,0.05,'','How strongly visitor numbers answer a change in the cost of a visit. At −1.3 a 1% fall in cost brings 1.3% more visitors. Cebr takes −1.3 from the British Tourist Authority, but the regression behind it explains real tourism receipts using a trade-weighted exchange rate, not visitor numbers responding to a shopping refund. Cebr’s own regression, in the same report, gives −0.9 for EU visitor numbers.',{page:19,article:'#assume-elasticity',enabledBy:'twoElasticities'}),
    number('spendingElasticity','judgment','Spending response coefficient',-5,0,0.05,'','How strongly spending answers a change in price. Cebr uses −1.6, which follows from the 3.2% fall in total visitor spending after a 2% price rise that it quotes from Gago and others, a simulation of tourism taxes in Spain. Its own regression gives −0.7 for EU visitor spending, and the UK study it cites gives −0.6. Our central case uses −1.0, between the British figures and the Spanish one.',{page:19,article:'#assume-elasticity'}),
    number('taxRate','judgment','Tax raised per £100 of extra output',0,100,0.1,'£','Cebr uses 34.4%, the OECD tax-to-GDP ratio, on gross value added. Converting that average ratio consistently to a GVA basis gives £38.13 per £100. Neither is an estimate of the tax on this particular activity. The point is of limited significance, so our central case retains 34.4% as an illustrative assumption. Varying the yield from £26 to £38 changes the current central fiscal result by about £53m. This is a sensitivity range, not a confidence interval.',{digits:1,page:21,article:'#assume-taxrate'}),
    number('takeup','judgment','Eligible refunds claimed',0,100,1,'%','The share of eligible purchases for which a refund is claimed. Cebr assumes 100%, which it calls an upper bound. The OBR reports £525m of gross refunds in 2019. Relative to £17.8bn of non-EU visitor spending, that is 2.95% before fees. It does not separately identify eligibility and take-up. Our 70% is a conditional assumption alongside 80% eligibility; extending the scheme to EU visitors needs further assumptions about their shopping and claiming behaviour. Take-up also scales the expected price saving in this model.',{disabledBy:'freeMoney',source:'obr',page:4,article:'#assume-takeup'}),
    number('eligibility','judgment','Shopping eligible for a refund',0,100,1,'%','The share of shopping that can produce a refund. Goods must carry VAT and be exported in the traveller’s luggage; both standard-rated and reduced-rated goods can qualify, but zero-rated goods produce no refund. VisitBritain’s shopping categories include books and food as well as clothes and souvenirs. The categories do not measure VAT status or how much is taken home. Our 80% is an illustrative judgment about their composition, not a measured eligibility rate. The model applies the selected VAT rate to the eligible share.',{disabledBy:'freeMoney',page:18,source:'foresight',article:'#assume-eligibility'}),
    number('passThrough','judgment','% of VAT savings passed through to consumers',0,100,1,'%','A visitor can get the full cash refund while a retailer quietly lifts its price or trims a discount, leaving the effective saving smaller than the cash. At 100% the whole refund, after fees, works as a price cut. We use 100% as a reference point rather than a finding: our review of the pass-through evidence turned up nothing that measures this for tourist refunds. Fees come off separately, so this does not deduct them twice.',{source:'passthrough',article:'#assume-passthrough'}),
    number('salience','judgment','Saving anticipated when booking',0,100,1,'%','Somebody might book a trip without knowing the scheme exists, or expecting less back than they eventually get. What drives the decision to travel is the saving expected, not the saving received. Cebr assumes visitors anticipate all of it, which is why this starts at 100%. Nothing we have found measures the gap.',{article:'#method-limits'}),
    number('spending','inputs','Visitor spending',0,100,0.01,'£bn','What overseas visitors spent in Britain in 2025, which everything else is built from. Cebr starts from VisitBritain’s £33.4bn for the whole UK and cuts it to £33.2bn to cover only the places the policy would reach, since Northern Ireland already has a refund scheme.',{digits:2,page:19,article:'#method-refund'}),
    number('visits','inputs','Baseline visits',0.01,100,0.1,'million','Overseas visits in 2025. VisitBritain reports 43.6m for the whole UK. We reduce that on the same basis Cebr reduces spending, because the model covers Great Britain rather than the whole country. Cebr’s report says “43 million”, but that is rounded, and its own per-visitor figures cannot be reproduced from it.',{digits:1,page:19,article:'#method-refund'}),
    number('shoppingShare','inputs','Shopping share of visitor spending',0,100,0.5,'%','How much of what visitors spend goes on shopping rather than hotels, restaurants and travel. Cebr uses 25%, from VisitBritain, and calls it an upper bound on what could qualify for a refund.',{disabledBy:'freeMoney',page:18,article:'#assume-eligibility'}),
    number('vat','inputs','VAT rate',0,30,0.5,'%','The standard rate of VAT. The refundable amount is one sixth of a VAT-inclusive price, not one fifth: £120 on the shelf contains £20 of VAT, not £24.',{disabledBy:'freeMoney',page:19,article:'#method-refund'}),
    number('multiplier','inputs','GVA multiplier',0,5,0.01,'×','How much economic activity each unit of the initial effect generates once suppliers, and then their employees, spend in turn. Cebr states 2.8, which it says it derives from WTTC Economic Impact data by dividing tourism’s international contribution by international visitor spending, averaged over 2013 to 2019. WTTC publishes no split of tourism’s contribution by visitor origin, so that numerator cannot be read off the published data, and Cebr has not shown the calculation. Its own regional table divides to about 2.775 throughout, which makes no practical difference. What matters is what the 2.8 is a multiple of, which is the first switch above.',{digits:2,page:22,article:'#assume-additionality'}),
    number('gvaPerJob','inputs','GVA per supported job',10000,250000,500,'£','Used only to turn the output figure into a headcount. Ours comes from VisitBritain’s 2013 forecast for 2025: £324bn of tourism contribution against nearly 4.6m jobs. Cebr instead uses economy-wide productivity region by region, which we have not rebuilt, so our job numbers are not directly comparable with its own.',{digits:0,source:'visitbritain',page:7,article:'#method-output'})
  ];

  const CORRECTIONS = Object.freeze({
    multiplierOnSpending:false,                              // multiply direct value added, not spending
    twoElasticities:false,                                   // count the spending response once
    fee:20,                                                  // the OBR's fee estimate
    ignoreInducedRefundCost:false                            // charge refunds on induced purchases too
  });
  const PRESETS = Object.freeze({
    cebr: {label:'1. Cebr’s published approach', values:DEFAULTS},
    corrected: {label:'2. Cebr with the errors corrected', values:Object.freeze({...DEFAULTS,...CORRECTIONS})},
    central: {label:'3. Errors corrected, our central assumptions', values:Object.freeze({...DEFAULTS,...CORRECTIONS,spendingElasticity:-1,takeup:70,eligibility:80,ignoreSubstitution:false})},
    // Deliberately built on Cebr's published approach rather than the corrected
    // one, so the error switches can be flipped against it one at a time.
    freeMoney: {label:'4. Free money', values:Object.freeze({...DEFAULTS,freeMoney:true})}
  });
  const isActive = (c, s) => (!c.enabledBy || s[c.enabledBy]) && (!c.disabledBy || !s[c.disabledBy]);
  function normalise(input = {}) {
    const s = {...DEFAULTS}, notices = [];
    if (!input || typeof input!=='object' || Array.isArray(input)) return {settings:s,notices:['Invalid settings object. Default settings used.']};
    for (const c of CONTROLS) {
      if (!Object.prototype.hasOwnProperty.call(input,c.key)) continue;
      const v = input[c.key];
      if (c.type === 'choice') {
        if (typeof v === 'number' && c.options.some(o => o.value === v)) s[c.key] = v;
        else notices.push(`Ignored invalid setting: ${c.label}.`);
      } else if (c.type === 'boolean') {
        if (typeof v === 'boolean') s[c.key] = v;
        else notices.push(`Ignored invalid setting: ${c.label}.`);
      } else if (typeof v === 'number' && Number.isFinite(v)) {
        s[c.key] = Math.max(c.min,Math.min(c.max,v));
        if (s[c.key] !== v) notices.push(`Limited ${c.label} to its allowed range.`);
      } else notices.push(`Ignored invalid setting: ${c.label}.`);
    }
    return {settings:s,notices};
  }
  function calculate(input = {}) {
    const {settings:s,notices} = normalise(input);
    // 1. Recover VAT from VAT-inclusive spending. At 20%, refundable VAT is
    // 20/120, not 20/100. Eligibility and take-up restrict the baseline bill.
    const vatFraction = s.vat/(100+s.vat);
    const eligibleShare = s.shoppingShare/100*s.eligibility/100;
    const eligibleShopping = s.spending*eligibleShare;
    const netShopping = eligibleShopping/(1+s.vat/100);
    // Free money swaps the refund for a flat per-arrival voucher spent on goods.
    // The refund inputs are inert in that mode and the interface greys them out.
    const voucherCost = s.freeMoney ? s.voucher*s.visits/1000 : 0;
    const staticRefunds = s.freeMoney ? 0 : eligibleShopping*vatFraction*s.takeup/100;
    // What the Exchequer pays out before any behavioural response.
    const baselineCost = s.freeMoney ? voucherCost : staticRefunds;
    // 2. Fees cut the traveller's saving but not the gross VAT refunded on a claim.
    // Pass-through applies to the rebate that remains, so no fee is deducted twice.
    const feeFraction = s.fee/100;
    const passThrough = s.passThrough/100;
    const salience = s.salience/100;
    // Post-incidence, so this is an effective price saving rather than cash: a retailer
    // can raise its price and keep part of the benefit. A voucher has no intermediary
    // cut, but pass-through still applies, and arguably applies harder.
    const cashRefundToVisitors = s.freeMoney ? voucherCost : staticRefunds*(1-feeFraction);
    const priceOffset = cashRefundToVisitors*(1-passThrough);
    const visitorSaving = cashRefundToVisitors*passThrough;
    const effectiveConsumerShare = (s.freeMoney ? 1 : 1-feeFraction)*passThrough;
    // Illustrate a successfully claimed £100 eligible purchase. This excludes
    // take-up deliberately: it describes the incidence of a successful claim.
    const per100Purchase = {vat:100*vatFraction,fees:100*vatFraction*feeFraction,
      cashRefund:100*vatFraction*(1-feeFraction),
      priceOffset:100*vatFraction*(1-feeFraction)*(1-passThrough),
      effectiveSaving:100*vatFraction*effectiveConsumerShare};
    // Judged against spending in Britain. Fares are excluded because the elasticities
    // in use were estimated against destination prices, not whole-trip cost.
    const denominator = s.spending;
    const discount = denominator > 0 ? visitorSaving*salience/denominator : 0;
    // 3. Linear elasticities, as in the published arithmetic. Coefficients are negative
    // and discount is a positive price cut, hence -e*d. The whole response is applied;
    // a first-year phase-in is recorded in the methodology rather than modelled.
    const phase = 1;
    const arrivalsCoefficient = s.arrivalsElasticity;
    const spendingCoefficient = s.spendingElasticity;
    const arrivalsGrowth = s.twoElasticities ? -arrivalsCoefficient*discount*phase : null;
    const spendingGrowth = -spendingCoefficient*discount*phase;
    const extraVisits = arrivalsGrowth === null ? null : s.visits*arrivalsGrowth;
    const arrivalsSpending = arrivalsGrowth === null ? null : s.spending*arrivalsGrowth;
    const originalVisitorsSpending = s.spending*spendingGrowth;
    // 4. Total spending is visits times spend per visitor, so with both responses
    // running the growth rates compound: S[(1+a)(1+b)-1]. The interaction term is a
    // hypothesis about Cebr's workbook. Aggregate spending cannot identify arrivals.
    const interaction = s.twoElasticities ? arrivalsSpending*spendingGrowth : 0;
    const spendingTerm = originalVisitorsSpending+interaction;
    const extraSpending = s.twoElasticities ? arrivalsSpending+spendingTerm : originalVisitorsSpending;
    // 5. Cebr applies the multiplier straight to spending. The switch inserts direct UK
    // GVA first; imports and inputs belong in that conversion, not deducted again.
    const directGva = extraSpending*(s.multiplierOnSpending ? 1 : DIRECT_VALUE_ADDED);
    const grossGva = directGva*s.multiplier;
    // Additionality is separate from the sales-to-GVA conversion and runs round by
    // round: the first two rounds are met from new outside demand, the employee round
    // is domestic income recycled. A reduced form, with no wages, prices or capacity.
    const additionalShare = s.ignoreSubstitution
      ? 1
      : ROUNDS.direct*s.additionalityDirect/100
        + ROUNDS.indirect*s.additionalityIndirect/100
        + ROUNDS.induced*s.additionalityInduced/100;
    const gva = grossGva*additionalShare;
    const jobs = gva*1e9/s.gvaPerJob;
    // 6. The average tax/GDP shortcut, kept for reproduction. Not a tax-by-tax
    // counterfactual for VAT, income tax, NICs and corporation tax.
    const taxRate = s.taxRate/100;
    const tax = gva*taxRate;
    // 7. Cebr is inconsistent about refund scope, so both ledgers are carried. Its
    // £1.4bn and £2.6bn can only come from the baseline bill; on its own assumptions the
    // whole bill is £1.56bn. We follow the stated scope: induced VAT is forgone too.
    const potentialInducedRefunds = s.freeMoney ? 0 : extraSpending*eligibleShare*vatFraction*s.takeup/100;
    // A voucher is paid per arrival, so with one aggregate elasticity there is no
    // arrivals estimate and the induced cost is unestimated rather than zero.
    const potentialInducedCost = s.freeMoney
      ? (extraVisits === null ? null : extraVisits*s.voucher/1000)
      : potentialInducedRefunds;
    const chargeableInduced = potentialInducedCost === null ? 0 : potentialInducedCost;
    const inducedRefunds = s.ignoreInducedRefundCost ? 0 : chargeableInduced;
    const refunds = baselineCost+inducedRefunds;
    const totalRefunds = baselineCost+chargeableInduced;
    // No running cost is modelled. The methodology records why.
    const admin = 0;
    const netFiscal = tax-refunds-admin;
    // Both ledger lines, so Cebr's figures can be matched to the one each uses.
    const netFiscalBaselineRefunds = tax-baselineCost-admin;
    const netFiscalTotalRefunds = tax-totalRefunds-admin;
    // With no refunds a ratio is undefined, rather than zero or infinity.
    const ratio = (n,d) => d > 0 ? n/d : null;
    const taxPerRefund = ratio(tax,refunds);
    const grossPerBaselineRefund = ratio(tax,baselineCost);
    const netPerBaselineRefund = ratio(netFiscalBaselineRefunds,baselineCost);
    const grossPerTotalRefund = ratio(tax,totalRefunds);
    const netPerTotalRefund = ratio(netFiscalTotalRefunds,totalRefunds);
    const messages = [];
    return {settings:s,notices,messages,vatFraction,eligibleShopping,netShopping,voucherCost,baselineCost,potentialInducedCost,
      shoppingPerVisitor:eligibleShopping*1000/s.visits,netShoppingPerVisitor:netShopping*1000/s.visits,
      vatPerVisitor:(eligibleShopping-netShopping)*1000/s.visits,
      staticRefunds,cashRefundToVisitors,priceOffset,effectiveConsumerShare,per100Purchase,visitorSaving,denominator,discount,arrivalsGrowth,spendingGrowth,extraVisits,
      totalVisits:extraVisits === null ? null : s.visits+extraVisits,arrivalsSpending,originalVisitorsSpending,interaction,spendingTerm,
      extraSpending,directGva,grossGva,additionalShare,effectiveMultiplier:s.multiplier*additionalShare,gva,jobs,tax,inducedRefunds,potentialInducedRefunds,refunds,totalRefunds,admin,netFiscal,
      netFiscalBaselineRefunds,netFiscalTotalRefunds,taxPerRefund,
      grossPerBaselineRefund,netPerBaselineRefund,grossPerTotalRefund,netPerTotalRefund};
  }
  function presetName(s) { return Object.keys(PRESETS).find(k=>CONTROLS.every(c=>s[c.key]===PRESETS[k].values[c.key])) || 'custom'; }
  function encode(s) { return encodeURIComponent(JSON.stringify({v:VERSION,settings:normalise(s).settings})); }
  const isSectionAnchor = hash => ['#assumptions','#reconciliation'].includes(hash);
  function decode(hash) {
    if (!hash || isSectionAnchor(hash)) return {settings:{...DEFAULTS},notices:[]};
    try {
      const parsed=JSON.parse(decodeURIComponent(hash.replace(/^#/,'')));
      if (parsed.v!==VERSION || !parsed.settings || typeof parsed.settings!=='object' || Array.isArray(parsed.settings)) throw new Error();
      return normalise(parsed.settings);
    } catch { return {settings:{...DEFAULTS},notices:['This scenario link is not supported. The current default settings have been restored.']}; }
  }
  return {VERSION,SOURCES,DISCUSSION,ARTICLE,DEFAULTS,GROUPS,CONTROLS,DIRECT_VALUE_ADDED,PRESETS,VOUCHER_OPTIONS,calculate,normalise,isActive,presetName,encode,decode,isSectionAnchor};
});
